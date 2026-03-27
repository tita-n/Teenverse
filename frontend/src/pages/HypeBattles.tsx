import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Zap, Users, Video, Flame, Clock, Play, Trophy, X, ChevronRight } from "lucide-react";

interface Battle {
  id: number;
  title: string;
  description: string;
  category: string;
  challenge_type: string;
  challenger_id: number;
  challenger_username: string;
  challenger_profile: string;
  challenger_verified: number;
  challenger_media_url: string;
  challenger_media_type: string;
  challenger_content: string;
  challenger_submitted_at: string;
  challenger_votes: number;
  opponent_id: number | null;
  opponent_username: string;
  opponent_profile: string;
  opponent_verified: number;
  opponent_media_url: string;
  opponent_media_type: string;
  opponent_content: string;
  opponent_submitted_at: string;
  opponent_votes: number;
  status: string;
  voting_deadline: string;
  winner_id: number | null;
  reward_coins: number;
  created_at: string;
}

const CATEGORIES = ["Dance", "Rap", "Singing", "Comedy", "Art", "Fitness", "General"];

function CountdownTimer({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });
  
  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ hours: h, minutes: m, seconds: s });
    }, 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  return (
    <div className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-full text-sm font-bold">
      <Clock className="w-4 h-4" />
      {timeLeft.hours > 0 && <span>{timeLeft.hours}h</span>}
      {timeLeft.minutes}m {timeLeft.seconds}s
    </div>
  );
}

