import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Flame, Heart, ArrowUp, MessageCircle, Filter } from "lucide-react";
import DOMPurify from "dompurify";

const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

interface Rant {
  id: number;
  content: string;
  category: string;
  upvotes: number;
  reactions: { [key: string]: number };
  hugs: number;
  ask_for_advice: number;
  created_at: string;
  comments: RantComment[];
}

interface RantComment {
  id: number;
  rant_id: number;
  content: string;
  created_at: string;
}

const categories = ["School Life", "Family Drama", "Relationship Wahala", "Self-Doubt & Mental Struggles", "Fake Friends", "Pressure & Anxiety", "Just Need to Vent"];
const reactions = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];

export default function RantZone() {
  const [rantContent, setRantContent] = useState("");
  const [category, setCategory] = useState("Just Need to Vent");
  const [askForAdvice, setAskForAdvice] = useState(false);
  const [rants, setRants] = useState<Rant[]>([]);
  const [filteredCategory, setFilteredCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const { user, token, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    const params = filteredCategory ? { category: filteredCategory } : {};
    axios.get("/api/rants", { ...withAuth(token), params })
      .then((res) => setRants(res.data))
      .catch((err) => console.error("Error fetching rants:", err))
      .finally(() => setLoading(false));
  }, [user, token, filteredCategory]);

  const refreshRants = () => {
    if (!user || !token) return;
    const params = filteredCategory ? { category: filteredCategory } : {};
    return axios.get("/api/rants", { ...withAuth(token), params }).then((res) => setRants(res.data));
  };

  const handlePostRant = async () => {
    if (!user || !token || !rantContent.trim()) return;
    try {
      setPosting(true);
      await axios.post("/api/rants/create", { email: user.email, content: rantContent, category, askForAdvice }, withAuth(token));
      setRantContent("");
      setAskForAdvice(false);
      setCategory("Just Need to Vent");
      await refreshRants();
    } catch (err) { console.error("Error posting rant:", err); }
    finally { setPosting(false); }
  };

  const handleUpvote = async (rantId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/rants/upvote", { email: user.email, rantId }, withAuth(token));
      await refreshRants();
    } catch (err) { console.error("Error upvoting:", err); }
  };

  const handleReaction = async (rantId: number, reaction: string) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/rants/react", { email: user.email, rantId, reaction }, withAuth(token));
      await refreshRants();
    } catch (err) { console.error("Error reacting:", err); }
  };

  const handleSendHug = async (rantId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/rants/hug", { email: user.email, rantId }, withAuth(token));
      await refreshRants();
    } catch (err) { console.error("Error sending hug:", err); }
  };

  const handleAddComment = async (rantId: number, content: string) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/rants/comment", { email: user.email, rantId, content }, withAuth(token));
      await refreshRants();
    } catch (err) { console.error("Error adding comment:", err); }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading rants..." />;

  const trendingRants = [...rants].sort((a, b) => b.upvotes - a.upvotes).slice(0, 5);

  return (
    <Layout maxWidth="3xl">
      <div className="mb-6">
        <h1 className="text-h1 flex items-center gap-2">
          <Flame className="w-7 h-7 text-brand-500" />
          Rant Zone
        </h1>
        <p className="text-tx-secondary mt-1">A safe space to let it all out. No judgment.</p>
      </div>

      {/* Post Rant */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-tx-primary mb-4">Share Your Thoughts</h2>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mb-3">
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <Textarea
          value={rantContent}
          onChange={(e) => setRantContent(e.target.value)}
          placeholder="Let it all out... (Your rant will be anonymous)"
          rows={3}
          className="mb-3"
        />
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input type="checkbox" checked={askForAdvice} onChange={(e) => setAskForAdvice(e.target.checked)} className="w-4 h-4 text-brand-600 rounded" />
          <span className="text-sm text-tx-secondary">Ask for advice</span>
        </label>
        <Button onClick={handlePostRant} loading={posting} disabled={!rantContent.trim()}>
          Post Anonymously
        </Button>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <h2 className="font-semibold text-tx-primary mb-3 flex items-center gap-2">
          <Filter className="w-4 h-4" />
          Filter by Category
        </h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilteredCategory(null)} className={`btn-sm rounded-full ${!filteredCategory ? "btn-primary" : "btn-secondary"}`}>
            All
          </button>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilteredCategory(cat)} className={`btn-sm rounded-full ${filteredCategory === cat ? "btn-primary" : "btn-secondary"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Trending */}
      {trendingRants.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-tx-primary mb-4 flex items-center gap-2">
            🔥 Trending Rants
          </h2>
          <div className="space-y-4">
            {trendingRants.map((rant) => (
              <RantCard key={rant.id} rant={rant} onUpvote={handleUpvote} onReaction={handleReaction} onHug={handleSendHug} onComment={handleAddComment} />
            ))}
          </div>
        </div>
      )}

      {/* All Rants */}
      <div className="card p-6">
        <h2 className="font-semibold text-tx-primary mb-4">Recent Rants</h2>
        {rants.length > 0 ? (
          <div className="space-y-4">
            {rants.map((rant) => (
              <RantCard key={rant.id} rant={rant} onUpvote={handleUpvote} onReaction={handleReaction} onHug={handleSendHug} onComment={handleAddComment} />
            ))}
          </div>
        ) : (
          <EmptyState title="No rants yet" message="Be the first to share your thoughts!" icon={<Flame className="w-8 h-8 text-tx-muted" />} />
        )}
      </div>
    </Layout>
  );
}

function RantCard({ rant, onUpvote, onReaction, onHug, onComment }: {
  rant: Rant;
  onUpvote: (id: number) => void;
  onReaction: (id: number, r: string) => void;
  onHug: (id: number) => void;
  onComment: (id: number, content: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");

  const handleSubmit = () => {
    if (commentContent.trim()) {
      onComment(rant.id, commentContent);
      setCommentContent("");
    }
  };

  return (
    <div className="border-b border-surface-border pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="badge badge-brand text-xs">{rant.category}</span>
        {rant.ask_for_advice === 1 && <span className="badge badge-neutral text-xs">💬 Advice Requested</span>}
        <span className="text-xs text-tx-muted ml-auto">{new Date(rant.created_at).toLocaleString(undefined, { month: "short", day: "numeric" })}</span>
      </div>
      <p className="text-tx-primary mb-3">{sanitizeContent(rant.content)}</p>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => onUpvote(rant.id)} className="btn-ghost btn-sm flex items-center gap-1 text-tx-secondary hover:text-blue-600">
          <ArrowUp className="w-4 h-4" /> {rant.upvotes || 0}
        </button>
        <button onClick={() => onHug(rant.id)} className="btn-ghost btn-sm flex items-center gap-1 text-tx-secondary hover:text-pink-600">
          <Heart className="w-4 h-4" /> {rant.hugs || 0}
        </button>
        {reactions.map((r) => (
          <button key={r} onClick={() => onReaction(rant.id, r)} className="btn-ghost btn-sm text-tx-secondary hover:text-tx-primary">
            {r} {rant.reactions?.[r] || 0}
          </button>
        ))}
        <button onClick={() => setShowComments(!showComments)} className="btn-ghost btn-sm flex items-center gap-1 text-brand-600 ml-auto">
          <MessageCircle className="w-4 h-4" /> {rant.comments.length}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 pl-4 border-l-2 border-surface-border space-y-3">
          {rant.comments.map((comment) => (
            <div key={comment.id} className="text-sm">
              <p className="text-tx-primary">{sanitizeContent(comment.content)}</p>
              <p className="text-xs text-tx-muted">{new Date(comment.created_at).toLocaleString()}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder="Comment (anonymous)" className="input text-sm flex-1" onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} />
            <Button size="sm" onClick={handleSubmit} disabled={!commentContent.trim()}>Post</Button>
          </div>
        </div>
      )}
    </div>
  );
}
