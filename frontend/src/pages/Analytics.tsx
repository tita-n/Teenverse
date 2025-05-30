import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

// Dynamically import heavy dependencies
import dynamic from "next/dynamic"; // Use dynamic imports for client-side only
const Bar = dynamic(() => import("react-chartjs-2").then((mod) => mod.Bar), { ssr: false });
const AnimatePresence = dynamic(() => import("framer-motion").then((mod) => mod.AnimatePresence), { ssr: false });
const motion = dynamic(() => import("framer-motion").then((mod) => mod.default), { ssr: false });

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface AnalyticsData {
  totalUsers: number;
  totalSquads: number;
  totalPosts: number;
  popularGames: { game_name: string; count: number }[];
}

export default function Analytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [timeFilter, setTimeFilter] = useState("all"); // Example filter
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user || !token) return;
      try {
        const res = await axios.get(`https://teenverse.onrender.com/api/platform-analytics?time=${timeFilter}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAnalytics(res.data);
      } catch (err) {
        setMessage("Error fetching analytics: " + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    if (user && token) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [user, token, timeFilter]);

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

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
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
      `Total Users,${analytics?.totalUsers}`,
      `Total Squads,${analytics?.totalSquads}`,
      `Total Posts,${analytics?.totalPosts}`,
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
    <div className={isDarkMode ? "dark" : ""}>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
            <motion.h1
              className="text-4xl font-bold text-gray-900 dark:text-gray-100 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              Platform Analytics
            </motion.h1>
            <div className="flex gap-4">
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value)}
                className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Filter by time period"
              >
                <option value="all">All Time</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDarkMode ? "☀️" : "🌙"}
              </button>
            </div>
          </div>
          <AnimatePresence>
            {message && (
              <motion.p
                className="text-center text-red-600 bg-red-100 dark:bg-red-900 dark:text-red-300 p-4 rounded-lg mb-6"
                role="alert"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {message}
              </motion.p>
            )}
          </AnimatePresence>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : !user || !token ? (
            <motion.div
              className="min-h-[50vh] flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="text-center text-red-600 dark:text-red-400 text-xl font-semibold" role="alert">
                Please log in to access analytics.
              </div>
            </motion.div>
          ) : analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg backdrop-blur-lg bg-opacity-80 hover:shadow-xl transition-shadow duration-300"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
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
              </motion.div>
              <motion.div
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg backdrop-blur-lg bg-opacity-80 hover:shadow-xl transition-shadow duration-300"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                role="region"
                aria-label="Popular Games Chart"
              >
                <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-4">Most Popular Games</h2>
                {analytics.popularGames.length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <p className="text-gray-600 dark:text-gray-300">No popular games yet.</p>
                )}
              </motion.div>
            </div>
          ) : (
            <motion.p
              className="text-gray-600 dark:text-gray-300 text-center text-lg"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              No analytics data available.
            </motion.p>
          )}
        </div>
      </div>
    </div>
  );
}