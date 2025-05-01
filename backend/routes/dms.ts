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

    // Get list of conversations (chat list page)
    router.get("/conversations", async (req: express.Request, res: express.Response) => {
        const { email } = req.query;
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user = await db.get<User>("SELECT id, username FROM users WHERE email = ?", [email]);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            interface ConversationWithUsername extends Conversation {
                other_username: string;
            }

            const conversations = await db.all<ConversationWithUsername>(
                `SELECT c.id, c.user1_id, c.user2_id, c.is_boosted, c.created_at, 
                        CASE 
                            WHEN c.user1_id = ? THEN u2.username 
                            WHEN c.user2_id = ? THEN u1.username 
                        END as other_username
                FROM conversations c
                LEFT JOIN users u1 ON c.user1_id = u1.id
                LEFT JOIN users u2 ON c.user2_id = u2.id
                WHERE c.user1_id = ? OR c.user2_id = ?
                ORDER BY c.is_boosted DESC, c.created_at DESC`,
                [user.id, user.id, user.id, user.id]
            );

            const conversationsWithLatestMessage = await Promise.all(
                conversations.map(async (conv) => {
                    const latestMessage = await db.get<Message>(
                        "SELECT content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1",
                        [conv.id]
                    );
                    return {
                        id: conv.id,
                        other_username: conv.other_username,
                        is_boosted: conv.is_boosted,
                        latest_message: latestMessage ? latestMessage.content : "No messages yet",
                        latest_message_time: latestMessage ? latestMessage.created_at : conv.created_at,
                    };
                })
            );

            res.json(conversationsWithLatestMessage);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Fetch conversations error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // Get messages for a specific conversation (chat detail page)
    router.get("/messages/:conversationId", async (req: express.Request, res: express.Response) => {
        const { email } = req.query;
        const conversationId = parseInt(req.params.conversationId);
        if (!email || typeof email !== "string" || isNaN(conversationId)) {
            return res.status(400).json({ message: "Email and conversationId are required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const conversation = await db.get<Conversation>(
                "SELECT id, user1_id, user2_id, is_boosted, created_at FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                [conversationId, user.id, user.id]
            );
            if (!conversation) {
                return res.status(404).json({ message: "Conversation not found or unauthorized" });
            }

            const messages = await db.all<Message>(
                "SELECT m.id, m.conversation_id, m.sender_id, m.content, m.media_url, m.media_type, m.created_at, m.is_ghost_bomb, u.username as sender_username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = ? ORDER BY m.created_at ASC",
                [conversationId]
            );

            const currentTime = new Date();
            const filteredMessages = messages.filter((msg) => {
                if (msg.is_ghost_bomb) {
                    const sentTime = new Date(msg.created_at);
                    if (isNaN(sentTime.getTime())) {
                        console.error(`Invalid created_at for message ${msg.id}: ${msg.created_at}`);
                        return false;
                    }
                    const timeDiff = (currentTime.getTime() - sentTime.getTime()) / 1000;
                    return timeDiff <= 10;
                }
                return true;
            });

            res.json(filteredMessages);
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Fetch messages error:`, err);
            res.status(500).json({ message: "Internal server error" });
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
            const sender = await db.get<User>("SELECT id FROM users WHERE email = ?", [email]);
            if (!sender) {
                return res.status(404).json({ message: "Sender not found" });
            }

            const recipient = await db.get<User>("SELECT id FROM users WHERE username = ?", [recipientUsername]);
            if (!recipient) {
                return res.status(404).json({ message: "Recipient not found" });
            }

            let conversation = await db.get<Conversation>(
                "SELECT id, user1_id, user2_id, is_boosted, created_at FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)",
                [sender.id, recipient.id, recipient.id, sender.id]
            );

            if (!conversation) {
                try {
                    await db.run(
                        "INSERT INTO conversations (user1_id, user2_id, created_at, is_boosted) VALUES (?, ?, ?, ?)",
                        [sender.id, recipient.id, new Date().toISOString(), 0]
                    );
                    conversation = await db.get<Conversation>(
                        "SELECT id, user1_id, user2_id, is_boosted, created_at FROM conversations WHERE user1_id = ? AND user2_id = ?",
                        [sender.id, recipient.id]
                    );
                    if (!conversation) {
                        throw new Error("Failed to create conversation");
                    }
                } catch (err) {
                    console.error(`[${new Date().toISOString()}] Create conversation error:`, err);
                    throw err;
                }
            }

            let mediaUrl: string | null = null;
            let mediaType: string | null = null;

            if (file) {
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

            try {
                await db.run(
                    "INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, created_at, is_ghost_bomb) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                        conversation.id,
                        sender.id,
                        content || "",
                        mediaUrl,
                        mediaType,
                        new Date().toISOString(),
                        isGhostBomb ? 1 : 0,
                    ]
                );
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Insert message error:`, err);
                throw err;
            }

            res.json({ message: "Message sent successfully", conversationId: conversation.id });
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Send message error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // Boost a chat
    router.post("/boost", async (req: express.Request, res: express.Response) => {
        const { email, conversationId } = req.body;
        const boostCost = 50;
        if (!email || !conversationId) {
            return res.status(400).json({ message: "Email and conversationId are required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user = await db.get<User>("SELECT id, coins FROM users WHERE email = ?", [email]);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            if (user.coins < boostCost) {
                return res.status(400).json({ message: "Insufficient coins to boost chat" });
            }

            const conversation = await db.get<Conversation>(
                "SELECT id, user1_id, user2_id, is_boosted, created_at FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                [conversationId, user.id, user.id]
            );
            if (!conversation) {
                return res.status(404).json({ message: "Conversation not found or unauthorized" });
            }

            const newCoins = user.coins - boostCost;
            try {
                await db.run("UPDATE users SET coins = ? WHERE id = ?", [newCoins, user.id]);
                await db.run("UPDATE conversations SET is_boosted = 1 WHERE id = ?", [conversationId]);
            } catch (err) {
                console.error(`[${new Date().toISOString()}] Boost chat error:`, err);
                throw err;
            }

            res.json({ message: "Chat boosted successfully", newCoins });
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Boost chat error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // View user profile (using username instead of email)
    router.get("/profile/:username", async (req: express.Request, res: express.Response) => {
        const targetUsername = req.params.username;
        const { email } = req.query;
        if (!targetUsername || !email || typeof email !== "string") {
            return res.status(400).json({ message: "Target username and requester email are required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user = await db.get<User>(
                "SELECT username, verified, coins FROM users WHERE username = ?",
                [targetUsername]
            );
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            res.json({
                username: user.username,
                verified: user.verified,
                coins: user.coins,
            });
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Fetch user profile error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    return router;
}