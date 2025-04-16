import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import io from "socket.io-client";

const socket = io("http://localhost:5000"); // Adjust for production

export default function UltimateShowdown() {
    const [vote, setVote] = useState("");
    const [message, setMessage] = useState("");
    const [bracket, setBracket] = useState<any[]>([]);
    const [liveStatus, setLiveStatus] = useState(false);
    const [coins, setCoins] = useState(0);
    const [boostTarget, setBoostTarget] = useState<number | null>(null);
    const { user, token } = useAuth();

    useEffect(() => {
        if (!user || !token) return;

        // Fetch invitation status
        axios.get("/api/ultimate-showdown/qualify", {
            headers: { Authorization: `Bearer ${token}` },
        }).then((res) => {
            setMessage(res.data.message);
        }).catch((err) => {
            setMessage(err.response?.data?.message || "Error checking qualification");
        });

        // Fetch bracket
        axios.get("/api/ultimate-showdown/bracket", {
            headers: { Authorization: `Bearer ${token}` },
        }).then((res) => {
            setBracket(res.data.bracket);
        }).catch((err) => {
            setMessage(err.response?.data?.message || "Error fetching bracket");
        });

        // Fetch user coins
        axios.post("/api/get-coins", { email: user.email }, {
            headers: { Authorization: `Bearer ${token}` },
        }).then((res) => {
            setCoins(res.data.coins);
        });

        // Socket listeners
        socket.on("showdown_live_start", (data) => setLiveStatus(true));
        socket.on("showdown_boost_update", (data) => console.log("Boost update:", data));
        socket.on("showdown_end", (data) => {
            setLiveStatus(false);
            setMessage(`Winner: User ${data.winnerId}`);
        });

        return () => socket.disconnect();
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
            await axios.post("/api/vote-showdown", { email: user.email, dateOption: vote }, {
                headers: { Authorization: `Bearer ${token}` },
            });
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
            await axios.post("/api/ultimate-showdown/boost", {
                email: user.email,
                tournamentId: 1, // Replace with dynamic tournament ID
                targetUserId: boostTarget,
                coins: Math.min(coins, 100), // Cap at 100 coins per boost
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCoins(coins - Math.min(coins, 100));
            setMessage("Boost submitted!");
        } catch (err) {
            setMessage("Error boosting: " + (err.response?.data?.message || err.message));
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Ultimate Showdown</h2>
            {message && <p className="mt-4 text-gray-600">{message}</p>}

            {/* Invitation Status */}
            <p>Invitation Status: {message.includes("invited") ? "Invited!" : "Not Qualified"}</p>

            {/* Bracket Visualization */}
            <h3 className="text-lg font-medium mt-4">Bracket</h3>
            {bracket.map((match) => (
                <div key={match.id} className="border p-2 mb-2">
                    {match.participant1.username} vs {match.participant2?.username || "TBD"}
                </div>
            ))}

            {/* Live Event */}
            {liveStatus && (
                <div className="mt-4">
                    <h3 className="text-lg font-medium">Live Event</h3>
                    <p>Event is live! Boost your favorite performer.</p>
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

            {/* Date Voting (existing feature) */}
            <h3 className="text-lg font-medium mt-4">Vote for Next Date</h3>
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
    );
            }
