import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../context/SocketContext';
import Navigation from '../components/Navigation';
import { motion, AnimatePresence } from 'framer-motion'; // For animations
import { ZapIcon, UsersIcon, VideoIcon, FlameIcon, RefreshCwIcon, ClockIcon } from 'lucide-react'; // For icons
import Confetti from 'react-confetti'; // For celebratory effect

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

interface FormData {
    category: string;
    content: string;
    mediaFile: File | null;
    opponentUsername: string;
    teamId: number | null;
    opponentTeamId: number | null;
    isLive: boolean;
}

export default function HypeBattles() {
    const [battles, setBattles] = useState<Battle[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [formData, setFormData] = useState<FormData>({
        category: '',
        content: '',
        mediaFile: null,
        opponentUsername: '',
        teamId: null,
        opponentTeamId: null,
        isLive: false,
    });
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [newTeamName, setNewTeamName] = useState('');
    const [joinTeamId, setJoinTeamId] = useState<number | null>(null);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [showConfetti, setShowConfetti] = useState(false);
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

    // Fetch battles and teams
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

        fetchData();

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

    // Clean up media preview
    useEffect(() => {
        return () => {
            if (mediaPreview) {
                URL.revokeObjectURL(mediaPreview);
            }
        };
    }, [mediaPreview]);

    // Create a new team
    const createTeam = async () => {
        if (!user || !token) {
            setMessage('Please log in to create a team.');
            return;
        }
        if (!newTeamName) {
            setMessage('Please enter a team name.');
            return;
        }
        try {
            const res = await axios.post(
                '/api/teams',
                { email: user.email, name: newTeamName },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(res.data.message);
            setNewTeamName('');
            const teamsRes = await axios.get('/api/teams', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTeams(teamsRes.data);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        } catch (err) {
            setMessage('Error creating team: ' + (err.response?.data?.message || err.message));
        }
    };

    // Join a team
    const joinTeam = async () => {
        if (!user || !token || !joinTeamId) {
            setMessage('Please log in and select a team to join.');
            return;
        }
        try {
            const res = await axios.post(
                '/api/teams/join',
                { email: user.email, teamId: joinTeamId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(res.data.message);
            setJoinTeamId(null);
            const teamsRes = await axios.get('/api/teams', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setTeams(teamsRes.data);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        } catch (err) {
            setMessage('Error joining team: ' + (err.response?.data?.message || err.message));
        }
    };

    // Post a new battle
    const postBattle = async () => {
        if (!user || !token) {
            setMessage('Please log in to post a battle.');
            return;
        }
        if (!formData.category) {
            setMessage('Please select a battle category.');
            return;
        }
        if (!formData.mediaFile) {
            setMessage('Please upload a video for your battle.');
            return;
        }

        const formDataObj = new FormData();
        formDataObj.append('media', formData.mediaFile);
        formDataObj.append('email', user.email);
        formDataObj.append('category', formData.category);
        formDataObj.append('content', formData.content);
        formDataObj.append('opponentUsername', formData.opponentUsername);
        if (formData.teamId) formDataObj.append('teamId', formData.teamId.toString());
        if (formData.opponentTeamId) formDataObj.append('opponentTeamId', formData.opponentTeamId.toString());
        formDataObj.append('isLive', formData.isLive.toString());

        try {
            const res = await axios.post('/api/hype-battle', formDataObj, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setFormData({
                category: '',
                content: '',
                mediaFile: null,
                opponentUsername: '',
                teamId: null,
                opponentTeamId: null,
                isLive: false,
            });
            setMediaPreview(null);
            const battlesRes = await axios.get('/api/hype-battles', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBattles(battlesRes.data);
            setMessage('Battle posted successfully!');
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        } catch (err) {
            setMessage('Error posting battle: ' + (err.response?.data?.message || err.message));
        }
    };

    // Respond to a battle
    const respondToBattle = async (battleId: number) => {
        if (!user || !token) {
            setMessage('Please log in to respond to a battle.');
            return;
        }
        if (!formData.mediaFile) {
            setMessage('Please upload a video for your response.');
            return;
        }

        const formDataObj = new FormData();
        formDataObj.append('media', formData.mediaFile);
        formDataObj.append('email', user.email);
        formDataObj.append('battleId', battleId.toString());
        formDataObj.append('content', formData.content);

        try {
            const res = await axios.post('/api/hype-battle/respond', formDataObj, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setFormData({ ...formData, content: '', mediaFile: null });
            setMediaPreview(null);
            setMessage(res.data.message);
            const battlesRes = await axios.get('/api/hype-battles', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBattles(battlesRes.data);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        } catch (err) {
            setMessage('Error responding to battle: ' + (err.response?.data?.message || err.message));
        }
    };

    // Vote on a battle
    const voteBattle = async (battleId: number, voteFor: 'creator' | 'opponent') => {
        if (!user || !token) {
            setMessage('Please log in to vote.');
            return;
        }
        try {
            const res = await axios.post(
                '/api/vote-battle',
                { email: user.email, battleId, voteFor },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(res.data.message);
            if (socket) {
                socket.emit('vote_battle', { battleId, voteFor });
                socket.emit('join_battle', battleId);
            }
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        } catch (err) {
            setMessage('Error voting: ' + (err.response?.data?.message || err.message));
        }
    };

    // Handle file input change
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setFormData({ ...formData, mediaFile: file });
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

    // Handle form input changes
    const handleFormChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, isLive: e.target.checked });
    };

    // Calculate time remaining for voting deadline
    const getTimeRemaining = (deadline: string) => {
        const now = new Date();
        const end = new Date(deadline);
        const diff = end.getTime() - now.getTime();
        if (diff <= 0) return 'Expired';
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m remaining`;
    };

    // Unauthorized state
    if (!user || !token) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500"
            >
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Access Denied</h1>
                    <p className="text-gray-200">Please log in to access HYPE Battles.</p>
                    <a
                        href="/login"
                        className="inline-block px-6 py-2 bg-white text-purple-600 rounded-full hover:bg-gray-100 transition"
                    >
                        Log In
                    </a>
                </div>
            </motion.div>
        );
    }

    // Loading state
    if (loading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-500"
            >
                <div className="flex flex-col items-center space-y-4">
                    <RefreshCwIcon className="w-8 h-8 text-white animate-spin" />
                    <p className="text-white text-lg">Loading HYPE Battles...</p>
                </div>
            </motion.div>
        );
    }

    return (
        <div>
            {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
            <Navigation />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 p-6"
            >
                <div className="max-w-5xl mx-auto">
                    <h1 className="text-4xl font-extrabold text-white mb-8 text-center">
                        <ZapIcon className="inline w-8 h-8 mr-2" />
                        HYPE Battles
                    </h1>
                    {message && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`mt-4 p-4 rounded-lg flex items-center justify-between ${
                                message.includes('successfully') ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                            }`}
                        >
                            <p>{message}</p>
                            <button
                                className="text-indigo-600 hover:underline"
                                onClick={() => setMessage('')}
                            >
                                Dismiss
                            </button>
                        </motion.div>
                    )}

                    {/* Manage Teams */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <UsersIcon className="w-6 h-6 text-purple-500 mr-2" />
                            Manage Teams
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Create a Team</h3>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    placeholder="Enter team name"
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    aria-label="Team name"
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={createTeam}
                                    className="mt-2 w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                >
                                    Create Team
                                </motion.button>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Join a Team</h3>
                                <select
                                    value={joinTeamId || ''}
                                    onChange={(e) => setJoinTeamId(Number(e.target.value))}
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    aria-label="Select team to join"
                                >
                                    <option value="">Select a Team</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name} (Creator: {team.creator_username})
                                        </option>
                                    ))}
                                </select>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={joinTeam}
                                    className="mt-2 w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                >
                                    Join Team
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Post a Battle */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <FlameIcon className="w-6 h-6 text-red-500 mr-2" />
                            Post a Battle
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <select
                                    name="category"
                                    value={formData.category}
                                    onChange={handleFormChange}
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                    aria-label="Battle category"
                                >
                                    <option value="">Select Category</option>
                                    <option value="rap">Rap Battle</option>
                                    <option value="dance">Dance-off</option>
                                    <option value="comedy">Meme Creation</option>
                                    <option value="other">Artistic Speed Drawing</option>
                                    <option value="other">Beat-making Face-off</option>
                                </select>
                                <textarea
                                    name="content"
                                    value={formData.content}
                                    onChange={handleFormChange}
                                    placeholder="Describe your challenge..."
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                    rows={4}
                                    aria-label="Challenge description"
                                />
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileChange}
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                    aria-label="Upload battle video"
                                />
                            </div>
                            <div>
                                {mediaPreview && (
                                    <div className="mb-4">
                                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Preview:</h3>
                                        <video
                                            src={mediaPreview}
                                            controls
                                            className="w-full max-w-md rounded-lg"
                                            aria-label="Battle video preview"
                                        />
                                    </div>
                                )}
                                <input
                                    type="text"
                                    name="opponentUsername"
                                    value={formData.opponentUsername}
                                    onChange={handleFormChange}
                                    placeholder="Opponent Username (optional)"
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                    aria-label="Opponent username"
                                />
                                <select
                                    name="teamId"
                                    value={formData.teamId || ''}
                                    onChange={(e) => setFormData({ ...formData, teamId: Number(e.target.value) })}
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                    aria-label="Your team"
                                >
                                    <option value="">Select Your Team (optional)</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    name="opponentTeamId"
                                    value={formData.opponentTeamId || ''}
                                    onChange={(e) => setFormData({ ...formData, opponentTeamId: Number(e.target.value) })}
                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                    aria-label="Opponent team"
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
                                        checked={formData.isLive}
                                        onChange={handleCheckboxChange}
                                        className="mr-2"
                                        aria-label="Live battle toggle"
                                    />
                                    <span className="text-gray-600">Live Battle</span>
                                </label>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={postBattle}
                                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                >
                                    Post Battle
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>

                    {/* Recent Battles */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white p-8 rounded-2xl shadow-xl mb-6 border border-gray-100 hover:shadow-2xl transition-shadow duration-300"
                    >
                        <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
                            <VideoIcon className="w-6 h-6 text-blue-500 mr-2" />
                            Recent Battles
                        </h2>
                        {battles.length > 0 ? (
                            <AnimatePresence>
                                {battles.map((battle) => (
                                    <motion.div
                                        key={battle.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        className="border-b py-6"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Creator's Side */}
                                            <div className="relative">
                                                {battle.is_live && (
                                                    <span className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
                                                        LIVE
                                                    </span>
                                                )}
                                                <p className="text-gray-800 font-semibold flex items-center">
                                                    <span className={battle.user_id === user.id ? 'text-purple-600' : ''}>
                                                        {battle.username}
                                                    </span>
                                                    {battle.team_id && (
                                                        <span className="ml-2 text-sm text-gray-500">
                                                            (Team ID: {battle.team_id})
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-gray-600">Category: {getCategoryDisplayName(battle.category)}</p>
                                                <p className="text-gray-600">{battle.content}</p>
                                                {battle.media_url && (
                                                    <video
                                                        src={battle.media_url}
                                                        controls
                                                        className="w-full max-w-md mt-2 rounded-lg"
                                                        aria-label={`${battle.username}'s battle video`}
                                                    />
                                                )}
                                            </div>
                                            {/* Opponent's Side */}
                                            {battle.opponent_id && (
                                                <div className="relative">
                                                    {battle.is_live && (
                                                        <span className="absolute top-0 left-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded animate-pulse">
                                                            LIVE
                                                        </span>
                                                    )}
                                                    <p className="text-gray-800 font-semibold flex items-center">
                                                        <span className={battle.opponent_id === user.id ? 'text-purple-600' : ''}>
                                                            {battle.actual_username} (Opponent)
                                                        </span>
                                                        {battle.opponent_team_id && (
                                                            <span className="ml-2 text-sm text-gray-500">
                                                                (Team ID: {battle.opponent_team_id})
                                                            </span>
                                                        )}
                                                    </p>
                                                    {battle.opponent_media_url ? (
                                                        <video
                                                            src={battle.opponent_media_url}
                                                            controls
                                                            className="w-full max-w-md mt-2 rounded-lg"
                                                            aria-label={`${battle.actual_username}'s response video`}
                                                        />
                                                    ) : (
                                                        <p className="text-gray-600">Awaiting opponent response...</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-4 flex items-center justify-between">
                                            <div>
                                                <p className="text-gray-600">
                                                    Votes: {battle.votes} | Opponent Votes: {battle.opponent_votes}
                                                </p>
                                                <p className="text-gray-500 text-sm flex items-center">
                                                    <ClockIcon className="w-4 h-4 mr-1" />
                                                    {getTimeRemaining(battle.voting_deadline)}
                                                </p>
                                                <p className="text-gray-500 text-sm">
                                                    Created: {new Date(battle.created_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="flex space-x-2">
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => voteBattle(battle.id, 'creator')}
                                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                                                    disabled={new Date(battle.voting_deadline) < new Date()}
                                                >
                                                    Vote for {battle.username}
                                                </motion.button>
                                                {battle.opponent_id && (
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => voteBattle(battle.id, 'opponent')}
                                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                                                        disabled={new Date(battle.voting_deadline) < new Date()}
                                                    >
                                                        Vote for Opponent
                                                    </motion.button>
                                                )}
                                            </div>
                                        </div>
                                        {battle.opponent_id === user.id && !battle.opponent_media_url && (
                                            <motion.div
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                className="mt-6 p-4 bg-gray-50 rounded-lg"
                                            >
                                                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                                    Respond to Challenge
                                                </h3>
                                                <textarea
                                                    name="content"
                                                    value={formData.content}
                                                    onChange={handleFormChange}
                                                    placeholder="Your response..."
                                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                                    rows={4}
                                                    aria-label="Response description"
                                                />
                                                <input
                                                    type="file"
                                                    accept="video/*"
                                                    onChange={handleFileChange}
                                                    className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                                                    aria-label="Upload response video"
                                                />
                                                {mediaPreview && (
                                                    <div className="mb-4">
                                                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Preview:</h3>
                                                        <video
                                                            src={mediaPreview}
                                                            controls
                                                            className="w-full max-w-md rounded-lg"
                                                            aria-label="Response video preview"
                                                        />
                                                    </div>
                                                )}
                                                <motion.button
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    onClick={() => respondToBattle(battle.id)}
                                                    className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                                                >
                                                    Submit Response
                                                </motion.button>
                                            </motion.div>
                                        )}
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        ) : (
                            <p className="text-gray-600">No battles yet. Start the HYPE!</p>
                        )}
                    </motion.div>
                </div>
            </motion.div>
        </div>
    );
        }
