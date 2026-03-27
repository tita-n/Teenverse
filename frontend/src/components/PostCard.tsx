import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Edit3, Trash2, Heart, MessageCircle, Share2, Flame, ThumbsUp, Zap, Star, Laugh } from "lucide-react";
import DOMPurify from "dompurify";
import Comment from "./Comment";

const sanitizeContent = (content: string): string => {
    return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'span'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        ALLOW_DATA_ATTR: false,
    });
};

interface Post {
  id: number;
  username: string;
  content: string;
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

interface Squad { id: number; game_name: string; description: string; }
interface User { id?: number; email: string; username?: string; }

interface PostCardProps {
  post: Post; user: User; token: string; comments: CommentType[];
  squads?: Squad[]; reactionsList?: string[];
  onLike: (postId: number) => void;
  onReact: (postId: number, reaction: string) => void;
  onComment: (postId: number) => void;
  onCommentLike: (commentId: number, postId: number) => void;
  onPinComment: (commentId: number, postId: number) => void;
  onReply: (commentId: number, postId: number, content: string) => void;
  onEdit: (postId: number, content: string) => Promise<void>;
  onDelete: (postId: number) => void;
  onShare?: (postId: number, squadId: number) => void;
  index?: number;
  lastRef?: (node: HTMLDivElement | null) => void;
}

const REACTION_EMOJIS: Record<string, { icon: any; color: string; bg: string }> = {
  "🔥": { icon: Flame, color: "text-orange-500", bg: "bg-orange-500/20" },
  "👍": { icon: ThumbsUp, color: "text-blue-500", bg: "bg-blue-500/20" },
  "❤️": { icon: Heart, color: "text-red-500", bg: "bg-red-500/20" },
  "⚡": { icon: Zap, color: "text-yellow-500", bg: "bg-yellow-500/20" },
  "😂": { icon: Laugh, color: "text-neon-cyan", bg: "bg-neon-cyan/20" },
  "💯": { icon: Star, color: "text-neon-gold", bg: "bg-neon-gold/20" },
};

export default function PostCard({
  post, user, token, comments, squads = [], reactionsList = ["🔥", "👍", "❤️", "⚡", "😂", "💯"],
  onLike, onReact, onComment, onCommentLike, onPinComment, onReply, onEdit, onDelete, onShare, index, lastRef
}: PostCardProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);

  const totalReactions = Object.values(post.reactions).reduce((sum, users) => sum + (users?.length || 0), 0);
  const isOwner = user?.username === post.username;
  const COMMENTS_PER_PAGE = 3;
  const [visibleComments, setVisibleComments] = useState(COMMENTS_PER_PAGE);

  const handleSaveEdit = async () => {
    await onEdit(post.id, editContent);
    setIsEditing(false);
  };

  const loadMoreComments = () => setVisibleComments((prev) => prev + COMMENTS_PER_PAGE);

