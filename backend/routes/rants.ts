import express from "express";
import { dbGet, dbAll, dbRun } from "../database";

const router = express.Router();

const VALID_RANT_CATEGORIES = [
    "School Life",
    "Family Drama",
    "Relationship Wahala",
    "Self-Doubt & Mental Struggles",
    "Fake Friends",
    "Pressure & Anxiety",
    "Just Need to Vent",
];

const VALID_REACTIONS = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];

// Get all rants
router.get("/", async (req, res, next) => {
    try {
        const { category } = req.query;
        let query = "SELECT * FROM rants";
        const params: any[] = [];

        if (category && typeof category === "string") {
            query += " WHERE category = ?";
            params.push(category);
        }

        query += " ORDER BY created_at DESC";

        const rants: any[] = await dbAll(query, params);

        if (rants.length === 0) {
            return res.json([]);
        }

        // Batch fetch all rant comments
        const rantIds = rants.map((r: any) => r.id);
        const placeholders = rantIds.map(() => "?").join(",");
        const allComments = await dbAll(
            `SELECT * FROM rant_comments WHERE rant_id IN (${placeholders}) ORDER BY created_at ASC`,
            rantIds
        );

        // Group comments by rant_id
        const commentsByRant: Record<number, any[]> = {};
        for (const comment of allComments) {
            if (!commentsByRant[comment.rant_id]) {
                commentsByRant[comment.rant_id] = [];
            }
            commentsByRant[comment.rant_id].push(comment);
        }

        const result = rants.map((rant: any) => ({
            ...rant,
            comments: commentsByRant[rant.id] || [],
        }));

        res.json(result);
    } catch (err) {
        console.error("Fetch rants error:", err);
        next(err);
    }
});

// Create a rant
router.post("/create", async (req, res, next) => {
    try {
        const { email, content, category, askForAdvice } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!content || !category) {
            return res.status(400).json({ message: "Content and category are required" });
        }

        if (!VALID_RANT_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: "Invalid category" });
        }

        const user = await dbGet("SELECT id, xp, coins, role FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        await dbRun(
            "INSERT INTO rants (content, category, ask_for_advice) VALUES (?, ?, ?)",
            [content, category, askForAdvice ? 1 : 0]
        );

        // Award XP and coins
        let xpBonus = 5;
        let coinBonus = 5;
        if (user.role === "admin") {
            xpBonus += 5;
            coinBonus += 5;
        }

        const newXP = user.xp + xpBonus;
        const newCoins = user.coins + coinBonus;
        await dbRun("UPDATE users SET xp = ?, coins = ? WHERE id = ?", [newXP, newCoins, user.id]);

        res.json({ message: `Rant posted anonymously! +${xpBonus} XP and +${coinBonus} coins`, newXP, newCoins });
    } catch (err) {
        console.error("Create rant error:", err);
        next(err);
    }
});

// Upvote a rant - only once per user
router.post("/upvote", async (req, res, next) => {
    try {
        const { email, rantId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });
        
        const rant = await dbGet("SELECT id FROM rants WHERE id = ?", [rantId]);
        if (!rant) return res.status(404).json({ message: "Rant not found" });

        // Check if already upvoted using email to track
        const alreadyUpvoted = await dbGet(
            "SELECT 1 FROM rant_upvotes WHERE rant_id = ? AND user_email = ?", 
            [rantId, email]
        );
        if (alreadyUpvoted) {
            return res.status(400).json({ message: "Already upvoted" });
        }
        
        await dbRun("INSERT INTO rant_upvotes (rant_id, user_email) VALUES (?, ?)", [rantId, email]);
        await dbRun("UPDATE rants SET upvotes = upvotes + 1 WHERE id = ?", [rantId]);
        res.json({ message: "Upvoted!" });
    } catch (err) {
        console.error("Upvote rant error:", err);
        next(err);
    }
});

// Add a reaction to a rant - only one reaction per user
router.post("/react", async (req, res, next) => {
    try {
        const { email, rantId, reaction } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!VALID_REACTIONS.includes(reaction)) {
            return res.status(400).json({ message: "Invalid reaction" });
        }

        const rant = await dbGet("SELECT reactions FROM rants WHERE id = ?", [rantId]);
        if (!rant) return res.status(404).json({ message: "Rant not found" });

        // Check if user already reacted
        const existingReaction = await dbGet(
            "SELECT reaction FROM rant_reactions WHERE rant_id = ? AND user_email = ?",
            [rantId, email]
        );
        
        if (existingReaction) {
            // Replace reaction if different
            if (existingReaction.reaction !== reaction) {
                await dbRun("UPDATE rant_reactions SET reaction = ? WHERE rant_id = ? AND user_email = ?", [reaction, rantId, email]);
            }
            return res.json({ message: "Reaction updated!" });
        }
        
        // Add new reaction
        await dbRun("INSERT INTO rant_reactions (rant_id, user_email, reaction) VALUES (?, ?, ?)", [rantId, email, reaction]);

        let reactions: Record<string, number> = {};
        if (rant.reactions) {
            try { reactions = JSON.parse(rant.reactions); }
            catch { reactions = {}; }
        }

        reactions[reaction] = (reactions[reaction] || 0) + 1;
        await dbRun("UPDATE rants SET reactions = ? WHERE id = ?", [JSON.stringify(reactions), rantId]);
        res.json({ message: "Reacted!" });
    } catch (err) {
        console.error("Upvote rant error:", err);
        next(err);
    }
});

// Add a reaction to a rant
router.post("/react", async (req, res, next) => {
    try {
        const { email, rantId, reaction } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        if (!VALID_REACTIONS.includes(reaction)) {
            return res.status(400).json({ message: "Invalid reaction" });
        }

        const rant = await dbGet("SELECT reactions FROM rants WHERE id = ?", [rantId]);
        if (!rant) return res.status(404).json({ message: "Rant not found" });

        let reactions: Record<string, number> = {};
        try {
            reactions = JSON.parse(rant.reactions || "{}");
        } catch {
            reactions = {};
        }

        reactions[reaction] = (reactions[reaction] || 0) + 1;
        await dbRun("UPDATE rants SET reactions = ? WHERE id = ?", [JSON.stringify(reactions), rantId]);

        res.json({ message: "Reaction added!" });
    } catch (err) {
        console.error("React to rant error:", err);
        next(err);
    }
});

// Send an anonymous hug
router.post("/hug", async (req, res, next) => {
    try {
        const { email, rantId } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const rant = await dbGet("SELECT id FROM rants WHERE id = ?", [rantId]);
        if (!rant) return res.status(404).json({ message: "Rant not found" });

        await dbRun("UPDATE rants SET hugs = hugs + 1 WHERE id = ?", [rantId]);
        res.json({ message: "Hug sent! 💖" });
    } catch (err) {
        console.error("Send hug error:", err);
        next(err);
    }
});

// Add a comment to a rant
router.post("/comment", async (req, res, next) => {
    try {
        const { email, rantId, content } = req.body;
        if (req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const rant = await dbGet("SELECT id FROM rants WHERE id = ?", [rantId]);
        if (!rant) return res.status(404).json({ message: "Rant not found" });

        await dbRun("INSERT INTO rant_comments (rant_id, content) VALUES (?, ?)", [rantId, content]);
        res.json({ message: "Comment added anonymously!" });
    } catch (err) {
        console.error("Add rant comment error:", err);
        next(err);
    }
});

export default router;
