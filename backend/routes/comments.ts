import express from "express";
import { dbGet, dbAll, dbRun } from "../database";

const router = express.Router();

// Get comments for a post with replies
router.get("/comments/:postId", async (req, res, next) => {
    try {
        const postId = parseInt(req.params.postId);
        
        // Get all comments
        const comments = await dbAll(
            `SELECT c.*, u.username 
             FROM comments c 
             LEFT JOIN users u ON c.user_id = u.id 
             WHERE c.post_id = ? 
             ORDER BY c.pinned DESC, c.created_at ASC`,
            [postId]
        );
        
        // Get all replies
        const commentIds = comments.map((c: any) => c.id);
        let replies: any[] = [];
        
        if (commentIds.length > 0) {
            const placeholders = commentIds.map(() => '?').join(',');
            replies = await dbAll(
                `SELECT r.*, u.username 
                 FROM replies r 
                 LEFT JOIN users u ON r.user_id = u.id 
                 WHERE r.comment_id IN (${placeholders}) 
                 ORDER BY r.created_at ASC`,
                commentIds
            );
        }
        
        // Group replies by comment_id
        const repliesByComment: Record<number, any[]> = {};
        for (const reply of replies) {
            if (!repliesByComment[reply.comment_id]) {
                repliesByComment[reply.comment_id] = [];
            }
            repliesByComment[reply.comment_id].push(reply);
        }
        
        // Attach replies to each comment
        const result = comments.map((comment: any) => ({
            ...comment,
            replies: repliesByComment[comment.id] || []
        }));
        
        res.json(result);
    } catch (err) {
        console.error("Get comments error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add comment to post
router.post("/comments", async (req, res, next) => {
    try {
        const { email, postId, content } = req.body;
        
        if (!email || !postId || !content) {
            return res.status(400).json({ message: "Email, postId, and content required" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = await dbRun(
            "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)",
            [postId, user.id, content]
        );
        
        res.json({ message: "Comment added!", commentId: result.lastID });
    } catch (err) {
        console.error("Add comment error:", err);
        res.status(500).json({ message: "Error: " + (err as Error).message });
    }
});

// Add reply to comment  
router.post("/comments/reply", async (req, res, next) => {
    try {
        const { email, commentId, content } = req.body;
        
        if (!email || !commentId || !content) {
            return res.status(400).json({ message: "Email, commentId, content required" });
        }

        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = await dbRun(
            "INSERT INTO replies (comment_id, user_id, content) VALUES (?, ?, ?)",
            [commentId, user.id, content]
        );
        
        res.json({ message: "Reply added!", replyId: result.lastID });
    } catch (err) {
        console.error("Add reply error:", err);
        res.status(500).json({ message: "Error: " + (err as Error).message });
    }
});

// Like a comment
router.post("/comments/like", async (req, res, next) => {
    try {
        const { commentId } = req.body;
        if (!commentId) return res.status(400).json({ message: "commentId required" });
        
        await dbRun("UPDATE comments SET likes = COALESCE(likes, 0) + 1 WHERE id = ?", [commentId]);
        res.json({ message: "Liked!" });
    } catch (err) {
        res.status(500).json({ message: "Error" });
    }
});

export default router;