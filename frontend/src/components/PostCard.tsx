import { useState } from "react";
import { Link } from "react-router-dom";
import { MoreHorizontal, Edit3, Trash2, Heart, MessageCircle, Share2, SmilePlus } from "lucide-react";
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
  mode?: string;
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

interface User {
  id: number;
  email: string;
  username?: string;
}

interface PostCardProps {
  post: Post;
  user: User;
  token: string;
  comments: CommentType[];
  squads?: Squad[];
  reactionsList?: string[];
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

const DEFAULT_REACTIONS = ["Deadass", "Big Mood", "Mid", "Facts", "Cap", "Slay", "No Cap", "Vibes", "Bet", "L", "W"];

export default function PostCard({
  post,
  user,
  token,
  comments,
  squads = [],
  reactionsList = DEFAULT_REACTIONS,
  onLike,
  onReact,
  onComment,
  onCommentLike,
  onPinComment,
  onReply,
  onEdit,
  onDelete,
  onShare,
  index,
  lastRef,
}: PostCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [commentContent, setCommentContent] = useState("");
  const [visibleComments, setVisibleComments] = useState(3);

  const isOwner = post.user_id === user?.id;
  const COMMENTS_PER_PAGE = 3;

  const handleSaveEdit = async () => {
    await onEdit(post.id, editContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(post.content);
    setIsEditing(false);
  };

  const handleSubmitComment = () => {
    if (commentContent.trim()) {
      onComment(post.id);
      setCommentContent("");
    }
  };

  const loadMoreComments = () => {
    setVisibleComments((prev) => prev + COMMENTS_PER_PAGE);
  };

  return (
    <div
      ref={lastRef}
      className="card p-4 sm:p-6 animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Link to={`/profile/${post.username}`} className="flex items-center gap-2 group">
            {post.profile_media_url && post.profile_media_type === "image" ? (
              <img
                src={post.profile_media_url}
                alt={post.username}
                className="w-10 h-10 rounded-full object-cover border border-surface-border"
              />
            ) : post.profile_media_url && post.profile_media_type === "video" ? (
              <video
                src={post.profile_media_url}
                autoPlay
                muted
                loop
                className="w-10 h-10 rounded-full object-cover border border-surface-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
                {post.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold text-tx-primary group-hover:text-brand-600 transition-colors inline-flex items-center gap-1.5">
                {post.username}
                {post.verified ? (
                  <span className="badge badge-brand w-5 h-5 flex items-center justify-center p-0 rounded-full text-xs">
                    ✓
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-tx-muted">
                {new Date(post.created_at).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </Link>
        </div>

        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="btn-ghost btn-sm p-1.5 rounded-full"
              aria-label="Post options"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-surface-border rounded-lg shadow-lg py-1 z-20 min-w-[120px]">
                <button
                  onClick={() => {
                    setIsEditing(true);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-tx-primary hover:bg-surface-muted transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => {
                    onDelete(post.id);
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-3">
        {isEditing ? (
          <div className="space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="input min-h-[100px]"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="btn-success btn-sm">
                Save
              </button>
              <button onClick={handleCancelEdit} className="btn-secondary btn-sm">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p 
            className="text-tx-primary whitespace-pre-wrap leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeContent(post.content) }}
          />
        )}
      </div>

      {/* Reactions Bar */}
      {Object.values(post.reactions).some((users) => users.length > 0) && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {Object.entries(post.reactions).map(
            ([reaction, users]) =>
              users.length > 0 && (
                <span key={reaction} className="badge badge-neutral text-xs">
                  {reaction} {users.length}
                </span>
              )
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-border">
        <div className="flex items-center gap-1">
          {/* Like */}
          <button
            onClick={() => onLike(post.id)}
            className="btn-ghost btn-sm flex items-center gap-1.5 text-tx-secondary hover:text-blue-600"
          >
            <Heart className="w-4 h-4" />
            <span className="text-sm">{post.likes || 0}</span>
          </button>

          {/* React */}
          <div className="relative">
            <button
              onClick={() => setShowReactions(!showReactions)}
              className="btn-ghost btn-sm flex items-center gap-1.5 text-tx-secondary hover:text-yellow-600"
            >
              <SmilePlus className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">React</span>
            </button>
            {showReactions && (
              <div className="absolute left-0 bottom-full mb-2 bg-white border border-surface-border rounded-xl shadow-lg p-3 z-20 flex flex-wrap gap-1.5 max-w-xs">
                {reactionsList.map((reaction) => (
                  <button
                    key={reaction}
                    onClick={() => {
                      onReact(post.id, reaction);
                      setShowReactions(false);
                    }}
                    className="px-2.5 py-1 text-xs bg-surface-muted rounded-lg hover:bg-brand-100 hover:text-brand-700 transition-colors"
                  >
                    {reaction}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Comments Toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="btn-ghost btn-sm flex items-center gap-1.5 text-tx-secondary hover:text-brand-600"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="text-sm">{comments.length || 0}</span>
          </button>
        </div>

        {/* Share to Squad */}
        {onShare && squads.length > 0 && (
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-tx-muted" />
            <select
              onChange={(e) => {
                if (e.target.value) {
                  onShare(post.id, parseInt(e.target.value));
                  e.target.value = "";
                }
              }}
              className="text-xs border border-surface-border rounded-lg px-2 py-1 text-tx-secondary bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-500"
              defaultValue=""
              aria-label="Share to squad"
            >
              <option value="" disabled>
                Share to Squad
              </option>
              {squads.map((squad) => (
                <option key={squad.id} value={squad.id}>
                  {squad.game_name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="mt-4 space-y-3 animate-fade-in">
          {comments.length > 0 ? (
            <>
              {comments
                .sort((a, b) => b.pinned - a.pinned)
                .slice(0, visibleComments)
                .map((comment) => (
                  <Comment
                    key={comment.id}
                    comment={comment}
                    postId={post.id}
                    user={user}
                    token={token}
                    onCommentLike={onCommentLike}
                    onPinComment={onPinComment}
                    onReply={onReply}
                  />
                ))}
              {comments.length > visibleComments && (
                <button
                  onClick={loadMoreComments}
                  className="text-sm text-brand-600 hover:text-brand-700 font-medium"
                >
                  View {Math.min(COMMENTS_PER_PAGE, comments.length - visibleComments)} more comments
                </button>
              )}
            </>
          ) : (
            <p className="text-sm text-tx-muted text-center py-4">No comments yet. Be the first!</p>
          )}

          {/* Comment Input */}
          <div className="flex gap-2">
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Add a comment..."
              className="input text-sm flex-1 min-h-[40px] resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmitComment();
                }
              }}
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentContent.trim()}
              className="btn-primary btn-sm self-end"
            >
              Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
