import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import { useParams } from "react-router-dom";

interface Post {
    id: number;
    username: string;
    content: string;
    mode: string;
    created_at: string;
    reactions: { [reaction: string]: string[] };
    user_id: number;
}

interface UserProfile {
    id: number;
    username: string;
    verified: number;
}

export default function Profile() {
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [xp, setXP] = useState(0);
    const [level, setLevel] = useState(1);
    const [rank, setRank] = useState("Newbie");
    const [snitchStatus, setSnitchStatus] = useState("clean");
    const [coins, setCoins] = useState(0);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const { user, token } = useAuth();
    const { username } = useParams<{ username: string }>();

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                const res = await axios.get(`/api/users/profile/${username}`);
                const { user: profileUser, posts: userPosts } = res.data;
                setUserProfile(profileUser);
                setPosts(
                    userPosts.map((post: Post) => ({
                        ...post,
                        reactions: post.reactions ? JSON.parse(post.reactions) : {},
                    }))
                );
            } catch (err) {
                setMessage("Error fetching user profile: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchUserStats = async () => {
            if (!user || !token || user.username !== username) return;
            try {
                // Fetch user stats
                try {
                    const statsRes = await axios.post(
                        "/api/get-user-stats",
                        { email: user.email },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setXP(statsRes.data.xp || 0);
                    setLevel(statsRes.data.level || 1);
                    setRank(statsRes.data.rank || "Newbie");
                } catch (err) {
                    setMessage(
                        (prev) => prev + " Error fetching stats: " + (err.response?.data?.message || err.message)
                    );
                }

                // Fetch snitch status
                try {
                    const snitchRes = await axios.post(
                        "/api/get-snitch-status",
                        { email: user.email },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setSnitchStatus(snitchRes.data.snitchStatus || "clean");
                } catch (err) {
                    setMessage(
                        (prev) =>
                            prev + " Error fetching snitch status: " + (err.response?.data?.message || err.message)
                    );
                }

                // Fetch coins
                try {
                    const coinsRes = await axios.post(
                        "/api/get-coins",
                        { email: user.email },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                    setCoins(coinsRes.data.coins || 0);
                } catch (err) {
                    setMessage(
                        (prev) => prev + " Error fetching coins: " + (err.response?.data?.message || err.message)
                    );
                }
            } catch (err) {
                setMessage("Error fetching profile data: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchData = async () => {
            setLoading(true);
            await Promise.all([fetchUserProfile(), fetchUserStats()]);
            setLoading(false);
        };

        fetchData();
    }, [user, token, username]);

    if (!userProfile && !loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">User not found.</div>
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
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">Profile</h1>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">
                            {userProfile?.username}{" "}
                            {userProfile?.verified ? (
                                <span className="inline-block bg-black text-white rounded-full h-5 w-5 text-center leading-5 text-xs">
                                    ✓
                                </span>
                            ) : null}
                        </h2>
                    </div>

                    {user?.username === username && (
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                            <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Stats</h2>
                            <p className="text-gray-600 mb-2">💎 XP: {xp}</p>
                            <p className="text-gray-600 mb-2">📈 Level: {level}</p>
                            <p className="text-gray-600 mb-2">🏆 Rank: {rank}</p>
                            <p className="text-gray-600 mb-2">💰 Coins: {coins}</p>
                            {snitchStatus === "Potential Snitch" ? (
                                <p className="text-red-500">🚨 Potential Snitch 🚨</p>
                            ) : (
                                <p className="text-green-500">✅ Verified</p>
                            )}
                        </div>
                    )}

                    <div className="bg-white p-6 rounded-lg shadow-lg">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Posts</h2>
                        {posts.length > 0 ? (
                            posts.map((post) => (
                                <div key={post.id} className="border-b py-4">
                                    <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                                    <p className="text-gray-500 text-sm mt-1">
                                        {new Date(post.created_at).toLocaleString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">No posts yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}