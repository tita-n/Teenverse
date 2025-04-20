import express from "express";
import { db } from "../database";

const router = express.Router();

// Fetch user profile by username (publicly accessible, but no email)
router.get("/profile/:username", async (req: express.Request, res: express.Response) => {
    try {
        const username = req.params.username;
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT id, username, verified FROM users WHERE username = ?",
                [username],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Fetch user's posts
        const posts: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT p.*, u.username as actual_username FROM posts p JOIN users u ON p.user_id = u.id WHERE p.user_id = ? ORDER BY p.created_at DESC",
                [user.id],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json({ user, posts });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Verify a user (only accessible by the creator)
router.post("/verify", async (req: express.Request, res: express.Response) => {
    try {
        const { email, username, verified } = req.body;
        if (!req.user || req.user.email !== email || email !== "restorationmichael3@gmail.com") {
            return res.status(403).json({ message: "Unauthorized: Only the creator can verify users" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE users SET verified = ? WHERE id = ?",
                [verified ? 1 : 0, user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: `User ${username} ${verified ? "verified" : "unverified"} successfully!` });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;