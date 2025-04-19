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
    const [vote, setVote] = useState(""); // For voting on the date
    const [clipUrl, setClipUrl] = useState(""); // For submitting a clip
    const [category, setCategory] = useState("Rap"); // Selected category for clip submission/voting
    const [message, setMessage] = useState("");
    const [participants, setParticipants] = useState<any[]>([]); // List of participants (updated from bracket)
    const [clips, setClips] = useState<any[]>([]); // List of submitted clips
    const [liveStatus, setLiveStatus] = useState(false);
    const [chosenDate, setChosenDate] = useState<string | null>(null); // The voted date
    const [hasVoted, setHasVoted] = useState<{ [category: string]: boolean }>({}); // Track votes per category
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [qualificationStatus, setQualificationStatus] = useState({
        canView: false,
        canParticipate: false,
        alreadyJoined: false,
        tournamentId: null,
        wins: 0
    }); // Updated to store full qualification status
    const { user, token } = useAuth();

    // Categories for the showdown
    const categories = ["Rap", "Dance", "Singing"];

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

                // Check qualification status
                const qualificationRes = await axios.get("/api/ultimate-showdown/qualify", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log("Qualification response:", qualificationRes.data);
                setQualificationStatus({
                    canView: qualificationRes.data.canView || false,
                    canParticipate: qualificationRes.data.canParticipate || false,
                    alreadyJoined: qualificationRes.data.alreadyJoined || false,
                    tournamentId: qualificationRes.data.tournamentId || null,
                    wins: qualificationRes.data.wins || 0
                });

                // Fetch the bracket (list of participants)
                try {
                    const bracketRes = await axios.get("/api/ultimate-showdown/bracket", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log("Bracket response:", bracketRes.data);
                    setParticipants(bracketRes.data.participants || []);
                    // Check if the current user is a participant
                    const userInBracket = bracketRes.data.participants.some(
                        (participant: any) => participant.user_id === user.id
                    );
                    setQualificationStatus((prev) => ({ ...prev, alreadyJoined: userInBracket }));
                } catch (bracketErr) {
                    console.error("Bracket fetch error:", bracketErr.response?.data || bracketErr.message);
                    setParticipants([]);
                    setMessage((prev) => prev + " | Bracket error: " + (bracketErr.response?.data?.message || "Failed to load participants"));
                }

                // Fetch the chosen date
                try {
                    const dateRes = await axios.get("/api/showdown-date", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log("Chosen date response:", dateRes.data);
                    setChosenDate(dateRes.data.date || null);
                } catch (dateErr) {
                    console.error("Date fetch error:", dateErr.response?.data || dateErr.message);
                    setChosenDate(null);
                }

                // Fetch submitted clips
                try {
                    const clipsRes = await axios.get("/api/showdown-clips", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log("Clips response:", clipsRes.data);
                    setClips(clipsRes.data.clips || []);
                } catch (clipsErr) {
                    console.error("Clips fetch error:", clipsErr.response?.data || clipsErr.message);
                    setClips([]);
                }

                // Check if the user has already voted in each category
                try {
                    const voteStatusRes = await axios.get("/api/user-vote-status", {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    console.log("Vote status response:", voteStatusRes.data);
                    setHasVoted(voteStatusRes.data.hasVoted || {});
                } catch (voteErr) {
                    console.error("Vote status fetch error:", voteErr.response?.data || voteErr.message);
                    setHasVoted({});
                }

                setError(null);
            } catch (err) {
                console.error("Error fetching data:", err);
                setError(err.response?.data?.message || "Error fetching data");
                // Still allow viewing even if there's an error, as long as the user is authenticated
                setQualificationStatus((prev) => ({ ...prev, canView: true }));
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
        socket.on("showdown_clip_update", (data) => {
            console.log("Clip update:", data);
            setClips((prev) => [...prev, data.clip]);
        });
        socket.on("showdown_end", (data) => {
            console.log("Showdown ended:", data);
            setLiveStatus(false);
            setMessage(`Winner: User ${data.winnerId}`);
        });

        return () => {
            socket.off("showdown_live_start");
            socket.off("showdown_clip_update");
            socket.off("showdown_end");
            socket.disconnect();
        };
    }, [user, token]);

    // Check if today is the chosen date
    const today = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
    const isShowdownDay = chosenDate && today === chosenDate;

    const joinTournament = async () => {
        if (!user || !token) {
            setMessage("Please log in to join the tournament.");
            return;
        }
        if (!qualificationStatus.canParticipate) {
            setMessage("You need at least 3 Hype Battle wins to join the tournament.");
            return;
        }
        if (qualificationStatus.alreadyJoined) {
            setMessage("You are already a participant in the tournament.");
            return;
        }
        try {
            await axios.post(
                "/api/ultimate-showdown/join",
                { email: user.email, tournamentId: qualificationStatus.tournamentId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage("Successfully joined the tournament!");
            setQualificationStatus((prev) => ({ ...prev, alreadyJoined: true }));
        } catch (err) {
            setMessage("Error joining tournament: " + (err.response?.data?.message || err.message));
        }
    };

    const submitDateVote = async () => {
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
            setMessage("Date vote submitted successfully!");
        } catch (err) {
            setMessage("Error submitting date vote: " + (err.response?.data?.message || err.message));
        }
    };

    const submitClip = async () => {
        if (!user || !token) {
            setMessage("Please log in to submit a clip.");
            return;
        }
        if (!qualificationStatus.canParticipate) {
            setMessage("You need at least 3 Hype Battle wins to submit a clip.");
            return;
        }
        if (!qualificationStatus.alreadyJoined) {
            setMessage("You must join the tournament to submit a clip.");
            return;
        }
        if (!clipUrl || !category) {
            setMessage("Please provide a clip URL and select a category.");
            return;
        }
        try {
            await axios.post(
                "/api/submit-clip",
                { email: user.email, clipUrl, category },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage("Clip submitted successfully!");
            setClipUrl(""); // Clear the input
        } catch (err) {
            setMessage("Error submitting clip: " + (err.response?.data?.message || err.message));
        }
    };

    const voteForClip = async (clipId: string, category: string) => {
        if (!user || !token) {
            setMessage("Please log in to vote.");
            return;
        }
        if (qualificationStatus.alreadyJoined) {
            setMessage("Participants cannot vote in the competition.");
            return;
        }
        if (hasVoted[category]) {
            setMessage("You have already voted in this category.");
            return;
        }
        try {
            await axios.post(
                "/api/vote-clip",
                { email: user.email, clipId, category },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setHasVoted((prev) => ({ ...prev, [category]: true }));
            setMessage("Vote submitted successfully!");
        } catch (err) {
            setMessage("Error submitting vote: " + (err.response?.data?.message || err.message));
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-800 text-xl">Loading...</div>
            </div>
        );
    }

    if (!qualificationStatus.canView && error) {
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

                    {/* Showdown Status */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Showdown Status</h2>
                        <p>
                            {qualificationStatus.canParticipate
                                ? qualificationStatus.alreadyJoined
                                    ? "You are a participant in the Ultimate Showdown! You can submit a clip on the showdown day."
                                    : "You are eligible to participate! Join the tournament below."
                                : `You need 3 Hype Battle wins to participate (Current wins: ${qualificationStatus.wins}). You can still vote for your favorite clips on the showdown day.`}
                        </p>
                        {qualificationStatus.canParticipate && !qualificationStatus.alreadyJoined && (
                            <button
                                onClick={joinTournament}
                                className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                            >
                                Join Tournament
                            </button>
                        )}
                        {chosenDate ? (
                            <p className="text-gray-600 mt-2">
                                Chosen Date: {chosenDate} {isShowdownDay ? "(Today!)" : ""}
                            </p>
                        ) : (
                            <p className="text-gray-600 mt-2">Date not yet chosen. Vote below!</p>
                        )}
                    </div>

                    {/* Participants List */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Participants</h2>
                        {participants.length > 0 ? (
                            participants.map((participant) => (
                                <div key={participant.user_id} className="border p-2 mb-2">
                                    {participant.username}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">No participants yet.</p>
                        )}
                    </div>

                    {/* Clip Submission - Only for Participants on Showdown Day */}
                    {qualificationStatus.alreadyJoined && isShowdownDay && (
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Submit Your Clip</h2>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                            >
                                <option value="">Select a category</option>
                                {categories.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={clipUrl}
                                onChange={(e) => setClipUrl(e.target.value)}
                                placeholder="Enter your clip URL"
                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                            />
                            <button
                                onClick={submitClip}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                            >
                                Submit Clip
                            </button>
                        </div>
                    )}

                    {/* Clip Voting - On Showdown Day */}
                    {isShowdownDay && (
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Vote for Clips</h2>
                            {clips.length > 0 ? (
                                categories.map((cat) => (
                                    <div key={cat} className="mb-6">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-2">{cat}</h3>
                                        {clips
                                            .filter((clip) => clip.category === cat)
                                            .map((clip) => (
                                                <div key={clip.id} className="border两个 p-2 mb-2 flex justify-between items-center">
                                                    <div>
                                                        <p>Posted by: {clip.username}</p>
                                                        <a href={clip.url} target="_blank" rel="noopener noreferrer" className="text-blue-500">
                                                            View Clip
                                                        </a>
                                                    </div>
                                                    <button
                                                        onClick={() => voteForClip(clip.id, clip.category)}
                                                        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                                        disabled={qualificationStatus.alreadyJoined || hasVoted[cat]}
                                                    >
                                                        {qualificationStatus.alreadyJoined
                                                            ? "Participants Can't Vote"
                                                            : hasVoted[cat]
                                                            ? "Already Voted"
                                                            : "Vote"}
                                                    </button>
                                                </div>
                                            ))}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-600">No clips submitted yet.</p>
                            )}
                        </div>
                    )}

                    {/* Date Voting - Disabled on Showdown Day */}
                    {!isShowdownDay && (
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Vote for Next Showdown Date</h2>
                            <select
                                value={vote}
                                onChange={(e) => setVote(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                disabled={!!chosenDate}
                            >
                                <option value="">Select a date</option>
                                <option value="2025-04-26">Next Saturday (2025-04-26)</option>
                                <option value="2025-04-27">Next Sunday (2025-04-27)</option>
                            </select>
                            <button
                                onClick={submitDateVote}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                disabled={!!chosenDate}
                            >
                                {chosenDate ? "Date Already Chosen" : "Vote"}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}