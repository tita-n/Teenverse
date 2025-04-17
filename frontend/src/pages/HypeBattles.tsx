import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { useSocket } from "../context/SocketContext"; // Assuming you already have this from Game Squad
import Navigation from "../components/Navigation";

interface Battle {
    id: number;
    user_id: number;
    username: string;
    opponent_id: number | null;
    team_id: number | null;
    opponent_team_id: number | null;
    category: string;
    content: string;
    media_url: string;
    votes: number;
    opponent_votes: number;
    is_live: boolean;
    voting_deadline: string;
    created_at: string;
}

interface Team {
    id: number;
    name: string;
    creator_username: string;
}

export default function HypeBattles() {
    const [battles, setBattles] = useState<Battle[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [category, setCategory] = useState("");
    const [content, setContent] = useState("");
    const [mediaUrl, setMediaUrl] = useState("");
    const [opponentId, setOpponentId] = useState<number | null>(null);
    const [teamId, setTeamId] = useState<number | null>(null);
    const [opponentTeamId, setOpponentTeamId] = useState<number | null>(null);
    const [isLive, setIsLive] = useState(false);
    const [newTeamName, setNewTeamName] = useState("");
    const [joinTeamId, setJoinTeamId] = useState<number | null>(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const { user, token } = useAuth();
    const { socket } = useSocket();

    useEffect(() => {
        const fetchBattles = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("/api/hype-battles", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setBattles(res.data);
            } catch (err) {
                setMessage("Error fetching battles: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchTeams = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("/api/teams", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTeams(res.data);
            } catch (err) {
                setMessage("Error fetching teams: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchData = async () => {
            setLoading(true);
            await Promise.all([fetchBattles(), fetchTeams()]);
            setLoading(false);
        };

        if (user && token) {
            fetchData();
        } else {
            setLoading(false);
        }

        // Socket.IO for real-time voting
        if (socket) {
            socket.on('vote_update', (updatedBattle) => {
                setBattles((prev) =>
                    prev.map((battle) =>
                        battle.id === updatedBattle.id
                            ? { ...battle, votes: updatedBattle.votes, opponent_votes: updatedBattle.opponent_votes }
                            : battle
                    )
                );
            });

            return () => {
                socket.off('vote_update');
            };
        }
    }, [user, token, socket]);

    const createTeam = async () => {
        if (!user || !token) {
            setMessage("Please log in to create a team.");
            return;
        }
        try {
            const res = await axios.post("/api/teams", {
                email: user.email,
                name: newTeamName
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setNewTeamName("");
            const teamsRes = await axios.get("/api/teams", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeams(teamsRes.data);
        } catch (err) {
            setMessage("Error creating team: " + (err.response?.data?.message || err.message));
        }
    };

    const joinTeam = async () => {
        if (!user || !token || !joinTeamId) {
            setMessage("Please log in and select a team to join.");
            return;
        }
        try {
            const res = await axios.post("/api/teams/join", {
                email: user.email,
                teamId: joinTeamId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setJoinTeamId(null);
            const teamsRes = await axios.get("/api/teams", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTeams(teamsRes.data);
        } catch (err) {
            setMessage("Error joining team: " + (err.response?.data?.message || err.message));
        }
    };

    const postBattle = async () => {
        if (!user || !token) {
            setMessage("Please log in to post a battle.");
            return;
        }
        if (!category) {
            setMessage("Please select a battle category.");
            return;
        }
        try {
            const res = await axios.post("/api/hype-battle", {
                email: user.email,
                category,
                content,
                mediaUrl,
                opponentId,
                teamId,
                opponentTeamId,
                isLive
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCategory("");
            setContent("");
            setMediaUrl("");
            setOpponentId(null);
            setTeamId(null);
            setOpponentTeamId(null);
            setIsLive(false);
            const battlesRes = await axios.get("/api/hype-battles", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBattles(battlesRes.data);
            setMessage("Battle posted successfully!");
        } catch (err) {
            setMessage("Error posting battle: " + (err.response?.data?.message || err.message));
        }
    };

    const respondToBattle = async (battleId: number) => {
        if (!user || !token) {
            setMessage("Please log in to respond to a battle.");
            return;
        }
        try {
            const res = await axios.post("/api/hype-battle/respond", {
                email: user.email,
                battleId,
                content,
                mediaUrl
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setContent("");
            setMediaUrl("");
            setMessage(res.data.message);
            const battlesRes = await axios.get("/api/hype-battles", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setBattles(battlesRes.data);
        } catch (err) {
            setMessage("Error responding to battle: " + (err.response?.data?.message || err.message));
        }
    };

    const voteBattle = async (battleId: number, voteFor: "creator" | "opponent") => {
        if (!user || !token) {
            setMessage("Please log in to vote.");
            return;
        }
        try {
            const res = await axios.post("/api/vote-battle", {
                email: user.email,
                battleId,
                voteFor
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);

            if (socket) {
                socket.emit('vote_battle', { battleId, voteFor });
                socket.emit('join_battle', battleId);
            }
        } catch (err) {
            setMessage("Error voting: " + (err.response?.data?.message || err.message));
        }
    };

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">
                    Please log in to access HYPE Battles.
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

    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">HYPE Battles</h1>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    {/* Create/Join Teams */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Manage Teams</h2>
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Create a Team</h3>
                            <input
                                type="text"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                placeholder="Team Name"
                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                            />
                            <button
                                onClick={createTeam}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                            >
                                Create Team
                            </button>
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2">Join a Team</h3>
                            <select
                                value={joinTeamId || ""}
                                onChange={(e) => setJoinTeamId(Number(e.target.value))}
                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                            >
                                <option value="">Select a Team</option>
                                {teams.map((team) => (
                                    <option key={team.id} value={team.id}>
                                        {team.name} (Creator: {team.creator_username})
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={joinTeam}
                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                            >
                                Join Team
                            </button>
                        </div>
                    </div>

                    {/* Post a Battle */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Post a Battle</h2>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        >
                            <option value="">Select Category</option>
                            <option value="Rap Battle">Rap Battle</option>
                            <option value="Dance-off">Dance-off</option>
                            <option value="Meme Creation">Meme Creation</option>
                            <option value="Artistic Speed Drawing">Artistic Speed Drawing</option>
                            <option value="Beat-making Face-off">Beat-making Face-off</option>
                        </select>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Challenge description..."
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        />
                        <input
                            type="text"
                            value={mediaUrl}
                            onChange={(e) => setMediaUrl(e.target.value)}
                            placeholder="Media URL (e.g., YouTube link)"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        />
                        <input
                            type="number"
                            value={opponentId || ""}
                            onChange={(e) => setOpponentId(Number(e.target.value))}
                            placeholder="Opponent User ID (optional)"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        />
                        <select
                            value={teamId || ""}
                            onChange={(e) => setTeamId(Number(e.target.value))}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        >
                            <option value="">Select Your Team (optional)</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                        <select
                            value={opponentTeamId || ""}
                            onChange={(e) => setOpponentTeamId(Number(e.target.value))}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        >
                            <option value="">Select Opponent Team (optional)</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>
                        <label className="flex items-center mb-4">
                            <input
                                type="checkbox"
                                checked={isLive}
                                onChange={(e) => setIsLive(e.target.checked)}
                                className="mr-2"
                            />
                            Live Battle
                        </label>
                        <button
                            onClick={postBattle}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                        >
                            Post Battle
                        </button>
                    </div>

                    <UltimateShowdown />

                    {/* Recent Battles */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Battles</h2>
                        {battles.length > 0 ? (
                            battles.map((battle) => (
                                <div key={battle.id} className="border-b py-4">
                                    <p className="text-gray-800 font-semibold">{battle.username} (Tier: {battle.tier})</p>
                                    {battle.opponent_id && (
                                        <p className="text-gray-800">vs Opponent ID: {battle.opponent_id}</p>
                                    )}
                                    {battle.team_id && (
                                        <p className="text-gray-800">Team ID: {battle.team_id}</p>
                                    )}
                                    {battle.opponent_team_id && (
                                        <p className="text-gray-800">vs Opponent Team ID: {battle.opponent_team_id}</p>
                                    )}
                                    <p className="text-gray-600">Category: {battle.category}</p>
                                    <p className="text-gray-600">{battle.content}</p>
                                    {battle.media_url && (
                                        <a
                                            href={battle.media_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                        >
                                            Watch Performance
                                        </a>
                                    )}
                                    <p className="text-gray-600">Votes: {battle.votes} | Opponent Votes: {battle.opponent_votes}</p>
                                    {battle.is_live && <p className="text-green-600">LIVE</p>}
                                    <p className="text-gray-500 text-sm">
                                        Voting Deadline: {new Date(battle.voting_deadline).toLocaleString()}
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        Created: {new Date(battle.created_at).toLocaleString()}
                                    </p>
                                    {battle.opponent_id === user.id && !battle.content && (
                                        <div className="mt-4">
                                            <h3 className="text-lg font-semibold">Respond to Challenge</h3>
                                            <textarea
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                placeholder="Your response..."
                                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                                            />
                                            <input
                                                type="text"
                                                value={mediaUrl}
                                                onChange={(e) => setMediaUrl(e.target.value)}
                                                placeholder="Media URL (e.g., YouTube link)"
                                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                                            />
                                            <button
                                                onClick={() => respondToBattle(battle.id)}
                                                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                            >
                                                Submit Response
                                            </button>
                                        </div>
                                    )}
                                    <div className="mt-2">
                                        <button
                                            onClick={() => voteBattle(battle.id, "creator")}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition mr-2"
                                        >
                                            Vote for {battle.username}
                                        </button>
                                        {battle.opponent_id && (
                                            <button
                                                onClick={() => voteBattle(battle.id, "opponent")}
                                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                                            >
                                                Vote for Opponent
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">No battles yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
                }
