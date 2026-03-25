import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { Vote, Play, Upload, Calendar } from "lucide-react";

export default function UltimateShowdown() {
  const [vote, setVote] = useState("");
  const [clipUrl, setClipUrl] = useState("");
  const [category, setCategory] = useState("Rap");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading } = useAuth();
  const categories = ["Rap", "Dance", "Singing"];

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;

  return (
    <Layout maxWidth="3xl">
      <div className="mb-6">
        <h1 className="text-display text-center">Ultimate Showdown</h1>
        <p className="text-tx-secondary text-center mt-1">The ultimate teen talent competition</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("success") ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
          {message}
        </div>
      )}

      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Vote className="w-5 h-5 text-brand-500" /> Showdown Status</h2>
        <p className="text-tx-secondary">Check back for tournament announcements and voting.</p>
      </div>

      <div className="card p-6 mb-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Calendar className="w-5 h-5 text-blue-500" /> Vote for Date</h2>
        <select value={vote} onChange={(e) => setVote(e.target.value)} className="input mb-3">
          <option value="">Select a date</option>
          <option value="2025-04-26">Next Saturday</option>
          <option value="2025-04-27">Next Sunday</option>
        </select>
        <Button disabled={!vote}>Vote</Button>
      </div>

      <div className="card p-6">
        <h2 className="text-h3 flex items-center gap-2 mb-4"><Upload className="w-5 h-5 text-green-500" /> Submit a Clip</h2>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mb-3">
          {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <Input value={clipUrl} onChange={(e) => setClipUrl(e.target.value)} placeholder="Enter your clip URL" className="mb-3" />
        <Button disabled={!clipUrl}><Play className="w-4 h-4 mr-2" /> Submit Clip</Button>
      </div>
    </Layout>
  );
}
