import express from "express";
import { RouteDependencies, Conversation, Message, User } from "../types";
import multer from "multer";
import cloudinary from "cloudinary";

// Configure Cloudinary
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "video/mp4", "audio/mpeg", "audio/wav"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only JPEG, PNG, MP4, MP3, and WAV are allowed."));
        }
    },
});

export default function dmRoutes({ db }: RouteDependencies) {
    const router = express.Router();

    // Get all conversations for a user
    router.get("/conversations", async (req: express.Request, res: express.Response) => {
        const { email } = req.query;
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user: User = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    if (!row) reject(new Error("User not found"));
                    resolve(row);
                });
            });

            const conversations: Conversation[] = await new Promise((resolve, reject) => {
                db.all(
                    `
                    SELECT c.*, u1.username as user1_username, u2.username as user2_username
                    FROM conversations c
                    JOIN users u1 ON c.user1_id = u1.id
                    JOIN users u2 ON c.user2_id = u2.id
                    WHERE c.user1_id = ? OR c.user2_id = ?
                    `,
                    [user.id, user.id],
                    (err: Error | null, rows: Conversation[]) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });

            res.json(conversations);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Get conversations error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // Get messages for a conversation
    router.get("/messages/:conversationId", async (req: express.Request, res: express.Response) => {
        const { conversationId } = req.params;
        const { email } = req.query;
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user: User = await new Promise((resolve, reject) => {
                db.get("SELECT id FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    if (!row) reject(new Error("User not found"));
                    resolve(row);
                });
            });

            const conversation: Conversation = await new Promise((resolve, reject) => {
                db.get(
                    "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                    [conversationId, user.id, user.id],
                    (err: Error | null, row: Conversation) => {
                        if (err) reject(err);
                        if (!row) reject(new Error("Conversation not found or unauthorized"));
                        resolve(row);
                    }
                );
            });

            const messages: Message[] = await new Promise((resolve, reject) => {
                db.all(
                    `
                    SELECT m.*, u.username as sender_username
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.conversation_id = ?
                    ORDER BY m.created_at ASC
                    `,
                    [conversationId],
                    (err: Error | null, rows: Message[]) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });

            res.json(messages);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Get messages error:`, err);
            res.status(500).json({ message: err.message || "Internal server error" });
        }
    });

    // Boost a conversation
    router.post("/boost", async (req: express.Request, res: express.Response) => {
        const { email, conversationId } = req.body;
        if (!email || !conversationId) {
            return res.status(400).json({ message: "Email and conversationId are required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user: User = await new Promise((resolve, reject) => {
                db.get("SELECT id, coins FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    if (!row) reject(new Error("User not found"));
                    resolve(row);
                });
            });

            if (user.coins < 50) {
                return res.status(400).json({ message: "Insufficient coins. Boosting requires 50 coins." });
            }

            const conversation: Conversation = await new Promise((resolve, reject) => {
                db.get(
                    "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                    [conversationId, user.id, user.id],
                    (err: Error | null, row: Conversation) => {
                        if (err) reject(err);
                        if (!row) reject(new Error("Conversation not found or unauthorized"));
                        resolve(row);
                    }
                );
            });

            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE users SET coins = coins - 50 WHERE id = ?", [user.id], (err: Error | null) => {
                    if (err) reject(err);
                    resolve();
                });
            });

            await new Promise<void>((resolve, reject) => {
                db.run(
                    "UPDATE conversations SET boost_count = boost_count + 1 WHERE id = ?",
                    [conversationId],
                    (err: Error | null) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });

            res.json({ message: "Conversation boosted successfully" });
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Boost error:`, err);
            res.status(500).json({ message: err.message || "Internal server error" });
        }
    });

    // Start a new conversation or send a message
    router.post("/send", upload.single("media"), async (req: express.Request, res: express.Response) => {
        const { email, recipientUsername, content, isGhostBomb = false } = req.body;
        const file = req.file;
        if (!email || !recipientUsername || (!content && !file)) {
            return res.status(400).json({ message: "Email, recipientUsername, and either content or media are required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const sender: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!sender) return res.status(404).json({ message: "Sender not found" });

            const recipient: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id FROM users WHERE username = ?", [recipientUsername], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!recipient) return res.status(404).json({ message: "Recipient not found" });

            let conversation: Conversation = await new Promise<Conversation>((resolve, reject) => {
                db.get(
                    "SELECT * FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
                    [sender.id, recipient.id, recipient.id, sender.id],
                    (err: Error | null, row: Conversation) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });

            if (!conversation) {
                await new Promise<void>((resolve, reject) => {
                    db.run(
                        "INSERT INTO conversations (user1_id, user2_id, created_at) VALUES (?, ?, ?)",
                        [sender.id, recipient.id, new Date().toISOString()],
                        (err: Error | null) => {
                            if (err) reject(err);
                            resolve();
                        }
                    );
                });

                conversation = await new Promise<Conversation>((resolve, reject) => {
                    db.get(
                        "SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?",
                        [sender.id, recipient.id],
                        (err: Error | null, row: Conversation) => {
                            if (err) reject(err);
                            resolve(row);
                        }
                    );
                });
            }

            let mediaUrl: string | null = null;
            let mediaType: string | null = null;

            if (file) {
                // Upload to Cloudinary
                const uploadResult = await new Promise<cloudinary.UploadApiResponse>((resolve, reject) => {
                    const stream = cloudinary.v2.uploader.upload_stream(
                        {
                            resource_type: file.mimetype.startsWith("image")
                                ? "image"
                                : file.mimetype.startsWith("video")
                                ? "video"
                                : "auto",
                            transformation: [{ quality: "auto:low", fetch_format: "auto" }],
                        },
                        (error, result) => {
                            if (error) reject(error);
                            if (!result) reject(new Error("Upload failed"));
                            resolve(result);
                        }
                    );
                    stream.end(file.buffer);
                });

                mediaUrl = uploadResult.secure_url;
                mediaType = file.mimetype.startsWith("image")
                    ? "image"
                    : file.mimetype.startsWith("video")
                    ? "video"
                    : "audio";
            }

            await new Promise<void>((resolve, reject) => {
                db.run(
                    "INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, created_at, is_ghost_bomb) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                        conversation.id,
                        sender.id,
                        content || "",
                        mediaUrl,
                        mediaType,
                        new Date().toISOString(),
                        isGhostBomb ? 1 : 0,
                    ],
                    (err: Error | null) => {
                        if (err) reject(err);
                        resolve();
                    }
                );
            });

            res.json({ message: "Message sent successfully", conversationId: conversation.id });
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Send message error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // Get user profile
    router.get("/profile/:username", async (req: express.Request, res: express.Response) => {
        const { username } = req.params;
        try {
            const user: User = await new Promise((resolve, reject) => {
                db.get(
                    "SELECT username, bio, profile_picture_url FROM users WHERE username = ?",
                    [username],
                    (err: Error | null, row: User) => {
                        if (err) reject(err);
                        if (!row) reject(new Error("User not found"));
                        resolve(row);
                    }
                );
            });

            res.json(user);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Get profile error:`, err);
            res.status(404).json({ message: err.message || "User not found" });
        }
    });

    return router;
                    }
