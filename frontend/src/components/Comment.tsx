import { memo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import DOMPurify from "dompurify";

const sanitizeContent = (content: string): string => {
    return DOMPurify.sanitize(content, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
};

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
    verified?: number;
    profile_media_url?: string;
    profile_media_type?: string;
}

interface Reply {
    id: number;
    comment_id: number;
    user_id: number;
    username: string;
    content: string;
    created_at: string;
    verified?: number;
    profile_media_url?: string;
    profile_media_type?: string;
}

interface CommentProps {
    comment: Comment;
    postId: number;
    user: any;
    token: string;
    onCommentLike: (commentId: number, postId: number) => void;
    onPinComment: (commentId: number, postId: number) => void;
    onReply: (commentId: number, postId: number, content: string) => void;
}

function ProfileAvatar({ url, type, name }: { url?: string; type?: string; name: string }) {
    if (url && type === "video") {
        return (
            <video
                src={url}
                autoPlay
                muted
                loop
                width={24}
                height={24}
                className="w-6 h-6 rounded-full object-cover mr-2 flex-shrink-0"
                aria-hidden="true"
            />
        );
    }
    if (url && type === "image") {
        return (
            <img
                src={url}
                alt=""
                width={24}
                height={24}
                loading="lazy"
                decoding="async"
                className="w-6 h-6 rounded-full object-cover mr-2 flex-shrink-0"
            />
        );
    }
    return (
        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600 mr-2 flex-shrink-0">
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

function Comment({ comment, postId, user, onCommentLike, onPinComment, onReply }: CommentProps) {
    const [replyContent, setReplyContent] = useState("");
    const [showReplyInput, setShowReplyInput] = useState(false);

    const handleReplySubmit = useCallback(() => {
        if (replyContent.trim()) {
            onReply(comment.id, postId, replyContent);
            setReplyContent("");
            setShowReplyInput(false);
        }
    }, [replyContent, comment.id, postId, onReply]);

    const toggleReplyInput = useCallback(() => {
        setShowReplyInput((prev) => !prev);
    }, []);

    const cancelReply = useCallback(() => {
        setShowReplyInput(false);
        setReplyContent("");
    }, []);

    return (
        <div className={`p-3 ${comment.pinned ? "bg-yellow-50 border-l-4 border-yellow-400" : "border-l-2 border-gray-200"}`}>
            <div className="flex items-start">
                <div className="flex-1">
                    <Link to={`/profile/${comment.username}`} className="flex items-center gap-1">
                        <ProfileAvatar
                            url={comment.profile_media_url}
                            type={comment.profile_media_type}
                            name={comment.username}
                        />
                        <p className="font-semibold text-gray-800 inline text-sm">
                            {comment.username}
                            {comment.verified ? (
                                <span className="inline-block bg-black text-white rounded-full h-4 w-4 text-center leading-4 text-[10px] ml-1 align-middle">✓</span>
                            ) : null}
                            {comment.pinned ? <span className="text-xs text-yellow-600 ml-1">(Pinned)</span> : ""}
                        </p>
                    </Link>
                    <p className="text-gray-700 whitespace-pre-wrap text-sm mt-1">{sanitizeContent(comment.content)}</p>
                    <p className="text-gray-500 text-xs mt-1">{new Date(comment.created_at).toLocaleString()}</p>
                    <div className="flex items-center mt-1 space-x-3">
                        <button
                            onClick={() => onCommentLike(comment.id, postId)}
                            className="text-blue-600 hover:text-blue-800 text-xs"
                        >
                            👍 {comment.likes || 0}
                        </button>
                        <button
                            onClick={toggleReplyInput}
                            className="text-gray-600 hover:text-gray-800 text-xs"
                        >
                            Reply
                        </button>
                        {user?.id === comment.user_id && !comment.pinned && (
                            <button
                                onClick={() => onPinComment(comment.id, postId)}
                                className="text-green-600 hover:text-green-800 text-xs"
                            >
                                Pin
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showReplyInput && (
                <div className="mt-2 ml-4">
                    <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        rows={2}
                    />
                    <div className="flex space-x-2 mt-1">
                        <button onClick={handleReplySubmit} className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition text-sm">
                            Reply
                        </button>
                        <button onClick={cancelReply} className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-400 transition text-sm">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {comment.replies?.length > 0 && (
                <div className="ml-6 mt-2 space-y-2">
                    {comment.replies.map((reply) => (
                        <div key={reply.id} className="border-l-2 border-gray-200 pl-3">
                            <Link to={`/profile/${reply.username}`} className="flex items-center gap-1">
                                <ProfileAvatar
                                    url={reply.profile_media_url}
                                    type={reply.profile_media_type}
                                    name={reply.username}
                                />
                                <p className="font-semibold text-gray-800 text-sm inline">
                                    {reply.username}
                                    {reply.verified ? (
                                        <span className="inline-block bg-black text-white rounded-full h-4 w-4 text-center leading-4 text-[10px] ml-1 align-middle">✓</span>
                                    ) : null}
                                </p>
                            </Link>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{sanitizeContent(reply.content)}</p>
                            <p className="text-gray-500 text-xs mt-1">{new Date(reply.created_at).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default memo(Comment);
