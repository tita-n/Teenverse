import express from "express";
import { db } from "../database";
import multer from "multer";
import cloudinary from "cloudinary";
import { User, Post } from "../types";

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
        const user = await db.get<User>(
            `SELECT id, username, verified, coins, xp, profile_media_url, profile_media_type 
             FROM users WHERE username = ?`,
            [username]
        );
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const posts = await db.all<Post>(
            `SELECT id, user_id, username, content, mode, likes, created_at, media_url, media_type, reactions 
             FROM posts WHERE user_id = ? ORDER BY created_at DESC`,
            [user.id]
        );

        const { level, rank } = calculateLevel(user.xp || 0);

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
        console.error(`[${new Date().toISOString()}] Fetch profile error:`, err);
        res.status(500).json({ message: "Internal server error" });
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
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

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

        await db.run(
            "UPDATE users SET profile_media_url = ?, profile_media_type = ? WHERE id = ?",
            [mediaUrl, mediaType, user.id]
        );

        res.json({ message: "Profile media uploaded successfully", profile_media_url: mediaUrl, profile_media_type: mediaType });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Upload profile media error:`, err);
        res.status(500).json({ message: "Internal server error" });
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
        const user = await db.get<User>("SELECT id FROM users WHERE username = ?", [username]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await db.run(
            "UPDATE users SET verified = ? WHERE username = ?",
            [verify ? 1 : 0, username]
        );

        res.json({ message: `User ${username} ${verify ? "verified" : "unverified"} successfully` });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Verify user error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;