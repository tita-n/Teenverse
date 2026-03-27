import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Trophy, Users, Video, Clock, Plus, ChevronRight, Crown, X } from "lucide-react";

interface Tournament {
  id: number;
  title: string;
  description: string;
  bracket_size: number;
  category: string;
  status: string;
  registration_deadline: string;
  current_round: number;
  total_rounds: number;
  winner_id: number | null;
  winner_username: string;
  reward_coins: number;
  created_at: string;
}

interface Participant {
  id: number;
  user_id: number;
  username: string;
  profile_media_url: string;
  verified: number;
  media_url: string;
  media_type: string;
  content: string;
  votes: number;
  status: string;
}

interface Round {
  id: number;
  round_number: number;
  status: string;
  voting_deadline: string;
}

interface Battle {
  id: number;
  round_id: number;
  participant1_id: number;
  participant2_id: number;
  p1_username: string;
  p1_media: string;
  p1_votes: number;
  participant2_id: number;
  p2_username: string;
  p2_media: string;
  p2_votes: number;
  winner_id: number;
  status: string;
}

const CATEGORIES = ["Dance", "Rap", "Singing", "Comedy", "Art", "Fitness", "Gaming"];

function TournamentCard({ tournament, onClick }: { tournament: Tournament; onClick: () => void }) {
  const isLive = tournament.status === "live";
  const isRegistration = tournament.status === "registration";
  const isCompleted = tournament.status === "completed";

  return (
    <div 
      onClick={onClick}
      className="card cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-brand-500"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-bold text-lg text-brand-700">{tournament.title}</h3>
            <span className="text-xs bg-surface-muted px-2 py-1 rounded">{tournament.category}</span>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-bold ${
            isLive ? "bg-red-100 text-red-600" :
            isRegistration ? "bg-green-100 text-green-600" :
            "bg-gray-100 text-gray-600"
          }`}>
            {isLive ? "LIVE" : isRegistration ? "Open" : "Done"}
          </div>
        </div>
        <p className="text-sm text-tx-secondary mt-1">{tournament.description}</p>
        <div className="flex items-center gap-4 mt-3 text-xs text-tx-muted">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {tournament.bracket_size} players</span>
          {isRegistration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(tournament.registration_deadline).toLocaleDateString()}</span>}
          {tournament.winner_username && <span className="text-yellow-600 flex items-center gap-1"><Crown className="w-3 h-3" /> {tournament.winner_username}</span>}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm font-bold text-brand-600">🏆 {tournament.reward_coins} coins</span>
          <span className="text-brand-500 flex items-center gap-1 text-sm">View <ChevronRight className="w-4 h-4" /></span>
        </div>
      </div>
    </div>
  );
}

function BracketDisplay({ tournamentId, rounds, battles, participants, onVote }: {
  tournamentId: number;
  rounds: Round[];
  battles: Battle[];
  participants: Participant[];
  onVote: (participantId: number) => void;
}) {
  const currentRound = rounds.find(r => r.status === "voting") || rounds[rounds.length - 1];
  const isLive = currentRound?.status === "voting";

  const getBracketSize = () => {
    if (!rounds.length) return 8;
    return Math.pow(2, rounds.length);
  };

  const bracketSize = getBracketSize();
  const numRounds = Math.log2(bracketSize);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-8 min-w-max p-4">
        {Array.from({ length: numRounds + 1 }).map((_, roundIdx) => {
          const roundNumber = roundIdx + 1;
          const roundRoundsData = rounds.find(r => r.round_number === roundNumber);
          const roundBattles = battles.filter(b => {
            const roundData = rounds.find(r => r.id === b.round_id);
            return roundData?.round_number === roundNumber;
          });
          
          return (
            <div key={roundIdx} className="flex flex-col justify-center">
              <div className="text-center mb-4 text-sm font-bold text-tx-muted">
                {roundIdx === numRounds ? "🏆 Champion" : `Round ${roundNumber}`}
                {roundRoundsData?.status === "voting" && <span className="ml-2 text-red-500">LIVE</span>}
              </div>
              <div className="flex flex-col gap-4 justify-center">
                {Array.from({ length: bracketSize / Math.pow(2, roundIdx + 1) }).map((_, matchIdx) => {
                  const battle = roundBattles[matchIdx];
                  return (
                    <div key={matchIdx} className="w-48 border border-surface-border rounded-lg overflow-hidden bg-surface">
                      {battle ? (
                        <>
                          {/* Participant 1 */}
                          <div className={`p-2 flex items-center gap-2 ${battle.p1_votes > battle.p2_votes ? 'bg-green-50' : ''}`}>
                            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-xs">
                              {battle.p1_username?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{battle.p1_username || "TBD"}</p>
                              <p className="text-xs text-tx-muted">{battle.p1_votes} votes</p>
                            </div>
                          </div>
                          <div className="border-t border-surface-border" />
                          {/* Participant 2 */}
                          <div className={`p-2 flex items-center gap-2 ${battle.p2_votes > battle.p1_votes ? 'bg-green-50' : ''}`}>
                            <div className="w-8 h-8 bg-opponent-100 rounded-full flex items-center justify-center text-xs">
                              {battle.p2_username?.charAt(0) || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{battle.p2_username || "TBD"}</p>
                              <p className="text-xs text-tx-muted">{battle.p2_votes} votes</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center text-tx-muted text-sm">TBD</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function UltimateShowdown() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [battles, setBattles] = useState<Battle[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    bracketSize: 16,
    category: "General",
  });
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    loadTournaments();
  }, [user, token]);

  const loadTournaments = async () => {
    try {
      const res = await axios.get("/api/showdown", withAuth(token));
      setTournaments(res.data);
    } catch (err) { console.error("Error loading tournaments:", err); }
    finally { setLoading(false); }
  };

  const loadTournamentDetail = async (id: number) => {
    try {
      const [tRes, roundsRes] = await Promise.all([
        axios.get(`/api/showdown/${id}`, withAuth(token)),
        axios.get(`/api/showdown/${id}/rounds`, withAuth(token))
      ]);
      
      const t = tRes.data;
      setSelectedTournament(t);
      setParticipants(t.participants || []);
      
      if (roundsRes.data.length > 0) {
        setRounds(roundsRes.data);
        const currentRound = roundsRes.data.find((r: Round) => r.status === "voting") || roundsRes.data[roundsRes.data.length - 1];
        if (currentRound) {
          const battlesRes = await axios.get(`/api/showdown/${id}/rounds/${currentRound.round_number}`, withAuth(token));
          setBattles(battlesRes.data.battles || []);
        }
      }
    } catch (err) { console.error("Error loading tournament detail:", err); }
  };

  const createTournament = async () => {
    if (!user || !token || !formData.title) return;
    try {
      await axios.post("/api/showdown", {
        email: user.email,
        ...formData
      }, withAuth(token));
      setMessage("Tournament created!");
      setShowCreate(false);
      loadTournaments();
    } catch (err) { console.error("Error creating tournament:", err); }
  };

  const joinTournament = async () => {
    if (!user || !token || !selectedTournament || !mediaFile) return;
    try {
      const fd = new FormData();
      fd.append("mediaUrl", "");
      fd.append("mediaType", mediaFile.type.startsWith("video") ? "video" : "image");
      fd.append("content", "");
      
      await axios.post(`/api/showdown/${selectedTournament.id}/join`, {
        email: user.email,
        mediaUrl: "",
        mediaType: "image",
        content: ""
      }, withAuth(token));
      
      setMessage("Joined tournament!");
      loadTournamentDetail(selectedTournament.id);
    } catch (err) { console.error("Error joining tournament:", err); }
  };

  const handleVote = async (participantId: number) => {
    if (!user || !token || !selectedTournament) return;
    try {
      await axios.post(`/api/showdown/${selectedTournament.id}/vote`, {
        email: user.email,
        participantId
      }, withAuth(token));
      loadTournamentDetail(selectedTournament.id);
    } catch (err) { console.error("Error voting:", err); }
  };

  if (authLoading) return <LoadingState message="Loading..." />;
  if (!user || !token) return <AuthRequiredState />;

  // Tournament Detail View
  if (selectedTournament) {
    const isRegistration = selectedTournament.status === "registration";
    const isLive = selectedTournament.status === "live";
    const isCompleted = selectedTournament.status === "completed";

    return (
      <Layout maxWidth="6xl">
        <button onClick={() => { setSelectedTournament(null); setParticipants([]); setRounds([]); setBattles([]); }} className="mb-4 text-brand-600 flex items-center gap-1">
          ← Back to Tournaments
        </button>

        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-display flex items-center gap-3">
                <Trophy className="w-10 h-10 text-yellow-500" />
                {selectedTournament.title}
              </h1>
              <p className="text-tx-secondary">{selectedTournament.description}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm bg-surface-muted px-3 py-1 rounded">{selectedTournament.category}</span>
                <span className="text-sm bg-surface-muted px-3 py-1 rounded">{selectedTournament.bracket_size} players</span>
                {selectedTournament.winner_username && (
                  <span className="text-sm text-yellow-600 flex items-center gap-1"><Crown className="w-4 h-4" /> {selectedTournament.winner_username}</span>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-brand-600">🏆 {selectedTournament.reward_coins} coins</p>
              <p className="text-sm text-tx-muted">Grand Prize</p>
            </div>
          </div>
        </div>

        {message && <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg">{message}</div>}

        {/* Registration */}
        {isRegistration && (
          <div className="card p-6 mb-6">
            <h2 className="text-h3 mb-4">Join the Tournament</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-tx-secondary mb-4">Upload your entry (video or image) to compete!</p>
                <input type="file" ref={fileInputRef} accept="image/*,video/*" onChange={(e) => setMediaFile(e.target.files?.[0] || null)} className="input" />
              </div>
              <div className="flex items-center">
                <Button onClick={joinTournament} disabled={!mediaFile} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Join Tournament
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Bracket Display */}
        {isLive && rounds.length > 0 && (
          <div className="card p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h3">Tournament Bracket</h2>
              <span className="text-sm bg-red-100 text-red-600 px-3 py-1 rounded-full animate-pulse">Round {selectedTournament.current_round} LIVE</span>
            </div>
            <BracketDisplay 
              tournamentId={selectedTournament.id}
              rounds={rounds}
              battles={battles}
              participants={participants}
              onVote={handleVote}
            />
          </div>
        )}

        {/* Participants */}
        <div className="card p-6">
          <h2 className="text-h3 mb-4">Participants ({participants.length}/{selectedTournament.bracket_size})</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {participants.filter(p => p.status !== 'eliminated').map(p => (
              <div key={p.id} className="text-center p-3 bg-surface-muted rounded-lg">
                <div className="w-12 h-12 mx-auto bg-brand-100 rounded-full flex items-center justify-center mb-2">
                  {p.profile_media_url ? (
                    <img src={p.profile_media_url} alt="" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    p.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <p className="font-medium text-sm truncate">{p.username}</p>
                <p className="text-xs text-tx-muted">{p.votes} votes</p>
                {isLive && <Button size="sm" className="mt-2" onClick={() => handleVote(p.id)}>Vote</Button>}
              </div>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Tournament List View
  return (
    <Layout maxWidth="5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display flex items-center gap-3">
            <Trophy className="w-10 h-10 text-yellow-500" />
            Ultimate Showdown
          </h1>
          <p className="text-tx-secondary mt-1">Compete for glory • Win massive rewards</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Tournament
        </Button>
      </div>

      {message && <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg">{message}</div>}

      {/* Create Tournament Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-h2">Create Tournament</h2>
              <button onClick={() => setShowCreate(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Tournament title" className="input" />
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Description" className="input" />
              <div className="grid grid-cols-2 gap-4">
                <select value={formData.bracketSize} onChange={(e) => setFormData({ ...formData, bracketSize: parseInt(e.target.value) })} className="input">
                  <option value={8}>8 Players</option>
                  <option value={16}>16 Players</option>
                  <option value={32}>32 Players</option>
                </select>
                <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="input">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Button onClick={createTournament} disabled={!formData.title} className="w-full">Create Tournament</Button>
            </div>
          </div>
        </div>
      )}

      {/* Tournament List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tournaments.map(t => (
          <TournamentCard key={t.id} tournament={t} onClick={() => loadTournamentDetail(t.id)} />
        ))}
      </div>

      {tournaments.length === 0 && (
        <EmptyState title="No tournaments" message="Create the first Ultimate Showdown!" icon={<Trophy className="w-12 h-12 text-tx-muted" />} />
      )}
    </Layout>
  );
}