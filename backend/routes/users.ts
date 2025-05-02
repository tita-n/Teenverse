import express from "express"
import { initDb } from './database.ts';
import multer from "multer";
import cloudinary from "cloudinary";

// Initialize database and mount routes
initDb().then((db) => {
    app.set('db', db); // Store db in app for routes to access

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

// Configure Multer for profile media uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "video/mp4"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only JPEG, PNG, and MP4 are allowed."));
        }
    },
});

const router = express.Router();

// Get user profile by username
router.get("/profile/:username", async (req: express.Request, res: express.Response) => {
    const username = req.params.username;
    try {
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT id, username, verified, coins, xp, profile_media_url, profile_media_type FROM users WHERE username = ?",
                [username],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });
        if (!user) return res.status(404).json({ message: "User not found" });

        const posts: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT * FROM posts WHERE user_id = (SELECT id FROM users WHERE username = ?) ORDER BY created_at DESC",
                [username],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        const { level, rank } = calculateLevel(user.xp);

        const userProfile = {
            username: user.username,
            verified: user.verified,
            coins: user.coins,
            rank,
            level,
            profile_media_url: user.profile_media_url,
            profile_media_type: user.profile_media_type,
        };

        res.json({ user: userProfile, posts });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching profile:`, err);
        res.status(500).json({ message: "Internal server error: " + (err as Error).message });
    }
});

// Upload profile photo/video
router.post("/profile/upload", upload.single("media"), async (req: express.Request, res: express.Response) => {
    const { email } = req.body;
    const file = req.file;

    if (!email || !file) {
        return res.status(400).json({ message: "Email and media file are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                if (!row) reject(new Error("User not found"));
                resolve(row);
            });
        });

        const uploadResult = await new Promise<cloudinary.UploadApiResponse>((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
                {
                    resource_type: file.mimetype.startsWith("image") ? "image" : "video",
                    transformation: [{ quality: "auto:low", fetch_format: "auto" }],
                },
                (error, result) => {
                    if (error) reject(error);
                    if (!result) reject(new Error("Upload failed"));
                    resolve(result);
                }
            );
            stream.end(file.buffer);
        });

        const mediaUrl = uploadResult.secure_url;
        const mediaType = file.mimetype.startsWith("image") ? "image" : "video";

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE users SET profile_media_url = ?, profile_media_type = ? WHERE id = ?",
                [mediaUrl, mediaType, user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Profile media uploaded successfully", profile_media_url: mediaUrl, profile_media_type: mediaType });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error uploading profile media:`, err);
        res.status(500).json({ message: "Internal server error: " + (err as Error).message });
    }
});

// Verify/unverify a user (creator only)
router.post("/verify", async (req: express.Request, res: express.Response) => {
    const { username, verify } = req.body;
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized: No user authenticated" });
    }
    if (req.user.email !== "restorationmichael3@gmail.com") {
        return res.status(403).json({ message: "Unauthorized: Only the creator can verify users" });
    }
    if (!username || typeof verify !== "boolean") {
        return res.status(400).json({ message: "Username and verify (boolean) are required" });
    }
    try {
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
        if (!user) return res.status(404).json({ message: "User not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE users SET verified = ? WHERE username = ?",
                [verify ? 1 : 0, username],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });
        res.json({ message: `User ${username} ${verify ? "verified" : "unverified"} successfully` });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error verifying user:`, err);
        res.status(500).json({ message: "Internal server error: " + (err as Error).message });
    }
});

export default router;
