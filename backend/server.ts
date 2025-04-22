import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import postRoutes from './routes/posts';
import usersRouter from "./routes/users"; // Add this import
import { db } from "./database";
import http from 'http';
import { Server } from 'socket.io';
import { User, ShopItem, RouteDependencies } from './types'; // Import interfaces
import { InventoryItem } from './types'; // Import interface
import express, { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import multer from 'multer';
import dmRoutes from "./routes/dms"; // chats
import settingsRouter from "./routes/settings"; // for settings 
import notificationsRouter from "./routes/notifications"; // Add this


dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || "teenverse_secret";

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});

const upload = multer({
    storage,
    fileFilter: (req: Request, file: Express.Multer.File, cb: (error: Error | null, acceptFile: boolean) => void) => {
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed!'), false);
        }
    },
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
});

// Create HTTP server and integrate Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Adjust for production
        methods: ["GET", "POST"]
    }
});

// Middleware to authenticate JWT token
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log(`[${new Date().toISOString()}] No token provided for ${req.path}`);
        return res.status(401).json({ message: "Authentication token required" });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY) as { email: string, verified: number };
        req.user = decoded;

        // Fetch user ID to include in req.user for endpoints that need it
        db.get("SELECT id FROM users WHERE email = ?", [decoded.email], (err, row: any) => {
            if (err) {
                console.error(`[${new Date().toISOString()}] Error fetching user ID in authenticateToken:`, err);
                return res.status(500).json({ message: "Internal server error" });
            }
            if (!row) {
                return res.status(404).json({ message: "User not found" });
            }
            req.user.id = row.id;
            console.log(`[${new Date().toISOString()}] Token verified for ${req.path}, user: ${decoded.email}, id: ${row.id}`);
            next();
        });
    } catch (err) {
        console.log(`[${new Date().toISOString()}] Token verification failed for ${req.path}: ${err.message}`);
        return res.status(403).json({ message: "Invalid or expired token" });
    }
};

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const routeDependencies: RouteDependencies = {
    db,
    SECRET_KEY
};

const processVideo = (inputPath: string, outputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Get video duration
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
            if (err) {
                return reject(new Error('Error reading video metadata: ' + err.message));
            }

            const duration = metadata.format.duration;
            if (!duration || duration > 90) {
                return reject(new Error('Video duration exceeds 90 seconds'));
            }

            // Compress video
            ffmpeg(inputPath)
                .output(outputPath)
                .videoCodec('libx264')
                .audioCodec('aac')
                .size('1280x720') // Resize to 720p
                .videoBitrate('1500k') // Lower bitrate for compression
                .audioBitrate('128k')
                .on('end', () => resolve(outputPath))
                .on('error', (err) => reject(new Error('Error compressing video: ' + err.message)))
                .run();
        });
    });
};

// Use post routes with authentication middleware
app.use('/api/posts', authenticateToken, postRoutes);
app.use("/api/users", authenticateToken, usersRouter);
app.use("/api/dms", authenticateToken, dmRoutes(routeDependencies)); // Add this
app.use("/api/settings", authenticateToken, settingsRouter); // Add this


