import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Trophy, Star, Users, DollarSign, Award } from "lucide-react";

interface TopUser {
  id: number;
  username: string;
  xp: number;
  coins: number;
  wins: number;
  verified: number;
  profile_media_url: string | null;
}

interface HallResponse {
  topXP: TopUser[];
  topCoins: TopUser[];
  topWins: TopUser[];
}

export default function HallOfFame() {
  const [data, setData] = useState<HallResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    axios.get("/api/users/hall-of-fame", withAuth(token))
      .then((res) => setData(res.data))
      .catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [user, token]);

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading Hall of Fame..." />;
  if (!data) return <EmptyState title="Failed to load" message="Unable to load Hall of Fame data." />;

  return (
    <Layout maxWidth="4xl">
      <div className="mb-8 text-center">
        <h1 className="text-display">Hall of Fame</h1>
        <p className="text-tx-secondary mt-2">TeenVerse Legends</p>
      </div>

      <div className="space-y-6">
        {/* Top by XP */}
        <section className="bg-surface-muted p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold">Top by XP</h2>
          </div>
          {data.topXP && data.topXP.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data.topXP.slice(0, 10).map((u, idx) => (
                <div key={u.id} className="p-3 bg-surface rounded-lg flex items-center gap-3">
                  <span className="text-2xl font-bold text-brand-500">#{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-brand-600">{u.username}</p>
                    <p className="text-xs text-tx-muted">{u.xp} XP</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-tx-muted">No users yet</p>
          )}
        </section>

        {/* Top by Coins */}
        <section className="bg-surface-muted p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-500" />
            <h2 className="text-xl font-bold">Top Earners</h2>
          </div>
          {data.topCoins && data.topCoins.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data.topCoins.slice(0, 10).map((u, idx) => (
                <div key={u.id} className="p-3 bg-surface rounded-lg flex items-center gap-3">
                  <span className="text-2xl font-bold text-green-500">#{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-brand-600">{u.username}</p>
                    <p className="text-xs text-tx-muted">{u.coins} coins</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-tx-muted">No users yet</p>
          )}
        </section>

        {/* Top by Wins */}
        <section className="bg-surface-muted p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-500" />
            <h2 className="text-xl font-bold">Top Warriors</h2>
          </div>
          {data.topWins && data.topWins.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {data.topWins.slice(0, 10).map((u, idx) => (
                <div key={u.id} className="p-3 bg-surface rounded-lg flex items-center gap-3">
                  <span className="text-2xl font-bold text-orange-500">#{idx + 1}</span>
                  <div>
                    <p className="font-semibold text-brand-600">{u.username}</p>
                    <p className="text-xs text-tx-muted">{u.wins} wins</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-tx-muted">No users yet</p>
          )}
        </section>
      </div>
    </Layout>
  );
}