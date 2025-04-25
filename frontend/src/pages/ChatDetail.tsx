import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface Message {
    id: number;
    sender_username: string;
    content: string;
    media_url?: string;
    media_type?: string;
    created_at: string;
    is_ghost_bomb: number;
}

export default function ChatDetail() {
    const { conversationId } = useParams<{ conversationId: string }>();
    const { state } = useLocation();
    const { otherUsername } = state || {};
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isGhostBomb, setIsGhostBomb] = useState(false);
    const [error, setError] = useState<string>("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [conversationId, user, token, navigate]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() && !selectedFile) return;

        try {
            const formData = new FormData();
            formData.append("email", user.email);
            formData.append("recipientUsername", otherUsername);
            formData.append("content", newMessage);
            formData.append("isGhostBomb", isGhostBomb ? "true" : "false");
            if (selectedFile) {
                if (selectedFile.size > 10 * 1024 * 1024) {
                    setError("File size exceeds 10MB limit.");
                    return;
                }
                formData.append("media", selectedFile);
            }

            await axios.post("/api/dms/send", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });

            setNewMessage("");
            setIsGhostBomb(false);
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";

            const messagesResponse = await axios.get(`/api/dms/messages/${conversationId}?email=${user.email}`, {
                headers: { Authorization: `Bearer ${token}` },
                });
            setMessages(messagesResponse.data);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                setError("File size exceeds 10MB limit.");
                return;
            }
            setSelectedFile(file);
        }
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
                            {msg.media_url && msg.media_type === "image" && (
                                <img
                                    src={msg.media_url}
                                    alt="Chat media"
                                    style={{ maxWidth: "100%", borderRadius: "10px", marginBottom: "5px" }}
                                />
                            )}
                            {msg.media_url && msg.media_type === "video" && (
                                <video
                                    src={msg.media_url}
                                    controls
                                    style={{ maxWidth: "100%", borderRadius: "10px", marginBottom: "5px" }}
                                />
                            )}
                            {msg.media_url && msg.media_type === "audio" && (
                                <audio
                                    src={msg.media_url}
                                    controls
                                    style={{ width: "100%", marginBottom: "5px" }}
                                />
                            )}
                            {msg.content && (
                                <p style={{ fontSize: "14px", margin: 0 }}>{msg.content}</p>
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
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 -1px 3px rgba(0,0,0,0.1)",
                    position: "sticky",
                    bottom: 0,
                    flexWrap: "wrap",
                }}
            >
                <input
                    type="file"
                    accept="image/jpeg,image/png,video/mp4,audio/mpeg,audio/wav"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                    style={{ display: "none" }}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        backgroundColor: "#00a884",
                        color: "white",
                        padding: "10px",
                        borderRadius: "20px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "14px",
                    }}
                    title="Attach photo, video, or audio (up to 10MB, audio max 60s)"
                >
                    📎
                </button>
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
                    }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "14px", color: "#667781" }}>
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
                    }}
                >
                    Send
                </button>
                {selectedFile && (
                    <div style={{ width: "100%", fontSize: "12px", color: "#667781" }}>
                        Selected: {selectedFile.name}
                    </div>
                )}
            </div>
        </div>
    );
}