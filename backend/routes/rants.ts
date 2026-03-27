import express from "express";
import { dbGet, dbAll, dbRun } from "../database";

const router = express.Router();

const VALID_REACTIONS = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];

// Get all rants with comments
router.get("/", async (req, res, next) => {
    try {
        const rants = await dbAll("SELECT * FROM rants ORDER BY created_at DESC LIMIT 50");
        
        // Get all comments for these rants
        const rantIds = rants.map((r: any) => r.id);
        let comments: any[] = [];
        
        if (rantIds.length > 0) {
            const placeholders = rantIds.map(() => '?').join(',');
            comments = await dbAll(
                `SELECT * FROM rant_comments WHERE rant_id IN (${placeholders}) ORDER BY created_at ASC`,
                rantIds
            );
        }
        
        // Group comments by rant_id
        const commentsByRant: Record<number, any[]> = {};
        for (const comment of comments) {
            if (!commentsByRant[comment.rant_id]) {
                commentsByRant[comment.rant_id] = [];
            }
            commentsByRant[comment.rant_id].push(comment);
        }
        
        // Attach comments to rants - return simpler structure
        const result = rants.map((rant: any) => ({
            id: rant.id,
            content: rant.content,
            category: rant.category,
            upvotes: rant.upvotes || 0,
            hugs: rant.hugs || 0,
            ask_for_advice: rant.ask_for_advice || 0,
            reactions: rant.reaction_counts || {},
            created_at: rant.created_at,
            comments: commentsByRant[rant.id] || []
        }));
        
        res.json(result);
    } catch (err) {
        console.error("Get rants error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create a rant
router.post("/create", async (req, res, next) => {
    try {
        const { email, content, category, askForAdvice } = req.body;
        
        if (!content || !category) {
            return res.status(400).json({ message: "Content and category required" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = await dbRun(
            "INSERT INTO rants (content, category, ask_for_advice, upvotes, hugs) VALUES (?, ?, ?, 0, 0)",
            [content, category, askForAdvice ? 1 : 0]
        );
        
        res.json({ message: "Rant posted!", rantId: result.lastID });
    } catch (err) {
        console.error("Create rant error:", err);
        res.status(500).json({ message: "Error: " + (err as Error).message });
    }
});

// Upvote a rant - simpler version
router.post("/upvote", async (req, res, next) => {
    try {
        const { rantId } = req.body;
        
        await dbRun("UPDATE rants SET upvotes = upvotes + 1 WHERE id = ?", [rantId]);
        res.json({ message: "Upvoted!" });
    } catch (err) {
        console.error("Upvote error:", err);
        res.status(500).json({ message: "Error upvoting" });
    }
});

// Send a hug
router.post("/hug", async (req, res, next) => {
    try {
        const { rantId } = req.body;
        await dbRun("UPDATE rants SET hugs = hugs + 1 WHERE id = ?", [rantId]);
        res.json({ message: "Hug sent!" });
    } catch (err) {
        res.status(500).json({ message: "Error sending hug" });
    }
});

// Reaction - track who reacted
router.post("/react", async (req, res, next) => {
    try {
        const { userEmail, rantId, reaction } = req.body;
        
        if (!rantId || !reaction) {
            return res.status(400).json({ message: "rantId and reaction required" });
        }

        // Update the JSON counts - simpler
        await dbRun(
            "UPDATE rants SET reaction_counts = COALESCE(reaction_counts, '{}'::jsonb) || jsonb_build_object(?, (COALESCE(reaction_counts->?, 0) + 1)) WHERE id = ?",
            [reaction, reaction, rantId]
        );
        
        res.json({ message: "Reacted!" });
    } catch (err) {
        console.error("React error:", err);
        res.status(500).json({ message: "Error reacting" });
    }
});

// Add comment
router.post("/comment", async (req, res, next) => {
    try {
        const { userEmail, rantId, content } = req.body;
        
        if (!rantId || !content) {
            return res.status(400).json({ message: "rantId and content required" });
        }

        // Store email to track who commented
        const result = await dbRun(
            "INSERT INTO rant_comments (rant_id, user_email, content) VALUES (?, ?, ?)",
            [rantId, userEmail, content]
        );
        
        res.json({ message: "Comment added!", commentId: result.lastID });
    } catch (err) {
        console.error("Comment error:", err);
        res.status(500).json({ message: "Error adding comment" });
    }
});

export default router;