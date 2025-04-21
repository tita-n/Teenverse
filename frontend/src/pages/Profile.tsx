import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";
import Comment from "../components/Comment";

// Updated UserProfile interface to include coins, rank, and level
interface UserProfile {
    username: string;
    verified: number;
    coins: number;
    rank: string;
    level: number;
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

export default function Profile() {
    const { username } = useParams<{ username: string }>();
    const { user, token } = useAuth();
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [message, setMessage] = useState("");
    const [comments, setComments] = useState<{ [postId: number]: CommentType[] }>({});
    const [commentContent, setCommentContent] = useState<{ [postId: number]: string }>({});
    const [showComments, setShowComments] = useState<{ [postId: number]: boolean }>({});

    useEffect(() => {
        const fetchProfile = async () => {
            console.log("Checking authentication...");
            console.log("User:", user);
            console.log("Token:", token);

            if (!token || !username || !user) {
                setMessage("Missing token, username, or user data. Redirecting to login...");
                setTimeout(() => navigate("/"), 2000);
                return;
            }

            try {
                console.log("Fetching profile for username:", username);
                const profileResponse = await axios.get(`/api/users/profile/${username}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                console.log("Profile API response:", profileResponse.data);

                const userData = profileResponse.data.user || profileResponse.data;
                if (!userData || !userData.username || typeof userData.verified === "undefined") {
                    throw new Error("Invalid user data in response");
                }
                console.log("Setting profile:", userData);
                setProfile(userData);

                const fetchedPosts = Array.isArray(profileResponse.data.posts) ? profileResponse.data.posts : [];
                console.log("Processing posts:", fetchedPosts);
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

                const newComments: { [postId: number]: CommentType[] } = {};
                for (const post of fetchedPosts) {
                    try {
                        const commentRes = await axios.get(`/api/posts/comments/${post.id}`, {
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

    useEffect(() => {
        console.log("Profile state updated:", profile);
    }, [profile]);

    useEffect(() => {
        console.log("Posts state updated:", posts);
    }, [posts]);

    const handleComment = async (postId: number) => {
        if (!user || !token) {
            setMessage("Please log in to comment. Redirecting to login...");
            setTimeout(() => navigate("/login"), 2000);
            return;
        }
        try {
            await axios.post(
                `/api/posts/comments`,
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
            const commentRes = await axios.get(`/api/posts/comments/${postId}`, {
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
            <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "lightgray" }}>
                <div style={{ color: "red", fontSize: "20px", textAlign: "center" }}>
                    Please log in to view profiles.
                </div>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: "lightblue", minHeight: "100vh", padding: "20px" }}>
            <Navigation />
            <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                {message && (
                    <p style={{ color: "red", textAlign: "center", fontSize: "18px", fontWeight: "bold", marginBottom: "20px" }}>
                        {message}
                    </p>
                )}
                {profile ? (
                    <>
                        <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "black", marginBottom: "20px" }}>
                            {profile.username}'s Profile{" "}
                            {profile.verified ? (
                                <span style={{ display: "inline-block", backgroundColor: "black", color: "white", borderRadius: "50%", width: "20px", height: "20px", textAlign: "center", lineHeight: "20px", fontSize: "12px" }}>
                                    ✓
                                </span>
                            ) : null}
                        </h1>
                        {/* Add profile stats section for all users */}
                        <div style={{ backgroundColor: "white", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", marginBottom: "20px" }}>
                            <h2 style={{ fontSize: "18px", fontWeight: "bold", color: "black", marginBottom: "10px" }}>
                                Profile Stats
                            </h2>
                            <p>Level: {profile.level}</p>
                            <p>Rank: {profile.rank}</p>
                            <p>Coins: {profile.coins}</p>
                        </div>
                        <div style={{ marginTop: "20px" }}>
                            {posts.length > 0 ? (
                                posts.map((post) => (
                                    <div key={post.id} style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", padding: "20px", marginBottom: "20px" }}>
                                        <p style={{ color: "gray", whiteSpace: "pre-wrap" }}>{post.content}</p>
                                        <p style={{ color: "gray", fontSize: "14px", marginTop: "4px" }}>
                                            {new Date(post.created_at).toLocaleString()}
                                        </p>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ color: "blue" }}>👍 {post.likes || 0}</span>
                                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                    {Object.entries(post.reactions || {}).map(
                                                        ([reaction, users]: [string, string[]]) => (
                                                            users.length > 0 ? (
                                                                <span key={reaction} style={{ fontSize: "14px", color: "gray" }}>
                                                                    {reaction}: {users.length}
                                                                </span>
                                                            ) : null
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => toggleComments(post.id)}
                                                style={{ color: "blue", textDecoration: "underline", fontSize: "14px", background: "none", border: "none", cursor: "pointer" }}
                                            >
                                                {showComments[post.id]
                                                    ? "Hide comments"
                                                    : `View comments (${comments[post.id]?.length || 0})`}
                                            </button>
                                        </div>
                                        {showComments[post.id] && (
                                            <div style={{ marginTop: "20px" }}>
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
                                                    <p style={{ color: "gray", fontSize: "14px" }}>No comments yet.</p>
                                                )}
                                                <div style={{ marginTop: "20px" }}>
                                                    <textarea
                                                        value={commentContent[post.id] || ""}
                                                        onChange={(e) =>
                                                            setCommentContent({
                                                                ...commentContent,
                                                                [post.id]: e.target.value,
                                                            })
                                                        }
                                                        placeholder="Add a comment..."
                                                        style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid gray", outline: "none" }}
                                                    />
                                                    <button
                                                        onClick={() => handleComment(post.id)}
                                                        style={{ background: "linear-gradient(to right, blue, darkblue)", color: "white", padding: "8px 16px", borderRadius: "8px", marginTop: "8px", border: "none", cursor: "pointer" }}
                                                    >
                                                        Comment
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p style={{ color: "gray", textAlign: "center" }}>No posts yet.</p>
                            )}
                        </div>
                    </>
                ) : (
                    <p style={{ color: "gray", textAlign: "center", fontSize: "18px" }}>
                        Loading profile...
                    </p>
                )}
            </div>
        </div>
    );
}