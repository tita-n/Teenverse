import { useState, useEffect } from "react";
import axios from "axios";
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

export default function Comment({ comment, postId, user, token, onCommentLike, onPinComment, onReply }: CommentProps) {
    const [replyContent, setReplyContent] = useState("");
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [commentVerified, setCommentVerified] = useState<number | undefined>(comment.verified);
    const [repliesVerified, setRepliesVerified] = useState<{ [replyId: number]: number }>({});
    const [commentProfileMedia, setCommentProfileMedia] = useState<{
        url?: string;
        type?: string;
    }>({ url: comment.profile_media_url, type: comment.profile_media_type });
    const [repliesProfileMedia, setRepliesProfileMedia] = useState<{
        [replyId: number]: { url?: string; type?: string };
    }>({});

    const fetchUserProfile = async (username: string) => {
        try {
            const res = await axios.get(`/api/users/profile/${username}`);
            return {
                verified: res.data.user.verified || 0,
                profile_media_url: res.data.user.profile_media_url,
                profile_media_type: res.data.user.profile_media_type,
            };
        } catch (err) {
            console.error("Error fetching user profile:", err);
            return { verified: 0, profile_media_url: undefined, profile_media_type: undefined };
        }
    };

    useEffect(() => {
        const updateProfileData = async () => {
            try {
                // Fetch profile data for the comment
                const commentData = await fetchUserProfile(comment.username);
                setCommentVerified(commentData.verified);
                setCommentProfileMedia({
                    url: commentData.profile_media_url,
                    type: commentData.profile_media_type,
                });

                // Fetch profile data for each reply
                const verifiedStatuses: { [replyId: number]: number } = {};
                const profileMediaData: { [replyId: number]: { url?: string; type?: string } } = {};
                for (const reply of comment.replies) {
                    const replyData = await fetchUserProfile(reply.username);
                    verifiedStatuses[reply.id] = replyData.verified;
                    profileMediaData[reply.id] = {
                        url: replyData.profile_media_url,
                        type: replyData.profile_media_type,
                    };
                }
                setRepliesVerified(verifiedStatuses);
                setRepliesProfileMedia(profileMediaData);
            } catch (err) {
                console.error("Error updating profile data:", err);
            }
        };

        updateProfileData();
    }, [comment]);

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
                    <Link to={`/profile/${comment.username}`} className="flex items-center">
                        {commentProfileMedia.url && (
                            commentProfileMedia.type === "video" ? (
                                <video
                                    src={commentProfileMedia.url}
                                    autoPlay
                                    muted
                                    loop
                                    className="w-6 h-6 rounded-full object-cover mr-2"
                                />
                            ) : (
                                <img
                                    src={commentProfileMedia.url}
                                    alt="Profile"
                                    className="w-6 h-6 rounded-full object-cover mr-2"
                                />
                            )
                        )}
                        <p className="font-semibold text-gray-800 inline">
                            {comment.username}{" "}
                            {commentVerified ? (
                                <span className="inline-block bg-black text-white rounded-full h-5 w-5 text-center leading-5 text-xs">
                                    ✓
                                </span>
                            ) : null}
                            {comment.pinned ? <span className="text-xs text-yellow-600"> (Pinned)</span> : ""}
                        </p>
                    </Link>
                    <p className="text-gray-700 whitespace-pre-wrap">{sanitizeContent(comment.content)}</p>
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
                        {user?.id === comment.user_id && !comment.pinned && (
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

            {comment.replies?.length > 0 && (
                <div className="ml-6 mt-2 space-y-2">
                    {comment.replies.map((reply) => (
                        <div key={reply.id} className="border-l-2 border-gray-200 pl-3">
                            <Link to={`/profile/${reply.username}`} className="flex items-center">
                                {repliesProfileMedia[reply.id]?.url && (
                                    repliesProfileMedia[reply.id].type === "video" ? (
                                        <video
                                            src={repliesProfileMedia[reply.id].url}
                                            autoPlay
                                            muted
                                            loop
                                            className="w-6 h-6 rounded-full object-cover mr-2"
                                        />
                                    ) : (
                                        <img
                                            src={repliesProfileMedia[reply.id].url}
                                            alt="Profile"
                                            className="w-6 h-6 rounded-full object-cover mr-2"
                                        />
                                    )
                                )}
                                <p className="font-semibold text-gray-800 text-sm inline">
                                    {reply.username}{" "}
                                    {repliesVerified[reply.id] ? (
                                        <span className="inline-block bg-black text-white rounded-full h-5 w-5 text-center leading-5 text-xs">
                                            ✓
                                        </span>
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
