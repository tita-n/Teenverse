import express from "express";
import { db, dbGet, dbAll, dbRun, withTransaction } from "../database";
import cloudinary from "cloudinary";
import multer from "multer";
import { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

const router = express.Router();

// ===== GET all posts (exclude rants) with JOIN - NO N+1 =====
router.get("/", async (req: express.Request, res: express.Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const posts = await dbAll(
            `SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type
             FROM posts p
             JOIN users u ON p.user_id = u.id
             WHERE p.mode != 'rant'
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        res.json(posts);
    } catch (err) {
        console.error("Get posts error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== GET news feed posts with JOIN =====
router.get("/newsfeed", async (req: express.Request, res: express.Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const posts = await dbAll(
            `SELECT p.*, u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type
             FROM posts p
             JOIN users u ON p.user_id = u.id
             ORDER BY p.created_at DESC
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        res.json(posts);
    } catch (err) {
        console.error("Get newsfeed error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== CREATE post =====
router.post("/create-post", upload.single("media"), async (req: express.Request, res: express.Response) => {
    const { email, content, mode } = req.body;
    const mediaFile = req.file;

    if (!email || !content || !mode) {
        return res.status(400).json({ message: "Email, content, and mode are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const user = await dbGet("SELECT id, username FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        if (mediaFile) {
            const uniqueId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
                const stream = cloudinary.v2.uploader.upload_stream(
                    {
                        resource_type: mediaFile.mimetype.startsWith("video") ? "video" : "image",
                        folder: "posts",
                        public_id: uniqueId,
                    },
                    (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
                        if (error) reject(error);
                        else resolve(result!);
                    }
                );
                stream.end(mediaFile.buffer);
            });

            mediaUrl = uploadResult.secure_url;
            mediaType = mediaFile.mimetype.startsWith("video") ? "video" : "image";
        }

        await dbRun(
            "INSERT INTO posts (user_id, content, mode, created_at, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, content, mode, new Date().toISOString(), mediaUrl, mediaType]
        );

        res.json({ message: "Post created successfully" });
    } catch (err) {
        console.error("Error creating post:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== EDIT post =====
router.put("/edit/:postId", async (req: express.Request, res: express.Response) => {
    const { email, content } = req.body;
    const postId = req.params.postId;
    if (!email || !content || !postId) {
        return res.status(400).json({ message: "Email, content, and postId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const post = await dbGet("SELECT user_id FROM posts WHERE id = ?", [postId]);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (post.user_id !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized: You can only edit your own posts" });
        }

        await dbRun("UPDATE posts SET content = ? WHERE id = ?", [content, postId]);
        res.json({ message: "Post updated successfully" });
    } catch (err) {
        console.error("Edit post error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== DELETE post =====
router.delete("/delete/:postId", async (req: express.Request, res: express.Response) => {
    const { email } = req.body;
    const postId = req.params.postId;
    if (!email || !postId) {
        return res.status(400).json({ message: "Email and postId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const post = await dbGet("SELECT user_id FROM posts WHERE id = ?", [postId]);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (post.user_id !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized: You can only delete your own posts" });
        }

        await dbRun("DELETE FROM posts WHERE id = ?", [postId]);
        res.json({ message: "Post deleted successfully" });
    } catch (err) {
        console.error("Delete post error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== LIKE post (transaction for race condition safety) =====
router.post("/like", async (req: express.Request, res: express.Response) => {
    const { email, postId } = req.body;
    if (!email || !postId) {
        return res.status(400).json({ message: "Email and postId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        await withTransaction(async () => {
            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) throw new Error("User not found");

            const post = await dbGet("SELECT id FROM posts WHERE id = ?", [postId]);
            if (!post) throw new Error("Post not found");

            const existingLike = await dbGet("SELECT id FROM likes WHERE post_id = ? AND user_id = ?", [postId, user.id]);
            if (existingLike) throw new Error("ALREADY_LIKED");

            await dbRun("INSERT INTO likes (post_id, user_id) VALUES (?, ?)", [postId, user.id]);
            await dbRun("UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId]);
        });
        res.json({ message: "Post liked successfully" });
    } catch (err: any) {
        if (err.message === "ALREADY_LIKED") {
            return res.status(400).json({ message: "Already liked this post" });
        }
        if (err.message === "Post not found") {
            return res.status(404).json({ message: "Post not found" });
        }
        if (err.message === "User not found") {
            return res.status(404).json({ message: "User not found" });
        }
        console.error("Like post error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== ADD reaction to post =====
router.post("/react", async (req: express.Request, res: express.Response) => {
    const { email, postId, reaction } = req.body;
    if (!email || !postId || !reaction) {
        return res.status(400).json({ message: "Email, postId, and reaction are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const user = await dbGet("SELECT id, username FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const post = await dbGet("SELECT reactions FROM posts WHERE id = ?", [postId]);
        if (!post) return res.status(404).json({ message: "Post not found" });

        let reactions: { [key: string]: string[] } = post.reactions ? JSON.parse(post.reactions) : {};
        reactions[reaction] = reactions[reaction] || [];
        if (!reactions[reaction].includes(user.username)) {
            reactions[reaction].push(user.username);
        }

        await dbRun("UPDATE posts SET reactions = ? WHERE id = ?", [JSON.stringify(reactions), postId]);
        res.json({ message: "Reaction added successfully" });
    } catch (err) {
        console.error("React to post error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== SHARE post =====
router.post("/share", async (req: express.Request, res: express.Response) => {
    const { email, postId, squadId } = req.body;
    if (!email || !postId || !squadId) {
        return res.status(400).json({ message: "Email, postId, and squadId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const post = await dbGet("SELECT content, mode, media_url, media_type FROM posts WHERE id = ?", [postId]);
        if (!post) return res.status(404).json({ message: "Post not found" });

        await dbRun(
            "INSERT INTO posts (user_id, content, mode, created_at, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, post.content, post.mode, new Date().toISOString(), post.media_url, post.media_type]
        );
        res.json({ message: "Post shared successfully" });
    } catch (err) {
        console.error("Share post error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== GET comments for multiple posts at once (batch) =====
router.post("/comments/batch", async (req: express.Request, res: express.Response) => {
    const { postIds } = req.body;
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
        return res.json({});
    }
    try {
        const placeholders = postIds.map(() => '?').join(',');

        // Fetch all comments for all posts in one query
        const comments = await dbAll(
            `SELECT c.*, u.username, u.profile_media_url, u.profile_media_type
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.post_id IN (${placeholders})
             ORDER BY c.pinned DESC, c.created_at ASC`,
            postIds
        );

        if (comments.length === 0) {
            const empty: { [key: number]: any[] } = {};
            for (const id of postIds) empty[id] = [];
            return res.json(empty);
        }

        // Batch fetch all replies
        const commentIds = comments.map((c: any) => c.id);
        const replyPlaceholders = commentIds.map(() => '?').join(',');
        const allReplies = await dbAll(
            `SELECT r.*, u.username, u.profile_media_url, u.profile_media_type
             FROM replies r
             JOIN users u ON r.user_id = u.id
             WHERE r.comment_id IN (${replyPlaceholders})
             ORDER BY r.created_at ASC`,
            commentIds
        );

        // Group replies by comment_id
        const repliesByComment: { [key: number]: any[] } = {};
        for (const reply of allReplies) {
            if (!repliesByComment[reply.comment_id]) {
                repliesByComment[reply.comment_id] = [];
            }
            repliesByComment[reply.comment_id].push(reply);
        }

        // Group comments by post_id
        const result: { [key: number]: any[] } = {};
        for (const comment of comments) {
            if (!result[comment.post_id]) {
                result[comment.post_id] = [];
            }
            result[comment.post_id].push({
                ...comment,
                replies: repliesByComment[comment.id] || [],
            });
        }

        // Ensure all requested postIds have an entry
        for (const id of postIds) {
            if (!result[id]) result[id] = [];
        }

        res.json(result);
    } catch (err) {
        console.error("Batch comments error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== GET comments for a post - FIX N+1 with JOIN =====
router.get("/comments/:postId", async (req: express.Request, res: express.Response) => {
    const postId = req.params.postId;
    try {
        // Single query: fetch all comments with their user info
        const comments = await dbAll(
            `SELECT c.*, u.username, u.profile_media_url, u.profile_media_type
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.post_id = ?
             ORDER BY c.pinned DESC, c.created_at ASC`,
            [postId]
        );

        if (comments.length === 0) {
            return res.json([]);
        }

        // Batch: fetch all replies for all comments in one query
        const commentIds = comments.map((c: any) => c.id);
        const placeholders = commentIds.map(() => '?').join(',');
        const allReplies = await dbAll(
            `SELECT r.*, u.username, u.profile_media_url, u.profile_media_type
             FROM replies r
             JOIN users u ON r.user_id = u.id
             WHERE r.comment_id IN (${placeholders})
             ORDER BY r.created_at ASC`,
            commentIds
        );

        // Group replies by comment_id
        const repliesByComment: { [key: number]: any[] } = {};
        for (const reply of allReplies) {
            if (!repliesByComment[reply.comment_id]) {
                repliesByComment[reply.comment_id] = [];
            }
            repliesByComment[reply.comment_id].push(reply);
        }

        // Attach replies to comments
        const result = comments.map((comment: any) => ({
            ...comment,
            replies: repliesByComment[comment.id] || [],
        }));

        res.json(result);
    } catch (err) {
        console.error("Get comments error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== ADD comment =====
router.post("/comments", async (req: express.Request, res: express.Response) => {
    const { email, postId, content } = req.body;
    if (!email || !postId || !content) {
        return res.status(400).json({ message: "Email, postId, and content are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        const post = await dbGet("SELECT id FROM posts WHERE id = ?", [parseInt(postId)]);
        if (!post) return res.status(404).json({ message: "Post not found" });

        await dbRun(
            "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
            [parseInt(postId), user.id, content, new Date().toISOString()]
        );
        res.json({ message: "Comment added successfully" });
    } catch (err) {
        console.error("Add comment error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== ADD reply to comment =====
router.post("/comments/reply", async (req: express.Request, res: express.Response) => {
    const { email, commentId, content } = req.body;
    if (!email || !commentId || !content) {
        return res.status(400).json({ message: "Email, commentId, and content are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) return res.status(404).json({ message: "User not found" });

        await dbRun(
            "INSERT INTO replies (comment_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
            [commentId, user.id, content, new Date().toISOString()]
        );
        res.json({ message: "Reply added successfully" });
    } catch (err) {
        console.error("Add reply error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== LIKE comment =====
router.post("/comments/like", async (req: express.Request, res: express.Response) => {
    const { email, commentId } = req.body;
    if (!email || !commentId) {
        return res.status(400).json({ message: "Email and commentId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        await withTransaction(async () => {
            const user = await dbGet("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) throw new Error("User not found");

            const comment = await dbGet("SELECT id FROM comments WHERE id = ?", [commentId]);
            if (!comment) throw new Error("Comment not found");

            const existingLike = await dbGet("SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?", [commentId, user.id]);
            if (existingLike) throw new Error("ALREADY_LIKED");

            await dbRun("INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)", [commentId, user.id]);
            await dbRun("UPDATE comments SET likes = likes + 1 WHERE id = ?", [commentId]);
        });
        res.json({ message: "Comment liked successfully" });
    } catch (err: any) {
        if (err.message === "ALREADY_LIKED") {
            return res.status(400).json({ message: "Already liked this comment" });
        }
        console.error("Like comment error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// ===== PIN comment =====
router.post("/comments/pin", async (req: express.Request, res: express.Response) => {
    const { email, commentId, postId } = req.body;
    if (!email || !commentId || !postId) {
        return res.status(400).json({ message: "Email, commentId, and postId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const post = await dbGet("SELECT user_id FROM posts WHERE id = ?", [postId]);
        if (!post) return res.status(404).json({ message: "Post not found" });

        if (post.user_id !== req.user.id) {
            return res.status(403).json({ message: "Unauthorized: You can only pin comments on your own posts" });
        }

        await withTransaction(async () => {
            await dbRun("UPDATE comments SET pinned = 0 WHERE post_id = ?", [postId]);
            await dbRun("UPDATE comments SET pinned = 1 WHERE id = ?", [commentId]);
        });

        res.json({ message: "Comment pinned successfully" });
    } catch (err) {
        console.error("Pin comment error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
