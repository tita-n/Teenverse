import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import Comment from "../components/Comment";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

interface UserProfile {
    username: string;
    verified: number;
}

interface Post {
    id: number;
    user_id: number;
    content: string;
    mode: string;
    created_at: string;
    reactions: { [reaction: string]: string[] };
    likes: number;
}

interface CommentType {
    id: number;
    post_id: number;
    user_id: number;
    username: string;
    content: string;
    created_at: string;
    pinned: number;
    replies: Reply[];
    likes: number;
}

interface Reply {
    id: number;
    comment_id: number;
    user_id: number;
    username: string;
    content: string;
    created_at: string;
}

interface Stats {
    xp: number;
    level: number;
    rank: string;
    coins: number;
    isSnitch: boolean;
}

export default function Profile() {
    const { username } = useParams<{ username: string }>();
    const { user, token } = useAuth(); // Removed setToken since we’re redirecting
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [message, setMessage] = useState("");
    const [comments, setComments] = useState<{ [postId: number]: CommentType[] }>({});
    const [commentContent, setCommentContent] = useState<{ [postId: number]: string }>({});
    const [showComments, setShowComments] = useState<{ [postId: number]: boolean }>({});

    useEffect(() => {
        const fetchProfile = async () => {
            if (!token || !username) {
                setMessage("Missing token or username. Redirecting to login...");
                setTimeout(() => navigate("/login"), 2000);
                return;
            }
            try {
                console.log("Fetching profile for username:", username);
                console.log("Using token:", token);
                const profileResponse = await axios.get(`${BACKEND_URL}/api/users/profile/${username}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                console.log("Profile API response:", profileResponse.data);

                const userData = profileResponse.data.user || profileResponse.data;
                if (!userData || !userData.username || typeof userData.verified === "undefined") {
                    throw new Error("Invalid user data in response");
                }
                setProfile(userData);

                const fetchedPosts = Array.isArray(profileResponse.data.posts) ? profileResponse.data.posts : [];
                setPosts(
                    fetchedPosts.map((post: Post) => {
                        let parsedReactions = {};
                        try {
                            parsedReactions = post.reactions && typeof post.reactions === "string"
                                ? JSON.parse(post.reactions)
                                : {};
                        } catch (err) {
                            console.error(`Error parsing reactions for post ${post.id}:`, err);
                        }
                        return { ...post, reactions: parsedReactions };
                    })
                );

                if (user && user.username === username) {
                    try {
                        const statsRes = await axios.get(`${BACKEND_URL}/api/get-user-stats`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const snitchRes = await axios.get(`${BACKEND_URL}/api/get-snitch-status`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        const coinsRes = await axios.get(`${BACKEND_URL}/api/get-coins`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        console.log("Stats response:", statsRes.data);
                        console.log("Snitch response:", snitchRes.data);
                        console.log("Coins response:", coinsRes.data);
                        setStats({
                            ...statsRes.data,
                            isSnitch: snitchRes.data.isSnitch,
                            coins: coinsRes.data.coins,
                        });
                    } catch (statsErr) {
                        console.error("Error fetching stats:", statsErr);
                        setMessage("Error fetching user stats: " + (statsErr.response?.data?.message || statsErr.message));
                    }
                }

                const newComments: { [postId: number]: CommentType[] } = {};
                for (const post of fetchedPosts) {
                    try {
                        const commentRes = await axios.get(`${BACKEND_URL}/api/posts/comments/${post.id}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });
                        console.log(`Comments for post ${post.id}:`, commentRes.data);
                        newComments[post.id] = commentRes.data || [];
                    } catch (commentErr) {
                        console.error(`Error fetching comments for post ${post.id}:`, commentErr);
                    }
                }
                setComments(newComments);
            } catch (err) {
                console.error("Error fetching profile:", err);
                if (err.response?.status === 401 || err.response?.status === 403) {
                    setMessage("Session expired. Redirecting to login...");
                    setTimeout(() => navigate("/login"), 2000);
                } else {
                    setMessage("Error fetching profile: " + (err.response?.data?.message || err.message));
                }
            }
        };

        fetchProfile();
    }, [username, user, token, navigate]);

    const handleComment = async (postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to comment. Redirecting to login...");
            setTimeout(() => navigate("/login"), 2000);
            return;
        }
        try {
            await axios.post(
                `${BACKEND_URL}/api/posts/comments`,
                {
                    email: user.email,
                    postId,
                    content: commentContent[postId] || "",
                },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setCommentContent({ ...commentContent, [postId]: "" });
            const commentRes = await axios.get(`${BACKEND_URL}/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComments({ ...comments, [postId]: commentRes.data });
        } catch (err) {
            console.error("Error adding comment:", err);
            setMessage("Error adding comment: " + (err.response?.data?.message || err.message));
        }
    };

    const toggleComments = (postId: number) => {
        setShowComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
    };

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Please log in to view profiles.</div>
            </div>
        );
    }

    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
                <div className="max-w-2xl mx-auto">
                    {message && (
                        <p className="text-center text-red-500 mb-6 text-lg font-semibold">{message}</p>
                    )}
                    {profile ? (
                        <>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
                                {profile.username}'s Profile{" "}
                                {profile.verified ? (
                                    <span className="inline-block bg-black text-white rounded-full h-5 w-5 text-center leading-5 text-xs">
                                        ✓
                                    </span>
                                ) : null}
                            </h1>
                            {stats && user.username === username && (
                                <div className="bg-white p-4 rounded-lg shadow-md mb-6">
                                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Stats</h2>
                                    <p>XP: {stats.xp}</p>
                                    <p>Level: {stats.level}</p>
                                    <p>Rank: {stats.rank}</p>
                                    <p>Coins: {stats.coins}</p>
                                    <p>Snitch Status: {stats.isSnitch ? "Snitch" : "Not a Snitch"}</p>
                                </div>
                            )}
                            <div className="space-y-6">
                                {posts.length > 0 ? (
                                    posts.map((post) => (
                                        <div key={post.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                                            <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                                            <p className="text-gray-500 text-sm mt-1">
                                                {new Date(post.created_at).toLocaleString()}
                                            </p>
                                            <div className="flex items-center justify-between mt-3 border-t pt-2">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-blue-600">👍 {post.likes || 0}</span>
                                                    <div className="flex items-center space-x-1">
                                                        {Object.entries(post.reactions || {}).map(
                                                            ([reaction, users]: [string, string[]]) =>
                                                                users.length > 0 && (
                                                                    <span key={reaction} className="text-sm text-gray-600">
                                                                        {reaction}: {users.length}
                                                                    </span>
                                                                )
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => toggleComments(post.id)}
                                                    className="text-indigo-600 hover:text-indigo-800 text-sm"
                                                >
                                                    {showComments[post.id]
                                                        ? "Hide comments"
                                                        : `View comments (${comments[post.id]?.length || 0})`}
                                                </button>
                                            </div>
                                            {showComments[post.id] && (
                                                <div className="mt-4">
                                                    {comments[post.id]?.length > 0 ? (
                                                        comments[post.id].map((comment) => (
                                                            <Comment
                                                                key={comment.id}
                                                                comment={comment}
                                                                postId={post.id}
                                                                user={user}
                                                                token={token}
                                                                onCommentLike={() => {}}
                                                                onPinComment={() => {}}
                                                                onReply={() => {}}
                                                            />
                                                        ))
                                                    ) : (
                                                        <p className="text-gray-600 text-sm">No comments yet.</p>
                                                    )}
                                                    <div className="mt-4">
                                                        <textarea
                                                            value={commentContent[post.id] || ""}
                                                            onChange={(e) =>
                                                                setCommentContent({
                                                                    ...commentContent,
                                                                    [post.id]: e.target.value,
                                                                })
                                                            }
                                                            placeholder="Add a comment..."
                                                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                                        />
                                                        <button
                                                            onClick={() => handleComment(post.id)}
                                                            className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition mt-2"
                                                        >
                                                            Comment
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-600 text-center">No posts yet.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-600 text-center text-lg">Loading profile...</p>
                    )}
                </div>
            </div>
        </div>
    );
}