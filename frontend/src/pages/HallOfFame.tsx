import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import { motion, AnimatePresence } from "framer-motion"; // For animations
import { TrophyIcon, StarIcon, UsersIcon, DollarSignIcon, AwardIcon, RefreshCwIcon } from "lucide-react"; // For icons

interface UltimateShowdownWinner {
    id: number;
    user_id: number;
    tournament_id: number;
    rank: number;
    awarded_at: string;
    actual_username: string;
}

interface CreatorRanking {
    id: number;
    username: string;
    wins: number;
}

interface SquadRanking {
    id: number;
    user_id: number;
    username: string;
    game_name: string;
    wins: number;
    creator_username: string;
}

interface TopEarner {
    id: number;
    username: string;
    coins: number;
}

interface DeveloperPick {
    id: number;
    user_id: number;
    title: string;
    awarded_at: string;
    actual_username: string;
}

interface HallOfFameData {
    ultimateShowdownWinners: UltimateShowdownWinner[];
    topCreatorsAllTime: { [key: string]: CreatorRanking[] };
    topCreatorsMonthly: { [key: string]: CreatorRanking[] };
    topSquads: SquadRanking[];
    topEarners: TopEarner[];
    developerPicks: DeveloperPick[];
}

export default function HallOfFame() {
    const [hallOfFameData, setHallOfFameData] = useState<HallOfFameData | null>(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const { user, token } = useAuth();

    // Fetch Hall of Fame data
    useEffect(() => {
        const fetchHallOfFameData = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("/api/hall-of-fame", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setHallOfFameData(res.data);
            } catch (err) {
                setMessage(
                    "Error fetching Hall of Fame data: " + (err.response?.data?.message || err.message)
                );
            } finally {
                setLoading(false);
            }
        };

        fetchHallOfFameData();
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
                    <p className="text-gray-600">Please log in to access the Hall of Fame.</p>
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
                    <p className="text-gray-600 text-lg">Loading Hall of Fame...</p>
                </div>
            </motion.div>
        );
    }

    // Failed to load data
    if (!hallOfFameData) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200"
            >
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-red-600">Failed to Load</h1>
                    <p className="text-gray-600">Unable to load Hall of Fame data.</p>
                    <button
                        className="px-6 py-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition"
                        onClick={() => fetchHallOfFameData()}
                    >
                        Retry
                    </button>
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
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-4xl font-extrabold text-gray-800 mb-8 text-center">
                        Hall of Fame - TeenVerse Legends
                    </h1>

                    {/* Ultimate Showdown Winners */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <TrophyIcon className="w-6 h-6 text-yellow-500 mr-2" />
                            Ultimate Showdown Champions
                        </h2>
                        {hallOfFameData.ultimateShowdownWinners.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {hallOfFameData.ultimateShowdownWinners.map((winner) => (
                                    <motion.li
                                        key={winner.id}
                                        className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <div className="flex items-center">
                                            <span className="font-bold text-indigo-600">{winner.actual_username}</span>
                                            <span className="ml-2 text-sm text-gray-500">
                                                Rank {winner.rank}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            Awarded: {new Date(winner.awarded_at).toLocaleDateString()}
                                        </p>
                                        <p className="text-sm text-green-600 mt-1">
                                            Privileges: Legendary Gold Frame, Moderator Powers, Verified Status, Early Access
                                        </p>
                                    </motion.li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No Ultimate Showdown champions yet.</p>
                        )}
                    </motion.div>

                    {/* Top Creators (All-Time) */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <StarIcon className="w-6 h-6 text-yellow-500 mr-2" />
                            Top Creators (All-Time)
                        </h2>
                        {Object.keys(hallOfFameData.topCreatorsAllTime).map((category) => (
                            <div key={category} className="mb-6">
                                <h3 className="text-lg font-medium text-gray-700 mb-2">{category}</h3>
                                {hallOfFameData.topCreatorsAllTime[category].length > 0 ? (
                                    <ul className="space-y-3">
                                        {hallOfFameData.topCreatorsAllTime[category].map((creator, index) => (
                                            <motion.li
                                                key={creator.id}
                                                className="flex items-center text-gray-600"
                                                whileHover={{ x: 5 }}
                                            >
                                                <span className="w-6 text-gray-500">{index + 1}.</span>
                                                <span className="font-bold text-indigo-600">{creator.username}</span>
                                                <span className="ml-2">{creator.wins} wins</span>
                                            </motion.li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-600">No winners in this category yet.</p>
                                )}
                            </div>
                        ))}
                    </motion.div>

                    {/* Top Creators (Monthly) */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <StarIcon className="w-6 h-6 text-blue-500 mr-2" />
                            Top Creators (Monthly)
                        </h2>
                        {Object.keys(hallOfFameData.topCreatorsMonthly).map((category) => (
                            <div key={category} className="mb-6">
                                <h3 className="text-lg font-medium text-gray-700 mb-2">{category}</h3>
                                {hallOfFameData.topCreatorsMonthly[category].length > 0 ? (
                                    <ul className="space-y-3">
                                        {hallOfFameData.topCreatorsMonthly[category].map((creator, index) => (
                                            <motion.li
                                                key={creator.id}
                                                className="flex items-center text-gray-600"
                                                whileHover={{ x: 5 }}
                                            >
                                                <span className="w-6 text-gray-500">{index + 1}.</span>
                                                <span className="font-bold text-indigo-600">{creator.username}</span>
                                                <span className="ml-2">{creator.wins} wins</span>
                                            </motion.li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-600">No winners in this

 category this month.</p>
                                )}
                            </div>
                        ))}
                    </motion.div>

                    {/* Top Squads */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <UsersIcon className="w-6 h-6 text-purple-500 mr-2" />
                            Top Squads
                        </h2>
                        {hallOfFameData.topSquads.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {hallOfFameData.topSquads.map((squad) => (
                                    <motion.li
                                        key={squad.id}
                                        className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <div className="flex items-center">
                                            <span className="font-bold text-indigo-600">{squad.username}</span>
                                            <span className="ml-2 text-sm text-gray-500">({squad.game_name})</span>
                                        </div>
                                        <p className="text-sm text-gray-600">{squad.wins} wins</p>
                                        <p className="text-sm text-gray-500">Led by: {squad.creator_username}</p>
                                    </motion.li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No top squads yet.</p>
                        )}
                    </motion.div>

                    {/* Top Earners */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <DollarSignIcon className="w-6 h-6 text-green-500 mr-2" />
                            Top Earners
                        </h2>
                        {hallOfFameData.topEarners.length > 0 ? (
                            <ul className="space-y-3">
                                {hallOfFameData.topEarners.map((earner, index) => (
                                    <motion.li
                                        key={earner.id}
                                        className="flex items-center text-gray-600"
                                        whileHover={{ x: 5 }}
                                    >
                                        <span className="w-6 text-gray-500">{index + 1}.</span>
                                        <span className="font-bold text-indigo-600">{earner.username}</span>
                                        <span className="ml-2">{earner.coins} coins</span>
                                    </motion.li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No top earners yet.</p>
                        )}
                    </motion.div>

                    {/* Developer Picks */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <AwardIcon className="w-6 h-6 text-blue-500 mr-2" />
                            Developer Picks
                        </h2>
                        {hallOfFameData.developerPicks.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {hallOfFameData.developerPicks.map((pick) => (
                                    <motion.li
                                        key={pick.id}
                                        className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                                        whileHover={{ scale: 1.02 }}
                                    >
                                        <div className="flex items-center">
                                            <span className="font-bold text-indigo-600">{pick.actual_username}</span>
                                            <span className="ml-2 text-sm text-gray-500">{pick.title}</span>
                                        </div>
                                        <p className="text-sm text-gray-600">
                                            Awarded: {new Date(pick.awarded_at).toLocaleDateString()}
                                        </p>
                                        {pick.title === "PrimeArchitect" && (
                                            <p className="text-sm text-purple-600">The visionary behind Teen Verse!</p>
                                        )}
                                    </motion.li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No developer picks yet.</p>
                        )}
                    </motion.div>

                    {message && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 p-4 bg-red-100 text-red-600 rounded-lg flex items-center justify-between"
                        >
                            <p>{message}</p>
                            <button
                                className="text-indigo-600 hover:underline"
                                onClick={() => fetchHallOfFameData()}
                            >
                                Retry
                            </button>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
    );
        }
