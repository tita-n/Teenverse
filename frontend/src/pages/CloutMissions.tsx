import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { Target, ArrowRight } from "lucide-react";

interface MissionData {
  mission: string;
  reward?: string;
  progress?: number;
}

export default function CloutMissions() {
  const [mission, setMission] = useState<MissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    axios.get("/api/clout-missions", withAuth(token))
      .then((res) => setMission(res.data))
      .catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [user, token]);

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading mission..." />;

  return (
    <Layout maxWidth="3xl">
      <div className="mb-6">
        <h1 className="text-display text-center">Clout Missions</h1>
        <p className="text-tx-secondary text-center mt-1">Complete missions to earn coins</p>
      </div>

      <div className="card p-8 text-center">
        <div className="w-20 h-20 mx-auto bg-brand-100 rounded-full flex items-center justify-center mb-6">
          <Target className="w-10 h-10 text-brand-600" />
        </div>
        <h2 className="text-h2 mb-2">Current Mission</h2>
        <p className="text-lg text-tx-secondary mb-6">{mission?.mission || "Get 50 Likes in 24 Hours for 100 Coins"}</p>

        {mission?.progress !== undefined && (
          <div className="max-w-xs mx-auto mb-6">
            <div className="w-full bg-surface-muted rounded-full h-3">
              <div className="bg-brand-600 h-3 rounded-full transition-all" style={{ width: `${mission.progress}%` }} />
            </div>
            <p className="text-sm text-tx-muted mt-1">{mission.progress}% Complete</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <a href="/hall-of-fame" className="text-brand-600 hover:text-brand-700 flex items-center gap-1 text-sm font-medium">
            Hall of Fame <ArrowRight className="w-4 h-4" />
          </a>
          <Button>Start Mission</Button>
        </div>
      </div>
    </Layout>
  );
}
