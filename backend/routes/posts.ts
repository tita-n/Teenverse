import express from "express";
import { db } from "../database";

const router = express.Router();

// Get all posts (for Dashboard, exclude rants)
router.get("/", async (req: express.Request, res: express.Response) => {
    try {
        const posts: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT p.*, u.username as actual_username FROM posts p JOIN users u ON p.user_id = u.id WHERE p.mode != 'rant' ORDER BY p.created_at DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json(posts);
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get news feed posts (mode: "main", exclude rants)
router.get("/newsfeed", async (req: express.Request, res: express.Response) => {
    try {
        const posts: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT p.*, u.username as actual_username FROM posts p JOIN users u ON p.user_id = u.id WHERE p.mode = 'main' AND p.mode != 'rant' ORDER BY p.created_at DESC",
                [],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        res.json(posts);
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Get comments for a post
router.get("/comments/:postId", async (req: express.Request, res: express.Response) => {
    try {
        const postId = parseInt(req.params.postId);
        const comments: any[] = await new Promise<any[]>((resolve, reject) => {
            db.all(
                "SELECT * FROM post_comments WHERE post_id = ? ORDER BY created_at ASC",
                [postId],
                (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                }
            );
        });

        // Fetch replies for each comment
        for (const comment of comments) {
            const replies: any[] = await new Promise<any[]>((resolve, reject) => {
                db.all(
                    "SELECT * FROM comment_replies WHERE comment_id = ? ORDER BY created_at ASC",
                    [comment.id],
                    (err, rows) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });
            comment.replies = replies;

            // Fetch like count for each comment
            const likeCount: number = await new Promise<number>((resolve, reject) => {
                db.get(
                    "SELECT COUNT(*) as count FROM comment_likes WHERE comment_id = ?",
                    [comment.id],
                    (err, row: any) => {
                        if (err) reject(err);
                        resolve(row.count);
                    }
                );
            });
            comment.likes = likeCount;
        }

        res.json(comments);
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create a comment
router.post("/comments", async (req: express.Request, res: express.Response) => {
    try {
        const { email, postId, content } = req.body;
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO post_comments (post_id, user_id, username, content) VALUES (?, ?, ?, ?)",
                [postId, user.id, user.username, content],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Comment added successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Create a reply to a comment
router.post("/comments/reply", async (req: express.Request, res: express.Response) => {
    try {
        const { email, commentId, content } = req.body;
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id, username FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO comment_replies (comment_id, user_id, username, content) VALUES (?, ?, ?, ?)",
                [commentId, user.id, user.username, content],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Reply added successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Like a comment
router.post("/comments/like", async (req: express.Request, res: express.Response) => {
    try {
        const { email, commentId } = req.body;
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT OR IGNORE INTO comment_likes (comment_id, user_id) VALUES (?, ?)",
                [commentId, user.id],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Comment liked!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Pin a comment (only by post creator)
router.post("/comments/pin", async (req: express.Request, res: express.Response) => {
    try {
        const { email, commentId, postId } = req.body;
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const post: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT user_id FROM posts WHERE id = ?", [postId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!post || post.user_id !== user.id) {
            return res.status(403).json({ message: "Only the post creator can pin comments" });
        }

        // Unpin any existing pinned comment
        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE post_comments SET pinned = 0 WHERE post_id = ? AND pinned = 1",
                [postId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Pin the new comment
        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE post_comments SET pinned = 1 WHERE id = ?",
                [commentId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Comment pinned!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Add a reaction to a post
router.post("/react", async (req: express.Request, res: express.Response) => {
    try {
        const { email, postId, reaction } = req.body;
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const validReactions = ["Deadass", "Big Mood", "Mid", "Facts", "Cap", "Slay", "No Cap", "Vibes", "Bet", "L", "W"];
        if (!validReactions.includes(reaction)) {
            return res.status(400).json({ message: "Invalid reaction" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const post: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT reactions FROM posts WHERE id = ?", [postId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!post) return res.status(404).json({ message: "Post not found" });

        // Define the type for reactions: a dictionary where keys are reaction names and values are arrays of user IDs (as strings)
        const reactions: { [reaction: string]: string[] } = post.reactions ? JSON.parse(post.reactions) : {};
        const userIdStr = user.id.toString();

        // Check if user has already reacted
        let userReaction = null;
        for (const [react, users] of Object.entries(reactions)) {
            if (users.includes(userIdStr)) { // Now TypeScript knows `users` is a string array
                userReaction = react;
                break;
            }
        }

        if (userReaction) {
            return res.status(400).json({ message: "You have already reacted to this post" });
        }

        // Add the new reaction
        if (!reactions[reaction]) {
            reactions[reaction] = [];
        }
        reactions[reaction].push(userIdStr);

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE posts SET reactions = ? WHERE id = ?",
                [JSON.stringify(reactions), postId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Reaction added!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Edit a post (within 5 minutes)
router.put("/edit/:postId", async (req: express.Request, res: express.Response) => {
    try {
        const { email, content } = req.body;
        const postId = parseInt(req.params.postId);
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const post: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT user_id, created_at FROM posts WHERE id = ?", [postId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!post) return res.status(404).json({ message: "Post not found" });
        if (post.user_id !== user.id) {
            return res.status(403).json({ message: "You can only edit your own posts" });
        }

        const postDate = new Date(post.created_at);
        const now = new Date();
        const timeDiff = (now.getTime() - postDate.getTime()) / 1000 / 60; // Difference in minutes
        if (timeDiff > 5) {
            return res.status(403).json({ message: "You can only edit a post within 5 minutes of posting" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run(
                "UPDATE posts SET content = ? WHERE id = ?",
                [content, postId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Post updated successfully!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

// Share a post to a squad
router.post("/share", async (req: express.Request, res: express.Response) => {
    try {
        const { email, postId, squadId } = req.body;
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const user: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!user) return res.status(404).json({ message: "User not found" });

        const post: any = await new Promise<any>((resolve, reject) => {
            db.get("SELECT id FROM posts WHERE id = ?", [postId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!post) return res.status(404).json({ message: "Post not found" });

        const isMember: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT squad_id FROM squad_members WHERE squad_id = ? AND user_id = ?",
                [squadId, user.id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        const isCreator: any = await new Promise<any>((resolve, reject) => {
            db.get(
                "SELECT id FROM game_squads WHERE id = ? AND user_id = ?",
                [squadId, user.id],
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        if (!isMember && !isCreator) {
            return res.status(403).json({ message: "You must be a member of this squad to share posts" });
        }

        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO post_shares (post_id, user_id, squad_id) VALUES (?, ?, ?)",
                [postId, user.id, squadId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // Notify squad members by adding a message to squad_messages
        await new Promise<void>((resolve, reject) => {
            db.run(
                "INSERT INTO squad_messages (squad_id, user_id, message) VALUES (?, ?, ?)",
                [squadId, user.id, `Shared a post: Check it out! (Post ID: ${postId})`],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        res.json({ message: "Post shared to squad!" });
    } catch (err) {
        res.status(500).json({ message: "Internal server error" });
    }
});

export default router;
