import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import CoinFlip from "./CoinFlip";

interface GameSquad {
    id: number;
    game_name: string;
    uid: string;
    description: string;
    username: string;
    created_at: string;
    status: string;
    max_members: number;
    wins: number;
    creator_username?: string;
    is_featured: number; // Added for featuring squads
}

interface Tournament {
    id: number;
    squad_id: number;
    title: string;
    description: string;
    game_name: string;
    status: string;
    winner_id: number | null;
    created_at: string;
    squad_game_name: string;
    creator_username: string;
    participants: { id: number; game_name: string; username: string }[];
}

export default function GameSquad() {
    const [gameName, setGameName] = useState("");
    const [uid, setUid] = useState("");
    const [description, setDescription] = useState("");
    const [squads, setSquads] = useState<GameSquad[]>([]);
    const [leaderboard, setLeaderboard] = useState<GameSquad[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [tournamentTitle, setTournamentTitle] = useState("");
    const [tournamentDescription, setTournamentDescription] = useState("");
    const [tournamentGameName, setTournamentGameName] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const { user, token } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSquads = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("https://teenverse.onrender.com/api/game-squads", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSquads(res.data);
            } catch (err) {
                setMessage("Error fetching squads: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchLeaderboard = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("https://teenverse.onrender.com/api/game-squads/leaderboard", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setLeaderboard(res.data);
            } catch (err) {
                setMessage("Error fetching leaderboard: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchTournaments = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("https://teenverse.onrender.com/api/tournaments", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTournaments(res.data);
            } catch (err) {
                setMessage("Error fetching tournaments: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchData = async () => {
            setLoading(true);
            await Promise.all([fetchSquads(), fetchLeaderboard(), fetchTournaments()]);
            setLoading(false);
        };

        if (user && token) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, token]);

    const handleCreateSquad = async () => {
        if (!user || !token) {
            setMessage("Please log in to create a squad.");
            return;
        }
        if (!gameName || !uid || !description) {
            setMessage("Please fill in all fields.");
            return;
        }
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/game-squads", {
                email: user.email,
                gameName,
                uid,
                description
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setGameName("");
            setUid("");
            setDescription("");
            const squadsRes = await axios.get("https://teenverse.onrender.com/api/game-squads", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSquads(squadsRes.data);
        } catch (err) {
            setMessage("Error creating squad: " + (err.response?.data?.message || err.message));
        }
    };

    const handleJoinSquad = async (squadId: number) => {
        if (!user || !token) {
            setMessage("Please log in to join a squad.");
            return;
        }
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/game-squads/join", {
                email: user.email,
                squadId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
        } catch (err) {
            setMessage("Error joining squad: " + (err.response?.data?.message || err.message));
        }
    };

    const handleReportWin = async (squadId: number) => {
        if (!user || !token) {
            setMessage("Please log in to report a win.");
            return;
        }
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/game-squads/report-win", {
                email: user.email,
                squadId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            const squadsRes = await axios.get("https://teenverse.onrender.com/api/game-squads", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSquads(squadsRes.data);
            const leaderboardRes = await axios.get("https://teenverse.onrender.com/api/game-squads/leaderboard", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeaderboard(leaderboardRes.data);
        } catch (err) {
            setMessage("Error reporting win: " + (err.response?.data?.message || err.message));
        }
    };

    const handleCreateTournament = async (squadId: number) => {
        if (!user || !token) {
            setMessage("Please log in to create a tournament.");
            return;
        }
        if (!tournamentTitle || !tournamentDescription || !tournamentGameName) {
            setMessage("Please fill in all tournament fields.");
            return;
        }
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/tournaments", {
                email: user.email,
                squadId,
                title: tournamentTitle,
                description: tournamentDescription,
                gameName: tournamentGameName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setTournamentTitle("");
            setTournamentDescription("");
            setTournamentGameName("");
            const tournamentsRes = await axios.get("https://teenverse.onrender.com/api/tournaments", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTournaments(tournamentsRes.data);
        } catch (err) {
            setMessage("Error creating tournament: " + (err.response?.data?.message || err.message));
        }
    };

    const handleJoinTournament = async (tournamentId: number, squadId: number) => {
        if (!user || !token) {
            setMessage("Please log in to join a tournament.");
            return;
        }
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/tournaments/join", {
                email: user.email,
                tournamentId,
                squadId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            const tournamentsRes = await axios.get("https://teenverse.onrender.com/api/tournaments", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTournaments(tournamentsRes.data);
        } catch (err) {
            setMessage("Error joining tournament: " + (err.response?.data?.message || err.message));
        }
    };

    const handleDeclareWinner = async (tournamentId: number, winnerId: number) => {
        if (!user || !token) {
            setMessage("Please log in to declare a winner.");
            return;
        }
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/tournaments/declare-winner", {
                email: user.email,
                tournamentId,
                winnerId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            const tournamentsRes = await axios.get("https://teenverse.onrender.com/api/tournaments", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTournaments(tournamentsRes.data);
            const leaderboardRes = await axios.get("https://teenverse.onrender.com/api/game-squads/leaderboard", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLeaderboard(leaderboardRes.data);
        } catch (err) {
            setMessage("Error declaring winner: " + (err.response?.data?.message || err.message));
        }
    };

    const handleViewSquad = (squadId: number) => {
        navigate(`/squad-details/${squadId}`);
    };

    // New function to manage squad status (open/close)
    const handleManageSquadStatus = async (squadId: number, currentStatus: string) => {
        if (!user || !token) {
            setMessage("Please log in to manage squad status.");
            return;
        }
        try {
            const newStatus = currentStatus === "open" ? "closed" : "open";
            const res = await axios.post("https://teenverse.onrender.com/api/game-squads/manage-status", {
                email: user.email,
                squadId,
                newStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setSquads(squads.map(squad =>
                squad.id === squadId ? { ...squad, status: newStatus } : squad
            ));
        } catch (err) {
            setMessage("Error managing squad status: " + (err.response?.data?.message || err.message));
        }
    };

    // New function to feature/unfeature a squad
    const handleFeatureSquad = async (squadId: number, isFeatured: number) => {
        if (!user || !token) {
            setMessage("Please log in to feature a squad.");
            return;
        }
        try {
            const feature = isFeatured ? 0 : 1; // Toggle feature status
            const res = await axios.post("https://teenverse.onrender.com/api/game-squads/feature", {
                email: user.email,
                squadId,
                feature
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setSquads(squads.map(squad =>
                squad.id === squadId ? { ...squad, is_featured: feature } : squad
            ));
        } catch (err) {
            setMessage("Error featuring squad: " + (err.response?.data?.message || err.message));
        }
    };

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Please log in to access the Game Squad.</div>
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
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Game Squad</h1>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    {/* Analytics Link (visible only to restorationmichael3@gmail.com) */}
                    {user.email === "restorationmichael3@gmail.com" && (
                        <div className="mb-6">
                            <a
                                href="/analytics"
                                className="text-blue-600 hover:underline font-semibold"
                            >
                                View Platform Analytics
                            </a>
                        </div>
                    )}

                    <CoinFlip />

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Create a Game Squad</h2>
                        <input
                            type="text"
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            placeholder="Game Name (e.g., CODM)"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        <input
                            type="text"
                            value={uid}
                            onChange={(e) => setUid(e.target.value)}
                            placeholder="Your UID"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description (e.g., Looking for CODM players for ranked matches)"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        <button
                            onClick={handleCreateSquad}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                            Create Squad
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Squad Leaderboard</h2>
                        {leaderboard.length > 0 ? (
                            <div className="space-y-4">
                                {leaderboard.map((squad, index) => (
                                    <div key={squad.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                        <div>
                                            <p className="text-gray-800 font-semibold">
                                                #{index + 1} {squad.game_name} Squad
                                            </p>
                                            <p className="text-gray-600">
                                                Created by: {squad.creator_username}
                                                {squad.creator_username === user.username && user.email === "restorationmichael3@gmail.com" && (
                                                    <span className="ml-2 text-yellow-600 font-semibold">(Platform Creator)</span>
                                                )}
                                            </p>
                                            <p className="text-gray-600">Wins: {squad.wins}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-600">No squads in the leaderboard yet.</p>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Tournaments</h2>
                        {tournaments.length > 0 ? (
                            tournaments.map((tournament) => (
                                <div key={tournament.id} className="border-b py-4">
                                    <p className="text-gray-800 font-semibold">{tournament.title}</p>
                                    <p className="text-gray-600">Game: {tournament.game_name}</p>
                                    <p className="text-gray-600">
                                        Created by: {tournament.creator_username}
                                        {tournament.creator_username === user.username && user.email === "restorationmichael3@gmail.com" && (
                                            <span className="ml-2 text-yellow-600 font-semibold">(Platform Creator)</span>
                                        )} ({tournament.squad_game_name} Squad)
                                    </p>
                                    <p className="text-gray-600">{tournament.description}</p>
                                    <p className="text-gray-500 text-sm">Status: {tournament.status}</p>
                                    <p className="text-gray-500 text-sm">{new Date(tournament.created_at).toLocaleString()}</p>
                                    {tournament.participants.length > 0 && (
                                        <div className="mt-2">
                                            <p className="text-gray-600 font-semibold">Participants:</p>
                                            <ul className="list-disc list-inside">
                                                {tournament.participants.map((participant) => (
                                                    <li key={participant.id} className="text-gray-600">
                                                        {participant.game_name} Squad (Creator: {participant.username})
                                                        {participant.username === user.username && user.email === "restorationmichael3@gmail.com" && (
                                                            <span className="ml-2 text-yellow-600 font-semibold">(Platform Creator)</span>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {tournament.status === "open" && squads.some(squad => squad.username === user.username) && (
                                        <div className="mt-2">
                                            <p className="text-gray-600 font-semibold">Join with your squad:</p>
                                            <select
                                                onChange={(e) => handleJoinTournament(tournament.id, parseInt(e.target.value))}
                                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                                            >
                                                <option value="">Select a squad</option>
                                                {squads
                                                    .filter(squad => squad.username === user.username)
                                                    .map(squad => (
                                                        <option key={squad.id} value={squad.id}>
                                                            {squad.game_name} Squad
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    )}
                                    {tournament.status !== "completed" && tournament.creator_username === user.username && (
                                        <div className="mt-2">
                                            <p className="text-gray-600 font-semibold">Declare Winner:</p>
                                            <select
                                                onChange={(e) => handleDeclareWinner(tournament.id, parseInt(e.target.value))}
                                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                                            >
                                                <option value="">Select a winner</option>
                                                <option value={tournament.squad_id}>
                                                    {tournament.squad_game_name} Squad (Creator: {tournament.creator_username})
                                                </option>
                                                {tournament.participants.map(participant => (
                                                    <option key={participant.id} value={participant.id}>
                                                        {participant.game_name} Squad (Creator: {participant.username})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    {tournament.status === "completed" && tournament.winner_id && (
                                        <p className="text-green-600 font-semibold mt-2">
                                            Winner: {tournament.participants.find(p => p.id === tournament.winner_id)?.game_name || tournament.squad_game_name} Squad
                                        </p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">No tournaments yet.</p>
                        )}
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Squads</h2>
                        {squads.length > 0 ? (
                            squads.map((squad) => (
                                <div key={squad.id} className="border-b py-4">
                                    <p className="text-gray-800 font-semibold">
                                        {squad.game_name} Squad {squad.is_featured ? <span className="text-yellow-600 font-semibold">(Featured)</span> : ""}
                                    </p>
                                    <p className="text-gray-600">
                                        Created by: {squad.username}
                                        {squad.username === user.username && user.email === "restorationmichael3@gmail.com" && (
                                            <span className="ml-2 text-yellow-600 font-semibold">(Platform Creator)</span>
                                        )}
                                    </p>
                                    <p className="text-gray-600">UID: {squad.uid}</p>
                                    <p className="text-gray-600">{squad.description}</p>
                                    <p className="text-gray-500 text-sm">Status: {squad.status}</p>
                                    <p className="text-gray-500 text-sm">Wins: {squad.wins}</p>
                                    <p className="text-gray-500 text-sm">{new Date(squad.created_at).toLocaleString()}</p>
                                    {squad.status === "open" && (
                                        <button
                                            onClick={() => handleJoinSquad(squad.id)}
                                            className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition mr-2"
                                        >
                                            Join Squad
                                        </button>
                                    )}
                                    {squad.username === user.username && (
                                        <>
                                            <button
                                                onClick={() => handleReportWin(squad.id)}
                                                className="mt-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition mr-2"
                                            >
                                                Report Win
                                            </button>
                                            <div className="mt-4">
                                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Create a Tournament</h3>
                                                <input
                                                    type="text"
                                                    value={tournamentTitle}
                                                    onChange={(e) => setTournamentTitle(e.target.value)}
                                                    placeholder="Tournament Title"
                                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                                                />
                                                <input
                                                    type="text"
                                                    value={tournamentGameName}
                                                    onChange={(e) => setTournamentGameName(e.target.value)}
                                                    placeholder="Game Name (e.g., CODM)"
                                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                                                />
                                                <textarea
                                                    value={tournamentDescription}
                                                    onChange={(e) => setTournamentDescription(e.target.value)}
                                                    placeholder="Tournament Description"
                                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                                                />
                                                <button
                                                    onClick={() => handleCreateTournament(squad.id)}
                                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                                >
                                                    Create Tournament
                                                </button>
                                            </div>
                                        </>
                                    )}
                                    {/* Admin Controls: Manage Squad Status and Feature Squad (visible only to restorationmichael3@gmail.com) */}
                                    {user.email === "restorationmichael3@gmail.com" && (
                                        <>
                                            <button
                                                onClick={() => handleManageSquadStatus(squad.id, squad.status)}
                                                className="mt-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition mr-2"
                                            >
                                                {squad.status === "open" ? "Close Squad" : "Open Squad"}
                                            </button>
                                            <button
                                                onClick={() => handleFeatureSquad(squad.id, squad.is_featured)}
                                                className="mt-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition mr-2"
                                            >
                                                {squad.is_featured ? "Unfeature Squad" : "Feature Squad"}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => handleViewSquad(squad.id)}
                                        className="mt-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                                    >
                                        View Squad
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">No game squads yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
    }
