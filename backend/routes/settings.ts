import express from "express";
import bcrypt from "bcryptjs";
import { dbGet, dbAll, dbRun, withTransaction } from "../database";

const router = express.Router();

// ===== Account Settings =====
router.get("/account", async (req, res) => {
    try {
        const user = await dbGet(
            "SELECT username, email, dob FROM users WHERE id = ?",
            [req.user?.id]
        );
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            username: user.username,
            email: user.email,
            password: "********",
            dob: user.dob,
        });
    } catch (err) {
        console.error("Error fetching account settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/account", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        const updates: Record<string, any> = {};

        if (username) {
            if (username.length < 3 || username.length > 30) {
                return res.status(400).json({ message: "Username must be 3-30 characters" });
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                return res.status(400).json({ message: "Username can only contain letters, numbers, and underscores" });
            }
            // Check uniqueness
            const existing = await dbGet("SELECT id FROM users WHERE username = ? AND id != ?", [username, req.user?.id]);
            if (existing) return res.status(400).json({ message: "Username already taken" });
            updates.username = username;
        }

        if (email) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ message: "Invalid email format" });
            }
            const existing = await dbGet("SELECT id FROM users WHERE email = ? AND id != ?", [email, req.user?.id]);
            if (existing) return res.status(400).json({ message: "Email already in use" });
            updates.email = email;
        }

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({ message: "Password must be at least 6 characters" });
            }
            updates.password = await bcrypt.hash(password, 10);
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
        const values = [...Object.values(updates), req.user?.id];
        await dbRun(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
        res.json({ message: "Account updated successfully" });
    } catch (err) {
        console.error("Error updating account settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Profile Settings =====
router.get("/profile", async (req, res) => {
    try {
        const user = await dbGet(
            "SELECT bio, background_theme FROM users WHERE id = ?",
            [req.user?.id]
        );
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            bio: user.bio || "",
            backgroundTheme: user.background_theme || "default",
        });
    } catch (err) {
        console.error("Error fetching profile settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/profile", async (req, res) => {
    try {
        const { bio, backgroundTheme } = req.body;
        const updates: Record<string, any> = {};

        if (bio !== undefined) {
            if (bio.length > 500) {
                return res.status(400).json({ message: "Bio must be 500 characters or less" });
            }
            updates.bio = bio;
        }
        if (backgroundTheme) updates.background_theme = backgroundTheme;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
        const values = [...Object.values(updates), req.user?.id];
        await dbRun(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
        res.json({ message: "Profile updated successfully" });
    } catch (err) {
        console.error("Error updating profile settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Economy Settings =====
router.get("/economy", async (req, res) => {
    try {
        const user = await dbGet(
            "SELECT coins, spending_restrictions, auto_earn_uploads FROM users WHERE id = ?",
            [req.user?.id]
        );
        if (!user) return res.status(404).json({ message: "User not found" });

        const history = await dbAll(
            "SELECT * FROM coin_flip_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
            [req.user?.id]
        );

        res.json({
            balance: user.coins || 0,
            history,
            spendingRestrictions: !!user.spending_restrictions,
            autoEarn: { uploads: !!user.auto_earn_uploads },
        });
    } catch (err) {
        console.error("Error fetching economy settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/economy", async (req, res) => {
    try {
        const { spendingRestrictions, autoEarnUploads } = req.body;
        const updates: Record<string, any> = {};

        if (typeof spendingRestrictions !== "undefined") updates.spending_restrictions = spendingRestrictions ? 1 : 0;
        if (typeof autoEarnUploads !== "undefined") updates.auto_earn_uploads = autoEarnUploads ? 1 : 0;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
        const values = [...Object.values(updates), req.user?.id];
        await dbRun(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
        res.json({ message: "Economy settings updated successfully" });
    } catch (err) {
        console.error("Error updating economy settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Customization Settings =====
router.get("/customization", async (req, res) => {
    try {
        const user = await dbGet(
            "SELECT theme, animations_enabled, font_size, language FROM users WHERE id = ?",
            [req.user?.id]
        );
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({
            theme: user.theme,
            animationsEnabled: !!user.animations_enabled,
            fontSize: user.font_size,
            language: user.language,
        });
    } catch (err) {
        console.error("Error fetching customization settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/customization", async (req, res) => {
    try {
        const { theme, animationsEnabled, fontSize, language } = req.body;
        const updates: Record<string, any> = {};

        if (theme) updates.theme = theme;
        if (typeof animationsEnabled !== "undefined") updates.animations_enabled = animationsEnabled ? 1 : 0;
        if (fontSize) updates.font_size = fontSize;
        if (language) updates.language = language;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        const setClauses = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
        const values = [...Object.values(updates), req.user?.id];
        await dbRun(`UPDATE users SET ${setClauses} WHERE id = ?`, values);
        res.json({ message: "Customization settings updated successfully" });
    } catch (err) {
        console.error("Error updating customization settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== Privacy & Safety =====
router.get("/privacy", async (req, res) => {
    try {
        const user = await dbGet("SELECT snitch_risk FROM users WHERE id = ?", [req.user?.id]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const blockList = await dbAll(
            `SELECT u.username, b.blocked_user_id
             FROM blocked_users b
             JOIN users u ON b.blocked_user_id = u.id
             WHERE b.user_id = ?`,
            [req.user?.id]
        );

        res.json({
            blockList,
            snitchRisk: user.snitch_risk || 0,
        });
    } catch (err) {
        console.error("Error fetching privacy settings:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/privacy/block", async (req, res) => {
    try {
        const { blockedUserId } = req.body;
        if (!blockedUserId) return res.status(400).json({ message: "Blocked user ID is required" });

        const blockedUser = await dbGet("SELECT id FROM users WHERE id = ?", [blockedUserId]);
        if (!blockedUser) return res.status(404).json({ message: "User not found" });

        const alreadyBlocked = await dbGet(
            "SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
            [req.user?.id, blockedUserId]
        );
        if (alreadyBlocked) return res.status(400).json({ message: "User already blocked" });

        await dbRun(
            "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)",
            [req.user?.id, blockedUserId]
        );
        res.json({ message: "User blocked successfully" });
    } catch (err) {
        console.error("Error blocking user:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/privacy/unblock", async (req, res) => {
    try {
        const { blockedUserId } = req.body;
        if (!blockedUserId) return res.status(400).json({ message: "Blocked user ID is required" });

        const blockedEntry = await dbGet(
            "SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
            [req.user?.id, blockedUserId]
        );
        if (!blockedEntry) return res.status(400).json({ message: "User not blocked" });

        await dbRun(
            "DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
            [req.user?.id, blockedUserId]
        );
        res.json({ message: "User unblocked successfully" });
    } catch (err) {
        console.error("Error unblocking user:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
