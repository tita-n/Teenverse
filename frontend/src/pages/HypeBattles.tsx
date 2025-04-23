import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import Navigation from '../components/Navigation';

interface Battle {
    id: number;
    user_id: number;
    username: string;
    actual_username: string;
    opponent_id: number | null;
    team_id: number | null;
    opponent_team_id: number | null;
    category: string;
    content: string;
    media_url: string;
    opponent_media_url: string | null;
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
    const [category, setCategory] = useState('');
    const [content, setContent] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [opponentUsername, setOpponentUsername] = useState('');
    const [teamId, setTeamId] = useState<number | null>(null);
    const [opponentTeamId, setOpponentTeamId] = useState<number | null>(null);
    const [isLive, setIsLive] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [joinTeamId, setJoinTeamId] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const { user, token } = useAuth();
    const { socket } = useSocket();

    const getCategoryDisplayName = (category: string): string => {
        const categoryDisplayMap: { [key: string]: string } = {
            rap: 'Rap Battle',
            dance: 'Dance-off',
            comedy: 'Meme Creation',
            other: 'Other (Artistic Speed Drawing or Beat-making Face-off)',
        };
        return categoryDisplayMap[category] || category;
    };

    useEffect(() => {
        const fetchBattles = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get('/api/hype-battles', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setBattles(res.data);
            } catch (err) {
                setMessage('Error fetching battles: ' + (err.response?.data?.message || err.message));
            }
        };

        const fetchTeams = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get('/api/teams', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setTeams(res.data);
            } catch (err) {
                setMessage('Error fetching teams: ' + (err.response?.data?.message || err.message));
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

    useEffect(() => {
        return () => {
            if (mediaPreview) {
                URL.revokeObjectURL(mediaPreview);
            }
        };
    }, [mediaPreview]);

    const createTeam = async () => {
        if (!user || !token) {
            setMessage('Please log in to create a team.');
            return;
        }
        try {
            const res = await axios.post(
                '/api/teams',
                {
                    email: user.email,
                    name: newTeamName,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setMessage(res.data.message);
            setNewTeamName('');
            const teamsRes = await axios.get('/api/teams', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTeams(teamsRes.data);
        } catch (err) {
            setMessage('Error creating team: ' + (err.response?.data?.message || err.message));
        }
    };

    const joinTeam = async () => {
        if (!user || !token || !joinTeamId) {
            setMessage('Please log in and select a team to join.');
            return;
        }
        try {
            const res = await axios.post(
                '/api/teams/join',
                {
                    email: user.email,
                    teamId: joinTeamId,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setMessage(res.data.message);
            setJoinTeamId(null);
            const teamsRes = await axios.get('/api/teams', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTeams(teamsRes.data);
        } catch (err) {
            setMessage('Error joining team: ' + (err.response?.data?.message || err.message));
        }
    };

    const postBattle = async () => {
        if (!user || !token) {
            setMessage('Please log in to post a battle.');
            return;
        }
        if (!category) {
            setMessage('Please select a battle category.');
            return;
        }
        if (!mediaFile) {
            setMessage('Please upload a video for your battle.');
            return;
        }

        const formData = new FormData();
        formData.append('media', mediaFile);
        formData.append('email', user.email);
        formData.append('category', category);
        formData.append('content', content);
        formData.append('opponentUsername', opponentUsername);
        if (teamId) formData.append('teamId', teamId.toString());
        if (opponentTeamId) formData.append('opponentTeamId', opponentTeamId.toString());
        formData.append('isLive', isLive.toString());

        try {
            const res = await axios.post('/api/hype-battle', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setCategory('');
            setContent('');
            setMediaFile(null);
            setMediaPreview(null);
            setOpponentUsername('');
            setTeamId(null);
            setOpponentTeamId(null);
            setIsLive(false);
            const battlesRes = await axios.get('/api/hype-battles', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBattles(battlesRes.data);
            setMessage('Battle posted successfully!');
        } catch (err) {
            setMessage('Error posting battle: ' + (err.response?.data?.message || err.message));
        }
    };

    const respondToBattle = async (battleId: number) => {
        if (!user || !token) {
            setMessage('Please log in to respond to a battle.');
            return;
        }
        if (!mediaFile) {
            setMessage('Please upload a video for your response.');
            return;
        }

        const formData = new FormData();
        formData.append('media', mediaFile);
        formData.append('email', user.email);
        formData.append('battleId', battleId.toString());
        formData.append('content', content);

        try {
            const res = await axios.post('/api/hype-battle/respond', formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setContent('');
            setMediaFile(null);
            setMediaPreview(null);
            setMessage(res.data.message);
            const battlesRes = await axios.get('/api/hype-battles', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBattles(battlesRes.data);
        } catch (err) {
            setMessage('Error responding to battle: ' + (err.response?.data?.message || err.message));
        }
    };

    const voteBattle = async (battleId: number, voteFor: 'creator' | 'opponent') => {
        if (!user || !token) {
            setMessage('Please log in to vote.');
            return;
        }
        try {
            const res = await axios.post(
                '/api/vote-battle',
                {
                    email: user.email,
                    battleId,
                    voteFor,
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setMessage(res.data.message);

            if (socket) {
                socket.emit('vote_battle', { battleId, voteFor });
                socket.emit('join_battle', battleId);
            }
        } catch (err) {
            setMessage('Error voting: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setMediaFile(file);
        if (mediaPreview) {
            URL.revokeObjectURL(mediaPreview);
        }
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setMediaPreview(previewUrl);
        } else {
            setMediaPreview(null);
        }
    };

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">
                    Please log in to access HYPE Battles.
                    <div className="mt-4 text-gray-800">
                        Debug: user={JSON.stringify(user)}, token={token ? 'Present' : 'Missing'}
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
                                value={joinTeamId || ''}
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
                            <option value="rap">Rap Battle</option>
                            <option value="dance">Dance-off</option>
                            <option value="comedy">Meme Creation</option>
                            <option value="other">Artistic Speed Drawing</option>
                            <option value="other">Beat-making Face-off</option>
                        </select>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Challenge description..."
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        />
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        />
                        {mediaPreview && (
                            <div className="mb-4">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Preview:</h3>
                                <video src={mediaPreview} controls className="w-full max-w-md rounded-lg" />
                            </div>
                        )}
                        <input
                            type="text"
                            value={opponentUsername}
                            onChange={(e) => setOpponentUsername(e.target.value)}
                            placeholder="Opponent Username (optional)"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        />
                        <select
                            value={teamId || ''}
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
                            value={opponentTeamId || ''}
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

                    {/* Recent Battles */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Battles</h2>
                        {battles.length > 0 ? (
                            battles.map((battle) => (
                                <div key={battle.id} className="border-b py-4">
                                    <div className="flex flex-col md:flex-row gap-4">
                                        {/* Creator's Side */}
                                        <div className="flex-1">
                                            <p className="text-gray-800 font-semibold">
                                                {battle.username} (Tier: {battle.tier})
                                            </p>
                                            {battle.team_id && <p className="text-gray-800">Team ID: {battle.team_id}</p>}
                                            <p className="text-gray-600">Category: {getCategoryDisplayName(battle.category)}</p>
                                            <p className="text-gray-600">{battle.content}</p>
                                            {battle.media_url && (
                                                <video
                                                    src={battle.media_url}
                                                    controls
                                                    className="w-full max-w-md mt-2 rounded-lg"
                                                />
                                            )}
                                        </div>
                                        {/* Opponent's Side */}
                                        {battle.opponent_id && (
                                            <div className="flex-1">
                                                <p className="text-gray-800 font-semibold">
                                                    {battle.actual_username} (Opponent)
                                                </p>
                                                {battle.opponent_team_id && (
                                                    <p className="text-gray-800">Opponent Team ID: {battle.opponent_team_id}</p>
                                                )}
                                                {battle.opponent_media_url ? (
                                                    <video
                                                        src={battle.opponent_media_url}
                                                        controls
                                                        className="w-full max-w-md mt-2 rounded-lg"
                                                    />
                                                ) : (
                                                    <p className="text-gray-600">Awaiting opponent response...</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-gray-600 mt-2">
                                        Votes: {battle.votes} | Opponent Votes: {battle.opponent_votes}
                                    </p>
                                    {battle.is_live && <p className="text-green-600">LIVE</p>}
                                    <p className="text-gray-500 text-sm">
                                        Voting Deadline: {new Date(battle.voting_deadline).toLocaleString()}
                                    </p>
                                    <p className="text-gray-500 text-sm">
                                        Created: {new Date(battle.created_at).toLocaleString()}
                                    </p>
                                    {battle.opponent_id === user.id && !battle.opponent_media_url && (
                                        <div className="mt-4">
                                            <h3 className="text-lg font-semibold">Respond to Challenge</h3>
                                            <textarea
                                                value={content}
                                                onChange={(e) => setContent(e.target.value)}
                                                placeholder="Your response..."
                                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                                            />
                                            <input
                                                type="file"
                                                accept="video/*"
                                                onChange={handleFileChange}
                                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
                                            />
                                            {mediaPreview && (
                                                <div className="mb-4">
                                                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Preview:</h3>
                                                    <video
                                                        src={mediaPreview}
                                                        controls
                                                        className="w-full max-w-md rounded-lg"
                                                    />
                                                </div>
                                            )}
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
                                            onClick={() => voteBattle(battle.id, 'creator')}
                                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition mr-2"
                                        >
                                            Vote for {battle.username}
                                        </button>
                                        {battle.opponent_id && (
                                            <button
                                                onClick={() => voteBattle(battle.id, 'opponent')}
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
