import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import PostCard from "../components/PostCard";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { Newspaper, PenSquare } from "lucide-react";

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

export default function NewsFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
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
      const res = await axios.get(`/api/posts/newsfeed?limit=${limit}&offset=${offset}`, auth);
      const postsData = res.data.map((p: Post) => ({
        ...p,
        reactions: p.reactions ? JSON.parse(p.reactions as any) : {},
      }));
      setPosts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...postsData.filter((p: Post) => !ids.has(p.id))];
      });
      setHasMore(postsData.length === limit);

      const newComments: { [postId: number]: CommentType[] } = {};
      for (const post of postsData) {
        if (!comments[post.id]) {
          const cr = await axios.get(`/api/posts/comments/${post.id}`, auth);
          newComments[post.id] = cr.data;
        }
      }
      setComments((prev) => ({ ...prev, ...newComments }));
    } catch (err) { console.error("Error fetching posts:", err); }
    finally { setLoading(false); }
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
      const res = await axios.get(`/api/posts/newsfeed?limit=${limit}&offset=0`, withAuth(token));
      const fresh = res.data.map((p: Post) => ({ ...p, reactions: p.reactions ? JSON.parse(p.reactions as any) : {} }));
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
      const res = await axios.get(`/api/posts/newsfeed?limit=${posts.length}&offset=0`, withAuth(token));
      setPosts(res.data.map((p: Post) => ({ ...p, reactions: p.reactions ? JSON.parse(p.reactions as any) : {} })));
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
    <Layout maxWidth="2xl">
      <div className="mb-6">
        <h1 className="text-h1">News Feed</h1>
        <p className="text-tx-secondary mt-1">See what everyone's talking about</p>
      </div>

      {/* Create Post */}
      <div className="card p-4 sm:p-6 mb-6">
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
            {(user.username || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share something with the community..."
              className="input min-h-[80px] resize-none"
              rows={2}
            />
            <div className="flex justify-end mt-3">
              <button onClick={handlePost} disabled={!content.trim() || posting} className="btn-primary">
                {posting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Posting...
                  </>
                ) : (
                  <>
                    <PenSquare className="w-4 h-4 mr-2" />
                    Post
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      <div className="space-y-4">
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
            message="The feed is quiet. Be the first to share something!"
            icon={<Newspaper className="w-8 h-8 text-tx-muted" />}
          />
        ) : null}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-tx-muted">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading...
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
