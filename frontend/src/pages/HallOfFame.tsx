import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

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

    useEffect(() => {
        const fetchHallOfFameData = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("/api/hall-of-fame", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setHallOfFameData(res.data);
            } catch (err) {
                setMessage("Error fetching Hall of Fame data: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchData = async () => {
            setLoading(true);
            await fetchHallOfFameData();
            setLoading(false);
        };

        if (user && token) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, token]);

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">
                    Please log in to access the Hall of Fame.
                    <div className="mt-4 text-gray-800">
                        Debug: user={JSON.stringify(user)}, token={token ? "Present" : "Missing"}
                    </div>
                </div>
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

    if (!hallOfFameData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Failed to load Hall of Fame data.</div>
            </div>
        );
    }

    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Hall of Fame - TeenVerse Legends</h1>

                    {/* Ultimate Showdown Winners */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Ultimate Showdown Champions</h2>
                        {hallOfFameData.ultimateShowdownWinners.length > 0 ? (
                            <ul className="space-y-4">
                                {hallOfFameData.ultimateShowdownWinners.map((winner) => (
                                    <li key={winner.id} className="text-gray-600">
                                        <span className="font-bold">{winner.actual_username}</span> - Rank {winner.rank} (Awarded on {new Date(winner.awarded_at).toLocaleDateString()})
                                        <p className="text-sm text-green-600">Privileges: Legendary Gold Frame, Moderator Powers, Verified Status, Early Access</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No Ultimate Showdown champions yet.</p>
                        )}
                    </div>

                    {/* Top Creators (All-Time) */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Creators (All-Time)</h2>
                        {Object.keys(hallOfFameData.topCreatorsAllTime).map((category) => (
                            <div key={category} className="mb-4">
                                <h3 className="text-lg font-medium text-gray-700">{category}</h3>
                                {hallOfFameData.topCreatorsAllTime[category].length > 0 ? (
                                    <ul className="space-y-2">
                                        {hallOfFameData.topCreatorsAllTime[category].map((creator) => (
                                            <li key={creator.id} className="text-gray-600">
                                                <span className="font-bold">{creator.username}</span> - {creator.wins} wins
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-600">No winners in this category yet.</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Top Creators (Monthly) */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Creators (Monthly)</h2>
                        {Object.keys(hallOfFameData.topCreatorsMonthly).map((category) => (
                            <div key={category} className="mb-4">
                                <h3 className="text-lg font-medium text-gray-700">{category}</h3>
                                {hallOfFameData.topCreatorsMonthly[category].length > 0 ? (
                                    <ul className="space-y-2">
                                        {hallOfFameData.topCreatorsMonthly[category].map((creator) => (
                                            <li key={creator.id} className="text-gray-600">
                                                <span className="font-bold">{creator.username}</span> - {creator.wins} wins
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-gray-600">No winners in this category this month.</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Top Squads */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Squads</h2>
                        {hallOfFameData.topSquads.length > 0 ? (
                            <ul className="space-y-4">
                                {hallOfFameData.topSquads.map((squad) => (
                                    <li key={squad.id} className="text-gray-600">
                                        <span className="font-bold">{squad.username}</span> ({squad.game_name}) - {squad.wins} wins
                                        <p className="text-sm">Led by: {squad.creator_username}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No top squads yet.</p>
                        )}
                    </div>

                    {/* Top Earners */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Top Earners</h2>
                        {hallOfFameData.topEarners.length > 0 ? (
                            <ul className="space-y-4">
                                {hallOfFameData.topEarners.map((earner) => (
                                    <li key={earner.id} className="text-gray-600">
                                        <span className="font-bold">{earner.username}</span> - {earner.coins} coins
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No top earners yet.</p>
                        )}
                    </div>

                    {/* Developer Picks */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Developer Picks</h2>
                        {hallOfFameData.developerPicks.length > 0 ? (
                            <ul className="space-y-4">
                                {hallOfFameData.developerPicks.map((pick) => (
                                    <li key={pick.id} className="text-gray-600">
                                        <span className="font-bold">{pick.actual_username}</span> - {pick.title}
                                        <p className="text-sm">Awarded on {new Date(pick.awarded_at).toLocaleDateString()}</p>
                                        {pick.title === "PrimeArchitect" && (
                                            <p className="text-sm text-purple-600">The visionary behind Teen Verse!</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-gray-600">No developer picks yet.</p>
                        )}
                    </div>

                    {message && <p className="text-red-500 mt-4">{message}</p>}
                </div>
            </div>
        </div>
    );
            }
