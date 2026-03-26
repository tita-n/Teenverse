import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Trophy, Star, Users, DollarSign, Award } from "lucide-react";

interface Winner { id: number; actual_username: string; rank: number; awarded_at: string; }
interface Creator { id: number; username: string; wins: number; }
interface Squad { id: number; username: string; game_name: string; wins: number; creator_username: string; }
interface TopEarner { id: number; username: string; coins: number; }
interface DevPick { id: number; actual_username: string; title: string; awarded_at: string; }

interface HallData {
  ultimateShowdownWinners: Winner[];
  topCreatorsAllTime: { [key: string]: Creator[] };
  topCreatorsMonthly: { [key: string]: Creator[] };
  topSquads: Squad[];
  topEarners: TopEarner[];
  developerPicks: DevPick[];
}

export default function HallOfFame() {
  const [data, setData] = useState<HallData | null>(null);
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
        {/* Showdown Champions */}
        <Section icon={<Trophy className="w-5 h-5 text-yellow-500" />} title="Ultimate Showdown Champions">
          {data.ultimateShowdownWinners.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.ultimateShowdownWinners.map((w) => (
                <div key={w.id} className="p-3 bg-surface-muted rounded-lg">
                  <p className="font-semibold text-brand-600">{w.actual_username} <span className="text-sm text-tx-muted">Rank {w.rank}</span></p>
                  <p className="text-xs text-tx-muted">{new Date(w.awarded_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-tx-muted">No champions yet.</p>}
        </Section>

        {/* Top Creators All-Time */}
        <Section icon={<Star className="w-5 h-5 text-yellow-500" />} title="Top Creators (All-Time)">
          {Object.entries(data.topCreatorsAllTime).map(([cat, creators]) => (
            <div key={cat} className="mb-4 last:mb-0">
              <h4 className="text-sm font-medium text-tx-secondary mb-2">{cat}</h4>
              {creators.length > 0 ? (
                <ul className="space-y-1">
                  {creators.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-tx-muted">{i + 1}.</span>
                      <span className="font-medium text-tx-primary">{c.username}</span>
                      <span className="text-tx-muted">{c.wins} wins</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-tx-muted">No winners yet.</p>}
            </div>
          ))}
        </Section>

        {/* Top Creators Monthly */}
        <Section icon={<Star className="w-5 h-5 text-blue-500" />} title="Top Creators (Monthly)">
          {Object.entries(data.topCreatorsMonthly).map(([cat, creators]) => (
            <div key={cat} className="mb-4 last:mb-0">
              <h4 className="text-sm font-medium text-tx-secondary mb-2">{cat}</h4>
              {creators.length > 0 ? (
                <ul className="space-y-1">
                  {creators.map((c, i) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="w-5 text-tx-muted">{i + 1}.</span>
                      <span className="font-medium text-tx-primary">{c.username}</span>
                      <span className="text-tx-muted">{c.wins} wins</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-tx-muted">No winners this month.</p>}
            </div>
          ))}
        </Section>

        {/* Top Squads */}
        <Section icon={<Users className="w-5 h-5 text-brand-500" />} title="Top Squads">
          {data.topSquads.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.topSquads.map((s) => (
                <div key={s.id} className="p-3 bg-surface-muted rounded-lg">
                  <p className="font-semibold text-tx-primary">{s.username} <span className="text-sm text-tx-muted">({s.game_name})</span></p>
                  <p className="text-sm text-tx-secondary">{s.wins} wins — Led by {s.creator_username}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-tx-muted">No top squads yet.</p>}
        </Section>

        {/* Top Earners */}
        <Section icon={<DollarSign className="w-5 h-5 text-green-500" />} title="Top Earners">
          {data.topEarners.length > 0 ? (
            <ul className="space-y-1">
              {data.topEarners.map((e, i) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-tx-muted">{i + 1}.</span>
                  <span className="font-medium text-tx-primary">{e.username}</span>
                  <span className="text-tx-muted">{e.coins} coins</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-tx-muted">No top earners yet.</p>}
        </Section>

        {/* Developer Picks */}
        <Section icon={<Award className="w-5 h-5 text-blue-500" />} title="Developer Picks">
          {data.developerPicks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.developerPicks.map((p) => (
                <div key={p.id} className="p-3 bg-surface-muted rounded-lg">
                  <p className="font-semibold text-tx-primary">{p.actual_username} <span className="text-sm text-tx-muted">{p.title}</span></p>
                  <p className="text-xs text-tx-muted">{new Date(p.awarded_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-tx-muted">No picks yet.</p>}
        </Section>
      </div>
    </Layout>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h2 className="text-h3 flex items-center gap-2 mb-4">{icon} {title}</h2>
      {children}
    </div>
  );
}
