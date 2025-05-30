import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import { motion } from "framer-motion"; // For animations
import { Bar } from "react-chartjs-2"; // For bar chart
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
  const { user, token } = useAuth();

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user || !token) return;
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

    if (user && token) {
      fetchAnalytics();
    } else {
      setLoading(false);
    }
  }, [user, token]);

  // Chart data for popular games
  const chartData = {
    labels: analytics?.popularGames.map((game) => game.game_name) || [],
    datasets: [
      {
        label: "Squads per Game",
        data: analytics?.popularGames.map((game) => game.count) || [],
        backgroundColor: "rgba(59, 130, 246, 0.5)",
        borderColor: "rgba(59, 130, 246, 1)",
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      title: { display: true, text: "Most Popular Games" },
    },
  };

  // Animation variants for Framer Motion
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  if (!user || !token) {
    return (
      <motion.div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center text-red-600 text-xl font-semibold" role="alert">
          Please log in to access analytics.
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return (
      <motion.div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-500"></div>
          <p className="mt-4 text-gray-800 text-lg">Loading...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <motion.h1
            className="text-4xl font-bold text-gray-900 mb-8 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            Platform Analytics
          </motion.h1>
          {message && (
            <motion.p
              className="text-center text-red-600 bg-red-100 p-4 rounded-lg mb-6"
              role="alert"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              {message}
            </motion.p>
          )}
          {analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overview Card */}
              <motion.div
                className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Overview</h2>
                <div className="space-y-3">
                  <p className="text-gray-600 text-lg">
                    <span className="font-medium">Total Users:</span> {analytics.totalUsers}
                  </p>
                  <p className="text-gray-600 text-lg">
                    <span className="font-medium">Total Game Squads:</span> {analytics.totalSquads}
                  </p>
                  <p className="text-gray-600 text-lg">
                    <span className="font-medium">Total Posts:</span> {analytics.totalPosts}
                  </p>
                </div>
              </motion.div>
              {/* Popular Games Chart */}
              <motion.div
                className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
              >
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Most Popular Games</h2>
                {analytics.popularGames.length > 0 ? (
                  <Bar data={chartData} options={chartOptions} />
                ) : (
                  <p className="text-gray-600">No popular games yet.</p>
                )}
              </motion.div>
            </div>
          ) : (
            <motion.p
              className="text-gray-600 text-center text-lg"
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