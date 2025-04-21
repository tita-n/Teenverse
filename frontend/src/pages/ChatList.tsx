import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

interface Conversation {
    id: number;
    other_username: string;
    is_boosted: number;
    latest_message: string;
    latest_message_time: string;
}

export default function ChatList() {
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const fetchConversations = async () => {
            if (!user || !token) {
                setError("Please log in to view chats. Redirecting to login...");
                setTimeout(() => navigate("/"), 2000);
                return;
            }

            try {
                const response = await axios.get(`/api/dms/conversations?email=${user.email}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setConversations(response.data);
            } catch (err) {
                console.error("Error fetching conversations:", err);
                setError("Failed to load chats: " + (err.response?.data?.message || err.message));
            }
        };

        fetchConversations();
    }, [user, token, navigate]);

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
        <div style={{ backgroundColor: "#f0f2f5", minHeight: "100vh" }}>
            <Navigation />
            <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
                <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111b21", marginBottom: "20px" }}>
                    Private Gist
                </h1>
                {error && (
                    <p style={{ color: "red", textAlign: "center", fontSize: "16px", marginBottom: "20px" }}>
                        {error}
                    </p>
                )}
                {conversations.length > 0 ? (
                    conversations.map((conv) => (
                        <div
                            key={conv.id}
                            onClick={() => navigate(`/chat/${conv.id}`, { state: { otherUsername: conv.other_username } })}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "15px",
                                backgroundColor: "white",
                                borderRadius: "8px",
                                marginBottom: "10px",
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                                transition: "background-color 0.2s",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f5f6f5")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                        >
                            <div
                                style={{
                                    width: "50px",
                                    height: "50px",
                                    borderRadius: "50%",
                                    backgroundColor: "#e0e0e0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "20px",
                                    color: "#666",
                                    marginRight: "15px",
                                }}
                            >
                                {conv.other_username.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <h2 style={{ fontSize: "16px", fontWeight: "bold", color: "#111b21" }}>
                                        {conv.other_username}
                                    </h2>
                                    {conv.is_boosted ? (
                                        <span style={{ fontSize: "12px", color: "#00a884" }}>📌 Boosted</span>
                                    ) : null}
                                </div>
                                <p style={{ fontSize: "14px", color: "#667781", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {conv.latest_message}
                                </p>
                            </div>
                            <small style={{ fontSize: "12px", color: "#667781" }}>
                                {new Date(conv.latest_message_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </small>
                        </div>
                    ))
                ) : (
                    <p style={{ color: "#667781", textAlign: "center", fontSize: "16px" }}>
                        No chats yet. Start a conversation!
                    </p>
                )}
            </div>
        </div>
    );
}