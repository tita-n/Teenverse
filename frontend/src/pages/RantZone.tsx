import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Flame, Heart, ArrowUp, MessageCircle, Filter, Ghost, Sparkles, Send } from "lucide-react";

interface Rant {
  id: number;
  content: string;
  category: string;
  upvotes: number;
  hugs: number;
  reactions: { [key: string]: number };
  ask_for_advice: number;
  created_at: string;
  comments: RantComment[];
}

interface RantComment {
  id: number;
  content: string;
  user_email: string;
  created_at: string;
}

const categories = ["School", "Family", "Relationships", "Self-Doubt", "Friends", "Pressure", "Just Vent"];
const reactions = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];

function RantCard({ rant, onUpvote, onReact, onHug, onComment }: {
  rant: Rant;
  onUpvote: () => void;
  onReact: (r: string) => void;
  onHug: () => void;
  onComment: (c: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");

  const handleSubmitComment = () => {
    if (commentContent.trim()) { onComment(commentContent); setCommentContent(""); }
  };

  return (
    <div className="card card-hover p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="badge badge-brand text-xs px-3 py-1">{rant.category}</span>
        {rant.ask_for_advice === 1 && <span className="badge bg-neon-cyan/20 text-neon-cyan text-xs px-3 py-1">💬 Need Advice</span>}
        <span className="text-xs text-dark-500 ml-auto">{new Date(rant.created_at).toLocaleDateString()}</span>
      </div>
      
      <p className="text-white text-lg mb-4 leading-relaxed">{rant.content}</p>
      
      {/* Reactions display */}
      {rant.reactions && Object.keys(rant.reactions).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {Object.entries(rant.reactions).map(([emoji, count]) => (
            <button key={emoji} onClick={() => onReact(emoji)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-dark-700 hover:bg-dark-600 text-lg">
              <span>{emoji}</span>
              <span className="text-sm font-bold text-dark-300">{count}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-dark-700">
        <button onClick={onUpvote} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-green-500/10 hover:text-green-500 transition-all">
          <ArrowUp className="w-6 h-6" />
          <span className="font-bold">{rant.upvotes || 0}</span>
        </button>
        
        <button onClick={onHug} className="flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-pink-500/10 hover:text-pink-500 transition-all">
          <Heart className="w-6 h-6" />
          <span className="font-bold">{rant.hugs || 0}</span>
        </button>
        
        <div className="flex gap-1">
          {reactions.map((r) => (
            <button key={r} onClick={() => onReact(r)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-dark-700 text-xl">
              {r}
            </button>
          ))}
        </div>
        
        <button onClick={() => setShowComments(!showComments)} className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-neon-cyan/10 text-dark-400 hover:text-neon-cyan">
          <MessageCircle className="w-5 h-5" />
          <span className="font-bold">{rant.comments?.length || 0}</span>
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-4 pt-4 border-t border-dark-700 space-y-3">
          {rant.comments?.map((comment) => (
            <div key={comment.id} className="bg-dark-800/50 p-3 rounded-xl">
              <p className="text-dark-200 text-sm">{comment.content}</p>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder="Drop a comment..." className="input flex-1" onKeyDown={(e) => { if (e.key === "Enter") handleSubmitComment(); }} />
            <Button size="sm" onClick={handleSubmitComment}><Send className="w-4 h-4" /></Button>
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
    if (!token) return;
    axios.get("/api/rants", withAuth(token)).then((res) => setRants(res.data)).catch(console.error);
  };

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    refreshRants();
    setLoading(false);
  }, [token]);

  const handlePostRant = async () => {
    if (!user || !rantContent.trim()) return;
    try { 
      setPosting(true); 
      await axios.post("/api/rants/create", { email: user.email, content: rantContent, category, askForAdvice }, withAuth(token));
      setRantContent(""); setAskForAdvice(false); 
      refreshRants(); 
    } catch (err) { console.error("Error posting rant:", err); alert("Failed to post rant - try again"); }
    finally { setPosting(false); }
  };

  const handleUpvote = async (rantId: number) => {
    try { await axios.post("/api/rants/upvote", { rantId }, withAuth(token)); refreshRants(); } catch (err) { console.error(err); }
  };
  const handleReact = async (rantId: number, reaction: string) => {
    try { await axios.post("/api/rants/react", { userEmail: user?.email, rantId, reaction }, withAuth(token)); refreshRants(); } catch (err) { console.error(err); }
  };
  const handleHug = async (rantId: number) => {
    try { await axios.post("/api/rants/hug", { rantId }, withAuth(token)); refreshRants(); } catch (err) { console.error(err); }
  };
  const handleComment = async (rantId: number, content: string) => {
    try { await axios.post("/api/rants/comment", { userEmail: user?.email, rantId, content }, withAuth(token)); refreshRants(); } catch (err) { console.error(err); }
  };

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;

  const trendingRants = [...rants].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0)).slice(0, 3);

  return (
    <Layout maxWidth="3xl">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <span className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center shadow-glow">🔥</span>
          <span className="text-gradient">Rant Zone</span>
        </h1>
        <p className="text-dark-400 mt-1">Get it all out. No judgment here 💯</p>
      </div>

      {/* Create Rant */}
      <div className="card card-hover p-5 mb-6 border border-orange-500/30">
        <Textarea value={rantContent} onChange={(e) => setRantContent(e.target.value)} placeholder="Spill everything... 😤" rows={4} className="mb-3" />
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input w-auto">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-dark-700 rounded-xl">
            <input type="checkbox" checked={askForAdvice} onChange={(e) => setAskForAdvice(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-dark-300">Need advice 💬</span>
          </label>
        </div>
        
        <Button onClick={handlePostRant} loading={posting} disabled={!rantContent.trim()} className="w-full mt-4">
          🚀 Let It All Out
        </Button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setFilteredCategory(null)} className={`px-4 py-2 rounded-full font-bold ${!filteredCategory ? 'bg-orange-500' : 'bg-dark-700'}`}>
          All 🔥
        </button>
        {categories.map((cat) => (
          <button key={cat} onClick={() => setFilteredCategory(cat)} className={`px-4 py-2 rounded-full font-bold ${filteredCategory === cat ? 'bg-orange-500' : 'bg-dark-700'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Rants Feed */}
      {rants.length > 0 ? rants.map((rant) => (
        <RantCard key={rant.id} rant={rant} onUpvote={() => handleUpvote(rant.id)} onReact={(r) => handleReact(rant.id, r)} onHug={() => handleHug(rant.id)} onComment={(c) => handleComment(rant.id, c)} />
      )) : <EmptyState title="No rants yet" message="Be the first to vent!" icon={<Flame className="w-12 h-12 text-orange-500" />} />}
    </Layout>
  );
}