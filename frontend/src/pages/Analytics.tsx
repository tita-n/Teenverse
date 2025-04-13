import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

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
                    headers: { Authorization: `Bearer ${token}` }
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

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Please log in to access analytics.</div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-800 text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Platform Analytics</h1>
                    {message && <p className="text-center text-red-600 mb-6">{message}</p>}
                    {analytics ? (
                        <div className="bg-white p-6 rounded-lg shadow-lg">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Overview</h2>
                            <p className="text-gray-600 mb-2">Total Users: {analytics.totalUsers}</p>
                            <p className="text-gray-600 mb-2">Total Game Squads: {analytics.totalSquads}</p>
                            <p className="text-gray-600 mb-4">Total Posts: {analytics.totalPosts}</p>
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Most Popular Games</h2>
                            {analytics.popularGames.length > 0 ? (
                                <ul className="list-disc list-inside">
                                    {analytics.popularGames.map((game) => (
                                        <li key={game.game_name} className="text-gray-600">
                                            {game.game_name}: {game.count} squads
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-gray-600">No popular games yet.</p>
                            )}
                        </div>
                    ) : (
                        <p className="text-gray-600">No analytics data available.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
