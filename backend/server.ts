import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import postRoutes from './routes/posts';
import { db } from "./database";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5000;
const SECRET_KEY = process.env.SECRET_KEY || "teenverse_secret";

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

// Use post routes with authentication middleware
app.use('/api/posts', authenticateToken, postRoutes);

// Endpoint to fetch rants
app.get("/api/rants", authenticateToken, async (req: express.Request, res: express.Response) => {
    try {
        const rants: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT p.*, u.username as actual_username FROM posts p JOIN users u ON p.user_id = u.id WHERE p.mode = 'rant' ORDER BY p.created_at DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        // Always set username to "Anonymous" for rants
        const modifiedRants = rants.map((rant) => {
            console.log(`Rant ID ${rant.id}: actual_username=${rant.actual_username}`); // Debug
            return { ...rant, username: "Anonymous" };
        });

        console.log(`[${new Date().toISOString()}] /api/rants returned ${modifiedRants.length} rants`);
        res.json(modifiedRants);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Get rants error:`, err);
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

// Get user data (for verifying token)
app.get("/api/users/me", authenticateToken, async (req: any, res) => {
    try {
        const user = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, email, username FROM users WHERE email = ?", [req.user.email], (err, row) => {
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

// Create post endpoint (used for rants as well)
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

        const postMode = mode || "main"; // Use the provided mode (e.g., "rant"), default to "main"
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

        const newXP = user.xp + 5;
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET xp = ? WHERE id = ?", [newXP, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        const newCoins = user.coins + 5;
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE users SET coins = ? WHERE id = ?", [newCoins, user.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: "Post created! +5 XP and +5 coins", newXP, newCoins });
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

// Game Squad endpoints
app.get("/api/game-squads", authenticateToken, async (req, res) => {
    try {
        const squads: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT g.*, u.username as actual_username FROM game_squads g JOIN users u ON g.user_id = u.id ORDER BY g.created_at DESC",
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
            db.get("SELECT id, username FROM users WHERE email = ?", [email], (err, row) => {
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

        // Add the creator as a member
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

        res.json({ message: "Game squad created!", squadId: squad.id });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Create game squad error:`, err);
        res.status(500).json({ message: "Internal server error", error: err.message });
    }
});

// Join a game squad
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

// Get game squad leaderboard
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