  return (
    <div ref={lastRef} className="card card-hover p-0 overflow-hidden">
      {/* Header with glow accent */}
      <div className="h-1 bg-gradient-to-r from-neon-red via-neon-gold to-neon-cyan" />
      
      <div className="p-4">
        {/* User Row */}
        <div className="flex items-center justify-between mb-3">
          <Link to={`/profile/${post.username}`} className="flex items-center gap-3 group">
            <div className="relative">
              {post.profile_media_url ? (
                <img src={post.profile_media_url} alt="" className="w-12 h-12 rounded-2xl object-cover border-2 border-dark-600 group-hover:border-neon-red transition-colors" />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-red to-red-700 flex items-center justify-center text-white font-bold text-lg shadow-glow-sm">
                  {post.username?.charAt(0).toUpperCase()}
                </div>
              )}
              {post.verified === 1 && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-neon-cyan rounded-full flex items-center justify-center border-2 border-dark-900">
                  ✓
                </div>
              )}
            </div>
            <div>
              <p className="font-bold text-white group-hover:text-neon-red transition-colors">{post.username}</p>
              <p className="text-xs text-dark-400">{new Date(post.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </div>
          </Link>
          
          {isOwner && (
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 rounded-xl hover:bg-dark-700 text-dark-400 hover:text-white transition-colors">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Menu Dropdown */}
        {showMenu && (
          <div className="absolute right-4 top-16 bg-dark-800 border border-dark-600 rounded-xl shadow-lg z-20 overflow-hidden">
            <button onClick={() => { setIsEditing(true); setShowMenu(false); }} className="w-full px-4 py-3 text-left hover:bg-dark-700 flex items-center gap-2 text-sm">
              <Edit3 className="w-4 h-4" /> Edit
            </button>
            <button onClick={() => { onDelete(post.id); setShowMenu(false); }} className="w-full px-4 py-3 text-left hover:bg-red-900/50 text-red-400 flex items-center gap-2 text-sm">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <div className="space-y-3">
            <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="input" autoFocus />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="btn-primary btn-sm">Save</button>
              <button onClick={() => setIsEditing(false)} className="btn-secondary btn-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">{post.content}</p>
        )}

        {/* Media placeholder - extend as needed */}

        {/* Reactions Display */}
        {totalReactions > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {Object.entries(post.reactions).filter(([,users]) => users?.length > 0).map(([reaction, users]) => {
              const config = REACTION_EMOJIS[reaction] || { icon: Flame, color: "text-white", bg: "bg-dark-600" };
              const Icon = config.icon;
              return (
                <div key={reaction} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.bg} ${config.color}`}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-bold">{users?.length || 0}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Action Buttons - Big & Tappable */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-700">
          <div className="flex items-center gap-1">
            {/* Like */}
            <button onClick={() => onLike(post.id)} className="group flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all">
              <Heart className={`w-6 h-6 transition-transform group-active:scale-125 ${post.likes > 0 ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="font-bold text-sm">{post.likes || 0}</span>
            </button>

            {/* React */}
            <div className="relative">
              <button onClick={() => setShowReactions(!showReactions)} className="group flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-neon-gold/10 hover:text-neon-gold transition-all">
                <Flame className="w-6 h-6" />
                <span className="font-bold text-sm">React</span>
              </button>
              {showReactions && (
                <div className="absolute left-0 bottom-full mb-2 bg-dark-800 border border-dark-600 rounded-2xl p-2 z-30 flex gap-1 shadow-glow-lg animate-scale-in">
                  {reactionsList.map((reaction) => {
                    const config = REACTION_EMOJIS[reaction] || { icon: Flame, color: "text-white", bg: "bg-dark-600" };
                    const Icon = config.icon;
                    return (
                      <button
                        key={reaction}
                        onClick={() => { onReact(post.id, reaction); setShowReactions(false); }}
                        className="w-12 h-12 flex items-center justify-center rounded-xl hover:bg-dark-700 transition-all hover:scale-110 text-xl"
                      >
                        {reaction}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comments */}
            <button onClick={() => setShowComments(!showComments)} className="group flex items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-neon-cyan/10 hover:text-neon-cyan transition-all">
              <MessageCircle className="w-6 h-6" />
              <span className="font-bold text-sm">{comments.length || 0}</span>
            </button>
          </div>

          {/* Share */}
          {onShare && squads.length > 0 && (
            <button onClick={() => {const id = prompt("Squad ID"); if(id) onShare(post.id, parseInt(id));}} className="p-3 rounded-xl hover:bg-dark-700 text-dark-400 hover:text-white transition-all">
              <Share2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-dark-700">
            {comments.slice(0, visibleComments).map((comment) => (
              <Comment key={comment.id} comment={comment} postId={post.id} user={user} token={token} onLike={onCommentLike} onPin={onPinComment} onReply={onReply} />
            ))}
            {comments.length > visibleComments && (
              <button onClick={loadMoreComments} className="text-neon-cyan text-sm font-bold mt-2">
                Load more 💬
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}