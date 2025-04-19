import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import io from "socket.io-client";
import Navigation from "../components/Navigation";

// Use a relative URL since backend and frontend are together
const socket = io("/", {
    reconnection: true,
    reconnectionAttempts: 3,
    reconnectionDelay: 1000,
});

export default function UltimateShowdown() {
    const [vote, setVote] = useState("");
    const [message, setMessage] = useState("");
    const [bracket, setBracket] = useState<any[]>([]);
    const [liveStatus, setLiveStatus] = useState(false);
    const [coins, setCoins] = useState(0);
    const [boostTarget, setBoostTarget] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user, token } = useAuth();

    useEffect(() => {
        console.log("UltimateShowdown useEffect triggered", { user, token });

        if (!user || !token) {
            console.log("User or token missing, setting loading to false");
            setError("Please log in to access Ultimate Showdown.");
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                console.log("Fetching data for user:", user.email);

                // Fix 1: Use POST for /api/ultimate-showdown/qualify and include email
                const qualificationRes = await axios.post(
                    "/api/ultimate-showdown/qualify",
                    { email: user.email },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log("Qualification response:", qualificationRes.data);
                setMessage(qualificationRes.data.message);

                // Fix 2: Access matches instead of bracket
                const bracketRes = await axios.get("/api/ultimate-showdown/bracket", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                console.log("Bracket response:", bracketRes.data);
                setBracket(bracketRes.data.matches || []); // Ensure bracket is an array

                // Fetch user coins
                const coinsRes = await axios.post(
                    "/api/get-coins",
                    { email: user.email },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log("Coins response:", coinsRes.data);
                setCoins(coinsRes.data.coins);

                setError(null);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.response?.data?.message || "Error fetching data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Socket listeners
        socket.on("connect", () => console.log("Socket connected"));
        socket.on("connect_error", (err) => console.error("Socket connection error:", err));
        socket.on("showdown_live_start", (data) => {
            console.log("Live event started:", data);
            setLiveStatus(true);
        });
        socket.on("showdown_boost_update", (data) => console.log("Boost update:", data));
        socket.on("showdown_end", (data) => {
            console.log("Showdown ended:", data);
            setLiveStatus(false);
            setMessage(`Winner: User ${data.winnerId}`);
        });

        return () => {
            socket.off("showdown_live_start");
            socket.off("showdown_boost_update");
            socket.off("showdown_end");
            socket.disconnect();
        };
    }, [user, token]);

    const submitVote = async () => {
        if (!user || !token) {
            setMessage("Please log in to vote.");
            return;
        }
        if (!vote) {
            setMessage("Please select a date option.");
            return;
        }
        try {
            await axios.post(
                "/api/vote-showdown",
                { email: user.email, dateOption: vote },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage("Vote submitted successfully!");
        } catch (err) {
            setMessage("Error submitting vote: " + (err.response?.data?.message || err.message));
        }
    };

    const submitBoost = async () => {
        if (!user || !token || !boostTarget || coins <= 0) {
            setMessage("Insufficient coins or invalid target.");
            return;
        }
        try {
            await axios.post(
                "/api/ultimate-showdown/boost",
                {
                    email: user.email,
                    tournamentId: 1, // Replace with dynamic tournament ID
                    targetUserId: boostTarget,
                    coins: Math.min(coins, 100), // Cap at 100 coins per boost
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setCoins(coins - Math.min(coins, 100));
            setMessage("Boost submitted!");
        } catch (err) {
            setMessage("Error boosting: " + (err.response?.data?.message || err.message));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-800 text-xl">Loading...</div>
            </div>
        );
    }

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">
                    Please log in to access Ultimate Showdown.
                    <div className="mt-4 text-gray-800">
                        Debug: user={JSON.stringify(user)}, token={token ? "Present" : "Missing"}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4">Ultimate Showdown</h1>
                    <p>{error}</p>
                    <div className="mt-4 text-gray-800">
                        Debug: user={JSON.stringify(user)}, token={token ? "Present" : "Missing"}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Ultimate Showdown</h1>
                    {message && <p className="text-center text-green-600 mb-6">{message}</p>}

                    {/* Invitation Status */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Invitation Status</h2>
                        <p>
                            {message.includes("qualified")
                                ? "Qualified! You're eligible to participate."
                                : "Not Qualified. Win 3+ Hype Battles to qualify."}
                        </p>
                    </div>

                    {/* Bracket Visualization */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Tournament Bracket</h2>
                        {bracket.length > 0 ? (
                            bracket.map((match) => (
                                <div key={match.id} className="border p-2 mb-2">
                                    {match.participant1.username} vs {match.participant2?.username || "TBD"}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">Bracket not available yet.</p>
                        )}
                    </div>

                    {/* Live Event */}
                    {liveStatus && (
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Live Event</h2>
                            <p className="text-gray-600 mb-4">Event is live! Boost your favorite performer.</p>
                            <select
                                value={boostTarget || ""}
                                onChange={(e) => setBoostTarget(parseInt(e.target.value))}
                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                            >
                                <option value="">Select a performer</option>
                                {bracket.map((match) => (
                                    <option key={match.participant1.userId} value={match.participant1.userId}>
                                        {match.participant1.username}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={submitBoost}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                disabled={coins <= 0}
                            >
                                Boost ({coins} coins)
                            </button>
                        </div>
                    )}

                    {/* Date Voting */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Vote for Next Date</h2>
                        <select
                            value={vote}
                            onChange={(e) => setVote(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        >
                            <option value="">Select a date</option>
                            <option value="Next Saturday">Next Saturday</option>
                            <option value="Next Sunday">Next Sunday</option>
                        </select>
                        <button
                            onClick={submitVote}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                        >
                            Vote
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
                    }
