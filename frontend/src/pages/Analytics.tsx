import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

// Import only necessary Chart.js modules to reduce bundle size
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from "chart.js";

// Register only required Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

interface AnalyticsData {
  totalUsers: number;
  totalSquads: number;
  totalPosts: number;
  popularGames: { game_name: string; count: number }[];
}

// Error Boundary component to prevent blank page
const ErrorBoundary: React.FC<{ children: React.ReactNode; fallback: React.ReactNode }> = ({ children, fallback }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const errorHandler = (error: ErrorEvent) => {
      console.error("ErrorBoundary caught:", error);
      setHasError(true);
    };
    window.addEventListener("error", errorHandler);
    return () => window.removeEventListener("error", errorHandler);
  }, []);

  return hasError ? <>{fallback}</> : <>{children}</>;
};

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user || !token) {
        setLoading(false);
        return;
      }
      try {
        const res = await axios.get("https://teenverse.onrender.com/api/platform-analytics", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAnalytics(res.data);
      } catch (err) {
        setMessage("Error fetching analytics: " + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [user, token]);

  // Chart data
  const chartData = {
    labels: analytics?.popularGames.map((game) => game.game_name) || [],
    datasets: [
      {
        label: "Squads per Game",
        data: analytics?.popularGames.map((game) => game.count) || [],
        backgroundColor: isDarkMode ? "rgba(59, 130, 246, 0.7)" : "rgba(59, 130, 246, 0.5)",
        borderColor: isDarkMode ? "rgba(59, 130, 246, 1)" : "rgba(59, 130, 246, 1)",
        borderWidth: 1,
        hoverBackgroundColor: isDarkMode ? "rgba(59, 130, 246, 0.9)" : "rgba(59, 130, 246, 0.7)",
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const, labels: { color: isDarkMode ? "#e5e7eb" : "#1f2937" } },
      title: { display: true, text: "Most Popular Games", color: isDarkMode ? "#e5e7eb" : "#1f2937" },
      tooltip: { enabled: true },
    },
    scales: {
      y: { ticks: { color: isDarkMode ? "#e5e7eb" : "#1f2937" } },
      x: { ticks: { color: isDarkMode ? "#e5e7eb" : "#1f2937" } },
    },
  };

  // Skeleton loader
  const SkeletonCard = () => (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg backdrop-blur-lg bg-opacity-80">
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    </div>
  );

  // Export CSV
  const exportCSV = () => {
    const csv = [
      "Metric,Value",
      `Total Users,${analytics?.totalUsers || 0}`,
      `Total Squads,${analytics?.totalSquads || 0}`,
      `Total Posts,${analytics?.totalPosts || 0}`,
      "Game,Count",
      ...(analytics?.popularGames.map((g) => `${g.game_name},${g.count}`) || []),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800">
          <div className="text-center text-red-600 dark:text-red-400 text-xl font-semibold" role="alert">
            An error occurred. Please try refreshing the page.
          </div>
        </div>
      }
    >
      <div className={isDarkMode ? "dark" : ""}>
        <Navigation />
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 py-10 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 text-center">
                Platform Analytics
              </h1>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? "☀️" : "🌙"}
              </button>
            </div>
            {message && (
              <div className="text-center">
                <p
                  className="text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300 p-4 rounded-lg mb-6"
                  role="alert"
                >
                  {message}
                </p>
                <button
                  onClick={() => {
                    setMessage("");
                    setLoading(true);
                    fetchAnalytics();
                  }}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label="Retry fetching analytics"
                >
                  Retry
                </button>
              </div>
            )}
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            ) : !user || !token ? (
              <div className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center text-red-600 dark:text-red-400 text-xl font-semibold" role="alert">
                  Please log in to access analytics.
                </div>
              </div>
            ) : analytics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg backdrop-blur-lg bg-opacity-80 hover:shadow-xl transition-shadow duration-300"
                  role="region"
                  aria-label="Analytics Overview"
                >
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Overview</h2>
                  <div className="space-y-3">
                    <p className="text-gray-600 dark:text-gray-300 text-lg">
                      <span className="font-medium">Total Users:</span> {analytics.totalUsers}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">
                      <span className="font-medium">Total Game Squads:</span> {analytics.totalSquads}
                    </p>
                    <p className="text-gray-600 dark:text-gray-300 text-lg">
                      <span className="font-medium">Total Posts:</span> {analytics.totalPosts}
                    </p>
                    <button
                      onClick={exportCSV}
                      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Export analytics as CSV"
                    >
                      Export as CSV
                    </button>
                  </div>
                </div>
                <div
                  className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg backdrop-blur-lg bg-opacity-80 hover:shadow-xl transition-shadow duration-300"
                  role="region"
                  aria-label="Popular Games Chart"
                >
                  <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Most Popular Games</h2>
                  {analytics.popularGames.length > 0 ? (
                    <Bar data={chartData} options={chartOptions} />
                  ) : (
                    <p className="text-gray-600 dark:text-gray-300">No popular games yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-300 text-center text-lg">
                No analytics data available.
              </p>
            )}
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
