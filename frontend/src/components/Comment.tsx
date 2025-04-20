import { useState } from "react";
import axios from "axios";

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

interface CommentProps {
    comment: Comment;
    postId: number;
    user: any;
    token: string;
    onCommentLike: (commentId: number, postId: number) => void;
    onPinComment: (commentId: number, postId: number) => void;
    onReply: (commentId: number, postId: number, content: string) => void;
}

export default function Comment({ comment, postId, user, token, onCommentLike, onPinComment, onReply }: CommentProps) {
    const [replyContent, setReplyContent] = useState("");
    const [showReplyInput, setShowReplyInput] = useState(false);

    const handleReplySubmit = () => {
        if (replyContent.trim()) {
            onReply(comment.id, postId, replyContent);
            setReplyContent("");
            setShowReplyInput(false);
        }
    };

    return (
        <div className={`p-3 ${comment.pinned ? "bg-yellow-50 border-l-4 border-yellow-400" : "border-l-2 border-gray-200"}`}>
            <div className="flex items-start">
                <div className="flex-1">
                    <p className="font-semibold text-gray-800">{comment.username} {comment.pinned ? <span className="text-xs text-yellow-600">(Pinned)</span> : ""}</p>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    <p className="text-gray-500 text-xs mt-1">{new Date(comment.created_at).toLocaleString()}</p>
                    <div className="flex items-center mt-1 space-x-3">
                        <button
                            onClick={() => onCommentLike(comment.id, postId)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                            👍 {comment.likes || 0}
                        </button>
                        <button
                            onClick={() => setShowReplyInput(!showReplyInput)}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                            Reply
                        </button>
                        {user?.id === comment.post_id && !comment.pinned && (
                            <button
                                onClick={() => onPinComment(comment.id, postId)}
                                className="text-green-600 hover:text-green-800 text-sm"
                            >
                                Pin
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Reply Input */}
            {showReplyInput && (
                <div className="mt-2 ml-4">
                    <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <div className="flex space-x-2 mt-1">
                        <button
                            onClick={handleReplySubmit}
                            className="bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700 transition text-sm"
                        >
                            Reply
                        </button>
                        <button
                            onClick={() => setShowReplyInput(false)}
                            className="bg-gray-300 text-gray-800 px-3 py-1 rounded-lg hover:bg-gray-400 transition text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Replies */}
            {comment.replies?.length > 0 && (
                <div className="ml-6 mt-2 space-y-2">
                    {comment.replies.map((reply) => (
                        <div key={reply.id} className="border-l-2 border-gray-200 pl-3">
                            <p className="font-semibold text-gray-800 text-sm">{reply.username}</p>
                            <p className="text-gray-700 whitespace-pre-wrap text-sm">{reply.content}</p>
                            <p className="text-gray-500 text-xs mt-1">{new Date(reply.created_at).toLocaleString()}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}