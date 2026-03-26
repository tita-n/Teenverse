import express from "express";
import { dbGet, dbAll, dbRun, withTransaction } from "../database";
import multer from "multer";
import cloudinary from "cloudinary";

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

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 3 * 1024 * 1024 },
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

// ===== GET user profile by username - fixed redundant subquery =====
router.get("/profile/:username", async (req: express.Request, res: express.Response) => {
    const username = req.params.username;
    try {
        const user = await dbGet(
            "SELECT id, username, verified, coins, xp, profile_media_url, profile_media_type FROM users WHERE username = ?",
            [username]
        );
        if (!user) return res.status(404).json({ message: "User not found" });

        // Single query for posts using user_id (already fetched)
        const posts = await dbAll(
            "SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC",
            [user.id]
        );

        const { level, rank } = calculateLevel(user.xp);

        res.json({
            user: {
                username: user.username,
                verified: user.verified,
                coins: user.coins,
                rank,
                level,
                profile_media_url: user.profile_media_url,
                profile_media_type: user.profile_media_type,
            },
            posts,
        });
    } catch (err) {
        console.error("Error fetching profile:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Upload profile photo/video =====
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
        const uploadResult = await new Promise<cloudinary.UploadApiResponse>((resolve, reject) => {
            const stream = cloudinary.v2.uploader.upload_stream(
                {
                    resource_type: file.mimetype.startsWith("image") ? "image" : "video",
                    transformation: [{ quality: "auto:low", fetch_format: "auto" }],
                },
                (error, result) => {
                    if (error) reject(error);
                    else if (!result) reject(new Error("Upload failed"));
                    else resolve(result);
                }
            );
            stream.end(file.buffer);
        });

        const mediaUrl = uploadResult.secure_url;
        const mediaType = file.mimetype.startsWith("image") ? "image" : "video";

        await dbRun(
            "UPDATE users SET profile_media_url = ?, profile_media_type = ? WHERE id = ?",
            [mediaUrl, mediaType, req.user.id]
        );

        res.json({ message: "Profile media uploaded successfully", profile_media_url: mediaUrl, profile_media_type: mediaType });
    } catch (err) {
        console.error("Error uploading profile media:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Verify/unverify a user (admin only) =====
router.post("/verify", async (req: express.Request, res: express.Response) => {
    const { username, verify } = req.body;
    if (!req.user) {
        return res.status(403).json({ message: "Unauthorized: No user authenticated" });
    }
    if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Unauthorized: Only admins can verify users" });
    }
    if (!username || typeof verify !== "boolean") {
        return res.status(400).json({ message: "Username and verify (boolean) are required" });
    }

    try {
        const user = await dbGet("SELECT id FROM users WHERE username = ?", [username]);
        if (!user) return res.status(404).json({ message: "User not found" });

        await dbRun("UPDATE users SET verified = ? WHERE username = ?", [verify ? 1 : 0, username]);
        res.json({ message: `User ${username} ${verify ? "verified" : "unverified"} successfully` });
    } catch (err) {
        console.error("Error verifying user:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Get user coins =====
router.post("/get-coins", async (req: express.Request, res: express.Response) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT coins FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ coins: user.coins || 0 });
    } catch (err) {
        console.error("Get coins error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Buy coins =====
router.post("/buy-coins", (req: express.Request, res: express.Response) => {
    res.status(501).json({ message: "Coin purchasing is not yet implemented. Use daily login and posting to earn coins!" });
});

// ===== Daily login XP =====
router.post("/daily-login", async (req: express.Request, res: express.Response) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id, xp, last_login FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const today = new Date().toISOString().split("T")[0];

        if (user.last_login !== today) {
            const newXP = user.xp + 10;
            await dbRun("UPDATE users SET xp = ?, last_login = ? WHERE id = ?", [newXP, today, user.id]);
            res.json({ message: "+10 XP for daily login!", newXP });
        } else {
            res.json({ message: "Already claimed XP today!" });
        }
    } catch (err) {
        console.error("Daily login error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Get user stats =====
router.post("/get-user-stats", async (req: express.Request, res: express.Response) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT xp FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        let level = Math.floor(user.xp / 10) + 1;
        if (level > 100) level = 100;

        let rank = "Newbie";
        if (level >= 11) rank = "Rising Star";
        if (level >= 26) rank = "Clout Lord";
        if (level >= 51) rank = "Elite";
        if (level >= 76) rank = "Titan";
        if (level >= 100) rank = "Shadow Rank";

        res.json({ xp: user.xp, level, rank });
    } catch (err) {
        console.error("Get user stats error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Get snitch status =====
router.post("/get-snitch-status", async (req: express.Request, res: express.Response) => {
    try {
        const { email } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT snitch_status FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ snitchStatus: user.snitch_status || "clean" });
    } catch (err) {
        console.error("Get snitch status error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Like (user profile like) =====
router.post("/like", async (req: express.Request, res: express.Response) => {
    try {
        const { email, postId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!postId) {
            return res.status(400).json({ message: "Post ID is required" });
        }

        const result = await withTransaction(async () => {
            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) throw new Error("User not found");

            const existingLike = await dbGet("SELECT id FROM likes WHERE post_id = ? AND user_id = ?", [postId, user.id]);
            if (existingLike) throw new Error("ALREADY_LIKED");

            await dbRun("INSERT INTO likes (post_id, user_id) VALUES (?, ?)", [postId, user.id]);
            await dbRun("UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId]);
        });

        res.json({ message: "Post liked successfully" });
    } catch (err: any) {
        if (err.message === "ALREADY_LIKED") {
            return res.status(400).json({ message: "Already liked this post" });
        }
        console.error("Like error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Platform analytics =====
router.get("/platform-analytics", async (req: express.Request, res: express.Response) => {
    try {
        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        const totalUsersRow = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM users");
        const totalSquadsRow = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM game_squads");
        const totalPostsRow = await dbGet<{ count: number }>("SELECT COUNT(*) as count FROM posts");
        const popularGames = await dbAll("SELECT game_name, COUNT(*) as count FROM game_squads GROUP BY game_name ORDER BY count DESC LIMIT 5");

        res.json({
            totalUsers: totalUsersRow?.count || 0,
            totalSquads: totalSquadsRow?.count || 0,
            totalPosts: totalPostsRow?.count || 0,
            popularGames,
        });
    } catch (err) {
        console.error("Analytics error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Coin flip =====
router.post("/coin-flip", async (req: express.Request, res: express.Response) => {
    try {
        const { email, choice, betAmount } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!choice || !["heads", "tails"].includes(choice)) {
            return res.status(400).json({ message: "Choice must be 'heads' or 'tails'" });
        }

        const bet = parseInt(betAmount);
        if (isNaN(bet) || bet <= 0) {
            return res.status(400).json({ message: "Invalid bet amount" });
        }

        const result = await withTransaction(async () => {
            const user = await dbGet("SELECT id, coins FROM users WHERE email = ?", [email]);
            if (!user) throw new Error("USER_NOT_FOUND");
            if (user.coins < bet) throw new Error("INSUFFICIENT_COINS");

            const coinResult = Math.random() < 0.5 ? "heads" : "tails";
            const won = choice === coinResult;
            const payout = won ? bet * 2 : 0;

            const newCoins = user.coins - bet + payout;
            await dbRun("UPDATE users SET coins = ? WHERE id = ?", [newCoins, user.id]);
            await dbRun(
                "INSERT INTO coin_flip_history (user_id, bet_amount, won_amount, result) VALUES (?, ?, ?, ?)",
                [user.id, bet, payout, coinResult]
            );

            return { won, payout, newCoins, result: coinResult };
        });

        res.json({
            message: result.won ? `You won ${result.payout} coins!` : `You lost ${bet} coins!`,
            ...result,
        });
    } catch (err: any) {
        const errorMap: Record<string, { status: number; message: string }> = {
            USER_NOT_FOUND: { status: 404, message: "User not found" },
            INSUFFICIENT_COINS: { status: 400, message: "Insufficient coins" },
        };
        const mapped = errorMap[err.message];
        if (mapped) return res.status(mapped.status).json({ message: mapped.message });
        console.error("Coin flip error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
