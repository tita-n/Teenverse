import express from "express";
import { RouteDependencies, Conversation, Message, User } from "../types";
import { dbGet, dbAll, dbRun, withTransaction } from "../database";
import multer from "multer";
import cloudinary from "cloudinary";

cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "video/mp4", "audio/mpeg", "audio/wav"];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only JPEG, PNG, MP4, MP3, and WAV are allowed."));
        }
    },
});

export default function dmRoutes({ db, io }: RouteDependencies & { io?: any }) {
    const router = express.Router();

    // ===== GET conversations list - FIX N+1 with subquery =====
    router.get("/conversations", async (req: express.Request, res: express.Response) => {
        const { email } = req.query;
        if (!email || typeof email !== "string") {
            return res.status(400).json({ message: "Email is required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        try {
            const user = await dbGet<{ id: number; username: string }>(
                "SELECT id, username FROM users WHERE email = ?", [email]
            );
            if (!user) return res.status(404).json({ message: "User not found" });

            // Single JOIN query with subquery for latest message - NO N+1
            const conversations = await dbAll(
                `SELECT
                    c.id,
                    c.is_boosted,
                    c.created_at,
                    CASE
                        WHEN c.user1_id = ? THEN u2.username
                        WHEN c.user2_id = ? THEN u1.username
                    END as other_username,
                    lm.content as latest_message,
                    lm.created_at as latest_message_time
                FROM conversations c
                LEFT JOIN users u1 ON c.user1_id = u1.id
                LEFT JOIN users u2 ON c.user2_id = u2.id
                LEFT JOIN (
                    SELECT m1.conversation_id, m1.content, m1.created_at
                    FROM messages m1
                    INNER JOIN (
                        SELECT conversation_id, MAX(created_at) as max_created
                        FROM messages
                        GROUP BY conversation_id
                    ) m2 ON m1.conversation_id = m2.conversation_id AND m1.created_at = m2.max_created
                ) lm ON lm.conversation_id = c.id
                WHERE c.user1_id = ? OR c.user2_id = ?
                ORDER BY c.is_boosted DESC, COALESCE(lm.created_at, c.created_at) DESC`,
                [user.id, user.id, user.id, user.id]
            );

            const result = conversations.map((conv: any) => ({
                id: conv.id,
                other_username: conv.other_username,
                is_boosted: conv.is_boosted,
                latest_message: conv.latest_message || "No messages yet",
                latest_message_time: conv.latest_message_time || conv.created_at,
            }));

            res.json(result);
        } catch (err) {
            console.error("Fetch conversations error:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // ===== GET messages for a conversation =====
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
            const user = await dbGet<{ id: number }>("SELECT id FROM users WHERE email = ?", [email]);
            if (!user) return res.status(404).json({ message: "User not found" });

            const conversation = await dbGet<Conversation>(
                "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                [conversationId, user.id, user.id]
            );
            if (!conversation) return res.status(404).json({ message: "Conversation not found or unauthorized" });

            const messages = await dbAll<Message>(
                `SELECT m.*, u.username as sender_username
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.conversation_id = ?
                 ORDER BY m.created_at ASC`,
                [conversationId]
            );

            const currentTime = new Date();
            const filteredMessages = messages.filter((msg) => {
                if (msg.is_ghost_bomb) {
                    const sentTime = new Date(msg.created_at);
                    const timeDiff = (currentTime.getTime() - sentTime.getTime()) / 1000;
                    return timeDiff <= 10;
                }
                return true;
            });

            res.json(filteredMessages);
        } catch (err) {
            console.error("Fetch messages error:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // ===== SEND message =====
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
            const sender = await dbGet<{ id: number }>("SELECT id FROM users WHERE email = ?", [email]);
            if (!sender) return res.status(404).json({ message: "Sender not found" });

            const recipient = await dbGet<{ id: number }>("SELECT id FROM users WHERE username = ?", [recipientUsername]);
            if (!recipient) return res.status(404).json({ message: "Recipient not found" });

            // Normalize user order for uniqueness (smaller ID first)
            const [userA, userB] = sender.id < recipient.id
                ? [sender.id, recipient.id]
                : [recipient.id, sender.id];

            // Find or create conversation
            let conversation = await dbGet<Conversation>(
                "SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?",
                [userA, userB]
            );

            if (!conversation) {
                await dbRun(
                    "INSERT INTO conversations (user1_id, user2_id, created_at, is_boosted) VALUES (?, ?, ?, ?)",
                    [userA, userB, new Date().toISOString(), 0]
                );
                conversation = await dbGet<Conversation>(
                    "SELECT * FROM conversations WHERE user1_id = ? AND user2_id = ?",
                    [userA, userB]
                );
            }

            if (!conversation) throw new Error("Failed to create conversation");

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
                            else if (!result) reject(new Error("Upload failed"));
                            else resolve(result);
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

            await dbRun(
                `INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, created_at, is_ghost_bomb)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [conversation.id, sender.id, content || "", mediaUrl, mediaType, new Date().toISOString(), isGhostBomb ? 1 : 0]
            );

            // Get the full message for socket emission
            const senderUsername = await dbGet<{ username: string }>("SELECT username FROM users WHERE email = ?", [email]);
            const newMessage = {
                conversationId: conversation.id,
                sender_username: senderUsername?.username || "Unknown",
                content: content || "",
                media_url: mediaUrl,
                media_type: mediaType,
                created_at: new Date().toISOString(),
                is_ghost_bomb: isGhostBomb ? 1 : 0,
            };

            // Emit to all in the chat room
            if (io) {
                io.to(`chat-${conversation.id}`).emit("new_message", newMessage);
            }

            res.json({ message: "Message sent successfully", conversationId: conversation.id });
        } catch (err) {
            console.error("Send message error:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // ===== BOOST chat (transaction for coin safety) =====
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
            const result = await withTransaction(async () => {
                const user = await dbGet<{ id: number; coins: number }>(
                    "SELECT id, coins FROM users WHERE email = ?", [email]
                );
                if (!user) throw new Error("User not found");
                if (user.coins < boostCost) throw new Error("INSUFFICIENT_COINS");

                const conversation = await dbGet<Conversation>(
                    "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                    [conversationId, user.id, user.id]
                );
                if (!conversation) throw new Error("Conversation not found");

                const newCoins = user.coins - boostCost;
                await dbRun("UPDATE users SET coins = ? WHERE id = ?", [newCoins, user.id]);
                await dbRun("UPDATE conversations SET is_boosted = 1 WHERE id = ?", [conversationId]);

                return { newCoins };
            });

            res.json({ message: "Chat boosted successfully", newCoins: result.newCoins });
        } catch (err: any) {
            if (err.message === "INSUFFICIENT_COINS") {
                return res.status(400).json({ message: "Insufficient coins to boost chat" });
            }
            console.error("Boost chat error:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // ===== VIEW user profile =====
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
            const user = await dbGet<{ username: string; verified: number; coins: number }>(
                "SELECT username, verified, coins FROM users WHERE username = ?",
                [targetUsername]
            );
            if (!user) return res.status(404).json({ message: "User not found" });

            res.json({
                username: user.username,
                verified: user.verified,
                coins: user.coins,
            });
        } catch (err) {
            console.error("Fetch user profile error:", err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    return router;
}
