import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import PostCard from "../components/PostCard";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { MessageSquare, PenSquare } from "lucide-react";

interface Post {
  id: number;
  username: string;
  content: string;
  mode: string;
  created_at: string;
  reactions: { [reaction: string]: string[] };
  user_id: number;
  verified?: number;
  likes: number;
  profile_media_url?: string;
  profile_media_type?: string;
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [comments, setComments] = useState<{ [postId: number]: CommentType[] }>({});
  const [squads, setSquads] = useState<Squad[]>([]);
  const { user, token, loading: authLoading } = useAuth();
  const limit = 10;

  const observer = useRef<IntersectionObserver | null>(null);
  const lastPostRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) setOffset((prev) => prev + limit);
      });
      if (node) observer.current.observe(node);
    },
    [loading, hasMore]
  );

  const fetchPosts = useCallback(async () => {
    if (!user || !token || !hasMore) return;
    try {
      setLoading(true);
      const auth = withAuth(token);
      const res = await axios.get(`/api/posts?limit=${limit}&offset=${offset}`, auth);
      const postsData = res.data.map((p: Post) => ({
        ...p,
        reactions: typeof p.reactions === 'string' ? JSON.parse(p.reactions) : (p.reactions || {}),
      }));
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...postsData.filter((p: Post) => !ids.has(p.id))];
      });
      setHasMore(postsData.length === limit);

      const newComments: { [postId: number]: CommentType[] } = {};
      for (const post of postsData) {
        if (!comments[post.id]) {
          const commentRes = await axios.get(`/api/posts/comments/${post.id}`, auth);
          newComments[post.id] = commentRes.data;
        }
      }
      setComments((prev) => ({ ...prev, ...newComments }));
    } catch (err: any) {
      console.error("Error fetching posts:", err);
    } finally {
      setLoading(false);
    }
  }, [user, token, offset, hasMore, comments]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  useEffect(() => {
    if (!user || !token) return;
    axios.get("/api/game-squads", withAuth(token))
      .then((res) => setSquads(res.data))
      .catch((err) => console.error("Error fetching squads:", err));
  }, [user, token]);

  const handlePost = async () => {
    if (!user || !token || !content.trim()) return;
    try {
      setPosting(true);
      await axios.post("/api/posts/create-post", { email: user.email, content, mode: "main" }, withAuth(token));
      setContent("");
      const res = await axios.get(`/api/posts?limit=${limit}&offset=0`, withAuth(token));
      const fresh = res.data.map((p: Post) => ({ ...p, reactions: typeof p.reactions === 'string' ? JSON.parse(p.reactions) : (p.reactions || {}) }));
      setPosts(fresh);
      setOffset(0);
      setHasMore(fresh.length === limit);
      const newComments: { [id: number]: CommentType[] } = {};
      for (const post of fresh) {
        if (!comments[post.id]) {
          const cr = await axios.get(`/api/posts/comments/${post.id}`, withAuth(token));
          newComments[post.id] = cr.data;
        }
      }
      setComments((prev) => ({ ...prev, ...newComments }));
    } catch (err) { console.error("Error posting:", err); }
    finally { setPosting(false); }
  };

  const handleLike = async (postId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/like", { postId, email: user.email }, withAuth(token));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, likes: (p.likes || 0) + 1 } : p)));
    } catch (err) { console.error("Error liking:", err); }
  };

  const handleReact = async (postId: number, reaction: string) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/react", { email: user.email, postId, reaction }, withAuth(token));
      const res = await axios.get(`/api/posts?limit=${posts.length}&offset=0`, withAuth(token));
      setPosts(res.data.map((p: Post) => ({ ...p, reactions: typeof p.reactions === 'string' ? JSON.parse(p.reactions) : (p.reactions || {}) })));
    } catch (err) { console.error("Error reacting:", err); }
  };

  const handleComment = async (postId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/comments", { email: user.email, postId, content: "" }, withAuth(token));
      const res = await axios.get(`/api/posts/comments/${postId}`, withAuth(token));
      setComments((prev) => ({ ...prev, [postId]: res.data }));
    } catch (err) { console.error("Error commenting:", err); }
  };

  const handleCommentLike = async (commentId: number, postId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/comments/like", { email: user.email, commentId }, withAuth(token));
      const res = await axios.get(`/api/posts/comments/${postId}`, withAuth(token));
      setComments((prev) => ({ ...prev, [postId]: res.data }));
    } catch (err) { console.error("Error liking comment:", err); }
  };

  const handlePinComment = async (commentId: number, postId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/comments/pin", { email: user.email, commentId, postId }, withAuth(token));
      const res = await axios.get(`/api/posts/comments/${postId}`, withAuth(token));
      setComments((prev) => ({ ...prev, [postId]: res.data }));
    } catch (err) { console.error("Error pinning:", err); }
  };

  const handleReply = async (commentId: number, postId: number, replyContent: string) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/comments/reply", { email: user.email, commentId, content: replyContent }, withAuth(token));
      const res = await axios.get(`/api/posts/comments/${postId}`, withAuth(token));
      setComments((prev) => ({ ...prev, [postId]: res.data }));
    } catch (err) { console.error("Error replying:", err); }
  };

  const handleEdit = async (postId: number, newContent: string) => {
    if (!user || !token) return;
    try {
      await axios.put(`/api/posts/edit/${postId}`, { email: user.email, content: newContent }, withAuth(token));
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, content: newContent } : p)));
    } catch (err) { console.error("Error editing:", err); }
  };

  const handleDelete = async (postId: number) => {
    if (!user || !token) return;
    try {
      await axios.delete(`/api/posts/delete/${postId}`, { data: { email: user.email }, ...withAuth(token) });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) { console.error("Error deleting:", err); }
  };

  const handleShare = async (postId: number, squadId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/share", { email: user.email, postId, squadId }, withAuth(token));
    } catch (err) { console.error("Error sharing:", err); }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;

  return (
    <Layout maxWidth="3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold">
          Hey, <span className="text-gradient">{user.username || user.email?.split('@')[0]}!</span> 👋
        </h1>
        <p className="text-dark-400 mt-1">What's the tea today? 🍵</p>
      </div>

      {/* Create Post - Big & Prominent */}
      <div className="card card-hover p-4 sm:p-5 mb-6 border border-dark-600/50">
        <div className="flex gap-3 items-start">
          <div className="w-14 h-14 bg-gradient-to-br from-neon-red to-red-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-glow-sm flex-shrink-0">
            {(user.username || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's on your mind? Spill it 🍵"
              className="input min-h-[100px] resize-none text-lg"
              rows={3}
            />
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-dark-700">
              <div className="flex gap-2">
                {/* Quick add_media icons could go here */}
              </div>
              <button
                onClick={handlePost}
                disabled={!content.trim() || posting}
                className="btn-primary px-6 py-3 text-base font-bold"
              >
                {posting ? "Posting..." : "PostIt 🚀"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Feed - Clean spacing */}
      <div className="space-y-6 max-w-2xl mx-auto">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              user={user}
              token={token}
              comments={comments[post.id] || []}
              squads={squads}
              onLike={handleLike}
              onReact={handleReact}
              onComment={handleComment}
              onCommentLike={handleCommentLike}
              onPinComment={handlePinComment}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onShare={handleShare}
              lastRef={index === posts.length - 1 ? lastPostRef : undefined}
            />
          ))
        ) : !loading ? (
          <EmptyState
            title="No posts yet"
            message="Be the first to share something with the community!"
            icon={<MessageSquare className="w-8 h-8 text-tx-muted" />}
          />
        ) : null}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-tx-muted">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading more posts...
            </div>
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <p className="text-center text-tx-muted text-sm py-4">You've reached the end!</p>
        )}
      </div>
    </Layout>
  );
}
