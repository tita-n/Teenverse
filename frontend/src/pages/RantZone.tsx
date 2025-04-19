import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

interface Rant {
    id: number;
    content: string;
    category: string;
    upvotes: number;
    reactions: { [key: string]: number };
    hugs: number;
    ask_for_advice: number;
    created_at: string;
    comments: Comment[];
}

interface Comment {
    id: number;
    rant_id: number;
    content: string;
    created_at: string;
}

export default function RantZone() {
    const [rantContent, setRantContent] = useState("");
    const [category, setCategory] = useState("Just Need to Vent");
    const [askForAdvice, setAskForAdvice] = useState(false);
    const [message, setMessage] = useState("");
    const [rants, setRants] = useState<Rant[]>([]);
    const [filteredCategory, setFilteredCategory] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { user, token } = useAuth();

    const categories = [
        "School Life",
        "Family Drama",
        "Relationship Wahala",
        "Self-Doubt & Mental Struggles",
        "Fake Friends",
        "Pressure & Anxiety",
        "Just Need to Vent"
    ];

    const reactions = ["❤️", "😢", "😠", "🥲", "😂", "😮", "🤗"];

    useEffect(() => {
        const fetchRants = async () => {
            if (!user || !token) return;
            try {
                const params = filteredCategory ? { category: filteredCategory } : {};
                const res = await axios.get("https://teenverse.onrender.com/api/rants", {
                    headers: { Authorization: `Bearer ${token}` },
                    params
                });
                setRants(res.data);
            } catch (err) {
                setMessage("Error fetching rants: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchData = async () => {
            setLoading(true);
            await fetchRants();
            setLoading(false);
        };

        if (user && token) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, token, filteredCategory]);

    const handlePostRant = async () => {
        if (!user || !token) {
            setMessage("Please log in to post a rant.");
            return;
        }
        try {
            const res = await axios.post(
                "https://teenverse.onrender.com/api/create-rant",
                {
                    email: user.email,
                    content: rantContent,
                    category,
                    askForAdvice
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setMessage(res.data.message);
            setRantContent("");
            setAskForAdvice(false);
            setCategory("Just Need to Vent");
            // Refresh rants
            const rantsRes = await axios.get("https://teenverse.onrender.com/api/rants", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRants(rantsRes.data);
        } catch (err) {
            setMessage("Error posting rant: " + (err.response?.data?.message || err.message));
        }
    };

    const handleUpvote = async (rantId: number) => {
        if (!user || !token) {
            setMessage("Please log in to upvote a rant.");
            return;
        }
        try {
            await axios.post(
                "https://teenverse.onrender.com/api/upvote-rant",
                {
                    email: user.email,
                    rantId
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            // Refresh rants
            const rantsRes = await axios.get("https://teenverse.onrender.com/api/rants", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRants(rantsRes.data);
        } catch (err) {
            setMessage("Error upvoting rant: " + (err.response?.data?.message || err.message));
        }
    };

    const handleReaction = async (rantId: number, reaction: string) => {
        if (!user || !token) {
            setMessage("Please log in to react to a rant.");
            return;
        }
        try {
            await axios.post(
                "https://teenverse.onrender.com/api/react-to-rant",
                {
                    email: user.email,
                    rantId,
                    reaction
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            // Refresh rants
            const rantsRes = await axios.get("https://teenverse.onrender.com/api/rants", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRants(rantsRes.data);
        } catch (err) {
            setMessage("Error reacting to rant: " + (err.response?.data?.message || err.message));
        }
    };

    const handleSendHug = async (rantId: number) => {
        if (!user || !token) {
            setMessage("Please log in to send a hug.");
            return;
        }
        try {
            await axios.post(
                "https://teenverse.onrender.com/api/send-hug",
                {
                    email: user.email,
                    rantId
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            // Refresh rants
            const rantsRes = await axios.get("https://teenverse.onrender.com/api/rants", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRants(rantsRes.data);
        } catch (err) {
            setMessage("Error sending hug: " + (err.response?.data?.message || err.message));
        }
    };

    const handleAddComment = async (rantId: number, content: string) => {
        if (!user || !token) {
            setMessage("Please log in to comment on a rant.");
            return;
        }
        try {
            await axios.post(
                "https://teenverse.onrender.com/api/add-comment",
                {
                    email: user.email,
                    rantId,
                    content
                },
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            // Refresh rants
            const rantsRes = await axios.get("https://teenverse.onrender.com/api/rants", {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRants(rantsRes.data);
        } catch (err) {
            setMessage("Error adding comment: " + (err.response?.data?.message || err.message));
        }
    };

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">
                    Please log in to access the Rant Zone.
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

    // Separate trending rants (top 5 by upvotes)
    const trendingRants = [...rants].sort((a, b) => b.upvotes - a.upvotes).slice(0, 5);

    return (
        <div onContextMenu={(e) => e.preventDefault()}>
            <Navigation />
            <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50 p-6">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-purple-800 mb-6">Rant Zone - The Anonymous Street Gist Corner</h1>
                    <p className="text-gray-600 mb-4">A safe space to let it all out. No judgment, just real talk. 💬</p>
                    <p className="text-gray-600 mb-6">Screenshots are discouraged to protect privacy.</p>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    {/* Post a Rant */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-purple-800 mb-4">Pour Out Your Heart</h2>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>
                                    {cat}
                                </option>
                            ))}
                        </select>
                        <textarea
                            value={rantContent}
                            onChange={(e) => setRantContent(e.target.value)}
                            placeholder="Let it all out... (Your rant will be anonymous)"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 mb-4"
                        />
                        <label className="flex items-center mb-4">
                            <input
                                type="checkbox"
                                checked={askForAdvice}
                                onChange={(e) => setAskForAdvice(e.target.checked)}
                                className="mr-2"
                            />
                            <span className="text-gray-600">Ask for advice (replies will be anonymous)</span>
                        </label>
                        <button
                            onClick={handlePostRant}
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                        >
                            Post Anonymously
                        </button>
                    </div>

                    {/* Trending Rants */}
                    {trendingRants.length > 0 && (
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                            <h2 className="text-xl font-semibold text-purple-800 mb-4">🔥 Trending Rants</h2>
                            {trendingRants.map((rant) => (
                                <RantCard
                                    key={rant.id}
                                    rant={rant}
                                    handleUpvote={handleUpvote}
                                    handleReaction={handleReaction}
                                    handleSendHug={handleSendHug}
                                    handleAddComment={handleAddComment}
                                    reactions={reactions}
                                />
                            ))}
                        </div>
                    )}

                    {/* Filter by Category */}
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-purple-800 mb-2">Filter by Category</h2>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilteredCategory(null)}
                                className={`px-4 py-2 rounded-lg ${
                                    !filteredCategory ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-800"
                                } hover:bg-purple-500 hover:text-white transition`}
                            >
                                All
                            </button>
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    onClick={() => setFilteredCategory(cat)}
                                    className={`px-4 py-2 rounded-lg ${
                                        filteredCategory === cat ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-800"
                                    } hover:bg-purple-500 hover:text-white transition`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recent Rants */}
                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-purple-800 mb-4">Recent Rants</h2>
                        {rants.length > 0 ? (
                            rants.map((rant) => (
                                <RantCard
                                    key={rant.id}
                                    rant={rant}
                                    handleUpvote={handleUpvote}
                                    handleReaction={handleReaction}
                                    handleSendHug={handleSendHug}
                                    handleAddComment={handleAddComment}
                                    reactions={reactions}
                                />
                            ))
                        ) : (
                            <p className="text-gray-600">No rants yet. Be the first to share!</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// Separate component for rendering a single rant
function RantCard({
    rant,
    handleUpvote,
    handleReaction,
    handleSendHug,
    handleAddComment,
    reactions
}: {
    rant: Rant;
    handleUpvote: (rantId: number) => void;
    handleReaction: (rantId: number, reaction: string) => void;
    handleSendHug: (rantId: number) => void;
    handleAddComment: (rantId: number, content: string) => void;
    reactions: string[];
}) {
    const [commentContent, setCommentContent] = useState("");
    const [showComments, setShowComments] = useState(false);

    const handleSubmitComment = () => {
        if (commentContent.trim()) {
            handleAddComment(rant.id, commentContent);
            setCommentContent("");
        }
    };

    return (
        <div className="border-b py-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-purple-800 font-semibold">
                    Anonymous <span className="text-sm text-gray-500">({rant.category})</span>
                </p>
                {rant.ask_for_advice === 1 && (
                    <span className="text-sm text-blue-600">💬 Advice Requested</span>
                )}
            </div>
            <p className="text-gray-800">{rant.content}</p>
            <p className="text-gray-500 text-sm">{new Date(rant.created_at).toLocaleString()}</p>

            {/* Interactions */}
            <div className="flex items-center gap-3 mt-2">
                <button
                    onClick={() => handleUpvote(rant.id)}
                    className="text-blue-600 hover:text-blue-800"
                >
                    ⬆️ {rant.upvotes || 0}
                </button>
                <button
                    onClick={() => handleSendHug(rant.id)}
                    className="text-pink-600 hover:text-pink-800"
                >
                    💖 {rant.hugs || 0}
                </button>
                <div className="flex gap-1">
                    {reactions.map((reaction) => (
                        <button
                            key={reaction}
                            onClick={() => handleReaction(rant.id, reaction)}
                            className="text-gray-600 hover:text-gray-800"
                        >
                            {reaction} {(rant.reactions && rant.reactions[reaction]) || 0}
                        </button>
                    ))}
                </div>
            </div>

            {/* Comments */}
            <div className="mt-2">
                <button
                    onClick={() => setShowComments(!showComments)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                >
                    {showComments ? "Hide Comments" : `Show Comments (${rant.comments.length})`}
                </button>
                {showComments && (
                    <div className="mt-2">
                        {rant.comments.length > 0 ? (
                            rant.comments.map((comment) => (
                                <div key={comment.id} className="border-t pt-2 mt-2">
                                    <p className="text-purple-800 font-semibold text-sm">Anonymous</p>
                                    <p className="text-gray-600 text-sm">{comment.content}</p>
                                    <p className="text-gray-500 text-xs">
                                        {new Date(comment.created_at).toLocaleString()}
                                    </p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-sm">No comments yet.</p>
                        )}
                        <div className="mt-2">
                            <textarea
                                value={commentContent}
                                onChange={(e) => setCommentContent(e.target.value)}
                                placeholder="Add a comment (anonymous)"
                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <button
                                onClick={handleSubmitComment}
                                className="mt-1 bg-purple-600 text-white px-3 py-1 rounded-lg hover:bg-purple-700 transition"
                            >
                                Comment
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
                       }
