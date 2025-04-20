import express from "express";
import { db } from "../database";

const router = express.Router();

// Get user profile by username
router.get("/profile/:username", async (req: express.Request, res: express.Response) => {
    const username = req.params.username;
    try {
        const user: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT username, verified FROM users WHERE username = ?",
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
                "SELECT * FROM posts WHERE user_id = (SELECT id FROM users WHERE username = ?)",
                [username],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json({ user, posts });
    } catch (err) {
        console.error("Error fetching profile:", err);
        res.status(500).json({ message: "Internal server error: " + err.message });
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
        console.error("Error verifying user:", err);
        res.status(500).json({ message: "Internal server error: " + err.message });
    }
});

export default router;