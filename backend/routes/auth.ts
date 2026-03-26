import express from "express";
import bcrypt from "bcryptjs";
import { dbGet, dbRun } from "../database";
import { generateToken } from "../middleware/auth";
import { AppError } from "../middleware/errorHandler";

const router = express.Router();

const validatePassword = (password: string): { valid: boolean; message: string } => {
    if (!password || password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters long" };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one uppercase letter" };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one lowercase letter" };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: "Password must contain at least one number" };
    }
    return { valid: true, message: "" };
};

const sanitizeHtml = (str: string): string => {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
        .replace(/\//g, "&#x2F;");
};

// Register
router.post("/register", async (req, res, next) => {
    try {
        const { email, username, password, dob } = req.body;

        if (!email || !username || !password || !dob) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.valid) {
            return res.status(400).json({ message: passwordCheck.message });
        }

        const sanitizedUsername = sanitizeHtml(username);
        if (sanitizedUsername.length < 3 || sanitizedUsername.length > 20) {
            return res.status(400).json({ message: "Username must be 3-20 characters" });
        }

        // Check existing email
        const existingEmail = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (existingEmail) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Check existing username
        const existingUsername = await dbGet("SELECT id FROM users WHERE username = ?", [sanitizedUsername]);
        if (existingUsername) {
            return res.status(400).json({ message: "Username already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        
        await dbRun(
            "INSERT INTO users (email, username, password, dob, verified, role) VALUES (?, ?, ?, ?, ?, ?)",
            [email, sanitizedUsername, hashedPassword, dob, 0, "user"]
        );

        res.json({ message: "Registered successfully!" });
    } catch (err) {
        console.error("Register error:", err);
        next(err);
    }
});

// Login
router.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);

        const passwordMatch = user ? await bcrypt.compare(password, user.password) : false;

        if (!user || !passwordMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            verified: user.verified,
            role: user.role || "user",
        });

        res.json({
            token,
            message: "Login successful",
            username: user.username,
            id: user.id,
        });
    } catch (err) {
        console.error("Login error:", err);
        next(err);
    }
});

// Get current user
router.get("/me", async (req, res, next) => {
    try {
        const user = await dbGet(
            "SELECT id, username, email, dob, verified, xp, coins, creator_badge, tier, wins, losses, title, legend_status, bio, background_theme, profile_media_url, profile_media_type, snitch_status, snitch_risk, theme, animations_enabled, font_size, language FROM users WHERE email = ?",
            [req.user.email]
        );

        if (!user) return res.status(404).json({ message: "User not found" });

        let level = Math.floor(user.xp / 10) + 1;
        if (level > 100) level = 100;

        let rank = "Newbie";
        if (level >= 11) rank = "Rising Star";
        if (level >= 26) rank = "Clout Lord";
        if (level >= 51) rank = "Elite";
        if (level >= 76) rank = "Titan";
        if (level >= 100) rank = "Shadow Rank";

        const totalLikesRow = await dbGet<{ total: number }>("SELECT SUM(likes) as total FROM posts WHERE user_id = ?", [user.id]);

        res.json({
            ...user,
            level,
            rank,
            totalLikes: totalLikesRow?.total || 0,
        });
    } catch (err) {
        console.error("Get user error:", err);
        next(err);
    }
});

export default router;
