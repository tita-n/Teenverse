import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import { motion, AnimatePresence } from "framer-motion"; // For animations
import { ArrowRightIcon, RefreshCwIcon } from "lucide-react"; // For icons (install lucide-react)

// Define TypeScript interface for mission data
interface MissionData {
  mission: string;
  reward?: string; // Optional: Add if backend provides reward details
  progress?: number; // Optional: For progress bar
}

export default function CloutMissions() {
  const [mission, setMission] = useState<MissionData | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, token } = useAuth();

  // Fetch mission data
  useEffect(() => {
    const fetchMission = async () => {
      if (!user || !token) return;
      try {
        const res = await axios.get("/api/clout-missions", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setMission(res.data);
      } catch (err) {
        setMessage(
          "Error fetching mission: " + (err.response?.data?.message || err.message)
        );
      } finally {
        setLoading(false);
      }
    };

    fetchMission();
  }, [user, token]);

  // Unauthorized state
  if (!user || !token) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200"
      >
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="text-gray-600">Please log in to access Clout Missions.</p>
          <a
            href="/login"
            className="inline-block px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
          >
            Log In
          </a>
        </div>
      </motion.div>
    );
  }

  // Loading state with spinner
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200"
      >
        <div className="flex flex-col items-center space-y-4">
          <RefreshCwIcon className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-gray-600 text-lg">Loading your mission...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <div>
      <Navigation />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-6"
      >
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-8 text-center">
            Clout Missions
          </h1>
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
            >
              <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">🎯</span> Current Mission
              </h2>
              <p className="text-gray-600 text-lg">
                {mission?.mission || "Mission: Get 50 Likes in 24 Hours for 100 Coins"}
              </p>
              {/* Progress Bar (optional, if backend provides progress) */}
              {mission?.progress && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-indigo-600 h-2.5 rounded-full"
                      style={{ width: `${mission.progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {mission.progress}% Complete
                  </p>
                </div>
              )}
              <div className="mt-4 flex items-center space-x-4">
                <a
                  href="/hall-of-fame"
                  className="text-indigo-600 hover:underline flex items-center"
                >
                  Check the Hall of Fame <ArrowRightIcon className="ml-1 w-4 h-4" />
                </a>
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
                  onClick={() => alert("Start mission clicked!")} // Replace with actual logic
                >
                  Start Mission
                </button>
              </div>
              {message && (
                <div className="mt-4 p-4 bg-red-100 text-red-600 rounded-lg flex items-center justify-between">
                  <p>{message}</p>
                  <button
                    className="text-indigo-600 hover:underline"
                    onClick={() => fetchMission()} // Retry fetching
                  >
                    Retry
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}