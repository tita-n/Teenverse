import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Flame, Heart, ArrowUp, MessageCircle, Filter, Ghost, Sparkles } from "lucide-react";
import DOMPurify from "dompurify";

const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br'], ALLOWED_ATTR: [] });
};

interface Rant {
  id: number; content: string; category: string; upvotes: number;
  reactions: { [key: string]: number }; hugs: number; ask_for_advice: number;
  created_at: string; comments: RantComment[];
}
interface RantComment { id: number; rant_id: number; content: string; created_at: string; }

const categories = ["School", "Family", "Relationships", "Self-Doubt", "Friends", "Pressure", "Just Vent"];
const reactions = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];

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
    if (commentContent.trim()) { onComment(rant.id, commentContent); setCommentContent(""); }
  };

  return (
    <div className="card card-hover p-5 mb-4">
      {/* Category Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="badge badge-brand text-xs px-3 py-1">{rant.category}</span>
        {rant.ask_for_advice === 1 && <span className="badge bg-neon-cyan/20 text-neon-cyan text-xs px-3 py-1">💬 Need Advice</span>}
        <span className="text-xs text-dark-500 ml-auto">{new Date(rant.created_at).toLocaleDateString()}</span>
      </div>
      
      {/* Content */}
      <p className="text-white text-lg mb-4 leading-relaxed">{rant.content}</p>
      
      {/* Actions - Big tappable buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-dark-700">
        <button onClick={() => onUpvote(rant.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-green-500/10 hover:text-green-500 transition-all group">
          <ArrowUp className="w-6 h-6 group-hover:scale-125 transition-transform" />
          <span className="font-bold">{rant.upvotes || 0}</span>
        </button>
        
        <button onClick={() => onHug(rant.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-pink-500/10 hover:text-pink-500 transition-all group">
          <Heart className="w-6 h-6 group-hover:scale-125 transition-transform" fill="currentColor" />
          <span className="font-bold">{rant.hugs || 0}</span>
        </button>
        
        <div className="flex gap-1">
          {reactions.map((r) => (
            <button key={r} onClick={() => onReaction(rant.id, r)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-dark-700 text-lg hover:scale-125 transition-all">
              {r}
            </button>
          ))}
        </div>
        
        <button onClick={() => setShowComments(!showComments)} className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-neon-cyan/10 text-dark-400 hover:text-neon-cyan transition-all">
          <MessageCircle className="w-5 h-5" />
          <span className="font-bold">{rant.comments.length}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-dark-700 space-y-3">
          {rant.comments.map((comment) => (
            <div key={comment.id} className="bg-dark-800/50 p-3 rounded-xl">
              <p className="text-dark-200 text-sm">{comment.content}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder="Drop a comment..." className="input flex-1" onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }} />
            <Button size="sm" onClick={handleSubmit} disabled={!commentContent.trim()}>Send</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RantZone() {
  const [rantContent, setRantContent] = useState("");
  const [category, setCategory] = useState("Just Vent");
  const [askForAdvice, setAskForAdvice] = useState(false);
  const [rants, setRants] = useState<Rant[]>([]);
  const [filteredCategory, setFilteredCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const { user, token, loading: authLoading } = useAuth();

  const refreshRants = () => {
    if (!user || !token) return;
    const params = filteredCategory ? { category: filteredCategory } : {};
    return axios.get("/api/rants", { ...withAuth(token), params }).then((res) => setRants(res.data));
  };

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    const params = filteredCategory ? { category: filteredCategory } : {};
    axios.get("/api/rants", { ...withAuth(token), params }).then((res) => setRants(res.data)).finally(() => setLoading(false));
  }, [user, token, filteredCategory]);

  const handlePostRant = async () => {
    if (!user || !token || !rantContent.trim()) return;
    try { setPosting(true); await axios.post("/api/rants/create", { email: user.email, content: rantContent, category, askForAdvice }, withAuth(token)); setRantContent(""); setAskForAdvice(false); await refreshRants(); } 
    catch (err) { console.error("Error:", err); }
    finally { setPosting(false); }
  };

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;

  const trendingRants = [...rants].sort((a, b) => b.upvotes - a.upvotes).slice(0, 3);

  return (
    <Layout maxWidth="3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <span className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-glow">🔥</span>
          <span className="text-gradient">Rant Zone</span>
        </h1>
        <p className="text-dark-400 mt-1">Get it all out. No judgment here. We got you 💯</p>
      </div>

      {/* Create Rant Card */}
      <div className="card card-hover p-5 mb-6 border border-orange-500/30">
        <h2 className="font-bold text-white mb-4 flex items-center gap-2"><Ghost className="w-5 h-5 text-orange-400" />Vent Anonymously</h2>
        
        <Textarea value={rantContent} onChange={(e) => setRantContent(e.target.value)} placeholder="Spill everything... what's bothering you? 😤" rows={4} className="mb-3 text-lg" />
        
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-auto">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-dark-700 rounded-xl hover:bg-dark-600 transition-colors">
            <input type="checkbox" checked={askForAdvice} onChange={(e) => setAskForAdvice(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-dark-300">Need advice 💬</span>
          </label>
        </div>
        
        <Button onClick={handlePostRant} loading={posting} disabled={!rantContent.trim()} className="w-full py-3 text-lg font-bold">
          🚀 Let It All Out
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilteredCategory(null)} className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${!filteredCategory ? 'bg-orange-500 text-white shadow-glow-sm' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}>
          All 🔥
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilteredCategory(cat)} className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${filteredCategory === cat ? 'bg-orange-500 text-white shadow-glow-sm' : 'bg-dark-700 text-dark-300 hover:bg-dark-600'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Trending Rants */}
      {trendingRants.length > 0 && (
        <div className="mb-6">
          <h2 className="font-bold text-lg text-orange-400 mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5" />Trending Now</h2>
          <div className="grid grid-cols-1 md:grid-colss3 gap-3">
            {trendingRants.map((rant) => (
              <RantCard key={rant.id} rant={rant} onUpvote={() => axios.post("/api/rants/upvote", { email: user.email, rantId: rant.id }, withAuth(token)).then(refreshRants)} onReaction={(id, r) => axios.post("/api/rants/react", { email: user.email, rantId: id, reaction: r }, withAuth(token)).then(refreshRants)} onHug={() => axios.post("/api/rants/hug", { email: user.email, rantId: rant.id }, withAuth(token)).then(refreshRants)} onComment={(id, c) => axios.post("/api/rants/comment", { email: user.email, rantId: id, content: c }, withAuth(token)).then(refreshRants)} />
            ))}
          </div>
        </div>
      )}

      {/* All Rants */}
      <div>
        <h2 className="font-bold text-lg text-white mb-3">Recent Rants</h2>
        {rants.length > 0 ? rants.map((rant) => (
          <RantCard key={rant.id} rant={rant} onUpvote={() => axios.post("/api/rants/upvote", { email: user.email, rantId: rant.id }, withAuth(token)).then(refreshRants)} onReaction={(id, r) => axios.post("/api/rants/react", { email: user.email, rantId: id, reaction: r }, withAuth(token)).then(refreshRants)} onHug={() => axios.post("/api/rants/hug", { email: user.email, rantId: rant.id }, withAuth(token)).then(refreshRants)} onComment={(id, c) => axios.post("/api/rants/comment", { email: user.email, rantId: id, content: c }, withAuth(token)).then(refreshRants)} />
        )) : <EmptyState title="No rants yet" message="Be the first to vent!" icon={<Flame className="w-12 h-12 text-orange-500" />} />}
      </div>
    </Layout>
  );
}