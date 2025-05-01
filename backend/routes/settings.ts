import express from "express";
import bcrypt from "bcrypt";
import { db } from "../database";
import { User } from "../types";

const router = express.Router();

// Helper to fetch user by email
async function getUserByEmail(email: string): Promise<User | null> {
    return await db.get<User>(
        `SELECT id, email, username, password, dob, bio, background_theme, theme, 
                animations_enabled, font_size, language, coins, spending_restrictions, 
                auto_earn_uploads, snitch_risk
         FROM users WHERE email = ?`,
        [email]
    );
}

// Helper to update user settings
async function updateUserSettings(email: string, updates: Record<string, any>): Promise<void> {
    const fields = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
    const values = [...Object.values(updates), email];
    await db.run(`UPDATE users SET ${fields} WHERE email = ?`, values);
}

// 1. Account Settings
// GET: Fetch account details (username, email, password [masked], dob)
router.get("/account", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            username: user.username,
            email: user.email,
            password: "********", // Masked for security
            dob: user.dob || "",
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch account settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Update username, email, or password
router.post("/account", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { username, email, password } = req.body;
        const updates: Record<string, any> = {};

        if (username) updates.username = username;
        if (email) updates.email = email;
        if (password) updates.password = await bcrypt.hash(password, 10);

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        await updateUserSettings(req.user.email, updates);
        res.json({ message: "Account updated successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Update account settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// 2. Profile Settings
// GET: Fetch profile settings (bio, profilePic, backgroundTheme)
router.get("/profile", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            bio: user.bio || "",
            profilePic: user.profile_media_url || "", // Using schema field
            backgroundTheme: user.background_theme || "default",
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch profile settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Update bio or backgroundTheme
router.post("/profile", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { bio, backgroundTheme } = req.body;
        const updates: Record<string, any> = {};

        if (bio) updates.bio = bio;
        if (backgroundTheme) updates.background_theme = backgroundTheme;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        await updateUserSettings(req.user.email, updates);
        res.json({ message: "Profile updated successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Update profile settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// 3. Coin & Economy Settings
// GET: Fetch coin balance and history
router.get("/economy", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        interface CoinFlipHistory {
            id: number;
            user_id: number;
            amount: number;
            result: string;
            created_at: string;
        }

        const history = await db.all<CoinFlipHistory>(
            "SELECT id, user_id, amount, result, created_at FROM coin_flip_history WHERE user_id = ? ORDER BY created_at DESC",
            [user.id]
        );

        res.json({
            balance: user.coins || 0,
            history,
            spendingRestrictions: !!user.spending_restrictions,
            autoEarn: {
                uploads: !!user.auto_earn_uploads,
            },
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch economy settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Update spending restrictions and auto-earn settings
router.post("/economy", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { spendingRestrictions, autoEarnUploads } = req.body;
        const updates: Record<string, any> = {};

        if (typeof spendingRestrictions !== "undefined") {
            updates.spending_restrictions = spendingRestrictions ? 1 : 0;
        }
        if (typeof autoEarnUploads !== "undefined") {
            updates.auto_earn_uploads = autoEarnUploads ? 1 : 0;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        await updateUserSettings(req.user.email, updates);
        res.json({ message: "Economy settings updated successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Update economy settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// 4. Customization Settings
// GET: Fetch customization settings (theme, animations, fontSize, language)
router.get("/customization", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({
            theme: user.theme || "default",
            animationsEnabled: !!user.animations_enabled,
            fontSize: user.font_size || "medium",
            language: user.language || "en",
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch customization settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Update customization settings
router.post("/customization", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { theme, animationsEnabled, fontSize, language } = req.body;
        const updates: Record<string, any> = {};

        if (theme) updates.theme = theme;
        if (typeof animationsEnabled !== "undefined") {
            updates.animations_enabled = animationsEnabled ? 1 : 0;
        }
        if (fontSize) updates.font_size = fontSize;
        if (language) updates.language = language;

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: "No updates provided" });
        }

        await updateUserSettings(req.user.email, updates);
        res.json({ message: "Customization settings updated successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Update customization settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// 5. Privacy & Safety
// GET: Fetch block list and snitch risk meter
router.get("/privacy", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const user = await getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        interface BlockListEntry {
            username: string;
            blocked_user_id: number;
        }

        const blockList = await db.all<BlockListEntry>(
            `SELECT u.username, u.id as blocked_user_id 
             FROM blocked_users b 
             JOIN users u ON b.blocked_user_id = u.id 
             WHERE b.user_id = ?`,
            [user.id]
        );

        res.json({
            blockList,
            snitchRisk: user.snitch_risk || 0,
        });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch privacy settings error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Block a user
router.post("/privacy/block", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { blockedUserId } = req.body;
        const user = await getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!blockedUserId) {
            return res.status(400).json({ message: "Blocked user ID is required" });
        }

        const blockedUser = await db.get<User>("SELECT id FROM users WHERE id = ?", [blockedUserId]);
        if (!blockedUser) {
            return res.status(404).json({ message: "Blocked user not found" });
        }

        const alreadyBlocked = await db.get<{ id: number }>(
            "SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
            [user.id, blockedUserId]
        );
        if (alreadyBlocked) {
            return res.status(400).json({ message: "User already blocked" });
        }

        await db.run(
            "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)",
            [user.id, blockedUserId]
        );

        res.json({ message: "User blocked successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Block user error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// POST: Unblock a user
router.post("/privacy/unblock", async (req: express.Request, res: express.Response) => {
    try {
        if (!req.user || !req.user.email) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { blockedUserId } = req.body;
        const user = await getUserByEmail(req.user.email);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!blockedUserId) {
            return res.status(400).json({ message: "Blocked user ID is required" });
        }

        const blockedEntry = await db.get<{ id: number }>(
            "SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
            [user.id, blockedUserId]
        );
        if (!blockedEntry) {
            return res.status(400).json({ message: "User not blocked" });
        }

        await db.run(
            "DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
            [user.id, blockedUserId]
        );

        res.json({ message: "User unblocked successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Unblock user error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;