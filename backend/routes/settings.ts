import express from "express";
import bcrypt from "bcrypt";
import { initDb } from './database';

// Create Express app and router
const app = express();
const router = express.Router();

// Initialize database and mount routes
initDb().then((db) => {
    app.set('db', db); // Store db in app for routes to access

    // Middleware to ensure db is available in routes
    router.use((req, res, next) => {
        req.db = app.get('db');
        if (!req.db) {
            return res.status(500).json({ message: "Database not initialized" });
        }
        next();
    });

    // Helper to fetch user by email
    const getUserByEmail = (email: string): Promise<any> => {
        return new Promise((resolve, reject) => {
            req.db.get("SELECT * FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });
    };

    // Helper to update user settings
    const updateUserSettings = (email: string, updates: Record<string, any>): Promise<void> => {
        const fields = Object.keys(updates).map((key) => `${key} = ?`).join(", ");
        const values = [...Object.values(updates), email];
        return new Promise((resolve, reject) => {
            req.db.run(`UPDATE users SET ${fields} WHERE email = ?`, values, (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    };

    // 1. Account Settings
    // GET: Fetch account details (username, email, password [masked], dob)
    router.get("/account", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const user = await getUserByEmail(req.user.email);
            if (!user) return res.status(404).json({ message: "User not found" });

            res.json({
                username: user.username,
                email: user.email,
                password: "********", // Masked for security
                dob: user.dob,
            });
        } catch (err) {
            console.error("Error fetching account settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // POST: Update username, email, or password
    router.post("/account", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
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
            console.error("Error updating account settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // 2. Profile Settings
    // GET: Fetch profile settings (bio, profilePic, backgroundTheme)
    router.get("/profile", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const user = await getUserByEmail(req.user.email);
            if (!user) return res.status(404).json({ message: "User not found" });

            res.json({
                bio: user.bio || "",
                profilePic: user.profile_media_url || "", // Use correct column name
                backgroundTheme: user.background_theme || "default",
            });
        } catch (err) {
            console.error("Error fetching profile settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // POST: Update bio or backgroundTheme (profilePic will be added later with Cloudinary)
    router.post("/profile", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
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
            console.error("Error updating profile settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // 3. Coin & Economy Settings
    // GET: Fetch coin balance and history
    router.get("/economy", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const user = await getUserByEmail(req.user.email);
            if (!user) return res.status(404).json({ message: "User not found" });

            const history = await new Promise<any[]>((resolve, reject) => {
                req.db.all("SELECT * FROM coin_flip_history WHERE user_id = ? ORDER BY created_at DESC", [user.id], (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            });

            res.json({
                balance: user.coins || 0,
                history,
                spendingRestrictions: !!user.spending_restrictions,
                autoEarn: {
                    uploads: !!user.auto_earn_uploads,
                },
            });
        } catch (err) {
            console.error("Error fetching economy settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // POST: Update spending restrictions and auto-earn settings
    router.post("/economy", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const { spendingRestrictions, autoEarnUploads } = req.body;
            const updates: Record<string, any> = {};

            if (typeof spendingRestrictions !== "undefined") updates.spending_restrictions = spendingRestrictions ? 1 : 0;
            if (typeof autoEarnUploads !== "undefined") updates.auto_earn_uploads = autoEarnUploads ? 1 : 0;

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ message: "No updates provided" });
            }

            await updateUserSettings(req.user.email, updates);
            res.json({ message: "Economy settings updated successfully" });
        } catch (err) {
            console.error("Error updating economy settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // 4. Customization Settings
    // GET: Fetch customization settings (theme, animations, fontSize, language)
    router.get("/customization", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const user = await getUserByEmail(req.user.email);
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

    // POST: Update customization settings
    router.post("/customization", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const { theme, animationsEnabled, fontSize, language } = req.body;
            const updates: Record<string, any> = {};

            if (theme) updates.theme = theme;
            if (typeof animationsEnabled !== "undefined") updates.animations_enabled = animationsEnabled ? 1 : 0;
            if (fontSize) updates.font_size = fontSize;
            if (language) updates.language = language;

            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ message: "No updates provided" });
            }

            await updateUserSettings(req.user.email, updates);
            res.json({ message: "Customization settings updated successfully" });
        } catch (err) {
            console.error("Error updating customization settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // 5. Privacy & Safety
    // GET: Fetch block list and snitch risk meter
    router.get("/privacy", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const user = await getUserByEmail(req.user.email);
            if (!user) return res.status(404).json({ message: "User not found" });

            const blockList = await new Promise<any[]>((resolve, reject) => {
                req.db.all(
                    `SELECT u.username, u.id as blocked_user_id 
                     FROM blocked_users b 
                     JOIN users u ON b.blocked_user_id = u.id 
                     WHERE b.user_id = ?`,
                    [user.id],
                    (err, rows) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });

            res.json({
                blockList,
                snitchRisk: user.snitch_risk || 0,
            });
        } catch (err) {
            console.error("Error fetching privacy settings:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // POST: Block a user
    router.post("/privacy/block", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const { blockedUserId } = req.body;
            const user = await getUserByEmail(req.user.email);
            if (!user) return res.status(404).json({ message: "User not found" });

            if (!blockedUserId) return res.status(400).json({ message: "Blocked user ID is required" });

            // Check if the user exists
            const blockedUser = await new Promise<any>((resolve, reject) => {
                req.db.get("SELECT * FROM users WHERE id = ?", [blockedUserId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!blockedUser) return res.status(404).json({ message: "Blocked user not found" });

            // Check if already blocked
            const alreadyBlocked = await new Promise<any>((resolve, reject) => {
                req.db.get(
                    "SELECT * FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
                    [user.id, blockedUserId],
                    (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });
            if (alreadyBlocked) return res.status(400).json({ message: "User already blocked" });

            // Block the user
            await new Promise<void>((resolve, reject) => {
                req.db.run(
                    "INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)",
                    [user.id, blockedUserId],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });

            res.json({ message: "User blocked successfully" });
        } catch (err) {
            console.error("Error blocking user:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // POST: Unblock a user
    router.post("/privacy/unblock", async (req, res) => {
        try {
            if (!req.user) {
                return res.status(401).json({ message: "Authentication required" });
            }
            const { blockedUserId } = req.body;
            const user = await getUserByEmail(req.user.email);
            if (!user) return res.status(404).json({ message: "User not found" });

            if (!blockedUserId) return res.status(400).json({ message: "Blocked user ID is required" });

            // Check if the user is blocked
            const blockedEntry = await new Promise<any>((resolve, reject) => {
                req.db.get(
                    "SELECT * FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
                    [user.id, blockedUserId],
                    (err, row) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });
            if (!blockedEntry) return res.status(400).json({ message: "User not blocked" });

            // Unblock the user
            await new Promise<void>((resolve, reject) => {
                req.db.run(
                    "DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
                    [user.id, blockedUserId],
                    (err) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });

            res.json({ message: "User unblocked successfully" });
        } catch (err) {
            console.error("Error unblocking user:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // Mount the router
    app.use('/settings', router);
}).catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1); // Exit or handle gracefully
});

export default router;
