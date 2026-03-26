import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Zap, Users, Video, Flame, Clock, Play } from "lucide-react";

interface Battle {
  id: number;
  user_id: number;
  username: string;
  actual_username: string;
  opponent_id: number | null;
  team_id: number | null;
  opponent_team_id: number | null;
  category: string;
  content: string;
  media_url: string;
  opponent_media_url: string | null;
  votes: number;
  opponent_votes: number;
  is_live: boolean;
  voting_deadline: string;
  created_at: string;
}

interface Team {
  id: number;
  name: string;
  creator_username: string;
}

const categoryMap: { [key: string]: string } = {
  rap: "Rap Battle",
  dance: "Dance-off",
  comedy: "Meme Creation",
  other: "Other",
};

export default function HypeBattles() {
  const [battles, setBattles] = useState<Battle[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [formData, setFormData] = useState({ category: "", content: "", mediaFile: null as File | null, opponentUsername: "", teamId: null as number | null, opponentTeamId: null as number | null, isLive: false });
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [joinTeamId, setJoinTeamId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading } = useAuth();
  const { socket } = useSocket();

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    Promise.all([
      axios.get("/api/hype-battles/battles", withAuth(token)),
      axios.get("/api/hype-battles/teams", withAuth(token)),
    ])
      .then(([bRes, tRes]) => { setBattles(bRes.data); setTeams(tRes.data); })
      .catch((err) => console.error("Error fetching data:", err))
      .finally(() => setLoading(false));

    if (socket) {
      socket.on("vote_update", (updated: Battle) => {
        setBattles((prev) => prev.map((b) => b.id === updated.id ? { ...b, votes: updated.votes, opponent_votes: updated.opponent_votes } : b));
      });
      return () => { socket.off("vote_update"); };
    }
  }, [user, token, socket]);

  useEffect(() => {
    return () => { if (mediaPreview) URL.revokeObjectURL(mediaPreview); };
  }, [mediaPreview]);

  const refreshData = () => {
    if (!user || !token) return;
    Promise.all([
      axios.get("/api/hype-battles/battles", withAuth(token)),
      axios.get("/api/hype-battles/teams", withAuth(token)),
    ]).then(([bRes, tRes]) => { setBattles(bRes.data); setTeams(tRes.data); });
  };

  const createTeam = async () => {
    if (!user || !token || !newTeamName) return;
    try {
      await axios.post("/api/hype-battles/teams", { email: user.email, name: newTeamName }, withAuth(token));
      setNewTeamName("");
      refreshData();
    } catch (err) { console.error("Error creating team:", err); }
  };

  const joinTeam = async () => {
    if (!user || !token || !joinTeamId) return;
    try {
      await axios.post("/api/hype-battles/teams/join", { email: user.email, teamId: joinTeamId }, withAuth(token));
      setJoinTeamId(null);
      refreshData();
    } catch (err) { console.error("Error joining team:", err); }
  };

  const postBattle = async () => {
    if (!user || !token || !formData.category || !formData.mediaFile) return;
    try {
      const fd = new FormData();
      fd.append("media", formData.mediaFile);
      fd.append("email", user.email);
      fd.append("category", formData.category);
      fd.append("content", formData.content);
      fd.append("opponentUsername", formData.opponentUsername);
      if (formData.teamId) fd.append("teamId", formData.teamId.toString());
      if (formData.opponentTeamId) fd.append("opponentTeamId", formData.opponentTeamId.toString());
      fd.append("isLive", formData.isLive.toString());
      await axios.post("/api/hype-battles/battles", fd, { headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" } });
      setFormData({ category: "", content: "", mediaFile: null, opponentUsername: "", teamId: null, opponentTeamId: null, isLive: false });
      setMediaPreview(null);
      refreshData();
    } catch (err) { console.error("Error posting battle:", err); }
  };

  const voteBattle = async (battleId: number, voteFor: "creator" | "opponent") => {
    if (!user || !token) return;
    try {
      await axios.post("/api/hype-battles/vote", { email: user.email, battleId, voteFor }, withAuth(token));
      if (socket) { socket.emit("vote_battle", { battleId, voteFor }); }
    } catch (err) { console.error("Error voting:", err); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setFormData({ ...formData, mediaFile: file });
    setMediaPreview(file ? URL.createObjectURL(file) : null);
  };

  const getTimeRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m left`;
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading battles..." />;

  return (
    <Layout maxWidth="4xl">
      <div className="mb-6">
        <h1 className="text-display flex items-center gap-3">
          <Zap className="w-8 h-8 text-yellow-500" />
          HYPE Battles
        </h1>
        <p className="text-tx-secondary mt-1">Challenge others and prove your skills</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm flex items-center justify-between ${message.includes("success") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
          <span>{message}</span>
          <button onClick={() => setMessage("")} className="text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Teams */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-brand-500" /> Manage Teams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-tx-primary mb-2">Create a Team</h3>
            <input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="Team name" className="input mb-2" />
            <Button onClick={createTeam} disabled={!newTeamName.trim()} className="w-full">Create Team</Button>
          </div>
          <div>
            <h3 className="font-medium text-tx-primary mb-2">Join a Team</h3>
            <select value={joinTeamId || ""} onChange={(e) => setJoinTeamId(Number(e.target.value) || null)} className="input mb-2">
              <option value="">Select a Team</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.creator_username})</option>)}
            </select>
            <Button onClick={joinTeam} disabled={!joinTeamId} className="w-full">Join Team</Button>
          </div>
        </div>
      </div>

      {/* Post Battle */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Flame className="w-5 h-5 text-red-500" /> Post a Battle</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
              <option value="">Select Category</option>
              <option value="rap">Rap Battle</option>
              <option value="dance">Dance-off</option>
              <option value="comedy">Meme Creation</option>
              <option value="other">Other</option>
            </select>
            <textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} placeholder="Describe your challenge..." className="input min-h-[100px] resize-none" rows={3} />
            <input type="file" accept="video/*" onChange={handleFileChange} className="input" />
          </div>
          <div className="space-y-3">
            {mediaPreview && (
              <div>
                <p className="text-sm font-medium text-tx-secondary mb-2">Preview:</p>
                <video src={mediaPreview} controls className="w-full rounded-lg" />
              </div>
            )}
            <input value={formData.opponentUsername} onChange={(e) => setFormData({ ...formData, opponentUsername: e.target.value })} placeholder="Opponent username (optional)" className="input" />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.isLive} onChange={(e) => setFormData({ ...formData, isLive: e.target.checked })} className="w-4 h-4 text-brand-600 rounded" />
              <span className="text-sm text-tx-secondary">Live Battle</span>
            </label>
            <Button onClick={postBattle} disabled={!formData.category || !formData.mediaFile} className="w-full">Post Battle</Button>
          </div>
        </div>
      </div>

      {/* Battles */}
      <div className="card p-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Video className="w-5 h-5 text-blue-500" /> Recent Battles</h2>
        {battles.length > 0 ? (
          <div className="space-y-6">
            {battles.map((battle) => (
              <div key={battle.id} className="border-b border-surface-border pb-6 last:border-b-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="relative">
                    {battle.is_live && <span className="absolute top-2 left-2 badge badge-danger text-xs animate-pulse">LIVE</span>}
                    <p className="font-semibold text-tx-primary mb-1">{battle.username} <span className="text-sm text-tx-muted">({categoryMap[battle.category] || battle.category})</span></p>
                    <p className="text-sm text-tx-secondary mb-2">{battle.content}</p>
                    {battle.media_url && <video src={battle.media_url} controls className="w-full rounded-lg" />}
                  </div>
                  <div>
                    {battle.opponent_id ? (
                      <div>
                        <p className="font-semibold text-tx-primary mb-1">{battle.actual_username}</p>
                        {battle.opponent_media_url ? (
                          <video src={battle.opponent_media_url} controls className="w-full rounded-lg" />
                        ) : (
                          <p className="text-sm text-tx-muted py-8 text-center">Awaiting response...</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-tx-muted py-8 text-center">No opponent yet</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm text-tx-secondary">
                    <span className="font-medium">{battle.username}: {battle.votes}</span>
                    {" | "}
                    <span className="font-medium">{battle.actual_username || "Opponent"}: {battle.opponent_votes}</span>
                    <span className="ml-3 flex items-center gap-1"><Clock className="w-3 h-3" /> {getTimeRemaining(battle.voting_deadline)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => voteBattle(battle.id, "creator")} disabled={new Date(battle.voting_deadline) < new Date()}>
                      <Play className="w-3 h-3 mr-1" /> {battle.username}
                    </Button>
                    {battle.opponent_id && (
                      <Button size="sm" variant="secondary" onClick={() => voteBattle(battle.id, "opponent")} disabled={new Date(battle.voting_deadline) < new Date()}>
                        <Play className="w-3 h-3 mr-1" /> {battle.actual_username}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No battles yet" message="Start the HYPE!" icon={<Zap className="w-8 h-8 text-tx-muted" />} />
        )}
      </div>
    </Layout>
  );
}
