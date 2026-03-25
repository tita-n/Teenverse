import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Users, Trophy, Gamepad2, Eye, Star, Lock, Unlock } from "lucide-react";

interface GameSquad {
  id: number;
  game_name: string;
  uid: string;
  description: string;
  username: string;
  created_at: string;
  status: string;
  max_members: number;
  wins: number;
  creator_username?: string;
  is_featured: number;
}

interface Tournament {
  id: number;
  squad_id: number;
  title: string;
  description: string;
  game_name: string;
  status: string;
  winner_id: number | null;
  created_at: string;
  squad_game_name: string;
  creator_username: string;
  participants: { id: number; game_name: string; username: string }[];
}

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

export default function GameSquad() {
  const [gameName, setGameName] = useState("");
  const [uid, setUid] = useState("");
  const [description, setDescription] = useState("");
  const [squads, setSquads] = useState<GameSquad[]>([]);
  const [leaderboard, setLeaderboard] = useState<GameSquad[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentTitle, setTournamentTitle] = useState("");
  const [tournamentDescription, setTournamentDescription] = useState("");
  const [tournamentGameName, setTournamentGameName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const fetchData = async () => {
    if (!user || !token) return;
    try {
      setLoading(true);
      const auth = withAuth(token);
      const [sRes, lRes, tRes] = await Promise.all([
        axios.get("/api/game-squads", auth),
        axios.get("/api/game-squads/leaderboard", auth),
        axios.get("/api/tournaments", auth),
      ]);
      setSquads(sRes.data);
      setLeaderboard(lRes.data);
      setTournaments(tRes.data);
    } catch (err) { console.error("Error:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [user, token]);

  const refreshSquads = () => {
    if (!user || !token) return;
    const auth = withAuth(token);
    Promise.all([
      axios.get("/api/game-squads", auth),
      axios.get("/api/game-squads/leaderboard", auth),
    ]).then(([sRes, lRes]) => { setSquads(sRes.data); setLeaderboard(lRes.data); });
  };

  const handleCreateSquad = async () => {
    if (!user || !token || !gameName || !uid || !description) return;
    try {
      setCreating(true);
      await axios.post("/api/game-squads", { email: user.email, gameName, uid, description }, withAuth(token));
      setGameName(""); setUid(""); setDescription("");
      refreshSquads();
    } catch (err) { console.error("Error creating squad:", err); }
    finally { setCreating(false); }
  };

  const handleJoinSquad = async (squadId: number) => {
    if (!user || !token) return;
    try { await axios.post("/api/game-squads/join", { email: user.email, squadId }, withAuth(token)); }
    catch (err) { console.error("Error joining:", err); }
  };

  const handleReportWin = async (squadId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/game-squads/report-win", { email: user.email, squadId }, withAuth(token));
      refreshSquads();
    } catch (err) { console.error("Error reporting win:", err); }
  };

  const handleCreateTournament = async (squadId: number) => {
    if (!user || !token || !tournamentTitle || !tournamentDescription || !tournamentGameName) return;
    try {
      await axios.post("/api/tournaments", { email: user.email, squadId, title: tournamentTitle, description: tournamentDescription, gameName: tournamentGameName }, withAuth(token));
      setTournamentTitle(""); setTournamentDescription(""); setTournamentGameName("");
      const res = await axios.get("/api/tournaments", withAuth(token));
      setTournaments(res.data);
    } catch (err) { console.error("Error creating tournament:", err); }
  };

  const handleJoinTournament = async (tournamentId: number, squadId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/tournaments/join", { email: user.email, tournamentId, squadId }, withAuth(token));
      const res = await axios.get("/api/tournaments", withAuth(token));
      setTournaments(res.data);
    } catch (err) { console.error("Error joining tournament:", err); }
  };

  const handleDeclareWinner = async (tournamentId: number, winnerId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/tournaments/declare-winner", { email: user.email, tournamentId, winnerId }, withAuth(token));
      const [tRes, lRes] = await Promise.all([
        axios.get("/api/tournaments", withAuth(token)),
        axios.get("/api/game-squads/leaderboard", withAuth(token)),
      ]);
      setTournaments(tRes.data);
      setLeaderboard(lRes.data);
    } catch (err) { console.error("Error declaring winner:", err); }
  };

  const handleManageStatus = async (squadId: number, currentStatus: string) => {
    if (!user || !token) return;
    try {
      const newStatus = currentStatus === "open" ? "closed" : "open";
      await axios.post("/api/game-squads/manage-status", { email: user.email, squadId, newStatus }, withAuth(token));
      setSquads(squads.map(s => s.id === squadId ? { ...s, status: newStatus } : s));
    } catch (err) { console.error("Error:", err); }
  };

  const handleFeatureSquad = async (squadId: number, isFeatured: number) => {
    if (!user || !token) return;
    try {
      const feature = isFeatured ? 0 : 1;
      await axios.post("/api/game-squads/feature", { email: user.email, squadId, feature }, withAuth(token));
      setSquads(squads.map(s => s.id === squadId ? { ...s, is_featured: feature } : s));
    } catch (err) { console.error("Error:", err); }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading squads..." />;

  return (
    <Layout maxWidth="4xl">
      <div className="mb-6">
        <h1 className="text-h1 flex items-center gap-2">
          <Gamepad2 className="w-7 h-7 text-green-500" />
          Game Squad
        </h1>
        <p className="text-tx-secondary mt-1">Join squads, compete in tournaments</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      {/* Create Squad */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 mb-4">Create a Game Squad</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Game Name (e.g., CODM)" />
          <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Your UID" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Squad description" />
        </div>
        <Button onClick={handleCreateSquad} loading={creating} disabled={!gameName || !uid || !description}>
          Create Squad
        </Button>
      </div>

      {/* Leaderboard */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard</h2>
        {leaderboard.length > 0 ? (
          <div className="space-y-3">
            {leaderboard.map((squad, index) => (
              <div key={squad.id} className="flex items-center gap-4 p-3 bg-surface-muted rounded-lg">
                <span className="w-8 h-8 flex items-center justify-center bg-brand-100 text-brand-700 rounded-full font-bold text-sm">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-tx-primary">{squad.game_name} Squad</p>
                  <p className="text-sm text-tx-secondary">by {squad.creator_username} • {squad.wins} wins</p>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-tx-muted">No squads yet.</p>}
      </div>

      {/* Tournaments */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Star className="w-5 h-5 text-purple-500" /> Tournaments</h2>
        {tournaments.length > 0 ? (
          <div className="space-y-4">
            {tournaments.map((t) => (
              <div key={t.id} className="border-b border-surface-border pb-4 last:border-b-0">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-tx-primary">{t.title}</p>
                    <p className="text-sm text-tx-secondary">{t.game_name} • by {t.creator_username}</p>
                    <p className="text-sm text-tx-muted">{t.description}</p>
                    <span className={`badge text-xs mt-1 ${t.status === "completed" ? "badge-success" : t.status === "open" ? "badge-brand" : "badge-neutral"}`}>{t.status}</span>
                  </div>
                </div>
                {t.status === "open" && squads.some(s => s.username === user.username) && (
                  <select onChange={(e) => e.target.value && handleJoinTournament(t.id, parseInt(e.target.value))} className="input text-sm mt-2 w-auto">
                    <option value="">Join with squad...</option>
                    {squads.filter(s => s.username === user.username).map(s => <option key={s.id} value={s.id}>{s.game_name}</option>)}
                  </select>
                )}
                {t.status !== "completed" && t.creator_username === user.username && (
                  <select onChange={(e) => e.target.value && handleDeclareWinner(t.id, parseInt(e.target.value))} className="input text-sm mt-2 w-auto">
                    <option value="">Declare winner...</option>
                    <option value={t.squad_id}>{t.squad_game_name}</option>
                    {t.participants.map(p => <option key={p.id} value={p.id}>{p.game_name}</option>)}
                  </select>
                )}
                {t.status === "completed" && t.winner_id && (
                  <p className="text-sm text-green-600 font-medium mt-1">
                    🏆 Winner: {t.participants.find(p => p.id === t.winner_id)?.game_name || t.squad_game_name}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : <EmptyState title="No tournaments yet" />}
      </div>

      {/* Squads */}
      <div className="card p-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-green-500" /> Game Squads</h2>
        {squads.length > 0 ? (
          <div className="space-y-4">
            {squads.map((squad) => (
              <div key={squad.id} className="p-4 bg-surface-muted rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-tx-primary flex items-center gap-2">
                      {squad.game_name} Squad
                      {squad.is_featured ? <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" /> : null}
                    </p>
                    <p className="text-sm text-tx-secondary">by {squad.username} • UID: {squad.uid}</p>
                    <p className="text-sm text-tx-muted mt-1">{squad.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-tx-muted">
                      <span className={`badge ${squad.status === "open" ? "badge-success" : "badge-danger"}`}>{squad.status}</span>
                      <span>{squad.wins} wins</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {squad.status === "open" && (
                      <Button size="sm" onClick={() => handleJoinSquad(squad.id)}>Join</Button>
                    )}
                    {squad.username === user.username && (
                      <Button size="sm" variant="success" onClick={() => handleReportWin(squad.id)}>Report Win</Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => navigate(`/squad-details/${squad.id}`)}>
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    {isAdmin && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleManageStatus(squad.id, squad.status)}>
                          {squad.status === "open" ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleFeatureSquad(squad.id, squad.is_featured)}>
                          <Star className={`w-3 h-3 ${squad.is_featured ? "fill-yellow-500 text-yellow-500" : ""}`} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {squad.username === user.username && (
                  <div className="mt-4 pt-4 border-t border-surface-border">
                    <p className="text-sm font-medium text-tx-secondary mb-2">Create Tournament</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input value={tournamentTitle} onChange={(e) => setTournamentTitle(e.target.value)} placeholder="Title" />
                      <Input value={tournamentGameName} onChange={(e) => setTournamentGameName(e.target.value)} placeholder="Game" />
                      <Input value={tournamentDescription} onChange={(e) => setTournamentDescription(e.target.value)} placeholder="Description" />
                    </div>
                    <Button size="sm" className="mt-2" onClick={() => handleCreateTournament(squad.id)} disabled={!tournamentTitle || !tournamentGameName || !tournamentDescription}>
                      Create Tournament
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <EmptyState title="No squads yet" message="Create one to get started!" icon={<Gamepad2 className="w-8 h-8 text-tx-muted" />} />}
      </div>
    </Layout>
  );
}
