import express from "express";
import { RouteDependencies, Conversation, Message, User } from "../types";
import multer from "multer";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import ffmpeg from "fluent-ffmpeg";
import { Server as SocketIOServer } from "socket.io";

// Configure Cloudinary (ensure your environment variables are set)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer for file uploads with a 20MB limit
const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

export default function dmRoutes({ db, io }: RouteDependencies) {
    const router = express.Router();

    // Join a conversation room (WebSocket)
    router.post("/join-conversation", async (req: express.Request, res: express.Response) => {
        const { email, conversationId } = req.body;
        if (!email || !conversationId) {
            return res.status(400).json({ message: "Email and conversationId are required" });
        }
        if (!req.user || req.user.email !== email) {
            return res.status(403).json({ message: "Unauthorized" });
        }
        try {
            const user: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!user) return res.status(404).json({ message: "User not found" });

            const conversation: Conversation = await new Promise<Conversation>((resolve, reject) => {
                db.get(
                    "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                    [conversationId, user.id, user.id],
                    (err: Error | null, row: Conversation) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });
            if (!conversation) return res.status(404).json({ message: "Conversation not found or you are not a participant" });

            // Emit a success response (client will handle Socket.IO connection separately)
            res.json({ message: "Joined conversation successfully" });
        } catch (err) {
            console.error(`[${new Date().toISOString()}] Join conversation error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

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
            const user: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id, username FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!user) return res.status(404).json({ message: "User not found" });

            const conversations: any[] = await new Promise<any[]>((resolve, reject) => {
                db.all(
                    `SELECT c.*, 
                            CASE 
                                WHEN c.user1_id = ? THEN u2.username 
                                WHEN c.user2_id = ? THEN u1.username 
                            END as other_username
                    FROM conversations c
                    LEFT JOIN users u1 ON c.user1_id = u1.id
                    LEFT JOIN users u2 ON c.user2_id = u2.id
                    WHERE c.user1_id = ? OR c.user2_id = ?
                    ORDER BY c.is_boosted DESC, c.created_at DESC`,
                    [user.id, user.id, user.id, user.id],
                    (err: Error | null, rows: any[]) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });

            const conversationsWithLatestMessage = await Promise.all(
                conversations.map(async (conv: any) => {
                    const latestMessage: Message = await new Promise<Message>((resolve, reject) => {
                        db.get(
                            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1",
                            [conv.id],
                            (err: Error | null, row: Message) => {
                                if (err) reject(err);
                                resolve(row);
                            }
                        );
                    });
                    return {
                        ...conv,
                        latest_message: latestMessage
                            ? latestMessage.media_url
                                ? `[${latestMessage.media_type || "media"}]`
                                : latestMessage.content || "No content"
                            : "No messages yet",
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
            const user: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!user) return res.status(404).json({ message: "User not found" });

            const conversation: Conversation = await new Promise<Conversation>((resolve, reject) => {
                db.get(
                    "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                    [conversationId, user.id, user.id],
                    (err: Error | null, row: Conversation) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });
            if (!conversation) return res.status(404).json({ message: "Conversation not found or you are not a participant" });

            const messages: Message[] = await new Promise<Message[]>((resolve, reject) => {
                db.all(
                    "SELECT m.*, u.username as sender_username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.conversation_id = ? ORDER BY m.created_at ASC",
                    [conversationId],
                    (err: Error | null, rows: Message[]) => {
                        if (err) reject(err);
                        resolve(rows);
                    }
                );
            });

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
            console.error(`[${new Date().toISOString()}] Fetch messages error:`, err);
            res.status(500).json({ message: "Internal server error" });
        }
    });

    // Start a new conversation or send a message (with media support)
    router.post("/send", upload.single("media"), async (req: express.Request, res: express.Response) => {
        const { email, recipientUsername, content, isGhostBomb = false, mediaType } = req.body;
        const file = req.file;

        // Validate required fields
        if (!email || !recipientUsername) {
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ message: "Email and recipientUsername are required" });
        }
        if (!req.user || req.user.email !== email) {
            if (file) fs.unlinkSync(file.path);
            return res.status(403).json({ message: "Unauthorized" });
        }
        if (!content && !file) {
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ message: "Either content or media file is required" });
        }
        if (file && !mediaType) {
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ message: "mediaType is required when sending a media file" });
        }
        if (mediaType && !["voice", "photo", "video"].includes(mediaType)) {
            if (file) fs.unlinkSync(file.path);
            return res.status(400).json({ message: "mediaType must be one of: voice, photo, video" });
        }

        try {
            const sender: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!sender) {
                if (file) fs.unlinkSync(file.path);
                return res.status(404).json({ message: "Sender not found" });
            }

            const recipient: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id FROM users WHERE username = ?", [recipientUsername], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!recipient) {
                if (file) fs.unlinkSync(file.path);
                return res.status(404).json({ message: "Recipient not found" });
            }

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

            let mediaUrl: string | undefined = undefined;
            let finalMediaType: "voice" | "photo" | "video" | undefined = undefined;

            if (file) {
                // Validate file type based on mediaType
                const allowedTypes = {
                    voice: ["audio/mpeg", "audio/wav", "audio/mp3"],
                    photo: ["image/jpeg", "image/png", "image/gif"],
                    video: ["video/mp4", "video/mpeg", "video/webm"],
                };

                if (!allowedTypes[mediaType].includes(file.mimetype)) {
                    fs.unlinkSync(file.path);
                    return res.status(400).json({ message: `Invalid file type for ${mediaType}. Allowed types: ${allowedTypes[mediaType].join(", ")}` });
                }

                // For voice messages and videos, check duration
                if (mediaType === "voice" || mediaType === "video") {
                    const metadata = await new Promise<any>((resolve, reject) => {
                        ffmpeg.ffprobe(file.path, (err, metadata) => {
                            if (err) return reject(new Error("Error reading media metadata: " + err.message));
                            resolve(metadata);
                        });
                    });

                    const duration = metadata.format.duration;
                    const maxDuration = mediaType === "voice" ? 60 : 90; // 60s for voice, 90s for video
                    if (!duration || duration > maxDuration) {
                        fs.unlinkSync(file.path);
                        return res.status(400).json({ message: `${mediaType === "voice" ? "Voice message" : "Video"} duration exceeds ${maxDuration} seconds` });
                    }
                }

                // Upload to Cloudinary with optimizations
                const cloudinaryOptions: any = {
                    resource_type: mediaType === "photo" ? "image" : "video",
                    folder: `teenverse/dms/${mediaType}s`,
                    timeout: 120000,
                    fetch_format: "auto", // Automatically choose the best format (e.g., WebP for images, WebM for videos)
                    quality: "auto:good", // Optimize quality while reducing file size
                };

                // Add transformations for videos and voice messages
                if (mediaType === "video") {
                    cloudinaryOptions.transformation = [
                        { width: 1280, height: 720, crop: "scale" },
                        { quality: "auto:good", fetch_format: "auto" },
                        { video_codec: "h264", bit_rate: "1500k" },
                        { audio_codec: "aac", audio_bit_rate: "128k" },
                    ];
                } else if (mediaType === "voice") {
                    cloudinaryOptions.transformation = [
                        { audio_codec: "mp3", audio_bit_rate: "64k" },
                    ];
                } else if (mediaType === "photo") {
                    cloudinaryOptions.transformation = [
                        { quality: "auto:good", fetch_format: "auto" },
                    ];
                }

                const cloudinaryResult = await cloudinary.uploader.upload(file.path, cloudinaryOptions);
                fs.unlinkSync(file.path);

                mediaUrl = cloudinaryResult.secure_url;
                finalMediaType = mediaType;
            }

            const createdAt = new Date().toISOString();
            const message: Message = await new Promise<Message>((resolve, reject) => {
                db.run(
                    "INSERT INTO messages (conversation_id, sender_id, content, media_url, media_type, created_at, is_ghost_bomb) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    [
                        conversation.id,
                        sender.id,
                        content || null,
                        mediaUrl || null,
                        finalMediaType || null,
                        createdAt,
                        isGhostBomb ? 1 : 0,
                    ],
                    function (err: Error | null) {
                        if (err) reject(err);
                        db.get(
                            "SELECT m.*, u.username as sender_username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?",
                            [this.lastID],
                            (err: Error | null, row: Message) => {
                                if (err) reject(err);
                                resolve(row);
                            }
                        );
                    }
                );
            });

            // Emit WebSocket event to the conversation room
            io.to(`conversation:${conversation.id}`).emit("new_message", message);

            res.json({ message: "Message sent successfully", conversationId: conversation.id });
        } catch (err) {
            if (file && fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
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
            const user: User = await new Promise<User>((resolve, reject) => {
                db.get("SELECT id, coins FROM users WHERE email = ?", [email], (err: Error | null, row: User) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });
            if (!user) return res.status(404).json({ message: "User not found" });

            if (user.coins < boostCost) {
                return res.status(400).json({ message: "Insufficient coins to boost chat" });
            }

            const conversation: Conversation = await new Promise<Conversation>((resolve, reject) => {
                db.get(
                    "SELECT * FROM conversations WHERE id = ? AND (user1_id = ? OR user2_id = ?)",
                    [conversationId, user.id, user.id],
                    (err: Error | null, row: Conversation) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });
            if (!conversation) return res.status(404).json({ message: "Conversation not found or you are not a participant" });

            const newCoins = user.coins - boostCost;
            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE users SET coins = ? WHERE id = ?", [newCoins, user.id], (err: Error | null) => {
                    if (err) reject(err);
                    resolve();
                });
            });

            await new Promise<void>((resolve, reject) => {
                db.run("UPDATE conversations SET is_boosted = 1 WHERE id = ?", [conversationId], (err: Error | null) => {
                    if (err) reject(err);
                    resolve();
                });
            });

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
            const user: User = await new Promise<User>((resolve, reject) => {
                db.get(
                    "SELECT username, verified, coins FROM users WHERE username = ?",
                    [targetUsername],
                    (err: Error | null, row: User) => {
                        if (err) reject(err);
                        resolve(row);
                    }
                );
            });
            if (!user) return res.status(404).json({ message: "User not found" });

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
