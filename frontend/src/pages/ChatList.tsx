import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { MessageCircle, Pin } from "lucide-react";

interface Conversation {
  id: number;
  other_username: string;
  is_boosted: number;
  latest_message: string;
  latest_message_time: string;
}

export default function ChatList() {
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    axios.get(`/api/dms/conversations?email=${user.email}`, withAuth(token))
      .then((res) => setConversations(res.data))
      .catch((err) => console.error("Error fetching conversations:", err))
      .finally(() => setLoading(false));
  }, [user, token]);

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading chats..." />;

  return (
    <Layout maxWidth="2xl">
      <div className="mb-6">
        <h1 className="text-h1">Private Gist</h1>
        <p className="text-tx-secondary mt-1">Your conversations</p>
      </div>

      {conversations.length > 0 ? (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`, { state: { otherUsername: conv.other_username } })}
              className="card-hover w-full flex items-center gap-4 p-4 text-left transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold flex-shrink-0">
                {conv.other_username.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-tx-primary truncate">{conv.other_username}</h3>
                  {conv.is_boosted ? (
                    <span className="badge badge-success text-xs flex items-center gap-1">
                      <Pin className="w-3 h-3" />
                      Boosted
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-tx-secondary truncate mt-0.5">{conv.latest_message}</p>
              </div>
              <span className="text-xs text-tx-muted flex-shrink-0">
                {new Date(conv.latest_message_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No conversations yet"
          message="Start chatting with someone by visiting their profile and sending a DM."
          icon={<MessageCircle className="w-8 h-8 text-tx-muted" />}
        />
      )}
    </Layout>
  );
}