function BattleCard({ battle, onVote, hasVoted, userId }: { 
  battle: Battle; 
  onVote: (battleId: number, voteFor: "challenger" | "opponent") => void;
  hasVoted: string | null;
  userId: string;
}) {
  const isLive = battle.status === "live";
  const isCompleted = battle.status === "completed";
  const isExpired = battle.voting_deadline && new Date(battle.voting_deadline) < new Date();

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{battle.title}</span>
          <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded">{battle.category}</span>
        </div>
        <div className="flex items-center gap-2">
          {isLive && <CountdownTimer deadline={battle.voting_deadline} />}
          {isCompleted && <Trophy className="w-5 h-5 text-yellow-400" />}
        </div>
      </div>

      {/* Split Screen Battle */}
      <div className="grid grid-cols-2 border-b border-surface-border">
        {/* Challenger Side */}
        <div className={`p-4 ${battle.challenger_id === parseInt(userId) ? 'bg-brand-50' : ''}`}>
          <div className="text-center">
            <div className="w-16 h-16 mx-auto bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-xl mb-2">
              {battle.challenger_profile ? (
                <img src={battle.challenger_profile} alt="" className="w-full h-full object-cover rounded-full" />
              ) : (
                battle.challenger_username?.charAt(0).toUpperCase()
              )}
            </div>
            <p className="font-bold text-brand-700 flex items-center justify-center gap-1">
              {battle.challenger_username}
              {battle.challenger_verified === 1 && <span className="text-blue-500 text-sm">✓</span>}
            </p>
            {battle.challenger_media_url && battle.challenger_media_type === "video" ? (
              <video src={battle.challenger_media_url} controls className="w-full mt-2 rounded-lg" />
            ) : battle.challenger_media_url ? (
              <img src={battle.challenger_media_url} alt="Entry" className="w-full mt-2 rounded-lg" />
            ) : null}
            {battle.challenger_content && (
              <p className="text-sm text-tx-secondary mt-2">{battle.challenger_content}</p>
            )}
          </div>
          <div className="text-center mt-3">
            <p className="text-3xl font-bold text-brand-600">{battle.challenger_votes}</p>
            <p className="text-xs text-tx-muted">votes</p>
          </div>
          {isLive && (
            <Button 
              onClick={() => onVote(battle.id, "challenger")} 
              disabled={hasVoted !== null}
              className="w-full mt-2"
              variant={hasVoted === "challenger" ? "primary" : "secondary"}
            >
              {hasVoted === "challenger" ? "✓ Voted" : "Vote"}
            </Button>
          )}
        </div>

        {/* VS Divider */}
        <div className="flex items-center justify-center bg-surface-muted">
          <div className="w-12 h-12 bg-brand-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
            VS
          </div>
        </div>

        {/* Opponent Side */}
        <div className={`p-4 ${battle.opponent_id === parseInt(userId) ? 'bg-brand-50' : ''}`}>
          {battle.opponent_id ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto bg-opponent-100 rounded-full flex items-center justify-center text-opponent-700 font-bold text-xl mb-2">
                {battle.opponent_profile ? (
                  <img src={battle.opponent_profile} alt="" className="w-full h-full object-cover rounded-full" />
                ) : (
                  battle.opponent_username?.charAt(0).toUpperCase()
                )}
              </div>
              <p className="font-bold text-opponent-700 flex items-center justify-center gap-1">
                {battle.opponent_username}
                {battle.opponent_verified === 1 && <span className="text-blue-500 text-sm">✓</span>}
              </p>
              {battle.opponent_media_url && battle.opponent_media_type === "video" ? (
                <video src={battle.opponent_media_url} controls className="w-full mt-2 rounded-lg" />
              ) : battle.opponent_media_url ? (
                <img src={battle.opponent_media_url} alt="Entry" className="w-full mt-2 rounded-lg" />
              ) : null}
              {battle.opponent_content && (
                <p className="text-sm text-tx-secondary mt-2">{battle.opponent_content}</p>
              )}
            </div>
          ) : battle.challenge_type === "direct" ? (
            <div className="text-center py-8">
              <p className="text-tx-muted">Awaiting opponent response...</p>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-tx-muted">Open Challenge - Anyone can respond!</p>
              <Button size="sm" className="mt-2">Accept Challenge</Button>
            </div>
          )}
          {battle.opponent_id && (
            <div className="text-center mt-3">
              <p className="text-3xl font-bold text-opponent-600">{battle.opponent_votes}</p>
              <p className="text-xs text-tx-muted">votes</p>
            </div>
          )}
          {isLive && battle.opponent_id && (
            <Button 
              onClick={() => onVote(battle.id, "opponent")} 
              disabled={hasVoted !== null}
              className="w-full mt-2"
              variant={hasVoted === "opponent" ? "primary" : "secondary"}
            >
              {hasVoted === "opponent" ? "✓ Voted" : "Vote"}
            </Button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-surface-muted flex items-center justify-between">
        <span className="text-xs text-tx-muted">
          {isCompleted ? (
            <span className="text-green-600 font-bold">Battle Ended • Winner: {battle.winner_id === battle.challenger_id ? battle.challenger_username : battle.opponent_username} (+{battle.reward_coins} coins)</span>
          ) : isLive ? (
            <span>Live Battle • Prize: {battle.reward_coins} coins</span>
          ) : (
            <span>Pending • Waiting for opponent</span>
          )}
        </span>
        <span className="text-xs text-tx-muted">
          {new Date(battle.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export default function HypeBattles() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [votes, setVotes] = useState<{ [battleId: string]: string }>({});
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "General",
    challengeType: "open" as "open" | "direct",
    opponentUsername: "",
    mediaFile: null as File | null,
  });
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading, user: authUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    loadBattles();
  }, [user, token]);

  const loadBattles = async () => {
    try {
      const res = await axios.get("/api/hype-battles/hype-battles", withAuth(token));
      setBattles(res.data);
      
      // Load user's votes for each battle
      for (const battle of res.data) {
        const voteRes = await axios.get(`/api/hype-battles/hype-battles/${battle.id}/my-vote?email=${user.email}`, withAuth(token));
        if (voteRes.data.vote) {
          setVotes(prev => ({ ...prev, [battle.id]: voteRes.data.vote }));
        }
      }
    } catch (err) { console.error("Error loading battles:", err); }
    finally { setLoading(false); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, mediaFile: file });
      const url = URL.createObjectURL(file);
      setMediaPreview(url.includes("video") ? null : url);
    }
  };

  const createBattle = async () => {
    if (!user || !token || !formData.title || !formData.mediaFile) return;
    try {
      const fd = new FormData();
      fd.append("email", user.email);
      fd.append("title", formData.title);
      fd.append("description", formData.description);
      fd.append("category", formData.category);
      fd.append("challengeType", formData.challengeType);
      fd.append("opponentUsername", formData.opponentUsername);
      fd.append("mediaUrl", "");
      fd.append("mediaType", formData.mediaFile.type.startsWith("video") ? "video" : "image");
      fd.append("content", "");
      
      await axios.post("/api/hype-battles/hype-battles", fd, {
        headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" }
      });
      
      setMessage("Battle created! Waiting for opponent...");
      setShowCreate(false);
      setFormData({ title: "", description: "", category: "General", challengeType: "open", opponentUsername: "", mediaFile: null });
      setMediaPreview(null);
      loadBattles();
    } catch (err) { console.error("Error creating battle:", err); }
  };

  const handleVote = async (battleId: number, voteFor: "challenger" | "opponent") => {
    if (!user || !token) return;
    try {
      await axios.post(`/api/hype-battles/hype-battles/${battleId}/vote`, {
        email: user.email,
        voteFor
      }, withAuth(token));
      setVotes(prev => ({ ...prev, [battleId]: voteFor }));
      loadBattles();
    } catch (err) { console.error("Error voting:", err); }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;

  const lobbyBattles = battles.filter(b => b.status === "pending");
  const liveBattles = battles.filter(b => b.status === "live");
  const completedBattles = battles.filter(b => b.status === "completed");

  return (
    <Layout maxWidth="5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display flex items-center gap-3">
            <Zap className="w-10 h-10 text-yellow-500" />
            HYPE Battles
          </h1>
          <p className="text-tx-secondary mt-1">Challenge others • Vote • Win Coins</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Flame className="w-4 h-4 mr-2" /> Start Battle
        </Button>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-600 text-sm">{message}</div>
      )}

      {/* Create Battle Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2">Create Battle</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Battle title (e.g., 'Dance Battle: Who moves better?')"
                className="input"
              />
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your battle..."
                className="input min-h-[80px]"
              />
              <div className="grid grid-cols-2 gap-4">
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={formData.challengeType} onChange={(e) => setFormData({ ...formData, challengeType: e.target.value as any })} className="input">
                  <option value="open">Open Challenge</option>
                  <option value="direct">Direct Challenge</option>
                </select>
              </div>
              {formData.challengeType === "direct" && (
                <input
                  value={formData.opponentUsername}
                  onChange={(e) => setFormData({ ...formData, opponentUsername: e.target.value })}
                  placeholder="Opponent username"
                  className="input"
                />
              )}
              <div>
                <p className="text-sm font-medium mb-2">Your Entry (image or video)</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-500"
                >
                  {mediaPreview ? (
                    <img src={mediaPreview} alt="Preview" className="max-h-40 mx-auto rounded" />
                  ) : (
                    <div className="text-gray-400">
                      <Video className="w-8 mx-auto mb-2" />
                      <p className="text-sm">Click to upload your entry</p>
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={createBattle} disabled={!formData.title || !formData.mediaFile} className="w-full">
                Create Battle Challenge
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Live Battles */}
      {liveBattles.length > 0 && (
        <div className="mb-8">
          <h2 className="text-h3 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Live Battles ({liveBattles.length})
          </h2>
          <div className="space-y-6">
            {liveBattles.map(battle => (
              <BattleCard 
                key={battle.id} 
                battle={battle} 
                onVote={handleVote} 
                hasVoted={votes[battle.id] || null}
                userId={authUser?.id?.toString() || ""}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lobby Battles */}
      {lobbyBattles.length > 0 && (
        <div className="mb-8">
          <h2 className="text-h3 mb-4">Open Challenges ({lobbyBattles.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lobbyBattles.map(battle => (
              <BattleCard 
                key={battle.id} 
                battle={battle} 
                onVote={handleVote} 
                hasVoted={votes[battle.id] || null}
                userId={authUser?.id?.toString() || ""}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedBattles.length > 0 && (
        <div>
          <h2 className="text-h3 mb-4">Completed Battles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedBattles.slice(0, 5).map(battle => (
              <BattleCard 
                key={battle.id} 
                battle={battle} 
                onVote={handleVote} 
                hasVoted={votes[battle.id] || null}
                userId={authUser?.id?.toString() || ""}
              />
            ))}
          </div>
        </div>
      )}

      {battles.length === 0 && (
        <EmptyState title="No battles yet" message="Start the first HYPE battle!" icon={<Zap className="w-12 h-12 text-tx-muted" />} />
      )}
    </Layout>
  );
}