import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";

interface Message {
    id: number;
    sender_username: string;
    content?: string;
    media_url?: string;
    media_type?: "voice" | "photo" | "video";
    created_at: string;
    is_ghost_bomb: number;
}

export default function ChatDetail() {
    const { conversationId } = useParams<{ conversationId: string }>();
    const { state } = useLocation();
    const { otherUsername } = state || {};
    const { user, token } = useAuth();
    const { socket } = useSocket();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isGhostBomb, setIsGhostBomb] = useState(false);
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaType, setMediaType] = useState<"voice" | "photo" | "video" | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [error, setError] = useState<string>("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchMessages = async () => {
            if (!user || !token || !conversationId) {
                setError("Please log in to view chats. Redirecting to login...");
                setTimeout(() => navigate("/"), 2000);
                return;
            }

            try {
                const response = await axios.get(`/api/dms/messages/${conversationId}?email=${user.email}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setMessages(response.data);
            } catch (err) {
                console.error("Error fetching messages:", err);
                setError("Failed to load messages: " + (err.response?.data?.message || err.message));
            }
        };

        fetchMessages();

        // Join the conversation room via WebSocket
        if (socket && conversationId) {
            socket.emit("join_conversation", conversationId);

            socket.on("new_message", (message: Message) => {
                const currentTime = new Date();
                if (message.is_ghost_bomb) {
                    const sentTime = new Date(message.created_at);
                    const timeDiff = (currentTime.getTime() - sentTime.getTime()) / 1000;
                    if (timeDiff > 10) return; // Skip if ghost bomb has expired
                }
                setMessages((prev) => {
                    // Avoid duplicates by checking message ID
                    if (prev.some((msg) => msg.id === message.id)) {
                        return prev;
                    }
                    return [...prev, message];
                });
            });

            return () => {
                socket.off("new_message");
                socket.emit("leave_conversation", conversationId);
            };
        }
    }, [conversationId, user, token, navigate, socket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        return () => {
            if (mediaPreview) {
                URL.revokeObjectURL(mediaPreview);
            }
        };
    }, [mediaPreview]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "voice" | "photo" | "video") => {
        const file = e.target.files ? e.target.files[0] : null;
        if (file && file.size > 20 * 1024 * 1024) {
            setError("File size exceeds 20MB limit.");
            return;
        }
        setMediaFile(file);
        setMediaType(type);
        if (mediaPreview) {
            URL.revokeObjectURL(mediaPreview);
        }
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setMediaPreview(previewUrl);
        } else {
            setMediaPreview(null);
        }
    };

    const handleSendMessage = async () => {
        if (!newMessage.trim() && !mediaFile) return;

        const formData = new FormData();
        formData.append("email", user.email);
        formData.append("recipientUsername", otherUsername);
        if (newMessage.trim()) {
            formData.append("content", newMessage);
        }
        formData.append("isGhostBomb", isGhostBomb.toString());
        if (mediaFile) {
            formData.append("media", mediaFile);
            formData.append("mediaType", mediaType!);
        }

        try {
            await axios.post("/api/dms/send", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });

            setNewMessage("");
            setIsGhostBomb(false);
            setMediaFile(null);
            setMediaType(null);
            setMediaPreview(null);
        } catch (err) {
            console.error("Error sending message:", err);
            setError("Failed to send message: " + (err.response?.data?.message || err.message));
        }
    };

    const handleBoostChat = async () => {
        try {
            const response = await axios.post(
                "/api/dms/boost",
                { email: user.email, conversationId },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            alert(response.data.message);
        } catch (err) {
            console.error("Error boosting chat:", err);
            alert("Failed to boost chat: " + (err.response?.data?.message || "Unknown error"));
        }
    };

    const handleViewProfile = () => {
        navigate(`/profile/${otherUsername}`);
    };

    if (!user || !token) {
        return (
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0f2f5" }}>
                <div style={{ color: "red", fontSize: "20px", textAlign: "center" }}>
                    Please log in to view chats.
                </div>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: "#f0f2f5", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
            <div
                style={{
                    backgroundColor: "#00a884",
                    padding: "15px 20px",
                    display: "flex",
                    alignItems: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                }}
            >
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: "none",
                        border: "none",
                        color: "white",
                        fontSize: "20px",
                        cursor: "pointer",
                        marginRight: "15px",
                    }}
                >
                    ←
                </button>
                <div
                    style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        backgroundColor: "#e0e0e0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        color: "#666",
                        marginRight: "15px",
                    }}
                >
                    {otherUsername?.charAt(0).toUpperCase()}
                </div>
                <h2
                    onClick={handleViewProfile}
                    style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "white",
                        cursor: "pointer",
                        flex: 1,
                    }}
                >
                    {otherUsername}
                </h2>
                <button
                    onClick={handleBoostChat}
                    style={{
                        backgroundColor: "rgba(255,255,255,0.2)",
                        color: "white",
                        padding: "5px 10px",
                        borderRadius: "15px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "14px",
                    }}
                >
                    Boost (50 coins)
                </button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
                {error && (
                    <p style={{ color: "red", textAlign: "center", fontSize: "16px", marginBottom: "20px" }}>
                        {error}
                    </p>
                )}
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: "flex",
                            justifyContent: msg.sender_username === user.username ? "flex-end" : "flex-start",
                            marginBottom: "10px",
                        }}
                    >
                        <div
                            style={{
                                maxWidth: "70%",
                                padding: "10px 15px",
                                borderRadius: "15px",
                                backgroundColor: msg.sender_username === user.username ? "#00a884" : "white",
                                color: msg.sender_username === user.username ? "white" : "#111b21",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                position: "relative",
                            }}
                        >
                            {msg.content && (
                                <p style={{ fontSize: "14px", margin: 0, marginBottom: msg.media_url ? "10px" : "0" }}>
                                    {msg.content}
                                </p>
                            )}
                            {msg.media_url && msg.media_type === "voice" && (
                                <audio controls src={msg.media_url} style={{ maxWidth: "100%", marginTop: "5px" }} />
                            )}
                            {msg.media_url && msg.media_type === "photo" && (
                                <img src={msg.media_url} alt="Photo" style={{ maxWidth: "100%", borderRadius: "10px", marginTop: "5px" }} />
                            )}
                            {msg.media_url && msg.media_type === "video" && (
                                <video controls src={msg.media_url} style={{ maxWidth: "100%", borderRadius: "10px", marginTop: "5px" }} />
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "5px" }}>
                                {msg.is_ghost_bomb && (
                                    <small style={{ fontSize: "10px", opacity: 0.7 }}>
                                        Ghost Bomb (disappears in 10s)
                                    </small>
                                )}
                                <small style={{ fontSize: "10px", opacity: "0.7", marginLeft: "10px" }}>
                                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </small>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div
                style={{
                    backgroundColor: "white",
                    padding: "15px 20px",
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 -1px 3px rgba(0,0,0,0.1)",
                    position: "sticky",
                    bottom: 0,
                }}
            >
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "20px",
                        border: "1px solid #e0e0e0",
                        outline: "none",
                        fontSize: "14px",
                        marginRight: "10px",
                    }}
                />
                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ fontSize: "14px", color: "#667781" }}>
                        Voice:
                        <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) => handleFileChange(e, "voice")}
                            style={{ marginLeft: "5px" }}
                        />
                    </label>
                    <label style={{ fontSize: "14px", color: "#667781" }}>
                        Photo:
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(e, "photo")}
                            style={{ marginLeft: "5px" }}
                        />
                    </label>
                    <label style={{ fontSize: "14px", color: "#667781" }}>
                        Video:
                        <input
                            type="file"
                            accept="video/*"
                            onChange={(e) => handleFileChange(e, "video")}
                            style={{ marginLeft: "5px" }}
                        />
                    </label>
                </div>
                {mediaPreview && (
                    <div style={{ width: "100%", marginTop: "10px" }}>
                        <h4 style={{ fontSize: "14px", color: "#667781" }}>Preview:</h4>
                        {mediaType === "voice" && <audio controls src={mediaPreview} style={{ maxWidth: "100%" }} />}
                        {mediaType === "photo" && <img src={mediaPreview} alt="Preview" style={{ maxWidth: "200px", borderRadius: "10px" }} />}
                        {mediaType === "video" && <video controls src={mediaPreview} style={{ maxWidth: "200px", borderRadius: "10px" }} />}
                        <button
                            onClick={() => {
                                setMediaFile(null);
                                setMediaType(null);
                                setMediaPreview(null);
                            }}
                            style={{
                                backgroundColor: "#ff4444",
                                color: "white",
                                padding: "5px 10px",
                                borderRadius: "10px",
                                border: "none",
                                cursor: "pointer",
                                marginLeft: "10px",
                                fontSize: "12px",
                            }}
                        >
                            Remove
                        </button>
                    </div>
                )}
                <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", color: "#667781", marginLeft: "10px" }}>
                    <input
                        type="checkbox"
                        checked={isGhostBomb}
                        onChange={(e) => setIsGhostBomb(e.target.checked)}
                    />
                    Ghost Bomb
                </label>
                <button
                    onClick={handleSendMessage}
                    style={{
                        backgroundColor: "#00a884",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: "20px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "14px",
                        marginLeft: "10px",
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
        }
