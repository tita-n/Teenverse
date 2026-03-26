import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { BarChart3, Users, Gamepad2, FileText, Download } from "lucide-react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface AnalyticsData {
  totalUsers: number;
  totalSquads: number;
  totalPosts: number;
  popularGames: { game_name: string; count: number }[];
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    axios.get("/api/users/platform-analytics", withAuth(token))
      .then((res) => setAnalytics(res.data))
      .catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [user, token]);

  const exportCSV = () => {
    if (!analytics) return;
    const csv = ["Metric,Value", `Total Users,${analytics.totalUsers}`, `Total Squads,${analytics.totalSquads}`, `Total Posts,${analytics.totalPosts}`, "Game,Count", ...analytics.popularGames.map((g) => `${g.game_name},${g.count}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "analytics.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading analytics..." />;

  return (
    <Layout maxWidth="4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-h1 flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-brand-500" />
          Platform Analytics
        </h1>
        <Button variant="secondary" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Stats */}
          <div className="card p-6">
            <h2 className="text-h3 mb-4">Overview</h2>
            <div className="space-y-3">
              <Stat icon={<Users className="w-5 h-5 text-brand-500" />} label="Total Users" value={analytics.totalUsers} />
              <Stat icon={<Gamepad2 className="w-5 h-5 text-green-500" />} label="Game Squads" value={analytics.totalSquads} />
              <Stat icon={<FileText className="w-5 h-5 text-blue-500" />} label="Total Posts" value={analytics.totalPosts} />
            </div>
          </div>

          {/* Chart */}
          <div className="card p-6">
            <h2 className="text-h3 mb-4">Popular Games</h2>
            {analytics.popularGames.length > 0 ? (
              <Bar
                data={{
                  labels: analytics.popularGames.map((g) => g.game_name),
                  datasets: [{ label: "Squads", data: analytics.popularGames.map((g) => g.count), backgroundColor: "rgba(147, 51, 234, 0.6)", borderColor: "rgba(147, 51, 234, 1)", borderWidth: 1 }],
                }}
                options={{ responsive: true, plugins: { legend: { display: false } } }}
              />
            ) : (
              <p className="text-sm text-tx-muted text-center py-8">No game data yet.</p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-center text-tx-muted">No analytics data available.</p>
      )}
    </Layout>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface-muted rounded-lg">
      {icon}
      <div>
        <p className="text-sm text-tx-secondary">{label}</p>
        <p className="text-xl font-bold text-tx-primary">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}