// Socket.IO setup for real-time voting
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a battle room for live updates
    socket.on('join_battle', (battleId) => {
        socket.join(`battle-${battleId}`);
        console.log(`User ${socket.id} joined battle-${battleId}`);
    });

    // Leave a battle room
    socket.on('leave_battle', (battleId) => {
        socket.leave(`battle-${battleId}`);
        console.log(`User ${socket.id} left battle-${battleId}`);
    });

    // Broadcast vote updates
    socket.on('vote_battle', async (data) => {
        const { battleId, voteFor } = data;
        try {
            const battle = await new Promise<any>((resolve, reject) => {
                db.get("SELECT votes, opponent_votes FROM hype_battles WHERE id = ?", [battleId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });

            if (voteFor === "creator") {
                await new Promise<void>((resolve, reject) => {
                    db.run("UPDATE hype_battles SET votes = votes + 1 WHERE id = ?", [battleId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
            } else {
                await new Promise<void>((resolve, reject) => {
                    db.run("UPDATE hype_battles SET opponent_votes = opponent_votes + 1 WHERE id = ?", [battleId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
            }

            const updatedBattle = await new Promise<any>((resolve, reject) => {
                db.get("SELECT votes, opponent_votes FROM hype_battles WHERE id = ?", [battleId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });

            io.to(`battle-${battleId}`).emit('vote_update', updatedBattle);
        } catch (err) {
            console.error("Vote broadcast error:", err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Endpoint to fetch rants
// Fetch rants
app.get("/api/rants", authenticateToken, async (req, res) => {
    try {
        const { category } = req.query;
        let query = "SELECT * FROM rants";
        let params: any[] = [];

        if (category && typeof category === "string") {
            query += " WHERE category = ?";
            params.push(category);
        }

        query += " ORDER BY created_at DESC";

        const rants: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        // Fetch comments for each rant
        const rantsWithComments = await Promise.all(
            rants.map(async (rant) => {
                const comments = await new Promise<any[]>((resolve, reject) => {
                    db.all(
                        "SELECT * FROM rant_comments WHERE rant_id = ? ORDER BY created_at ASC",
                        [rant.id],
                        (err, rows) => {
                            if (err) reject(err);
                            resolve(rows);
                        }
                    );
                });
                return { ...rant, comments };
            })
        );

        console.log(`[${new Date().toISOString()}] /api/rants returned ${rantsWithComments.length} rants`);
        res.json(rantsWithComments);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch rants error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create a rant
app.post("/api/create-rant", authenticateToken, async (req, res) => {
    try {
        const { email, content, category, askForAdvice } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, xp, coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Validate category
        const validCategories = [
            "School Life",
            "Family Drama",
            "Relationship Wahala",
            "Self-Doubt & Mental Struggles",
            "Fake Friends",
            "Pressure & Anxiety",
            "Just Need to Vent"
        ];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ message: "Invalid category" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO rants (content, category, ask_for_advice) VALUES (?, ?, ?)",
                [content, category, askForAdvice ? 1 : 0],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Award XP and coins
        let xpBonus = 5;
        let coinBonus = 5;
        if (email === "restorationmichael3@gmail.com") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: `Rant posted anonymously! +${xpBonus} XP and +${coinBonus} coins`, newXP, newCoins });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Create rant error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Upvote a rant
app.post("/api/upvote-rant", authenticateToken, async (req, res) => {
    try {
        const { email, rantId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const rant: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM rants WHERE id = ?", [rantId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!rant) return res.status(404).json({ message: "Rant not found" });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE rants SET upvotes = upvotes + 1 WHERE id = ?", [rantId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: "Upvoted successfully!" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Upvote rant error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add a reaction to a rant
app.post("/api/react-to-rant", authenticateToken, async (req, res) => {
    try {
        const { email, rantId, reaction } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const validReactions = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];
        if (!validReactions.includes(reaction)) {
            return res.status(400).json({ message: "Invalid reaction" });
        }

        const rant: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT reactions FROM rants WHERE id = ?", [rantId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!rant) return res.status(404).json({ message: "Rant not found" });

        // Parse reactions (stored as JSON string)
        let reactions: { [key: string]: number } = {};
        try {
            reactions = JSON.parse(rant.reactions || "{}");
        } catch (e) {
            console.error("Error parsing reactions:", e);
        }

        // Increment the reaction count
        reactions[reaction] = (reactions[reaction] || 0) + 1;

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE rants SET reactions = ? WHERE id = ?",
                [JSON.stringify(reactions), rantId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Reaction added!" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] React to rant error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Send an anonymous hug
app.post("/api/send-hug", authenticateToken, async (req, res) => {
    try {
        const { email, rantId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const rant: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM rants WHERE id = ?", [rantId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!rant) return res.status(404).json({ message: "Rant not found" });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE rants SET hugs = hugs + 1 WHERE id = ?", [rantId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: "Hug sent! 💖" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Send hug error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add a comment to a rant
app.post("/api/add-comment", authenticateToken, async (req, res) => {
    try {
        const { email, rantId, content } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const rant: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM rants WHERE id = ?", [rantId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!rant) return res.status(404).json({ message: "Rant not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO rant_comments (rant_id, content) VALUES (?, ?)",
                [rantId, content],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Comment added anonymously!" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Add comment error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Register endpoint
app.post("/api/register", async (req, res) => {
    try {
        const { email, username, password, dob } = req.body;

        if (!email || !username || !password || !dob) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
            return res.status(400).json({ message: "Invalid date of birth format. Use YYYY-MM-DD." });
        }

        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        if (age < 13 || age > 19) {
            return res.status(400).json({ message: "Get Out, Oldie. This Ain’t for You" });
        }

        const existingUser: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT email, username FROM users WHERE email = ? OR username = ?", [email, username], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        if (existingUser) {
            if (existingUser.email === email) {
                return res.status(400).json({ message: "Email already exists" });
            }
            if (existingUser.username === username) {
                return res.status(400).json({ message: "Username already taken" });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO users (email, username, password, dob, verified) VALUES (?, ?, ?, ?, ?)",
                [email, username, hashedPassword, dob, 0],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Registered successfully!" });
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ email: user.email, verified: user.verified }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ token, message: "Login successful", username: user.username });
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get user data (for verifying token) - Modified to include creator_badge
app.get("/api/users/me", authenticateToken, async (req: any, res) => {
    try {
        const user = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, email, username, creator_badge FROM users WHERE email = ?", [req.user.email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json(user);
    } catch (err) {
        console.error("Get user data error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create post endpoint (used for rants as well) - Modified to give bonus XP/coins to creator
app.post("/api/create-post", authenticateToken, async (req, res) => {
    try {
        const { email, content, mode } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username, xp, coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const postMode = mode || "main";
        console.log(`[${new Date().toISOString()}] Creating post for user ${user.username}: mode=${postMode}, content=${content}`);

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO posts (user_id, username, content, mode) VALUES (?, ?, ?, ?)",
                [user.id, user.username, content, postMode],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        let xpBonus = 5;
        let coinBonus = 5;

        if (email === "restorationmichael3@gmail.com") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET xp = ? WHERE id = ?", [newXP, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        const newCoins = user.coins + coinBonus;
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET coins = ? WHERE id = ?", [newCoins, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: `Post created! +${xpBonus} XP and +${coinBonus} coins`, newXP, newCoins });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Create post error:`, err);
        res.status(500).json({ message: "Error creating post" });
    }
});

// Get coins endpoint
app.post("/api/get-coins", authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ coins: user.coins });
    } catch (err) {
        console.error("Get coins error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Buy coins endpoint (placeholder)
app.post("/api/buy-coins", authenticateToken, (req, res) => {
    res.json({ message: "Buying coins is not available yet." });
});

// Daily login endpoint
app.post("/api/daily-login", authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const today = new Date().toISOString().split("T")[0];
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT xp, last_login FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.last_login !== today) {
            const newXP = user.xp + 10;
            await new Promise<void>((resolve, reject) => {
                db.run(
                    "UPDATE users SET xp = ?, last_login = ? WHERE email = ?",
                    [newXP, today, email],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });
            return res.json({ message: "+10 XP for daily login!", newXP });
        }

        res.json({ message: "Already claimed XP today!" });
    } catch (err) {
        console.error("Daily login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get user stats endpoint
app.post("/api/get-user-stats", authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT xp FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const { level, rank } = calculateLevel(user.xp);
        res.json({ xp: user.xp, level, rank });
    } catch (err) {
        console.error("Get user stats error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get snitch status endpoint
app.post("/api/get-snitch-status", authenticateToken, async (req, res) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT snitch_status FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ snitchStatus: user.snitch_status || "clean" });
    } catch (err) {
        console.error("Get snitch status error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Calculate level and rank
function calculateLevel(xp: number): { level: number; rank: string } {
    let level = Math.floor(xp / 10) + 1;
    if (level > 100) level = 100;

    let rank = "Newbie";
    if (level >= 11) rank = "Rising Star";
    if (level >= 26) rank = "Clout Lord";
    if (level >= 51) rank = "Elite";
    if (level >= 76) rank = "Titan";
    if (level >= 100) rank = "Shadow Rank";

    return { level, rank };
}

// Check snitch status (runs daily)
function checkSnitchStatus() {
    db.all("SELECT id, xp FROM users", [], (err: Error | null, users: any[]) => {
        if (err) {
            console.error("Snitch status check error:", err);
            return;
        }
        users.forEach((user) => {
            db.get(
                "SELECT SUM(xp) as weekly_xp FROM posts WHERE user_id = ? AND created_at >= datetime('now', '-7 days')",
                [user.id],
                (err: Error | null, data: any) => {
                    if (err) {
                        console.error("Snitch status query error:", err);
                        return;
                    }
                    const weeklyXP = data?.weekly_xp || 0;
                    const snitchStatus = weeklyXP < 50 ? "Potential Snitch" : "clean";

                    db.run("UPDATE users SET snitch_status = ? WHERE id = ?", [snitchStatus, user.id], (err: Error | null) => {
                        if (err) console.error("Snitch status update error:", err);
                    });
                }
            );
        });
    });
}

setInterval(checkSnitchStatus, 86400000);

// Like a post endpoint
app.post("/api/like", authenticateToken, async (req, res) => {
    try {
        const { postId, email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const userId = user.id;

        const existingLike: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM likes WHERE post_id = ? AND user_id = ?", [postId, userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingLike) {
            return res.status(400).json({ message: "Already liked this post" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run("INSERT INTO likes (post_id, user_id) VALUES (?, ?)", [postId, userId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        const post: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT likes, mode FROM posts WHERE id = ?", [postId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const totalLikes: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT SUM(likes) as total FROM posts WHERE user_id = ?", [userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (totalLikes.total >= 100) {
            await new Promise<void>((resolve, reject) => {
                db.run(
                    "INSERT INTO badges (user_id, news_king) VALUES (?, 1) ON CONFLICT(user_id) DO UPDATE SET news_king = 1",
                    [userId],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });
        }

        res.json({ message: "Post liked" });
    } catch (err) {
        console.error("Like error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Game Squad endpoints - Modified to sort by is_featured
app.get("/api/game-squads", authenticateToken, async (req, res) => {
    try {
        const squads: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT g.*, u.username as actual_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.is_featured DESC, g.created_at DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        console.log(`[${new Date().toISOString()}] /api/game-squads returned ${squads.length} squads`);
        res.json(squads);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Get game squads error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/game-squads", authenticateToken, async (req, res) => {
    try {
        const { email, gameName, uid, description } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username, xp, coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const squad = await new Promise<any>((resolve, reject) => {
            db.run(
                "INSERT INTO game_squads (user_id, username, game_name, uid, description, status, max_members, wins, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [user.id, user.username, gameName, uid, description, "open", 5, 0, new Date()],
                function (err) {
                    if (err) reject(err);
                    resolve({ id: this.lastID });
                }
            );
        });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES (?, ?, ?)",
                [squad.id, user.id, new Date()],
                (err) => {
                    if (err) {
                        console.error(`[${new Date().toISOString()}] Error adding creator to squad_members:`, err);
                        reject(err);
                    }
                    resolve();
                }
            );
        });

        let xpBonus = 10;
        let coinBonus = 10;
        if (email === "restorationmichael3@gmail.com") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: `Game squad created! +${xpBonus} XP and +${coinBonus} coins`, squadId: squad.id, newXP, newCoins });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Create game squad error:`, err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

app.post("/api/game-squads/join", authenticateToken, async (req, res) => {
    try {
        const { email, squadId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const squad: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT status, max_members FROM game_squads WHERE id = ?", [squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.status === "closed") return res.status(400).json({ message: "Squad is closed to new members" });

        const memberCount: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM squad_members WHERE squad_id = ?", [squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (memberCount.count >= squad.max_members) {
            return res.status(400).json({ message: "Squad is full" });
        }

        const alreadyMember: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?", [squadId, user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (alreadyMember) return res.status(400).json({ message: "You are already a member of this squad" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO squad_members (squad_id, user_id, joined_at) VALUES (?, ?, ?)",
                [squadId, user.id, new Date()],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Joined squad successfully!" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error joining squad:`, err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

app.post("/api/game-squads/manage-status", authenticateToken, async (req, res) => {
    try {
        const { email, squadId, newStatus } = req.body;

        if (email !== "restorationmichael3@gmail.com") {
            return res.status(403).json({ message: "Only the platform creator can manage squad status" });
        }

        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!["open", "closed"].includes(newStatus)) {
            return res.status(400).json({ message: "Invalid status. Must be 'open' or 'closed'." });
        }

        const squad: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM game_squads WHERE id = ?", [squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!squad) return res.status(404).json({ message: "Squad not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE game_squads SET status = ? WHERE id = ?",
                [newStatus, squadId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: `Squad status updated to ${newStatus}!` });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error managing squad status:`, err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

app.post("/api/game-squads/feature", authenticateToken, async (req, res) => {
    try {
        const { email, squadId, feature } = req.body;

        if (email !== "restorationmichael3@gmail.com") {
            return res.status(403).json({ message: "Only the platform creator can feature squads" });
        }

        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const isFeatured = feature ? 1 : 0;

        const squad: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM game_squads WHERE id = ?", [squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!squad) return res.status(404).json({ message: "Squad not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE game_squads SET is_featured = ? WHERE id = ?",
                [isFeatured, squadId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: `Squad ${isFeatured ? 'featured' : 'unfeatured'} successfully!` });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error featuring squad:`, err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

app.get("/api/game-squads/leaderboard", authenticateToken, async (req, res) => {
    try {
        const leaderboard: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT g.*, u.username as creator_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.wins DESC LIMIT 10",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json(leaderboard);
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/game-squads/report-win", authenticateToken, async (req, res) => {
    try {
        const { email, squadId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, xp, coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const squad: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT user_id FROM game_squads WHERE id = ?", [squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.user_id !== user.id) return res.status(403).json({ message: "Only the squad creator can report a win" });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE game_squads SET wins = wins + 1 WHERE id = ?", [squadId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        let xpBonus = 5;
        let coinBonus = 5;
        if (email === "restorationmichael3@gmail.com") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: `Win reported successfully! +${xpBonus} XP and +${coinBonus} coins`, newXP, newCoins });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/platform-analytics", authenticateToken, async (req, res) => {
    try {
        const { email } = req.user;

        if (email !== "restorationmichael3@gmail.com") {
            return res.status(403).json({ message: "Only the platform creator can access analytics" });
        }

        const totalUsers: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const totalSquads: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM game_squads", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const totalPosts: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT COUNT(*) as count FROM posts", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const popularGames: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT game_name, COUNT(*) as count FROM game_squads GROUP BY game_name ORDER BY count DESC LIMIT 5",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json({
            totalUsers: totalUsers.count,
            totalSquads: totalSquads.count,
            totalPosts: totalPosts.count,
            popularGames,
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching platform analytics:`, err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

app.post("/api/tournaments", authenticateToken, async (req, res) => {
    try {
        const { email, squadId, title, description, gameName } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const squad: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT user_id FROM game_squads WHERE id = ?", [squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.user_id !== user.id) return res.status(403).json({ message: "Only the squad creator can create a tournament" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO tournaments (squad_id, title, description, game_name) VALUES (?, ?, ?, ?)",
                [squadId, title, description, gameName],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Tournament created successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/tournaments/join", authenticateToken, async (req, res) => {
    try {
        const { email, tournamentId, squadId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const squad: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT user_id FROM game_squads WHERE id = ?", [squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!squad) return res.status(404).json({ message: "Squad not found" });
        if (squad.user_id !== user.id) return res.status(403).json({ message: "Only the squad creator can join a tournament" });

        const tournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT status, squad_id FROM tournaments WHERE id = ?", [tournamentId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        if (tournament.status !== "open") return res.status(400).json({ message: "Tournament is not open for joining" });
        if (tournament.squad_id === squadId) return res.status(400).json({ message: "You cannot join your own tournament" });

        const alreadyJoined: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM tournament_participants WHERE tournament_id = ? AND squad_id = ?", [tournamentId, squadId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (alreadyJoined) return res.status(400).json({ message: "Your squad is already in this tournament" });

        await new Promise<void>((resolve, reject) => {
            db.run("INSERT INTO tournament_participants (tournament_id, squad_id) VALUES (?, ?)", [tournamentId, squadId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: "Joined tournament successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/tournaments/declare-winner", authenticateToken, async (req, res) => {
    try {
        const { email, tournamentId, winnerId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, xp, coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const tournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT squad_id, status FROM tournaments WHERE id = ?", [tournamentId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        if (tournament.status === "completed") return res.status(400).json({ message: "Tournament is already completed" });

        const creatorSquad: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT user_id FROM game_squads WHERE id = ?", [tournament.squad_id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (creatorSquad.user_id !== user.id) return res.status(403).json({ message: "Only the tournament creator can declare a winner" });

        const participant: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM tournament_participants WHERE tournament_id = ? AND squad_id = ?", [tournamentId, winnerId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!participant && winnerId !== tournament.squad_id) return res.status(400).json({ message: "Winner must be a participant in the tournament" });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE tournaments SET status = 'completed', winner_id = ? WHERE id = ?", [winnerId, tournamentId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE game_squads SET wins = wins + 1 WHERE id = ?", [winnerId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        let xpBonus = 5;
        let coinBonus = 5;
        if (email === "restorationmichael3@gmail.com") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: `Winner declared successfully! +${xpBonus} XP and +${coinBonus} coins`, newXP, newCoins });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/tournaments", authenticateToken, async (req, res) => {
    try {
        const tournaments: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT t.*, g.game_name as squad_game_name, g.username as creator_username FROM tournaments t JOIN game_squads g ON t.squad_id = g.id ORDER BY t.created_at DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        for (const tournament of tournaments) {
            const participants: any[] = await new Promise<any[]>((resolve, reject) => {
                db.all(
                    "SELECT g.id, g.game_name, g.username FROM tournament_participants tp JOIN game_squads g ON tp.squad_id = g.id WHERE tp.tournament_id = ?",
                    [tournament.id],
                    (err, rows) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });
            tournament.participants = participants;
        }

        res.json(tournaments);
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post('/api/game-clips', authenticateToken, upload.single('clip'), async (req, res) => {
    try {
        const { email, squadId, description } = req.body;
        const file = req.file;

        if (req.user.email !== email) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (!file) {
            return res.status(400).json({ message: 'No video file uploaded' });
        }

        if (!squadId || !description) {
            return res.status(400).json({ message: 'Squad ID and description are required' });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) {
            fs.unlinkSync(file.path); // Clean up uploaded file
            return res.status(404).json({ message: 'User not found' });
        }

        const isMember: any = await new Promise<any>((resolve, reject) => {
            db.get('SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?', [squadId, user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const isCreator: any = await new Promise<any>((resolve, reject) => {
            db.get('SELECT id FROM game_squads WHERE id = ? AND user_id = ?', [squadId, user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!isMember && !isCreator) {
            fs.unlinkSync(file.path); // Clean up uploaded file
            return res.status(403).json({ message: 'You must be a member of this squad to upload a clip' });
        }

        // Process video (check duration and compress)
        const outputPath = path.join(__dirname, 'uploads', `processed-${file.filename}`);
        await processVideo(file.path, outputPath);

        // Upload to Cloudinary
        const cloudinaryResult = await cloudinary.uploader.upload(outputPath, {
            resource_type: 'video',
            folder: 'teenverse/game-clips',
            timeout: 60000,
        });

        // Clean up temporary files
        fs.unlinkSync(file.path);
        fs.unlinkSync(outputPath);

        // Store Cloudinary URL in database
        const clipUrl = cloudinaryResult.secure_url;
        await new Promise<void>((resolve, reject) => {
            db.run(
                'INSERT INTO game_clips (squad_id, user_id, clip_url, description) VALUES (?, ?, ?, ?)',
                [squadId, user.id, clipUrl, description],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: 'Game clip uploaded successfully!', clipUrl });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path); // Clean up uploaded file on error
        }
        const outputPath = req.file ? path.join(__dirname, 'uploads', `processed-${req.file.filename}`) : '';
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath); // Clean up processed file on error
        }
        console.error(`[${new Date().toISOString()}] Upload clip error:`, err);
        res.status(500).json({ message: err.message || 'Internal server error' });
    }
});

app.get('/api/game-clips/:squadId', authenticateToken, async (req, res) => {
    try {
        const squadId = req.params.squadId;
        const clips: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                'SELECT gc.*, u.username FROM game_clips gc JOIN users u ON gc.user_id = u.id WHERE gc.squad_id = ? ORDER BY gc.created_at DESC',
                [squadId],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        console.log(`[${new Date().toISOString()}] Fetched ${clips.length} clips for squad ${squadId}`);
        res.json(clips);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch clips error:`, err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.post("/api/squad-messages", authenticateToken, async (req, res) => {
    try {
        const { email, squadId, message } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const isMember: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?", [squadId, user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const isCreator: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM game_squads WHERE id = ? AND user_id = ?", [squadId, user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!isMember && !isCreator) return res.status(403).json({ message: "You must be a member of this squad to send messages" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO squad_messages (squad_id, user_id, message) VALUES (?, ?, ?)",
                [squadId, user.id, message],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Message sent successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/squad-messages/:squadId", authenticateToken, async (req: any, res) => {
    try {
        const { squadId } = req.params;
        const userId = req.user.id;

        const membership = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT * FROM squad_members WHERE squad_id = ? AND user_id = ?",
                [squadId, userId],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!membership) {
            return res.status(403).json({ message: "You are not a member of this squad" });
        }

        const messages = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT sm.*, u.username FROM squad_messages sm JOIN users u ON sm.user_id = u.id WHERE sm.squad_id = ? ORDER BY sm.created_at ASC",
                [squadId],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.status(200).json(messages);
    } catch (err) {
        console.error("Error fetching squad messages:", err);
        res.status(500).json({ message: "Error fetching squad messages" });
    }
});

// Team Endpoints for Hype Battles
app.post("/api/teams", authenticateToken, async (req, res) => {
    try {
        const { email, name } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const team = await new Promise<any>((resolve, reject) => {
            db.run(
                "INSERT INTO teams (name, creator_id) VALUES (?, ?)",
                [name, user.id],
                function (err) {
                    if (err) reject(err);
                    resolve({ id: this.lastID });
                }
            );
        });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)",
                [team.id, user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Team created!", teamId: team.id });
    } catch (err) {
        console.error("Create team error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/teams/join", authenticateToken, async (req, res) => {
    try {
        const { email, teamId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const alreadyMember = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT * FROM team_members WHERE team_id = ? AND user_id = ?",
                [teamId, user.id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (alreadyMember) return res.status(400).json({ message: "Already a member of this team" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO team_members (team_id, user_id) VALUES (?, ?)",
                [teamId, user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Joined team successfully!" });
    } catch (err) {
        console.error("Join team error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/teams", authenticateToken, async (req, res) => {
    try {
        const teams = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT t.*, u.username as creator_username FROM teams t JOIN users u ON t.creator_id = u.id",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json(teams);
    } catch (err) {
        console.error("Get teams error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Hype Battles Endpoints
app.get("/api/hype-battles", authenticateToken, async (req, res) => {
    try {
        const { category, isLive } = req.query;
        let query = "SELECT h.*, u.username as actual_username FROM hype_battles h JOIN users u ON h.user_id = u.id WHERE h.closed = 0";
        const params = [];

        if (category) {
            query += " AND h.category = ?";
            params.push(category);
        }
        if (isLive) {
            query += " AND h.is_live = ?";
            params.push(isLive === "true" ? 1 : 0);
        }

        query += " ORDER BY h.created_at DESC";

        const battles = await new Promise<any[]>((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        console.log(`[${new Date().toISOString()}] /api/hype-battles returned ${battles.length} battles`);
        res.json(battles);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Get hype battles error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/hype-battle", authenticateToken, async (req, res) => {
    try {
        const { email, category, content, mediaUrl, opponentId, teamId, opponentTeamId, isLive } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const validCategories = ["Rap Battle", "Dance-off", "Meme Creation", "Artistic Speed Drawing", "Beat-making Face-off"];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ message: "Invalid battle category" });
        }

        if (opponentId) {
            const opponent = await new Promise<any>((resolve, reject) => {
                db.get("SELECT id FROM users WHERE id = ?", [opponentId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!opponent) return res.status(404).json({ message: "Opponent not found" });
        }

        if (teamId) {
            const team = await new Promise<any>((resolve, reject) => {
                db.get("SELECT id FROM teams WHERE id = ?", [teamId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!team) return res.status(404).json({ message: "Team not found" });
        }
        if (opponentTeamId) {
            const opponentTeam = await new Promise<any>((resolve, reject) => {
                db.get("SELECT id FROM teams WHERE id = ?", [opponentTeamId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!opponentTeam) return res.status(404).json({ message: "Opponent team not found" });
        }

        const votingDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const battle = await new Promise<any>((resolve, reject) => {
            db.run(
                "INSERT INTO hype_battles (user_id, username, opponent_id, team_id, opponent_team_id, category, content, media_url, is_live, voting_deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [user.id, user.username, opponentId || null, teamId || null, opponentTeamId || null, category, content, mediaUrl, isLive ? 1 : 0, votingDeadline],
                function (err) {
                    if (err) reject(err);
                    resolve({ id: this.lastID });
                }
            );
        });

        res.json({ message: "Battle created!", battleId: battle.id });
    } catch (err) {
        console.error("Create hype battle error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/hype-battle/respond", authenticateToken, async (req, res) => {
    try {
        const { email, battleId, content, mediaUrl } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const battle = await new Promise<any>((resolve, reject) => {
            db.get("SELECT opponent_id, closed FROM hype_battles WHERE id = ?", [battleId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!battle) return res.status(404).json({ message: "Battle not found" });
        if (battle.closed) return res.status(400).json({ message: "Battle is closed" });
        if (battle.opponent_id !== user.id) return res.status(403).json({ message: "You are not the opponent for this battle" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE hype_battles SET content = ?, media_url = ? WHERE id = ?",
                [content, mediaUrl, battleId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Response submitted!" });
    } catch (err) {
        console.error("Respond to hype battle error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/vote-battle", authenticateToken, async (req, res) => {
    try {
        const { email, battleId, voteFor } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const battle = await new Promise<any>((resolve, reject) => {
            db.get("SELECT closed, voting_deadline FROM hype_battles WHERE id = ?", [battleId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!battle) return res.status(404).json({ message: "Battle not found" });
        if (battle.closed) return res.status(400).json({ message: "Battle is closed" });
        if (new Date(battle.voting_deadline) < new Date()) return res.status(400).json({ message: "Voting has ended" });

        const existingVote = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT id FROM battle_votes WHERE user_id = ? AND battle_id = ?",
                [user.id, battleId],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (existingVote) return res.status(400).json({ message: "You already voted for this battle!" });

        if (!["creator", "opponent"].includes(voteFor)) {
            return res.status(400).json({ message: "Invalid vote target" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO battle_votes (user_id, battle_id, vote_for) VALUES (?, ?, ?)",
                [user.id, battleId, voteFor],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        if (voteFor === "creator") {
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE hype_battles SET votes = votes + 1 WHERE id = ?", [battleId], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        } else {
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE hype_battles SET opponent_votes = opponent_votes + 1 WHERE id = ?", [battleId], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }

        res.json({ message: "Vote cast successfully!" });
    } catch (err) {
        console.error("Vote battle error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/determine-winners", authenticateToken, async (req, res) => {
    try {
        const battles = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT id, user_id, opponent_id, team_id, opponent_team_id, votes, opponent_votes, category FROM hype_battles WHERE voting_deadline < DATETIME('now') AND closed = 0",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        for (const battle of battles) {
            let winnerId = null;
            let loserId = null;
            let winnerTeamId = null;
            let loserTeamId = null;

            if (battle.votes > battle.opponent_votes) {
                winnerId = battle.user_id;
                loserId = battle.opponent_id;
                winnerTeamId = battle.team_id;
                loserTeamId = battle.opponent_team_id;
            } else if (battle.opponent_votes > battle.votes) {
                winnerId = battle.opponent_id;
                loserId = battle.user_id;
                winnerTeamId = battle.opponent_team_id;
                loserTeamId = battle.team_id;
            }

            await new Promise<void>((resolve, reject) => {
                db.run(
                    "UPDATE hype_battles SET closed = 1, winner_id = ? WHERE id = ?",
                    [winnerId || winnerTeamId, battle.id],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });

            if (winnerId) {
                await new Promise<void>((resolve, reject) => {
                    db.run("UPDATE users SET coins = coins + 50, wins = wins + 1 WHERE id = ?", [winnerId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
                if (loserId) {
                    await new Promise<void>((resolve, reject) => {
                        db.run("UPDATE users SET losses = losses + 1 WHERE id = ?", [loserId], (err) => {
                            if (err) reject(err);
                            resolve();
                        });
                    });
                }
            }

            const winner = await new Promise<any>((resolve, reject) => {
                db.get("SELECT tier, wins, losses FROM users WHERE id = ?", [winnerId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });

            if (winner) {
                const newTier = calculateTier(winner.wins, winner.losses, winner.tier);
                await new Promise<void>((resolve, reject) => {
                    db.run("UPDATE users SET tier = ? WHERE id = ?", [newTier, winnerId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
            }

            if (loserId) {
                const loser = await new Promise<any>((resolve, reject) => {
                    db.get("SELECT tier, wins, losses FROM users WHERE id = ?", [loserId], (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    });
                });

                if (loser) {
                    const newTier = calculateTier(loser.wins, loser.losses, loser.tier);
                    await new Promise<void>((resolve, reject) => {
                        db.run("UPDATE users SET tier = ? WHERE id = ?", [newTier, loserId], (err) => {
                            if (err) reject(err);
                            resolve();
                        });
                    });
                }
            }

            const titleMap = {
                "Rap Battle": "Rap King",
                "Dance-off": "Dance Legend",
                "Meme Creation": "Meme Master",
                "Artistic Speed Drawing": "Art Ace",
                "Beat-making Face-off": "Beat Boss"
            };
            const title = titleMap[battle.category];

            if (title && winnerId) {
                await new Promise<void>((resolve, reject) => {
                    db.run(`UPDATE users SET title = NULL WHERE title = ?`, [title], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
                await new Promise<void>((resolve, reject) => {
                    db.run(`UPDATE users SET title = ? WHERE id = ?`, [title, winnerId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
            }
        }

        res.json({ message: "Winners determined and titles assigned!" });
    } catch (err) {
        console.error("Determine winners error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

function calculateTier(wins: number, losses: number, currentTier: number): number {
    const winRate = wins / (wins + losses || 1);
    let newTier = currentTier;

    if (wins + losses >= 5) {
        if (winRate >= 0.7 && newTier < 5) {
            newTier += 1;
        } else if (winRate < 0.3 && newTier > 1) {
            newTier -= 1;
        }
    }

    return newTier;
}

app.post("/api/vote-showdown", authenticateToken, async (req, res) => {
    try {
        const { email, dateOption } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const userId = user.id;

        const existingVote: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM showdown_votes WHERE user_id = ?", [userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingVote) {
            return res.status(400).json({ message: "You have already voted!" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run("INSERT INTO showdown_votes (user_id, date_option) VALUES (?, ?)", [userId, dateOption], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: "Vote recorded!" });
    } catch (err) {
        console.error("Vote showdown error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/determine-showdown-date", authenticateToken, async (req, res) => {
    try {
        const result: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT date_option, COUNT(*) as votes FROM showdown_votes GROUP BY date_option ORDER BY votes DESC LIMIT 1",
                [],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (result) {
            await new Promise<void>((resolve, reject) => {
                db.run("INSERT INTO scheduled_battles (date) VALUES (?)", [result.date_option], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            res.json({ message: `Next battle scheduled for ${result.date_option}!` });
        } else {
            res.json({ message: "No votes yet." });
        }
    } catch (err) {
        console.error("Determine showdown date error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// New interfaces for Ultimate Showdown
interface ShowdownParticipant {
    userId: number;
    username: string;
    wins: number;
    tier: number;
    status: string;
    bracketPosition?: number;
}

interface BracketMatch {
    id: number;
    participant1: ShowdownParticipant;
    participant2: ShowdownParticipant | null;
    winnerId?: number;
    round: number;
}

// Existing authenticateToken middleware remains the same

// New endpoints for Ultimate Showdown
app.post("/api/ultimate-showdown/qualify", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username, wins, tier FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Qualification: Must have won at least 3 Hype Battles
        const battleWins: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = ? AND closed = 1", [user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (battleWins.wins < 3) {
            return res.status(400).json({ message: "You need at least 3 Hype Battle wins to qualify" });
        }

        // Check if already invited
        const existingParticipant: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT * FROM showdown_participants WHERE user_id = ?", [user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingParticipant) {
            return res.status(400).json({ message: "You are already invited to the Ultimate Showdown" });
        }

        // Invite user
        const currentTournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!currentTournament) {
            return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO showdown_participants (tournament_id, user_id, status) VALUES (?, ?, ?)",
                [currentTournament.id, user.id, "invited"],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "You have been invited to the Ultimate Showdown!" });
    } catch (err) {
        console.error("Qualify error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/ultimate-showdown/qualify", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT * FROM users WHERE email = ?", [req.user.email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if user is eligible to participate (but don't block viewing)
        const battleWins: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = ? AND closed = 1", [user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        console.log(`User ${user.username} has ${battleWins.wins} Hype Battle wins`);

        const canParticipate = battleWins.wins >= 3;

        const currentTournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!currentTournament) {
            return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
        }

        const participant: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT * FROM showdown_participants WHERE tournament_id = ? AND user_id = ?",
                [currentTournament.id, user.id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        // Return qualification status for participation, but allow viewing regardless
        res.json({
            canView: true, // Everyone can view the page
            canParticipate: canParticipate, // Only users with 3+ wins can participate
            alreadyJoined: !!participant, // Whether the user is already a participant
            tournamentId: currentTournament.id,
            wins: battleWins.wins // Include the number of wins for frontend display
        });
    } catch (err) {
        console.error("Qualify error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/ultimate-showdown/bracket", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const tournament: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT * FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1",
                [],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!tournament) {
            return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
        }

        const participants: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT sp.*, u.username FROM showdown_participants sp JOIN users u ON sp.user_id = u.id WHERE sp.tournament_id = ? AND sp.status = 'active'",
                [tournament.id],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json({ tournament, participants });
    } catch (err) {
        console.error("Bracket fetch error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/ultimate-showdown/start-live", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const { email, tournamentId } = req.body;
        if (req.user.email !== email || email !== "restorationmichael3@gmail.com") {
            return res.status(403).json({ message: "Only the platform creator can start the live event" });
        }

        const tournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT status, start_date FROM showdown_tournaments WHERE id = ?", [tournamentId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        if (tournament.status !== "open") return res.status(400).json({ message: "Tournament is not open" });
        if (new Date(tournament.start_date) > new Date()) return res.status(400).json({ message: "Tournament has not started yet" });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE showdown_tournaments SET status = 'live' WHERE id = ?", [tournamentId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Broadcast live event start
        io.emit("showdown_live_start", { tournamentId });
        res.json({ message: "Live event started!" });
    } catch (err) {
        console.error("Start live error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/ultimate-showdown/boost", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const { email, tournamentId, targetUserId, coins } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user || user.coins < coins) {
            return res.status(400).json({ message: "Insufficient coins" });
        }

        const newCoins = user.coins - coins;
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET coins = ? WHERE id = ?", [newCoins, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO showdown_boosts (tournament_id, user_id, target_user_id, coins_spent) VALUES (?, ?, ?, ?)",
                [tournamentId, user.id, targetUserId, coins],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Broadcast boost update
        io.emit("showdown_boost_update", { tournamentId, targetUserId, coins });
        res.json({ message: `Boosted ${coins} coins to user ${targetUserId}!`, newCoins });
    } catch (err) {
        console.error("Boost error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/ultimate-showdown/end", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const { email, tournamentId, winnerId } = req.body;
        if (req.user.email !== email || email !== "restorationmichael3@gmail.com") {
            return res.status(403).json({ message: "Only the platform creator can end the event" });
        }

        const tournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT status FROM showdown_tournaments WHERE id = ?", [tournamentId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!tournament) return res.status(404).json({ message: "Tournament not found" });
        if (tournament.status !== "live") return res.status(400).json({ message: "Tournament is not live" });

        // Determine winner based on votes and boosts (simplified logic)
        const votes: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT SUM(coins_spent) as totalBoosts FROM showdown_boosts WHERE tournament_id = ? AND target_user_id = ?", [tournamentId, winnerId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const totalBoosts = votes.totalBoosts || 0;
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE showdown_tournaments SET status = 'completed', winner_id = ? WHERE id = ?", [winnerId, tournamentId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Award rewards
        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO profile_borders (user_id, border_style) VALUES (?, ?)",
                [winnerId, "LegendaryGold"],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET coins = coins + 1000, legend_status = 'Ultimate Champion' WHERE id = ?", [winnerId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO hall_of_fame (user_id, tournament_id, rank) VALUES (?, ?, 1)",
                [winnerId, tournamentId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        io.emit("showdown_end", { tournamentId, winnerId });
        res.json({ message: "Ultimate Showdown completed! Winner rewarded." });
    } catch (err) {
        console.error("End showdown error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Fetch the chosen showdown date
app.get("/api/showdown-date", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const schedule: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT date FROM showdown_schedule ORDER BY created_at DESC LIMIT 1",
                [],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!schedule) {
            return res.status(404).json({ message: "No showdown date scheduled yet" });
        }

        res.json({ date: schedule.date });
    } catch (err) {
        console.error("Showdown date fetch error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Submit a clip for Ultimate Showdown
app.post("/api/submit-clip", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const { email, clipUrl, category } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username, wins, tier FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if user is qualified (wins >= 3 and in showdown_participants)
        const battleWins: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT COUNT(*) as wins FROM hype_battles WHERE winner_id = ? AND closed = 1", [user.id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (battleWins.wins < 3) {
            return res.status(400).json({ message: "You need at least 3 Hype Battle wins to submit a clip" });
        }

        const currentTournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!currentTournament) {
            return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
        }

        const isParticipant: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT * FROM showdown_participants WHERE tournament_id = ? AND user_id = ? AND status = 'active'",
                [currentTournament.id, user.id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!isParticipant) {
            return res.status(400).json({ message: "You are not an active participant in the Ultimate Showdown" });
        }

        // Check if today is the showdown day
        const schedule: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT date FROM showdown_schedule ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!schedule) {
            return res.status(400).json({ message: "Showdown date not set" });
        }

        const today = new Date().toISOString().split("T")[0];
        if (today !== schedule.date) {
            return res.status(400).json({ message: "You can only submit clips on the showdown day" });
        }

        // Check if user already submitted a clip in this category
        const existingClip: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT * FROM showdown_clips WHERE user_id = ? AND tournament_id = ? AND category = ?",
                [user.id, currentTournament.id, category],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (existingClip) {
            return res.status(400).json({ message: "You have already submitted a clip in this category" });
        }

        // Submit the clip
        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO showdown_clips (tournament_id, user_id, username, clip_url, category) VALUES (?, ?, ?, ?, ?)",
                [currentTournament.id, user.id, user.username, clipUrl, category],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Fetch the newly inserted clip to broadcast
        const newClip: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT id, user_id, username, clip_url, category FROM showdown_clips WHERE user_id = ? AND tournament_id = ? AND category = ?",
                [user.id, currentTournament.id, category],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        // Broadcast clip submission
        io.emit("showdown_clip_update", { clip: newClip });

        res.json({ message: "Clip submitted successfully!" });
    } catch (err) {
        console.error("Submit clip error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Fetch submitted clips
app.get("/api/showdown-clips", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const currentTournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!currentTournament) {
            return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
        }

        const clips: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT id, user_id, username, clip_url as url, category FROM showdown_clips WHERE tournament_id = ?",
                [currentTournament.id],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json({ clips });
    } catch (err) {
        console.error("Fetch clips error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Vote for a clip
app.post("/api/vote-clip", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const { email, clipId, category } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        // Check if today is the showdown day
        const schedule: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT date FROM showdown_schedule ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!schedule) {
            return res.status(400).json({ message: "Showdown date not set" });
        }

        const today = new Date().toISOString().split("T")[0];
        if (today !== schedule.date) {
            return res.status(400).json({ message: "You can only vote on the showdown day" });
        }

        // Check if user is a participant (participants can't vote)
        const currentTournament: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM showdown_tournaments WHERE status = 'open' ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!currentTournament) {
            return res.status(404).json({ message: "No active Ultimate Showdown tournament" });
        }

        const isParticipant: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT * FROM showdown_participants WHERE tournament_id = ? AND user_id = ? AND status = 'active'",
                [currentTournament.id, user.id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (isParticipant) {
            return res.status(400).json({ message: "Participants cannot vote in the Ultimate Showdown" });
        }

        // Check if the clip exists
        const clip: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM showdown_clips WHERE id = ?", [clipId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!clip) {
            return res.status(404).json({ message: "Clip not found" });
        }

        // Check if user has already voted in this category
        const existingVote: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT id FROM showdown_clip_votes WHERE user_id = ? AND category = ?",
                [user.id, category],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (existingVote) {
            return res.status(400).json({ message: "You have already voted in this category" });
        }

        // Record the vote
        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO showdown_clip_votes (user_id, clip_id, category) VALUES (?, ?, ?)",
                [user.id, clipId, category],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Vote recorded successfully!" });
    } catch (err) {
        console.error("Vote clip error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Fetch user's vote status for each category
app.get("/api/user-vote-status", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [req.user.email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const votes: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT category FROM showdown_clip_votes WHERE user_id = ?",
                [user.id],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        const hasVoted: { [key: string]: boolean } = {};
        votes.forEach((vote) => {
            hasVoted[vote.category] = true;
        });

        res.json({ hasVoted });
    } catch (err) {
        console.error("Fetch vote status error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get('/api/shop/items', authenticateToken, async (req, res) => {
  try {
    const items = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM shop_items WHERE stock IS NULL OR stock > 0', [], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });
    res.json(items);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Fetch shop items error:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/shop/purchase', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, itemId } = req.body;
    if (req.user.email !== email) {
      res.status(403).json({ message: 'Unauthorized' });
      return;
    }

    // Fetch user
    const user = await new Promise<User | undefined>((resolve, reject) => {
      db.get('SELECT id, email, coins FROM users WHERE email = ?', [email], (err, row: User) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Fetch item
    const item = await new Promise<ShopItem | undefined>((resolve, reject) => {
      db.get('SELECT id, name, price, is_limited, stock FROM shop_items WHERE id = ? AND (stock IS NULL OR stock > 0)', [itemId], (err, row: ShopItem) => {
        if (err) reject(err);
        resolve(row);
      });
    });
    if (!item) {
      res.status(404).json({ message: 'Item not found or out of stock' });
      return;
    }

    // Check coins
    if (user.coins < item.price) {
      res.status(400).json({ message: 'Insufficient coins' });
      return;
    }

    // Update user coins
    const newCoins = user.coins - item.price;
    await new Promise<void>((resolve, reject) => {
      db.run('UPDATE users SET coins = ? WHERE id = ?', [newCoins, user.id], (err) => {
        if (err) reject(err);
        resolve();
      });
    });

    // Add to inventory
    await new Promise<void>((resolve, reject) => {
      db.run('INSERT INTO user_inventory (user_id, item_id) VALUES (?, ?)', [user.id, itemId], (err) => {
        if (err) reject(err);
        resolve();
      });
    });

    // Update stock for limited items
    if (item.is_limited) {
      await new Promise<void>((resolve, reject) => {
        db.run('UPDATE shop_items SET stock = stock - 1 WHERE id = ?', [itemId], (err) => {
          if (err) reject(err);
          resolve();
        });
      });
    }

    res.json({ message: `Purchased ${item.name}!`, newCoins });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Purchase item error:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/user/inventory', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.user as { email: string }; // Type assertion for req.user
    if (!email) {
      res.status(401).json({ message: 'Unauthorized: Missing email' });
      return;
    }

    const inventory = await new Promise<InventoryItem[]>((resolve, reject) => {
      db.all(
        'SELECT ui.*, si.name, si.category, si.image_url, si.description FROM user_inventory ui JOIN shop_items si ON ui.item_id = si.id WHERE ui.user_id = (SELECT id FROM users WHERE email = ?)',
        [email],
        (err: Error | null, rows: InventoryItem[]) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    res.json(inventory);
  } catch (err: unknown) {
    console.error(`[${new Date().toISOString()}] Fetch inventory error:`, err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update the /api/determine-showdown-date endpoint to store the date correctly
app.get("/api/determine-showdown-date", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        // Check if a date is already scheduled
        const existingSchedule: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT date FROM showdown_schedule ORDER BY created_at DESC LIMIT 1", [], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingSchedule) {
            return res.json({ message: `Next battle already scheduled for ${existingSchedule.date}!` });
        }

        const result: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT date_option, COUNT(*) as votes FROM showdown_votes GROUP BY date_option ORDER BY votes DESC LIMIT 1",
                [],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (result) {
            await new Promise<void>((resolve, reject) => {
                db.run("INSERT INTO showdown_schedule (date) VALUES (?)", [result.date_option], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            res.json({ message: `Next battle scheduled for ${result.date_option}!` });
        } else {
            res.json({ message: "No votes yet." });
        }
    } catch (err) {
        console.error("Determine showdown date error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/coin-flip", authenticateToken, async (req, res) => {
    try {
        const { email, betAmount } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (betAmount < 1 || betAmount > 100) {
            return res.status(400).json({ message: "Bet must be between 1 and 100 coins." });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, coins FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user || user.coins < betAmount) {
            return res.status(400).json({ message: "Insufficient coins." });
        }

        const isWin = Math.random() < 0.5;
        let newBalance = user.coins;
        let winnings = 0;

        if (isWin) {
            winnings = Math.floor(betAmount * 2 * 0.95);
            newBalance += winnings;
        } else {
            newBalance -= betAmount;
        }

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET coins = ? WHERE id = ?", [newBalance, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO coin_flip_history (user_id, bet_amount, won_amount, result) VALUES (?, ?, ?, ?)",
                [user.id, betAmount, winnings, isWin ? "win" : "lose"],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ result: isWin ? "win" : "lose", newBalance });
    } catch (err) {
        console.error("Coin flip error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/hall-of-fame", authenticateToken, async (req, res) => {
    try {
        // Fetch Ultimate Showdown winners
        const ultimateShowdownWinners: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT h.*, u.username as actual_username FROM hall_of_fame h JOIN users u ON h.user_id = u.id ORDER BY h.awarded_at DESC LIMIT 10",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        // Fetch Top Rappers/Dancers/Creators (All-Time)
        const categories = ["Rap Battle", "Dance-off", "Meme Creation", "Artistic Speed Drawing", "Beat-making Face-off"];
        const topCreatorsAllTime: { [key: string]: any[] } = {};
        for (const category of categories) {
            const winners = await new Promise<any[]>((resolve, reject) => {
                db.all(
                    `SELECT u.id, u.username, COUNT(*) as wins
                     FROM hype_battles h
                     JOIN users u ON h.winner_id = u.id
                     WHERE h.category = ? AND h.closed = 1
                     GROUP BY u.id, u.username
                     ORDER BY wins DESC LIMIT 5`,
                    [category],
                    (err, rows) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });
            topCreatorsAllTime[category] = winners;
        }

        // Fetch Top Rappers/Dancers/Creators (Monthly)
        const topCreatorsMonthly: { [key: string]: any[] } = {};
        for (const category of categories) {
            const winners = await new Promise<any[]>((resolve, reject) => {
                db.all(
                    `SELECT u.id, u.username, COUNT(*) as wins
                     FROM hype_battles h
                     JOIN users u ON h.winner_id = u.id
                     WHERE h.category = ? AND h.closed = 1
                     AND h.created_at >= datetime('now', '-30 days')
                     GROUP BY u.id, u.username
                     ORDER BY wins DESC LIMIT 5`,
                    [category],
                    (err, rows) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });
            topCreatorsMonthly[category] = winners;
        }

        // Fetch Top Squads
        const topSquads: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT g.*, u.username as creator_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.wins DESC LIMIT 5",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        // Fetch Top Earners
        const topEarners: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT id, username, coins FROM users ORDER BY coins DESC LIMIT 5",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        // Fetch Developer Picks
        const developerPicks: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT d.*, u.username as actual_username FROM developer_picks d JOIN users u ON d.user_id = u.id ORDER BY d.awarded_at DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        console.log(`[${new Date().toISOString()}] /api/hall-of-fame returned data for all sections`);
        res.json({
            ultimateShowdownWinners,
            topCreatorsAllTime,
            topCreatorsMonthly,
            topSquads,
            topEarners,
            developerPicks
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Hall of fame error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Correcting the problematic section starting from line 1944

app.post("/api/track-like", authenticateToken, async (req, res) => {
    try {
        const { email, postId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const userId = user.id;

        const existingLike: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM likes WHERE post_id = ? AND user_id = ?", [postId, userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingLike) {
            return res.status(400).json({ message: "Already liked this post" });
        }

        const post: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT user_id FROM posts WHERE id = ?", [postId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!post) return res.status(404).json({ message: "Post not found" });

        const postOwnerId = post.user_id;

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO post_hall_of_fame (user_id, post_id, total_likes) VALUES (?, ?, 1) " +
                "ON CONFLICT(user_id) DO UPDATE SET total_likes = total_likes + 1",
                [postOwnerId, postId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Like tracked for Post Hall of Fame" });
    } catch (err) {
        console.error("Track like error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Catch-all route to serve the frontend
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
// Express route to catch users
declare global {
    namespace Express {
        interface Request {
            user?: { email: string; verified: number; id?: number };
        }
    }
}
