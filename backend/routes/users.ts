import express from "express";
import { db } from "../database";

// Import calculateLevel from server.ts (uncomment if you export it from server.ts)
// import { calculateLevel } from "../server";

// If you prefer not to import, define calculateLevel here (copied from server.ts)
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

const router = express.Router();

// Get user profile by username (updated to include coins, rank, and level)
router.get("/profile/:username", async (req: express.Request, res: express.Response) => {
    const username = req.params.username;
    try {
        // Fetch user data including coins and xp for rank/level calculation
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT id, username, verified, coins, xp FROM users WHERE username = ?",
                [username],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });
        if (!user) return res.status(404).json({ message: "User not found" });

        // Fetch user posts
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

        // Calculate level and rank using the user's XP
        const { level, rank } = calculateLevel(user.xp);

        // Construct the updated user object with requested fields
        const userProfile = {
            username: user.username,
            verified: user.verified,
            coins: user.coins,
            rank,
            level
        };

        res.json({ user: userProfile, posts });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Error fetching profile:`, err);
        res.status(500).json({ message: "Internal server error: " + (err as Error).message });
    }
});

// Verify/unverify a user (creator only) - unchanged
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