import { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import Comment from "../components/Comment";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircleIcon, ThumbsUpIcon, ShareIcon, MoreHorizontalIcon, UploadIcon, StarIcon, FilterIcon } from "lucide-react";
import Confetti from "react-confetti";
import { useDropzone } from "react-dropzone";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface Post {
    id: number;
    username: string;
    content: string;
    mode: string;
    likes: number;
    reactions: { [reaction: string]: string[] };
    created_at: string;
    user_id: number;
    verified?: number;
    media_url?: string | null;
    media_type?: string | null;
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

const reactionEmojis: { [key: string]: string } = {
    Deadass: "💯",
    "Big Mood": "😎",
    Mid: "😐",
    Facts: "✅",
    Cap: "🙅‍♂️",
    Slay: "🔥",
    "No Cap": "🙌",
    Vibes: "✨",
    Bet: "🤝",
    L: "😞",
    W: "🏆",
};

export default function NewsFeed() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [content, setContent] = useState("");
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [mediaPreview, setMediaPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const limit = 10;
    const [comments, setComments] = useState<{ [postId: number]: CommentType[] }>({});
    const [commentContent, setCommentContent] = useState<{ [postId: number]: string }>({});
    const [showComments, setShowComments] = useState<{ [postId: number]: boolean }>({});
    const [visibleComments, setVisibleComments] = useState<{ [postId: number]: number }>({});
    const [showReactions, setShowReactions] = useState<number | null>(null);
    const [editingPost, setEditingPost] = useState<number | null>(null);
    const [editContent, setEditContent] = useState("");
    const [squads, setSquads] = useState<Squad[]>([]);
    const [showMenu, setShowMenu] = useState<number | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [filter, setFilter] = useState<"all" | "media" | "squad">("all");
    const [darkMode, setDarkMode] = useState(localStorage.getItem("darkMode") === "true");
    const { user, token } = useAuth();

    const observer = useRef<IntersectionObserver | null>(null);
    const lastPostElementRef = useCallback(
        (node: HTMLDivElement | null) => {
            if (loading) return;
            if (observer.current) observer.current.disconnect();
            observer.current = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    setOffset((prev) => prev + limit);
                }
            });
            if (node) observer.current.observe(node);
        },
        [loading, hasMore]
    );

    const reactionsList = Object.keys(reactionEmojis);
    const commentsPerPage = 3;

    // Toggle dark mode
    useEffect(() => {
        localStorage.setItem("darkMode", darkMode.toString());
        document.documentElement.classList.toggle("dark", darkMode);
    }, [darkMode]);

    // Clean up media preview
    useEffect(() => {
        return () => {
            if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        };
    }, [mediaPreview]);

    // Fetch posts
    const fetchPosts = useCallback(async () => {
        if (!user || !token || !hasMore) return;
        try {
            setLoading(true);
            const res = await axios.get(`/api/posts/newsfeed?limit=${limit}&offset=${offset}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const postsData = res.data.map((post: Post) => ({
                ...post,
                reactions: post.reactions ? JSON.parse(post.reactions) : {},
                verified: post.verified,
            }));

            setPosts((prev) => {
                const existingIds = new Set(prev.map((p) => p.id));
                const newPosts = postsData.filter((post: Post) => !existingIds.has(post.id));
                return [...prev, ...newPosts];
            });
            setHasMore(postsData.length === limit);

            const newComments: { [postId: number]: CommentType[] } = { ...comments };
            for (const post of postsData) {
                if (!newComments[post.id]) {
                    const commentRes = await axios.get(`/api/posts/comments/${post.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    newComments[post.id] = commentRes.data;
                    setVisibleComments((prev) => ({ ...prev, [post.id]: commentsPerPage }));
                }
            }
            setComments(newComments);
        } catch (err) {
            toast.error("Error fetching posts: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    }, [user, token, offset, comments, hasMore]);

    // Fetch squads
    useEffect(() => {
        const fetchSquads = async () => {
            try {
                const res = await axios.get("/api/game-squads", {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setSquads(res.data);
            } catch (err) {
                console.error("Error fetching squads:", err);
            }
        };

        if (user && token) {
            fetchSquads();
            fetchPosts();
        }
    }, [user, token, fetchPosts]);

    // Handle media drop
    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (file.size > 10 * 1024 * 1024) {
            toast.error("File size exceeds 10MB limit.");
            return;
        }
        setMediaFile(file);
        if (mediaPreview) URL.revokeObjectURL(mediaPreview);
        const previewUrl = URL.createObjectURL(file);
        setMediaPreview(previewUrl);
    }, [mediaPreview]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { "image/*": [], "video/*": [] },
        maxSize: 10 * 1024 * 1024,
    });

    // Handle post creation
    const postUpdate = async () => {
        if (!user || !token) {
            toast.error("Please log in to post.");
            return;
        }
        if (!content && !mediaFile) {
            toast.error("Post content or media is required.");
            return;
        }
        try {
            const formData = new FormData();
            formData.append("email", user.email);
            formData.append("content", content);
            formData.append("mode", "main");
            if (mediaFile) formData.append("media", mediaFile);

            const res = await axios.post("/api/create-post", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            toast.success(res.data.message);
            setContent("");
            setMediaFile(null);
            setMediaPreview(null);

            const newPostsRes = await axios.get(`/api/posts/newsfeed?limit=${limit}&offset=0`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const newPostsData = newPostsRes.data.map((post: Post) => ({
                ...post,
                reactions: post.reactions ? JSON.parse(post.reactions) : {},
                verified: post.verified,
            }));
            setPosts(newPostsData);
            setOffset(0);
            setHasMore(newPostsData.length === limit);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        } catch (err) {
            toast.error("Error posting: " + (err.response?.data?.message || err.message));
        }
    };

    const handleLike = async (postId: number) => {
        if (!user || !token) {
            toast.error("Please log in to like a post.");
            return;
        }
        try {
            await axios.post("/api/like", { postId, email: user.email }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setPosts(posts.map((post) =>
                post.id === postId ? { ...post, likes: (post.likes || 0) + 1 } : post
            ));
            toast.success("Post liked!");
        } catch (err) {
            toast.error("Error liking post: " + (err.response?.data?.message || err.message));
        }
    };

    const handleComment = async (postId: number) => {
        if (!user || !token) {
            toast.error("Please log in to comment.");
            return;
        }
        if (!commentContent[postId]) {
            toast.error("Comment content is required.");
            return;
        }
        try {
            await axios.post("/api/posts/comments", {
                email: user.email,
                postId,
                content: commentContent[postId],
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCommentContent({ ...commentContent, [postId]: "" });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComments({ ...comments, [postId]: commentRes.data });
            toast.success("Comment added!");
        } catch (err) {
            toast.error("Error adding comment: " + (err.response?.data?.message || err.message));
        }
    };

    const handleReply = async (commentId: number, postId: number, content: string) => {
        if (!user || !token) {
            toast.error("Please log in to reply.");
            return;
        }
        try {
            await axios.post("/api/posts/comments/reply", {
                email: user.email,
                commentId,
                content,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComments({ ...comments, [postId]: commentRes.data });
            toast.success("Reply added!");
        } catch (err) {
            toast.error("Error adding reply: " + (err.response?.data?.message || err.message));
        }
    };

    const handleCommentLike = async (commentId: number, postId: number) => {
        if (!user || !token) {
            toast.error("Please log in to like a comment.");
            return;
        }
        try {
            await axios.post("/api/posts/comments/like", {
                email: user.email,
                commentId,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComments({ ...comments, [postId]: commentRes.data });
            toast.success("Comment liked!");
        } catch (err) {
            toast.error("Error liking comment: " + (err.response?.data?.message || err.message));
        }
    };

    const handleReact = async (postId: number, reaction: string) => {
        if (!user || !token) {
            toast.error("Please log in to react.");
            return;
        }
        try {
            await axios.post("/api/posts/react", {
                email: user.email,
                postId,
                reaction,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setShowReactions(null);
            const updatedPosts = await axios.get(`/api/posts/newsfeed?limit=${posts.length}&offset=0`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const postsData = updatedPosts.data.map((post: Post) => ({
                ...post,
                reactions: post.reactions ? JSON.parse(post.reactions) : {},
                verified: post.verified,
            }));
            setPosts(postsData);
            toast.success(`Reacted with ${reaction}!`);
        } catch (err) {
            toast.error("Error adding reaction: " + (err.response?.data?.message || err.message));
        }
    };

    const startEditing = (post: Post) => {
        setEditingPost(post.id);
        setEditContent(post.content);
        setShowMenu(null);
    };

    const handleEdit = async (postId: number) => {
        if (!user || !token) {
            toast.error("Please log in to edit.");
            return;
        }
        try {
            await axios.put(`/api/posts/edit/${postId}`, {
                email: user.email,
                content: editContent,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setEditingPost(null);
            setEditContent("");
            setPosts(posts.map((post) =>
                post.id === postId ? { ...post, content: editContent } : post
            ));
            toast.success("Post updated!");
        } catch (err) {
            toast.error("Error editing post: " + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async (postId: number) => {
        if (!user || !token) {
            toast.error("Please log in to delete.");
            return;
        }
        try {
            await axios.delete(`/api/posts/delete/${postId}`, {
                data: { email: user.email },
                headers: { Authorization: `Bearer ${token}` },
            });
            setShowMenu(null);
            setPosts(posts.filter((post) => post.id !== postId));
            toast.success("Post deleted!");
        } catch (err) {
            toast.error("Error deleting post: " + (err.response?.data?.message || err.message));
        }
    };

    const handlePinComment = async (commentId: number, postId: number) => {
        if (!user || !token) {
            toast.error("Please log in to pin a comment.");
            return;
        }
        try {
            await axios.post("/api/posts/comments/pin", {
                email: user.email,
                commentId,
                postId,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComments({ ...comments, [postId]: commentRes.data });
            toast.success("Comment pinned!");
        } catch (err) {
            toast.error("Error pinning comment: " + (err.response?.data?.message || err.message));
        }
    };

    const handleShare = async (postId: number, squadId: number) => {
        if (!user || !token) {
            toast.error("Please log in to share.");
            return;
        }
        try {
            await axios.post("/api/posts/share", {
                email: user.email,
                postId,
                squadId,
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            toast.success("Post shared to squad!");
        } catch (err) {
            toast.error("Error sharing post: " + (err.response?.data?.message || err.message));
        }
    };

    const toggleComments = (postId: number) => {
        setShowComments((prev) => ({ ...prev, [postId]: !prev[postId] }));
    };

    const loadMoreComments = (postId: number) => {
        setVisibleComments((prev) => ({
            ...prev,
            [postId]: (prev[postId] || commentsPerPage) + commentsPerPage,
        }));
    };

    // Filter posts
    const filteredPosts = posts.filter((post) => {
        if (filter === "media") return post.media_url;
        if (filter === "squad") return squads.some((squad) => post.squad_id === squad.id);
        return true;
    });

    // Find hot post
    const hotPost = posts.reduce((hot, post) => {
        const hotScore = (hot?.likes || 0) + Object.values(hot?.reactions || {}).flat().length;
        const postScore = (post.likes || 0) + Object.values(post.reactions || {}).flat().length;
        return postScore > hotScore ? post : hot;
    }, null as Post | null);

    if (!user || !token) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-500"
            >
                <div className="text-center space-y-4">
                    <h1 className="text-2xl font-bold text-white">Access Denied</h1>
                    <p className="text-gray-200">Please log in to access the News Feed.</p>
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

    return (
        <div className={darkMode ? "dark" : ""}>
            {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
            <ToastContainer position="top-right" autoClose={3000} theme={darkMode ? "dark" : "light"} />
            <Navigation />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-screen bg-gradient-to-br from-purple-600 to-pink-500 p-4 sm:p-6 dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900"
            >
                <div className="max-w-7xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-extrabold text-white dark:text-gray-200">
                            News Feed
                        </h1>
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setDarkMode(!darkMode)}
                            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                        >
                            {darkMode ? "Light Mode" : "Dark Mode"}
                        </motion.button>
                    </div>

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="sticky top-4 z-20 bg-white bg-opacity-20 backdrop-blur-lg p-6 rounded-2xl shadow-xl mb-6 dark:bg-gray-800 dark:bg-opacity-20"
                    >
                        <h2 className="text-xl font-semibold text-white mb-4 dark:text-gray-200">
                            What's on your mind?
                        </h2>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Share your vibe..."
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white bg-opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                            rows={4}
                            aria-label="Post content"
                        />
                        <div
                            {...getRootProps()}
                            className={`mt-2 p-4 border-dashed border-2 rounded-lg text-center cursor-pointer ${
                                isDragActive ? "border-purple-500 bg-purple-100" : "border-gray-300"
                            }`}
                        >
                            <input {...getInputProps()} aria-label="Upload media" />
                            <UploadIcon className="w-6 h-6 mx-auto text-gray-600 dark:text-gray-300" />
                            <p className="text-gray-600 dark:text-gray-300">
                                Drag & drop media or click to upload (max 10MB)
                            </p>
                        </div>
                        {mediaPreview && (
                            <div className="mt-2">
                                {mediaFile?.type.startsWith("video") ? (
                                    <video
                                        src={mediaPreview}
                                        controls
                                        className="w-full max-w-xs rounded-lg"
                                        aria-label="Media preview"
                                    />
                                ) : (
                                    <img
                                        src={mediaPreview}
                                        alt="Media preview"
                                        className="w-full max-w-xs rounded-lg"
                                        loading="lazy"
                                    />
                                )}
                                <button
                                    onClick={() => {
                                        setMediaFile(null);
                                        setMediaPreview(null);
                                    }}
                                    className="mt-2 text-red-600 hover:text-red-800"
                                >
                                    Remove
                                </button>
                            </div>
                        )}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={postUpdate}
                            className="mt-4 w-full bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-600 transition"
                        >
                            Post
                        </button>
                    </motion.div>

                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white bg-opacity-20 backdrop-blur-lg p-6 rounded-2xl shadow-xl mb-6 dark:bg-gray-800 dark:bg-opacity-20"
                    >
                        <div className="flex space-x-2">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => setFilter("all")}
                                className={`px-4 py-2 rounded-lg ${
                                    filter === "all"
                                        ? "bg-purple-600 text-white"
                                        : "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                                }`}
                            >
                                All Posts
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => setFilter("media")}
                                className={`px-4 py-2 rounded-lg ${
                                    filter === "media"
                                        ? "bg-purple-600 text-white"
                                        : "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                                }`}
                            >
                                Media
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                onClick={() => setFilter("squad")}
                                className={`px-4 py-2 rounded-lg ${
                                    filter === "squad"
                                        ? "bg-purple-600 text-white"
                                        : "bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200"
                                }`}
                            >
                                Squads
                            </motion.button>
                        </div>
                    </motion.div>

                    {hotPost && (
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-6 mb-6 border-2 border-yellow-400 dark:bg-gray-800 dark:bg-opacity-20"
                        >
                            <p className="text-yellow-400 font-semibold mb-2">🔥 Hot Post</p>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <Link to={`/profile/${hotPost.username}`}>
                                        <p className="font-semibold text-white inline-flex items-center dark:text-gray-200">
                                            {hotPost.username}{" "}
                                            {hotPost.verified ? (
                                                <span className="ml-1 inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full h-5 w-5 text-center leading-5 text-xs animate-pulse">
                                                    ✓
                                                </span>
                                            ) : null}
                                        </p>
                                    </Link>
                                    <p className="text-gray-200 whitespace-pre-wrap mt-1 dark:text-gray-300">
                                        {hotPost.content}
                                    </p>
                                    {hotPost.media_url && (
                                        <div className="mt-2">
                                            {hotPost.media_type === "video" ? (
                                                <video
                                                    src={hotPost.media_url}
                                                    controls
                                                    className="w-full max-w-md rounded-lg"
                                                    aria-label={`${hotPost.username}'s video`}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <img
                                                    src={hotPost.media_url}
                                                    alt={`${hotPost.username}'s image`}
                                                    className="w-full max-w-md rounded-lg"
                                                    loading="lazy"
                                                />
                                            )}
                                        </div>
                                    )}
                                    <p className="text-gray-400 text-sm mt-1 dark:text-gray-500">
                                        {new Date(hotPost.created_at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    <div className="space-y-6">
                        <AnimatePresence>
                            {filteredPosts.length > 0 ? (
                                filteredPosts.map((post, index) => (
                                    <motion.div
                                        key={post.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        ref={index === filteredPosts.length - 1 ? lastPostElementRef : null}
                                        className="bg-white bg-opacity-20 backdrop-blur-lg rounded-2xl shadow-xl p-6 dark:bg-gray-800 dark:bg-opacity-20"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <Link to={`/profile/${post.username}`}>
                                                    <p className="font-semibold text-white inline-flex items-center dark:text-gray-200">
                                                        {post.username}{" "}
                                                        {post.verified ? (
                                                            <span className="ml-1 inline-block bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full h-5 w-5 text-center leading-5 text-xs animate-pulse">
                                                                ✓
                                                            </span>
                                                        ) : null}
                                                    </p>
                                                </Link>
                                                {editingPost === post.id ? (
                                                    <div className="mt-2">
                                                        <textarea
                                                            value={editContent}
                                                            onChange={(e) => setEditContent(e.target.value)}
                                                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white bg-opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                                                            aria-label="Edit post content"
                                                        />
                                                        <div className="flex space-x-2 mt-2">
                                                            <motion.button
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => handleEdit(post.id)}
                                                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                                                            >
                                                                Save
                                                            </motion.button>
                                                            <motion.button
                                                                whileHover={{ scale: 1.05 }}
                                                                whileTap={{ scale: 0.95 }}
                                                                onClick={() => setEditingPost(null)}
                                                                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                                                            >
                                                                Cancel
                                                            </motion.button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-gray-200 whitespace-pre-wrap mt-1 dark:text-gray-300">
                                                            {post.content}
                                                        </p>
                                                        {post.media_url && (
                                                            <div className="mt-2">
                                                                {post.media_type === "video" ? (
                                                                    <video
                                                                        src={post.media_url}
                                                                        controls
                                                                        className="w-full max-w-md rounded-lg"
                                                                        aria-label={`${post.username}'s video`}
                                                                        loading="lazy"
                                                                    />
                                                                ) : (
                                                                    <img
                                                                        src={post.media_url}
                                                                        alt={`${post.username}'s image`}
                                                                        className="w-full max-w-md rounded-lg"
                                                                        loading="lazy"
                                                                    />
                                                                )}
                                                            </div>
                                                        )}
                                                        <p className="text-gray-400 text-sm mt-1 dark:text-gray-500">
                                                            {new Date(post.created_at).toLocaleString()}
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                            {post.user_id === user.id && (
                                                <div className="relative">
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        onClick={() => setShowMenu(post.id === showMenu ? null : post.id)}
                                                        className="text-gray-200 hover:text-white dark:text-gray-400 dark:hover:text-gray-200"
                                                    >
                                                        <MoreHorizontalIcon className="w-5 h-5" />
                                                    </motion.button>
                                                    {showMenu === post.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            className="absolute right-0 mt-2 bg-white bg-opacity-20 backdrop-blur-lg border rounded-lg shadow-lg p-2 z-10 dark:bg-gray-800 dark:bg-opacity-20 dark:border-gray-600"
                                                        >
                                                            <button
                                                                onClick={() => startEditing(post)}
                                                                className="block text-gray-200 px-2 py-1 hover:bg-gray-100 hover:bg-opacity-20 dark:text-gray-300 dark:hover:bg-gray-700"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(post.id)}
                                                                className="block text-red-600 px-2 py-1 hover:bg-gray-100 hover:bg-opacity-20 dark:hover:bg-gray-700"
                                                            >
                                                                Delete
                                                            </button>
                                                        </motion.div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between mt-3 border-t border-gray-200 border-opacity-20 pt-2">
                                            <div className="flex items-center space-x-4">
                                                <motion.button
                                                    whileHover={{ scale: 1.1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    onClick={() => handleLike(post.id)}
                                                    className="text-blue-400 hover:text-blue-600 flex items-center dark:text-blue-300 dark:hover:text-blue-500"
                                                >
                                                    <ThumbsUpIcon className="w-5 h-5 mr-1" />
                                                    {post.likes || 0}
                                                </motion.button>
                                                <div className="relative">
                                                    <motion.button
                                                        whileHover={{ scale: 1.1 }}
                                                        whileTap={{ scale: 0.9 }}
                                                        onClick={() => setShowReactions(post.id === showReactions ? null : post.id)}
                                                        className="text-yellow-400 hover:text-yellow-600 flex items-center dark:text-yellow-300 dark:hover:text-yellow-500"
                                                    >
                                                        <StarIcon className="w-5 h-5 mr-1" />
                                                        React
                                                    </motion.button>
                                                    {showReactions === post.id && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            className="absolute left-0 mt-2 bg-white bg-opacity-20 backdrop-blur-lg border rounded-lg shadow-lg p-2 flex flex-wrap gap-2 z-10 dark:bg-gray-800 dark:bg-opacity-20 dark:border-gray-600"
                                                        >
                                                            {reactionsList.map((reaction) => (
                                                                <motion.button
                                                                    key={reaction}
                                                                    whileHover={{ scale: 1.2 }}
                                                                    onClick={() => handleReact(post.id, reaction)}
                                                                    className="text-2xl"
                                                                    title={reaction}
                                                                >
                                                                    {reactionEmojis[reaction]}
                                                                </motion.button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    {Object.entries(post.reactions).map(([reaction, users]) =>
                                                        users.length > 0 && (
                                                            <span key={reaction} className="text-sm text-gray-200 dark:text-gray-400">
                                                                {reactionEmojis[reaction]} {users.length}
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                            <motion.button
                                                whileHover={{ scale: 1.05 }}
                                                onClick={() => toggleComments(post.id)}
                                                className="text-indigo-400 hover:text-indigo-600 text-sm flex items-center dark:text-indigo-300 dark:hover:text-indigo-500"
                                            >
                                                <MessageCircleIcon className="w-5 h-5 mr-1" />
                                                {showComments[post.id]
                                                    ? "Hide comments"
                                                    : `Comments (${comments[post.id]?.length || 0})`}
                                            </motion.button>
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
                                                            <motion.button
                                                                whileHover={{ scale: 1.05 }}
                                                                onClick={() => loadMoreComments(post.id)}
                                                                className="text-indigo-400 hover:text-indigo-600 text-sm mt-2 dark:text-indigo-300 dark:hover:text-indigo-500"
                                                            >
                                                                View more comments
                                                            </motion.button>
                                                        )}
                                                    </>
                                                ) : (
                                                    <p className="text-gray-400 text-sm dark:text-gray-500">
                                                        No comments yet.
                                                    </p>
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
                                                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white bg-opacity-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                                                        rows={2}
                                                        aria-label="Comment input"
                                                    />
                                                    <motion.button
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        onClick={() => handleComment(post.id)}
                                                        className="mt-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-600 transition"
                                                    >
                                                        Comment
                                                    </motion.button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="mt-3">
                                            <select
                                                onChange={(e) => handleShare(post.id, parseInt(e.target.value))}
                                                className="border rounded-lg p-1 text-sm text-gray-200 bg-white bg-opacity-20 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                                                defaultValue=""
                                                aria-label="Share to squad"
                                            >
                                                <option value="" disabled>
                                                    Share to Squad
                                                </option>
                                                {squads.map((squad) => (
                                                    <option key={squad.id} value={squad.id}>
                                                        {squad.game_name} - {squad.description}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </motion.div>
                                ))
                            ) : (
                                <p className="text-gray-200 text-center dark:text-gray-400">
                                    No posts yet. Share your vibe!
                                </p>
                            )}
                        </AnimatePresence>
                        {loading && (
                            <div className="text-center text-gray-200 dark:text-gray-400">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                    className="inline-block w-6 h-6 border-2 border-t-transparent border-gray-200 rounded-full"
                                />
                                <p>Loading...</p>
                            </div>
                        )}
                        {!hasMore && filteredPosts.length > 0 && (
                            <p className="text-center text-gray-200 dark:text-gray-400">
                                No more posts to load.
                            </p>
                        )}
                    </div>
                </div>
            </motion.div>
        </div>
    );
}