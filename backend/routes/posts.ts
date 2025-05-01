import express from "express";
import { db } from "../database";
import cloudinary from "cloudinary";
import multer from "multer";
import { UploadApiResponse, UploadApiErrorResponse } from "cloudinary";

// Configure Cloudinary
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = express.Router();

// Get all posts (for Dashboard, exclude rants) with pagination
router.get("/", async (req: express.Request, res: express.Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const posts = await db.all<Post>(
            `SELECT p.id, p.user_id, p.username, p.content, p.mode, p.likes, p.created_at, p.media_url, p.media_type, p.reactions,
                    u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.mode != 'rant'
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        res.json(posts);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch posts error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get news feed posts (include all posts) with pagination
router.get("/newsfeed", async (req: express.Request, res: express.Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const posts = await db.all<Post>(
            `SELECT p.id, p.user_id, p.username, p.content, p.mode, p.likes, p.created_at, p.media_url, p.media_type, p.reactions,
                    u.username as actual_username, u.verified, u.profile_media_url, u.profile_media_type
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?`,
            [limit, offset]
        );

        res.json(posts);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch newsfeed error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create a new post
router.post("/create-post", upload.single("media"), async (req: express.Request, res: express.Response) => {
    const Snap: Snap = {
        email: req.body.email,
        content: req.body.content,
        mode: req.body.mode,
        mediaFile: req.file,
    };

    if (!Snap.email || !Snap.content || !Snap.mode) {
        return res.status(400).json({ message: "Email, content, and mode are required" });
    }
    if (!req.user || req.user.email !== Snap.email) {
        return res.status(403).json({ message: "Unauthorized" });
    }

    try {
        const user = await db.get<User>("SELECT id, username FROM users WHERE email = ?", [Snap.email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        let mediaUrl: string | null = null;
        let mediaType: string | null = null;

        if (Snap.mediaFile) {
            const uniqueId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

            const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
                const stream = cloudinary.v2.uploader.upload_stream(
                    {
                        resource_type: Snap.mediaFile.mimetype.startsWith("video") ? "video" : "image",
                        folder: "posts",
                        public_id: uniqueId,
                    },
                    (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
                        if (error) reject(error);
                        resolve(result!);
                    }
                );
                stream.end(Snap.mediaFile.buffer);
            });

            mediaUrl = uploadResult.secure_url;
            mediaType = Snap.mediaFile.mimetype.startsWith("video") ? "video" : "image";
        }

        await db.run(
            "INSERT INTO posts (user_id, username, content, mode, created_at, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [user.id, user.username, Snap.content, Snap.mode, new Date().toISOString(), mediaUrl, mediaType]
        );

        res.json({ message: "Post created successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Create post error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Edit a post
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
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const post = await db.get<{ user_id: number }>("SELECT user_id FROM posts WHERE id = ?", [postId]);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        if (post.user_id !== user.id) {
            return res.status(403).json({ message: "Unauthorized: You can only edit your own posts" });
        }

        await db.run("UPDATE posts SET content = ? WHERE id = ?", [content, postId]);
        res.json({ message: "Post updated successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Edit post error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Delete a post
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
        const usr = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!usr) {
            return res.status(404).json({ message: "User not found" });
        }

        const post = await db.get<{ user_id: number }>("SELECT user_id FROM posts WHERE id = ?", [postId]);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        if (post.user_id !== usr.id) {
            return res.status(403).json({ message: "Unauthorized: You can only delete your own posts" });
        }

        await db.run("DELETE FROM posts WHERE id = ?", [postId]);
        res.json({ message: "Post deleted successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Delete post error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Like a post
router.post("/like", async (req: express.Request, res: express.Response) => {
    const { email, postId } = req.body;
    if (!email || !postId) {
        return res.status(400).json({ message: "Email and postId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    try {
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await db.run("UPDATE posts SET likes = likes + 1 WHERE id = ?", [postId]);
        res.json({ message: "Post liked successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Like post error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add reaction to a post
router.post("/react", async (req: express.Request, res: express.Response) => {
    const { email, postId, reaction } = req.body;
    if (!email || !postId || !reaction) {
        return res.status(400).json({ message: "Email, postId, and reaction are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    try {
        const user = await db.get<User>("SELECT id, username FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const post = await db.get<{ reactions: string }>("SELECT reactions FROM posts WHERE id = ?", [postId]);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        let reactions = post.reactions ? JSON.parse(post.reactions) : {};
        reactions[reaction] = reactions[reaction] || [];
        if (!reactions[reaction].includes(user.username)) {
            reactions[reaction].push(user.username);
        }

        await db.run("UPDATE posts SET reactions = ? WHERE id = ?", [JSON.stringify(reactions), postId]);
        res.json({ message: "Reaction added successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] React to post error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Share a post
router.post("/share", async (req: express.Request, res: express.Response) => {
    const { email, postId, squadId } = req.body;
    if (!email || !postId || !squadId) {
        return res.status(400).json({ message: "Email, postId, and squadId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    try {
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const post = await db.get<Post>(
            "SELECT content, mode, media_url, media_type FROM posts WHERE id = ?",
            [postId]
        );
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        await db.run(
            "INSERT INTO posts (user_id, content, mode, created_at, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?)",
            [user.id, post.content, post.mode, new Date().toISOString(), post.media_url, post.media_type]
        );

        await db.run(
            "INSERT INTO post_shares (post_id, user_id, squad_id, created_at) VALUES (?, ?, ?, ?)",
            [postId, user.id, squadId, new Date().toISOString()]
        );

        res.json({ message: "Post shared successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Share post error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get comments for a post
router.get("/comments/:postId", async (req: express.Request, res: express.Response) => {
    const postId = req.params.postId;
    try {
        const comments = await db.all<Comment>(
            `SELECT c.id, c.post_id, c.user_id, c.content, c.created_at, c.pinned, c.likes,
                    u.username, u.profile_media_url, u.profile_media_type
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC`,
            [postId]
        );

        for (const comment of comments) {
            const replies = await db.all<Reply>(
                `SELECT r.id, r.comment_id, r.user_id, r.content, r.created_at,
                        u.username, u.profile_media_url, u.profile_media_type
                FROM replies r
                JOIN users u ON r.user_id = u.id
                WHERE r.comment_id = ?
                ORDER BY r.created_at ASC`,
                [comment.id]
            );
            comment.replies = replies;
        }

        res.json(comments);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Fetch comments error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add a comment
router.post("/comments", async (req: express.Request, res: express.Response) => {
    const { email, postId, content } = req.body;
    if (!email || !postId || !content) {
        return res.status(400).json({ message: "Email, postId, and content are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    try {
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const post = await db.get<{ id: number }>("SELECT id FROM posts WHERE id = ?", [parseInt(postId)]);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }

        await db.run(
            "INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
            [parseInt(postId), user.id, content, new Date().toISOString()]
        );
        res.json({ message: "Comment added successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Add comment error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add a reply to a comment
router.post("/comments/reply", async (req: express.Request, res: express.Response) => {
    const { email, commentId, content } = req.body;
    if (!email || !commentId || !content) {
        return res.status(400).json({ message: "Email, commentId, and content are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    try {
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await db.run(
            "INSERT INTO replies (comment_id, user_id, content, created_at) VALUES (?, ?, ?, ?)",
            [commentId, user.id, content, new Date().toISOString()]
        );
        res.json({ message: "Reply added successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Add reply error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Like a comment
router.post("/comments/like", async (req: express.Request, res: express.Response) => {
    const { email, commentId } = req.body;
    if (!email || !commentId) {
        return res.status(400).json({ message: "Email and commentId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    try {
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        await db.run("UPDATE comments SET likes = likes + 1 WHERE id = ?", [commentId]);
        res.json({ message: "Comment liked successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Like comment error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Pin a comment
router.post("/comments/pin", async (req: express.Request, res: express.Response) => {
    const { email, commentId, postId } = req.body;
    if (!email || !commentId || !postId) {
        return res.status(400).json({ message: "Email, commentId, and postId are required" });
    }
    if (!req.user || req.user.email !== email) {
        return res.status(403).json({ message: "Unauthorized" });
    }
    try {
        const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const post = await db.get<{ user_id: number }>("SELECT user_id FROM posts WHERE id = ?", [postId]);
        if (!post) {
            return res.status(404).json({ message: "Post not found" });
        }
        if (post.user_id !== user.id) {
            return res.status(403).json({ message: "Unauthorized: You can only pin comments on your own posts" });
        }

        await db.run("UPDATE comments SET pinned = 0 WHERE post_id = ?", [postId]);
        await db.run("UPDATE comments SET pinned = 1 WHERE id = ?", [commentId]);
        res.json({ message: "Comment pinned successfully" });
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Pin comment error:`, err);
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;