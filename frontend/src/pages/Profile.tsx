import { useEffect, useState, ChangeEvent } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Comment from "../components/Comment";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState, EmptyState } from "../components/ui/PageStates";
import { MessageCircle, Camera, User as UserIcon, Coins, Award, TrendingUp } from "lucide-react";
import DOMPurify from "dompurify";

const sanitizeContent = (content: string): string => {
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

interface UserProfile {
  username: string;
  verified: number;
  coins: number;
  rank: string;
  level: number;
  profile_media_url?: string;
  profile_media_type?: string;
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
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<{ [postId: number]: CommentType[] }>({});
  const [commentContent, setCommentContent] = useState<{ [postId: number]: string }>({});
  const [showComments, setShowComments] = useState<{ [postId: number]: boolean }>({});

  useEffect(() => {
    if (!token || !username || !user) {
      setLoading(false);
      return;
    }
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const auth = withAuth(token);
        const profileResponse = await axios.get(`/api/users/profile/${username}`, auth);
        const userData = profileResponse.data.user || profileResponse.data;
        if (!userData || !userData.username) throw new Error("Invalid user data");
        setProfile(userData);

        const fetchedPosts = Array.isArray(profileResponse.data.posts) ? profileResponse.data.posts : [];
        setPosts(
          fetchedPosts.map((post: Post) => ({
            ...post,
            reactions: typeof post.reactions === "string" ? JSON.parse(post.reactions) : post.reactions || {},
          }))
        );

        const newComments: { [postId: number]: CommentType[] } = {};
        for (const post of fetchedPosts) {
          try {
            const cr = await axios.get(`/api/posts/comments/${post.id}`, auth);
            newComments[post.id] = cr.data || [];
          } catch {}
        }
        setComments(newComments);
      } catch (err: any) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          setMessage("Session expired.");
        } else {
          setMessage("Error loading profile.");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username, user, token]);

  const handleComment = async (postId: number) => {
    if (!user || !token) return;
    try {
      await axios.post("/api/posts/comments", { email: user.email, postId, content: commentContent[postId] || "" }, withAuth(token));
      setCommentContent({ ...commentContent, [postId]: "" });
      const res = await axios.get(`/api/posts/comments/${postId}`, withAuth(token));
      setComments({ ...comments, [postId]: res.data });
    } catch (err) { console.error("Error adding comment:", err); }
  };

  const handleStartDM = async () => {
    if (!user || !token || !profile?.username) return;
    try {
      const res = await axios.post("/api/dms/send", { email: user.email, recipientUsername: profile.username, content: "Hey, let's chat!", isGhostBomb: false }, withAuth(token));
      navigate(`/chat/${res.data.conversationId}`, { state: { otherUsername: profile.username } });
    } catch (err) { console.error("Error starting DM:", err); }
  };

  const handleUploadMedia = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!user || !token || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.size > 3 * 1024 * 1024) { setMessage("File size exceeds 3MB limit."); return; }
    const formData = new FormData();
    formData.append("email", user.email);
    formData.append("media", file);
    try {
      const res = await axios.post("/api/users/profile/upload", formData, { headers: { ...withAuth(token).headers, "Content-Type": "multipart/form-data" } });
      setProfile({ ...profile!, profile_media_url: res.data.profile_media_url, profile_media_type: res.data.profile_media_type });
      setMessage("Profile photo updated!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) { console.error("Upload error:", err); }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading profile..." />;

  const isOwnProfile = user.username === profile?.username;

  return (
    <Layout maxWidth="3xl">
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("Error") || message.includes("expired") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      {profile ? (
        <>
          {/* Profile Header */}
          <div className="card p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {profile.profile_media_url && profile.profile_media_type === "image" ? (
                  <img src={profile.profile_media_url} alt={profile.username} className="w-24 h-24 rounded-full object-cover border-4 border-brand-100" />
                ) : profile.profile_media_url && profile.profile_media_type === "video" ? (
                  <video src={profile.profile_media_url} autoPlay loop muted className="w-24 h-24 rounded-full object-cover border-4 border-brand-100" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-3xl border-4 border-brand-50">
                    {profile.username.charAt(0).toUpperCase()}
                  </div>
                )}
                {isOwnProfile && (
                  <label className="absolute bottom-0 right-0 w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-brand-700 transition-colors shadow-md">
                    <Camera className="w-4 h-4 text-white" />
                    <input type="file" accept="image/jpeg,image/png,video/mp4" onChange={handleUploadMedia} className="hidden" />
                  </label>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <h1 className="text-2xl font-bold text-tx-primary">{profile.username}</h1>
                  {profile.verified ? (
                    <span className="badge badge-brand w-6 h-6 flex items-center justify-center p-0 rounded-full text-xs font-bold">✓</span>
                  ) : null}
                </div>

                {/* Stats */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <TrendingUp className="w-4 h-4 text-brand-500" />
                    <span className="text-tx-secondary">Level</span>
                    <span className="font-semibold text-tx-primary">{profile.level}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Award className="w-4 h-4 text-yellow-500" />
                    <span className="text-tx-secondary">Rank</span>
                    <span className="font-semibold text-tx-primary">{profile.rank}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <Coins className="w-4 h-4 text-amber-500" />
                    <span className="text-tx-secondary">Coins</span>
                    <span className="font-semibold text-tx-primary">{profile.coins}</span>
                  </div>
                </div>

                {!isOwnProfile && (
                  <Button onClick={handleStartDM} variant="primary" size="sm">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Send DM
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Posts */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-tx-primary">Posts</h2>
            {posts.length > 0 ? (
              posts.map((post) => (
                <div key={post.id} className="card p-4 sm:p-6">
                  <p className="text-tx-primary whitespace-pre-wrap">{sanitizeContent(post.content)}</p>
                  <p className="text-xs text-tx-muted mt-2">
                    {new Date(post.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-border">
                    <div className="flex items-center gap-2 text-sm text-tx-secondary">
                      <span>👍 {post.likes || 0}</span>
                      {Object.entries(post.reactions || {}).map(([r, u]) =>
                        Array.isArray(u) && u.length > 0 ? <span key={r} className="badge badge-neutral text-xs">{r} {u.length}</span> : null
                      )}
                    </div>
                    <button onClick={() => setShowComments({ ...showComments, [post.id]: !showComments[post.id] })} className="text-sm text-brand-600 hover:text-brand-700">
                      {showComments[post.id] ? "Hide" : `Comments (${comments[post.id]?.length || 0})`}
                    </button>
                  </div>

                  {showComments[post.id] && (
                    <div className="mt-4 space-y-3">
                      {comments[post.id]?.map((comment) => (
                        <Comment key={comment.id} comment={comment} postId={post.id} user={user} token={token} onCommentLike={() => {}} onPinComment={() => {}} onReply={() => {}} />
                      )) || <p className="text-sm text-tx-muted">No comments yet.</p>}
                      <div className="flex gap-2">
                        <input
                          value={commentContent[post.id] || ""}
                          onChange={(e) => setCommentContent({ ...commentContent, [post.id]: e.target.value })}
                          placeholder="Add a comment..."
                          className="input text-sm flex-1"
                        />
                        <Button onClick={() => handleComment(post.id)} size="sm">Post</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <EmptyState title="No posts yet" message={`${profile.username} hasn't posted anything yet.`} icon={<UserIcon className="w-8 h-8 text-tx-muted" />} />
            )}
          </div>
        </>
      ) : (
        <EmptyState title="Profile not found" message="This user doesn't exist or has been removed." />
      )}
    </Layout>
  );
}
