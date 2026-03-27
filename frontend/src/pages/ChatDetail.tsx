import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";
import { withAuth } from "../lib/api";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { ArrowLeft, Paperclip, Send, Rocket, Zap } from "lucide-react";
import DOMPurify from "dompurify";

const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

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
  const { user, token, loading: authLoading } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isGhostBomb, setIsGhostBomb] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Join chat room and listen for real-time messages
  useEffect(() => {
    if (!user || !token || !conversationId) return;
    
    // Fetch initial messages
    const fetchMessages = () => {
      axios.get(`/api/dms/messages/${conversationId}?email=${user.email}`, withAuth(token))
        .then((res) => setMessages(res.data))
        .catch((err) => console.error("Error:", err));
    };
    fetchMessages();

    // Join chat room via socket
    if (socket) {
      socket.emit("join_chat", conversationId);
      
      // Listen for new messages
      socket.on("new_message", (newMsg: Message) => {
        setMessages(prev => [...prev, newMsg]);
      });
      
      return () => {
        socket.emit("leave_chat", conversationId);
        socket.off("new_message");
      };
    }
  }, [conversationId, user, token, socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() && !file) return;
    const formData = new FormData();
    formData.append("email", user!.email);
    formData.append("recipientUsername", otherUsername);
    if (newMessage.trim()) formData.append("content", newMessage);
    if (isGhostBomb) formData.append("isGhostBomb", "true");
    if (file) formData.append("media", file);

    try {
      await axios.post("/api/dms/send", formData, { headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" } });
      setNewMessage(""); setIsGhostBomb(false); setFile(null);
      const res = await axios.get(`/api/dms/messages/${conversationId}?email=${user!.email}`, withAuth(token));
      setMessages(res.data);
    } catch (err) { console.error("Error sending:", err); }
  };

  const handleBoostChat = async () => {
    try {
      await axios.post("/api/dms/boost", { email: user!.email, conversationId }, withAuth(token));
    } catch (err) { console.error("Error boosting:", err); }
  };

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;

  return (
    <div className="flex flex-col h-screen bg-surface">
      {/* Header */}
      <div className="bg-brand-600 px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button onClick={() => navigate(`/profile/${otherUsername}`)} className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold">
            {otherUsername?.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-white font-semibold">{otherUsername}</h2>
        </button>
        <button onClick={handleBoostChat} className="px-3 py-1.5 rounded-full bg-white/20 text-white text-sm hover:bg-white/30 transition-colors flex items-center gap-1">
          <Rocket className="w-3 h-3" />
          Boost (50)
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => {
          const isMine = msg.sender_username === user.username;
          return (
            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl shadow-sm ${
                isMine
                  ? "bg-brand-600 text-white rounded-br-md"
                  : "bg-white text-tx-primary rounded-bl-md"
              }`}>
                {msg.content && <p className="text-sm">{sanitizeContent(msg.content)}</p>}
                {msg.media_url && msg.media_type === "image" && (
                  <img src={msg.media_url} alt="media" className="max-w-full rounded-lg mt-1" />
                )}
                {msg.media_url && msg.media_type === "video" && (
                  <video controls src={msg.media_url} className="max-w-full rounded-lg mt-1" />
                )}
                {msg.media_url && msg.media_type === "audio" && (
                  <audio controls src={msg.media_url} className="w-full mt-1" />
                )}
                <div className={`flex items-center gap-2 mt-1 ${isMine ? "justify-end" : "justify-start"}`}>
                  {msg.is_ghost_bomb ? <span className="text-xs opacity-70">👻 10s</span> : null}
                  <span className="text-xs opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white px-4 py-3 flex items-center gap-2 border-t border-surface-border">
        <label className="p-2 rounded-lg text-tx-muted hover:bg-surface-muted cursor-pointer transition-colors">
          <Paperclip className="w-5 h-5" />
          <input
            type="file"
            accept="image/jpeg,image/png,video/mp4,audio/mpeg,audio/wav"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="input flex-1 rounded-full py-2.5"
          onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
        />
        <label className="flex items-center gap-1 text-sm text-tx-muted cursor-pointer">
          <input type="checkbox" checked={isGhostBomb} onChange={(e) => setIsGhostBomb(e.target.checked)} className="w-4 h-4" />
          <Zap className="w-3 h-3" />
        </label>
        <button onClick={handleSend} disabled={!newMessage.trim() && !file} className="p-2.5 rounded-full bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-50">
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
