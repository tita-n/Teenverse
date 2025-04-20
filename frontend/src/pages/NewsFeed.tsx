import { useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

interface Post {
    id: number;
    username: string;
    content: string;
    mode: string;
    likes: number;
    reactions: string;
    created_at: string;
}

interface Comment {
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

export default function NewsFeed() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [content, setContent] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [comments, setComments] = useState<{ [postId: number]: Comment[] }>({});
    const [commentContent, setCommentContent] = useState<{ [postId: number]: string }>({});
    const [replyContent, setReplyContent] = useState<{ [commentId: number]: string }>({});
    const [showReactions, setShowReactions] = useState<number | null>(null);
    const [editingPost, setEditingPost] = useState<number | null>(null);
    const [editContent, setEditContent] = useState("");
    const [squads, setSquads] = useState<Squad[]>([]);
    const { user, token } = useAuth();

    const reactionsList = ["Deadass", "Big Mood", "Mid", "Facts", "Cap", "Slay", "No Cap", "Vibes", "Bet", "L", "W"];

    useEffect(() => {
        const fetchPosts = async () => {
            if (!user || !token) return;
            try {
                const res = await axios.get("/api/posts/newsfeed", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const postsData = res.data.map((post: Post) => ({
                    ...post,
                    reactions: post.reactions ? JSON.parse(post.reactions) : {}
                }));
                setPosts(postsData);

                // Fetch comments for each post
                const commentsData: { [postId: number]: Comment[] } = {};
                for (const post of postsData) {
                    const commentRes = await axios.get(`/api/posts/comments/${post.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    commentsData[post.id] = commentRes.data;
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

    const postUpdate = async () => {
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
            const postsRes = await axios.get("/api/posts/newsfeed", {
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

    const handleLike = async (postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to like a post.");
            return;
        }
        try {
            await axios.post("/api/like", {
                postId,
                email: user.email
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const postsRes = await axios.get("/api/posts/newsfeed", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const postsData = postsRes.data.map((post: Post) => ({
                ...post,
                reactions: post.reactions ? JSON.parse(post.reactions) : {}
            }));
            setPosts(postsData);
        } catch (err) {
            setMessage("Error liking post: " + (err.response?.data?.message || err.message));
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

    const handleReply = async (commentId: number, postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to reply.");
            return;
        }
        try {
            await axios.post("/api/posts/comments/reply", {
                email: user.email,
                commentId,
                content: replyContent[commentId] || ""
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReplyContent({ ...replyContent, [commentId]: "" });
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
            const postsRes = await axios.get("/api/posts/newsfeed", {
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
            const postsRes = await axios.get("/api/posts/newsfeed", {
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

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Please log in to access the News Feed.</div>
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
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">News Feed</h1>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Create a Post</h2>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="What's on your mind?"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                        />
                        <button
                            onClick={postUpdate}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                        >
                            Post
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Posts</h2>
                        {posts.length > 0 ? (
                            posts.map((post) => (
                                <div key={post.id} className="border-b py-4">
                                    <p className="text-gray-800 font-semibold">{post.username}</p>
                                    {editingPost === post.id ? (
                                        <div>
                                            <textarea
                                                value={editContent}
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                                            />
                                            <button
                                                onClick={() => handleEdit(post.id)}
                                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition mr-2"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingPost(null)}
                                                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-gray-600 whitespace-pre-wrap">{post.content}</p>
                                            <p className="text-gray-500 text-sm">{new Date(post.created_at).toLocaleString()}</p>
                                            {post.user_id === user.id && (
                                                <button
                                                    onClick={() => startEditing(post)}
                                                    className="text-gray-600 hover:text-gray-800 text-sm mr-2"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleLike(post.id)}
                                                className="mt-2 text-blue-600 hover:text-blue-800 mr-2"
                                            >
                                                👍 {post.likes || 0}
                                            </button>
                                            <button
                                                onClick={() => setShowReactions(show.id === showReactions ? null : post.id)}
                                                className="mt-2 text-yellow-600 hover:text-yellow-800 mr-2"
                                            >
                                                😊 React
                                            </button>
                                            {showReactions === post.id && (
                                                <div className="flex flex-wrap mt-2">
                                                    {reactionsList.map((reaction) => (
                                                        <button
                                                            key={reaction}
                                                            onClick={() => handleReact(post.id, reaction)}
                                                            className="bg-gray-200 text-gray-800 px-2 py-1 rounded-lg m-1 hover:bg-gray-300"
                                                        >
                                                            {reaction}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="mt-2">
                                                {Object.entries(post.reactions).map(([reaction, users]: [string, string[]]) => (
                                                    users.length > 0 && (
                                                        <span key={reaction} className="text-sm text-gray-600 mr-2">
                                                            {reaction}: {users.length}
                                                        </span>
                                                    )
                                                ))}
                                            </div>
                                            <div className="mt-2">
                                                <select
                                                    onChange={(e) => handleShare(post.id, parseInt(e.target.value))}
                                                    className="border rounded-lg p-1 text-sm"
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
                                            <div className="mt-4">
                                                <textarea
                                                    value={commentContent[post.id] || ""}
                                                    onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                                                    placeholder="Add a comment..."
                                                    className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                                                />
                                                <button
                                                    onClick={() => handleComment(post.id)}
                                                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                                                >
                                                    Comment
                                                </button>
                                            </div>
                                            <div className="mt-4">
                                                {comments[post.id]?.length > 0 ? (
                                                    comments[post.id].sort((a, b) => b.pinned - a.pinned).map((comment) => (
                                                        <div key={comment.id} className={`ml-4 mt-2 ${comment.pinned ? "bg-yellow-100 p-2 rounded-lg" : ""}`}>
                                                            <p className="text-gray-800 font-semibold">{comment.username} {comment.pinned ? "(Pinned)" : ""}</p>
                                                            <p className="text-gray-600 whitespace-pre-wrap">{comment.content}</p>
                                                            <p className="text-gray-500 text-sm">{new Date(comment.created_at).toLocaleString()}</p>
                                                            <button
                                                                onClick={() => handleCommentLike(comment.id, post.id)}
                                                                className="text-blue-600 hover:text-blue-800 text-sm mr-2"
                                                            >
                                                                👍 {comment.likes || 0}
                                                            </button>
                                                            {post.user_id === user.id && !comment.pinned && (
                                                                <button
                                                                    onClick={() => handlePinComment(comment.id, post.id)}
                                                                    className="text-green-600 hover:text-green-800 text-sm mr-2"
                                                                >
                                                                    Pin
                                                                </button>
                                                            )}
                                                            <textarea
                                                                value={replyContent[comment.id] || ""}
                                                                onChange={(e) => setReplyContent({ ...replyContent, [comment.id]: e.target.value })}
                                                                placeholder="Reply..."
                                                                className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-2"
                                                            />
                                                            <button
                                                                onClick={() => handleReply(comment.id, post.id)}
                                                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition mt-2"
                                                            >
                                                                Reply
                                                            </button>
                                                            {comment.replies?.length > 0 && (
                                                                <div className="ml-4 mt-2">
                                                                    {comment.replies.map((reply) => (
                                                                        <div key={reply.id} className="mt-2">
                                                                            <p className="text-gray-800 font-semibold">{reply.username}</p>
                                                                            <p className="text-gray-600 whitespace-pre-wrap">{reply.content}</p>
                                                                            <p className="text-gray-500 text-sm">{new Date(reply.created_at).toLocaleString()}</p>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-gray-600 ml-4">No comments yet.</p>
                                                )}
                                            </div>
                                        </>
                                    )}
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