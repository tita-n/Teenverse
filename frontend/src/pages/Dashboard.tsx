import { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import Comment from "../components/Comment";

interface Post {
    id: number;
    username: string;
    content: string;
    mode: string;
    created_at: string;
    reactions: { [reaction: string]: string[] };
    user_id: number;
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

interface Squad {
    id: number;
    game_name: string;
    description: string;
}

export default function Dashboard() {
    const [content, setContent] = useState("");
    const [message, setMessage] = useState("");
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState<{ [postId: number]: CommentType[] }>({});
    const [commentContent, setCommentContent] = useState<{ [postId: number]: string }>({});
    const [showComments, setShowComments] = useState<{ [postId: number]: boolean }>({});
    const [visibleComments, setVisibleComments] = useState<{ [postId: number]: number }>({});
    const [showReactions, setShowReactions] = useState<number | null>(null);
    const [editingPost, setEditingPost] = useState<number | null>(null);
    const [editContent, setEditContent] = useState("");
    const [squads, setSquads] = useState<Squad[]>([]);
    const { user, token } = useAuth();

    const reactionsList = ["Deadass", "Big Mood", "Mid", "Facts", "Cap", "Slay", "No Cap", "Vibes", "Bet", "L", "W"];
    const commentsPerPage = 3;

    useEffect(() => {
        const fetchPosts = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("/api/posts", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const postsData = res.data.map((post: Post) => ({
                    ...post,
                    reactions: post.reactions ? JSON.parse(post.reactions) : {}
                }));
                setPosts(postsData);

                const commentsData: { [postId: number]: CommentType[] } = {};
                for (const post of postsData) {
                    const commentRes = await axios.get(`/api/posts/comments/${post.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    commentsData[post.id] = commentRes.data;
                    setVisibleComments((prev) => ({ ...prev, [post.id]: commentsPerPage }));
                }
                setComments(commentsData);
            } catch (err) {
                setMessage("Error fetching posts: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchSquads = async () => {
            try {
                const res = await axios.get("/api/game-squads", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSquads(res.data);
            } catch (err) {
                console.error("Error fetching squads:", err);
            }
        };

        const fetchData = async () => {
            setLoading(true);
            await Promise.all([fetchPosts(), fetchSquads()]);
            setLoading(false);
        };

        if (user && token) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, token]);

    const handlePost = async () => {
        if (!user || !token) {
            setMessage("Please log in to post.");
            return;
        }
        try {
            const res = await axios.post("/api/create-post", {
                email: user.email,
                content,
                mode: "main"
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setContent("");
            const postsRes = await axios.get("/api/posts", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const postsData = postsRes.data.map((post: Post) => ({
                ...post,
                reactions: post.reactions ? JSON.parse(post.reactions) : {}
            }));
            setPosts(postsData);
        } catch (err) {
            setMessage("Error posting: " + (err.response?.data?.message || err.message));
        }
    };

    const handleComment = async (postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to comment.");
            return;
        }
        try {
            await axios.post("/api/posts/comments", {
                email: user.email,
                postId,
                content: commentContent[postId] || ""
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setCommentContent({ ...commentContent, [postId]: "" });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments({ ...comments, [postId]: commentRes.data });
        } catch (err) {
            setMessage("Error adding comment: " + (err.response?.data?.message || err.message));
        }
    };

    const handleReply = async (commentId: number, postId: number, content: string) => {
        if (!user || !token) {
            setMessage("Please log in to reply.");
            return;
        }
        try {
            await axios.post("/api/posts/comments/reply", {
                email: user.email,
                commentId,
                content
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments({ ...comments, [postId]: commentRes.data });
        } catch (err) {
            setMessage("Error adding reply: " + (err.response?.data?.message || err.message));
        }
    };

    const handleCommentLike = async (commentId: number, postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to like a comment.");
            return;
        }
        try {
            await axios.post("/api/posts/comments/like", {
                email: user.email,
                commentId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments({ ...comments, [postId]: commentRes.data });
        } catch (err) {
            setMessage("Error liking comment: " + (err.response?.data?.message || err.message));
        }
    };

    const handleReact = async (postId: number, reaction: string) => {
        if (!user || !token) {
            setMessage("Please log in to react.");
            return;
        }
        try {
            await axios.post("/api/posts/react", {
                email: user.email,
                postId,
                reaction
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setShowReactions(null);
            const postsRes = await axios.get("/api/posts", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const postsData = postsRes.data.map((post: Post) => ({
                ...post,
                reactions: post.reactions ? JSON.parse(post.reactions) : {}
            }));
            setPosts(postsData);
        } catch (err) {
            setMessage("Error adding reaction: " + (err.response?.data?.message || err.message));
        }
    };

    const startEditing = (post: Post) => {
        setEditingPost(post.id);
        setEditContent(post.content);
    };

    const handleEdit = async (postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to edit.");
            return;
        }
        try {
            await axios.put(`/api/posts/edit/${postId}`, {
                email: user.email,
                content: editContent
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingPost(null);
            setEditContent("");
            const postsRes = await axios.get("/api/posts", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const postsData = postsRes.data.map((post: Post) => ({
                ...post,
                reactions: post.reactions ? JSON.parse(post.reactions) : {}
            }));
            setPosts(postsData);
        } catch (err) {
            setMessage("Error editing post: " + (err.response?.data?.message || err.message));
        }
    };

    const handlePinComment = async (commentId: number, postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to pin a comment.");
            return;
        }
        try {
            await axios.post("/api/posts/comments/pin", {
                email: user.email,
                commentId,
                postId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments({ ...comments, [postId]: commentRes.data });
        } catch (err) {
            setMessage("Error pinning comment: " + (err.response?.data?.message || err.message));
        }
    };

    const handleShare = async (postId: number, squadId: number) => {
        if (!user || !token) {
            setMessage("Please log in to share.");
            return;
        }
        try {
            await axios.post("/api/posts/share", {
                email: user.email,
                postId,
                squadId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage("Post shared successfully!");
        } catch (err) {
            setMessage("Error sharing post: " + (err.response?.data?.message || err.message));
        }
    };

    const toggleComments = (postId: number) => {
        setShowComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
    };

    const loadMoreComments = (postId: number) => {
        setVisibleComments((prev) => ({
            ...prev,
            [postId]: (prev[postId] || commentsPerPage) + commentsPerPage
        }));
    };

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Please log in to access the dashboard.</div>
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
            <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Welcome to TeenVerse, {user.username || user.email}!</h1>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md mb-6">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Create a Post</h2>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                        />
                        <button
                            onClick={handlePost}
                            className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition"
                        >
                            Post
                        </button>
                    </div>

                    <div className="space-y-6">
                        {posts.length > 0 ? (
                            posts.map((post) => (
                                <div key={post.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                                    <div className="flex items-start">
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-800">{post.username}</p>
                                            {editingPost === post.id ? (
                                                <div className="mt-2">
                                                    <textarea
                                                        value={editContent}
                                                        onChange={(e) => setEditContent(e.target.value)}
                                                        className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                                                    />
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleEdit(post.id)}
                                                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingPost(null)}
                                                            className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-gray-700 whitespace-pre-wrap mt-1">{post.content}</p>
                                                    <p className="text-gray-500 text-sm mt-1">{new Date(post.created_at).toLocaleString()}</p>
                                                    {post.user_id === user.id && (
                                                        <button
                                                            onClick={() => startEditing(post)}
                                                            className="text-gray-600 hover:text-gray-800 text-sm mt-1"
                                                        >
                                                            Edit
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-3 border-t pt-2">
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => handleLike(post.id)}
                                                className="text-blue-600 hover:text-blue-800 flex items-center"
                                            >
                                                👍 {post.likes || 0}
                                            </button>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowReactions(post.id === showReactions ? null : post.id)}
                                                    className="text-yellow-600 hover:text-yellow-800 flex items-center"
                                                >
                                                    😊 React
                                                </button>
                                                {showReactions === post.id && (
                                                    <div className="absolute left-0 mt-2 bg-white border rounded-lg shadow-lg p-2 flex space-x-1 z-10">
                                                        {reactionsList.map((reaction) => (
                                                            <button
                                                                key={reaction}
                                                                onClick={() => handleReact(post.id, reaction)}
                                                                className="bg-gray-100 text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-200 transition"
                                                            >
                                                                {reaction}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                {Object.entries(post.reactions).map(([reaction, users]: [string, string[]]) => (
                                                    users.length > 0 && (
                                                        <span key={reaction} className="text-sm text-gray-600">
                                                            {reaction}: {users.length}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => toggleComments(post.id)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm"
                                        >
                                            {showComments[post.id] ? "Hide comments" : `View comments (${comments[post.id]?.length || 0})`}
                                        </button>
                                    </div>

                                    {showComments[post.id] && (
                                        <div className="mt-4">
                                            {comments[post.id]?.length > 0 ? (
                                                <>
                                                    {comments[post.id]
                                                        .sort((a, b) => b.pinned - a.pinned)
                                                        .slice(0, visibleComments[post.id])
                                                        .map((comment) => (
                                                            <Comment
                                                                key={comment.id}
                                                                comment={comment}
                                                                postId={post.id}
                                                                user={user}
                                                                token={token}
                                                                onCommentLike={handleCommentLike}
                                                                onPinComment={handlePinComment}
                                                                onReply={handleReply}
                                                            />
                                                        ))}
                                                    {comments[post.id].length > visibleComments[post.id] && (
                                                        <button
                                                            onClick={() => loadMoreComments(post.id)}
                                                            className="text-indigo-600 hover:text-indigo-800 text-sm mt-2"
                                                        >
                                                            View more comments
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <p className="text-gray-600 text-sm">No comments yet.</p>
                                            )}

                                            <div className="mt-4">
                                                <textarea
                                                    value={commentContent[post.id] || ""}
                                                    onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
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

                                    <div className="mt-3">
                                        <select
                                            onChange={(e) => handleShare(post.id, parseInt(e.target.value))}
                                            className="border rounded-lg p-1 text-sm text-gray-600"
                                            defaultValue=""
                                        >
                                            <option value="" disabled>Share to Squad</option>
                                            {squads.map((squad) => (
                                                <option key={squad.id} value={squad.id}>
                                                    {squad.game_name} - {squad.description}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-center">No posts yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}