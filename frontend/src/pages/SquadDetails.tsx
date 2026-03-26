import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState, ErrorState } from "../components/ui/PageStates";
import { Gamepad2, MessageCircle, Calendar, Video, ArrowLeft } from "lucide-react";

export default function SquadDetails() {
  const { squadId } = useParams<{ squadId: string }>();
  const navigate = useNavigate();
  const { user, token, loading: authLoading } = useAuth();
  const [clips, setClips] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [matchDescription, setMatchDescription] = useState("");
  const [clipFile, setClipFile] = useState<File | null>(null);
  const [clipPreview, setClipPreview] = useState<string | null>(null);
  const [clipDescription, setClipDescription] = useState("");
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !token || !squadId) { setLoading(false); return; }
    const auth = withAuth(token);
    const checkMembership = async () => {
      try {
        const res = await axios.get(`/api/squad-messages/${squadId}`, auth);
        if (res.status === 200) { setIsMember(true); setMessages(res.data); }
      } catch { setIsMember(false); }
    };
    const fetchClips = async () => {
      try { const res = await axios.get(`/api/game-clips/${squadId}`, auth); setClips(res.data); }
      catch (err) { console.error("Error:", err); }
    };
    Promise.all([checkMembership(), fetchClips()]).finally(() => setLoading(false));
    const interval = setInterval(checkMembership, 5000);
    return () => clearInterval(interval);
  }, [user, token, squadId]);

  useEffect(() => { return () => { if (clipPreview) URL.revokeObjectURL(clipPreview); }; }, [clipPreview]);

  const refreshMessages = () => {
    if (!token || !squadId) return;
    axios.get(`/api/game-squads/${squadId}/messages`, withAuth(token)).then((r) => setMessages(r.data)).catch(() => {});
  };

  const handleSend = async () => {
    if (!user || !token || !squadId || !newMessage.trim()) return;
    try {
      await axios.post(`/api/game-squads/${squadId}/messages`, { email: user.email, squadId: parseInt(squadId), message: newMessage }, withAuth(token));
      setNewMessage("");
      refreshMessages();
    } catch (err) { console.error("Error:", err); }
  };

  const handleSchedule = async () => {
    if (!user || !token || !squadId || !matchTime || !matchDescription) return;
    try {
      await axios.post(`/api/game-squads/${squadId}/messages`, { email: user.email, squadId: parseInt(squadId), message: `🎮 Match: ${matchDescription} at ${matchTime}` }, withAuth(token));
      setMatchTime(""); setMatchDescription("");
      refreshMessages();
    } catch (err) { console.error("Error:", err); }
  };

  const handleUpload = async () => {
    if (!user || !token || !squadId || !clipFile || !clipDescription) return;
    const fd = new FormData();
    fd.append("clip", clipFile); fd.append("email", user.email); fd.append("squadId", squadId); fd.append("description", clipDescription);
    try {
      await axios.post(`/api/game-squads/${squadId}/clips`, fd, { headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" } });
      setClipFile(null); setClipDescription(""); if (clipPreview) { URL.revokeObjectURL(clipPreview); setClipPreview(null); }
      const res = await axios.get(`/api/game-squads/${squadId}/clips`, withAuth(token));
      setClips(res.data);
    } catch (err) { console.error("Error:", err); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (clipPreview) URL.revokeObjectURL(clipPreview);
    setClipFile(file);
    setClipPreview(file ? URL.createObjectURL(file) : null);
  };

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading squad..." />;

  if (!isMember) {
    return <ErrorState title="Access Denied" message="You must be a member of this squad." action={<Button onClick={() => navigate("/game-squad")}>Back to Game Squad</Button>} />;
  }

  return (
    <Layout maxWidth="3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 flex items-center gap-2">
          <Gamepad2 className="w-7 h-7 text-green-500" />
          Squad Details
        </h1>
        <Button variant="secondary" onClick={() => navigate("/game-squad")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      {/* Chat */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><MessageCircle className="w-5 h-5 text-brand-500" /> Squad Chat</h2>
        <div className="bg-surface-muted rounded-lg h-64 overflow-y-auto p-4 mb-4 space-y-3">
          {messages.length > 0 ? messages.map((msg) => (
            <div key={msg.id}>
              <p className="font-semibold text-sm text-tx-primary">{msg.username}</p>
              <p className="text-sm text-tx-secondary">{msg.message}</p>
              <p className="text-xs text-tx-muted">{new Date(msg.created_at).toLocaleString()}</p>
            </div>
          )) : <p className="text-sm text-tx-muted text-center py-8">No messages yet.</p>}
        </div>
        <div className="flex gap-2">
          <Textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..." rows={1} className="flex-1" />
          <Button onClick={handleSend} disabled={!newMessage.trim()}>Send</Button>
        </div>
      </div>

      {/* Schedule */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Calendar className="w-5 h-5 text-green-500" /> Schedule a Match</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <Input type="datetime-local" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} />
          <Input value={matchDescription} onChange={(e) => setMatchDescription(e.target.value)} placeholder="Match description" />
        </div>
        <Button variant="success" onClick={handleSchedule} disabled={!matchTime || !matchDescription}>Schedule Match</Button>
      </div>

      {/* Upload Clip */}
      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Video className="w-5 h-5 text-purple-500" /> Upload a Clip</h2>
        <input type="file" accept="video/*" onChange={handleFileChange} className="input mb-3" />
        {clipPreview && <video src={clipPreview} controls className="w-full max-w-md rounded-lg mb-3" />}
        <Textarea value={clipDescription} onChange={(e) => setClipDescription(e.target.value)} placeholder="Clip description" rows={2} className="mb-3" />
        <Button onClick={handleUpload} disabled={!clipFile || !clipDescription}>Upload Clip</Button>
      </div>

      {/* Clips */}
      <div className="card p-6">
        <h2 className="text-h3 mb-4">Game Clips</h2>
        {clips.length > 0 ? (
          <div className="space-y-4">
            {clips.map((clip) => (
              <div key={clip.id} className="p-3 bg-surface-muted rounded-lg">
                <p className="font-semibold text-sm text-tx-primary">{clip.username}</p>
                <p className="text-sm text-tx-secondary mb-2">{clip.description}</p>
                <video src={clip.clip_url} controls className="w-full max-w-md rounded-lg" />
                <p className="text-xs text-tx-muted mt-1">{new Date(clip.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-tx-muted">No clips yet.</p>}
      </div>
    </Layout>
  );
}