// Report a win for a game squad (only the creator can report)
app.post("/api/game-squads/report-win", authenticateToken, async (req, res) => {
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

        res.json({ message: "Win reported successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create a tournament
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

// Join a tournament
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

// Declare a tournament winner
app.post("/api/tournaments/declare-winner", authenticateToken, async (req, res) => {
    try {
        const { email, tournamentId, winnerId } = req.body;
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

        // Update tournament status and winner
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE tournaments SET status = 'completed', winner_id = ? WHERE id = ?", [winnerId, tournamentId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Increment wins for the winning squad
        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE game_squads SET wins = wins + 1 WHERE id = ?", [winnerId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: "Winner declared successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get all tournaments
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

        // Fetch participants for each tournament
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

// Upload a game clip
app.post("/api/game-clips", authenticateToken, async (req, res) => {
    try {
        const { email, squadId, clipUrl, description } = req.body;
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

        if (!isMember && !isCreator) return res.status(403).json({ message: "You must be a member of this squad to upload a clip" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO game_clips (squad_id, user_id, clip_url, description) VALUES (?, ?, ?, ?)",
                [squadId, user.id, clipUrl, description],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Game clip uploaded successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get game clips for a squad
app.get("/api/game-clips/:squadId", authenticateToken, async (req, res) => {
    try {
        const squadId = req.params.squadId;
        const clips: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT gc.*, u.username FROM game_clips gc JOIN users u ON gc.user_id = u.id WHERE gc.squad_id = ? ORDER BY gc.created_at DESC",
                [squadId],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json(clips);
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Send a message in a squad chat
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

// Get messages for a squad chat (with membership check)
app.get("/api/squad-messages/:squadId", authenticateToken, async (req: any, res) => {
    try {
        const { squadId } = req.params;
        const userId = req.user.id;

        // Check if the user is a member of the squad
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

        // Fetch messages for the squad
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

// Hype Battles endpoints
app.get("/api/hype-battles", authenticateToken, async (req, res) => {
    try {
        const battles: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT h.*, u.username as actual_username FROM hype_battles h JOIN users u ON h.user_id = u.id WHERE h.closed = 0 ORDER BY h.created_at DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
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
        const { email, content } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO hype_battles (user_id, username, content, votes) VALUES (?, ?, ?, ?)",
                [user.id, user.username, content, 0],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
        res.json({ message: "Battle post created!" });
    } catch (err) {
        console.error("Hype battle error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.post("/api/vote-battle", authenticateToken, async (req, res) => {
    try {
        const { email, battleId } = req.body;
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
            db.get(
                "SELECT id FROM battle_votes WHERE user_id = ? AND battle_id = ?",
                [userId, battleId],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (existingVote) {
            return res.status(400).json({ message: "You already voted for this battle!" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run("INSERT INTO battle_votes (user_id, battle_id) VALUES (?, ?)", [userId, battleId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        await new Promise<void>((resolve, reject) => {
            db.run("UPDATE hype_battles SET votes = votes + 1 WHERE id = ?", [battleId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        res.json({ message: "Vote cast successfully!" });
    } catch (err) {
        console.error("Vote battle error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

app.get("/api/determine-winners", authenticateToken, async (req, res) => {
    try {
        const battles: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT id, user_id, votes FROM hype_battles WHERE created_at < DATETIME('now', '-1 day') AND closed = 0",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        for (const battle of battles) {
            const winnerId = battle.user_id;
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE users SET coins = coins + 50 WHERE id = ?", [winnerId], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE users SET title = NULL WHERE title = 'Rap King'", [], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE users SET title = 'Rap King' WHERE id = ?", [winnerId], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE hype_battles SET closed = 1 WHERE id = ?", [battle.id], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
        }

        res.json({ message: "Winners determined and titles assigned!" });
    } catch (err) {
        console.error("Determine winners error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Ultimate Showdown voting endpoints
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

// Coin Flip endpoint
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

// Hall of Fame endpoint
app.get("/api/hall-of-fame", authenticateToken, async (req, res) => {
    try {
        const rankings: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT h.*, u.username as actual_username FROM hall_of_fame h JOIN users u ON h.user_id = u.id ORDER BY h.total_likes DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        console.log(`[${new Date().toISOString()}] /api/hall-of-fame returned ${rankings.length} rankings`);
        res.json(rankings);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Hall of fame error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Track like endpoint (for Hall of Fame)
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

        await new Promise<void>((resolve, reject) => {
            db.run("INSERT INTO likes (user_id, post_id) VALUES (?, ?)", [userId, postId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        const result: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT COUNT(*) as count FROM likes WHERE post_id = ? AND created_at >= datetime('now', '-1 day')",
                [postId],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });
        const count = result.count;

        if (count >= 50) {
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE users SET coins = coins + 100 WHERE id = ?", [userId], (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            await new Promise<void>((resolve, reject) => {
                db.run(
                    "INSERT INTO hall_of_fame (user_id, total_likes) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET total_likes = total_likes + ?",
                    [userId, count, count],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });
        }

        res.json({ message: "Like recorded", currentLikes: count });
    } catch (err) {
        console.error("Track like error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Catch-all route for SPA (must be at the end)
app.get('*', (req, res) => {
    // Only return 404 for /api/* routes that aren't matched
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ message: "API endpoint not found" });
    }
    // Serve index.html for all other routes (client-side routing)
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Extend Express Request interface to include user
declare global {
    namespace Express {
        interface Request {
            user?: { email: string, verified: number, id?: number };
        }
    }
                              }
