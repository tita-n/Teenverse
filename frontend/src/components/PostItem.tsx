import { memo, useState } from "react";
import { Link } from "react-router-dom";
import Comment from "./Comment";

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
    media_url?: string;
    media_type?: string;
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

interface PostItemProps {
    post: Post;
    user: User;
    token: string;
    comments: CommentType[];
    commentContent: string;
    showComments: boolean;
    visibleComments: number;
    showReactions: boolean;
    editingPost: boolean;
    editContent: string;
    showMenu: boolean;
    squads: Squad[];
    onLike: (postId: number) => void;
    onReact: (postId: number, reaction: string) => void;
    onComment: (postId: number) => void;
    onReply: (commentId: number, postId: number, content: string) => void;
    onCommentLike: (commentId: number, postId: number) => void;
    onPinComment: (commentId: number, postId: number) => void;
    onEdit: (postId: number) => void;
    onDelete: (postId: number) => void;
    onShare: (postId: number, squadId: number) => void;
    onStartEditing: (post: Post) => void;
    onToggleComments: (postId: number) => void;
    onLoadMoreComments: (postId: number) => void;
    onSetShowReactions: (postId: number | null) => void;
    onSetShowMenu: (postId: number | null) => void;
    onSetEditingPost: (postId: number | null) => void;
    onSetEditContent: (content: string) => void;
    onSetCommentContent: (postId: number, content: string) => void;
}

const reactionsList = ["Deadass", "Big Mood", "Mid", "Facts", "Cap", "Slay", "No Cap", "Vibes", "Bet", "L", "W"];

function PostItem({
    post,
    user,
    token,
    comments,
    commentContent,
    showComments,
    visibleComments,
    showReactions,
    editingPost,
    editContent,
    showMenu,
    squads,
    onLike,
    onReact,
    onComment,
    onReply,
    onCommentLike,
    onPinComment,
    onEdit,
    onDelete,
    onShare,
    onStartEditing,
    onToggleComments,
    onLoadMoreComments,
    onSetShowReactions,
    onSetShowMenu,
    onSetEditingPost,
    onSetEditContent,
    onSetCommentContent,
}: PostItemProps) {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <Link to={`/profile/${post.username}`}>
                        <p className="font-semibold text-gray-800 inline">
                            {post.username}{" "}
                            {post.verified ? (
                                <span className="inline-block bg-black text-white rounded-full h-5 w-5 text-center leading-5 text-xs">
                                    ✓
                                </span>
                            ) : null}
                        </p>
                    </Link>
                    {editingPost ? (
                        <div className="mt-2">
                            <textarea
                                value={editContent}
                                onChange={(e) => onSetEditContent(e.target.value)}
                                className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                            />
                            <div className="flex space-x-2">
                                <button
                                    onClick={() => onEdit(post.id)}
                                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                                >
                                    Save
                                </button>
                                <button
                                    onClick={() => onSetEditingPost(null)}
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-400 transition"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <p className="text-gray-700 whitespace-pre-wrap mt-1">{post.content}</p>
                            <p className="text-gray-500 text-sm mt-1">
                                {new Date(post.created_at).toLocaleString()}
                            </p>
                        </>
                    )}
                </div>
                {post.user_id === user.id && (
                    <div className="relative">
                        <button
                            onClick={() => onSetShowMenu(showMenu ? null : post.id)}
                            className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                            ...
                        </button>
                        {showMenu && (
                            <div className="absolute right-0 mt-2 bg-white border rounded-lg shadow-lg p-2 z-10">
                                <button
                                    onClick={() => onStartEditing(post)}
                                    className="block text-gray-800 px-2 py-1 hover:bg-gray-100"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => onDelete(post.id)}
                                    className="block text-red-600 px-2 py-1 hover:bg-gray-100"
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between mt-3 border-t pt-2">
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => onLike(post.id)}
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                    >
                        👍 {post.likes || 0}
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => onSetShowReactions(showReactions ? null : post.id)}
                            className="text-yellow-600 hover:text-yellow-800 flex items-center"
                        >
                            😊 React
                        </button>
                        {showReactions && (
                            <div className="absolute left-0 mt-2 bg-white border rounded-lg shadow-lg p-2 flex flex-wrap gap-1 z-10 max-w-xs">
                                {reactionsList.map((reaction) => (
                                    <button
                                        key={reaction}
                                        onClick={() => onReact(post.id, reaction)}
                                        className="bg-gray-100 text-gray-800 px-2 py-1 rounded-lg hover:bg-gray-200 transition text-sm"
                                    >
                                        {reaction}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-1 flex-wrap">
                        {Object.entries(post.reactions || {}).map(
                            ([reaction, users]: [string, string[]]) =>
                                users.length > 0 && (
                                    <span key={reaction} className="text-sm text-gray-600">
                                        {reaction}: {users.length}
                                    </span>
                                )
                        )}
                    </div>
                </div>
                <button
                    onClick={() => onToggleComments(post.id)}
                    className="text-indigo-600 hover:text-indigo-800 text-sm"
                >
                    {showComments
                        ? "Hide comments"
                        : `View comments (${comments?.length || 0})`}
                </button>
            </div>

            {showComments && (
                <div className="mt-4">
                    {comments?.length > 0 ? (
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
                                    onClick={() => onLoadMoreComments(post.id)}
                                    className="text-indigo-600 hover:text-indigo-800 text-sm mt-2"
                                >
                                    View more comments
                                </button>
                            )}
                        </>
                    ) : (
                        <p className="text-gray-600 text-sm">No comments yet.</p>
                    )}

                    <div className="mt-4">
                        <textarea
                            value={commentContent || ""}
                            onChange={(e) => onSetCommentContent(post.id, e.target.value)}
                            placeholder="Add a comment..."
                            className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        <button
                            onClick={() => onComment(post.id)}
                            className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 py-2 rounded-lg hover:from-indigo-700 hover:to-indigo-800 transition mt-2"
                        >
                            Comment
                        </button>
                    </div>
                </div>
            )}

            <div className="mt-3">
                <select
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) onShare(post.id, val);
                        e.target.value = "";
                    }}
                    className="border rounded-lg p-1 text-sm text-gray-600"
                    defaultValue=""
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
        </div>
    );
}

export default memo(PostItem, (prev, next) => {
    return (
        prev.post.id === next.post.id &&
        prev.post.content === next.post.content &&
        prev.post.likes === next.post.likes &&
        JSON.stringify(prev.post.reactions) === JSON.stringify(next.post.reactions) &&
        prev.comments?.length === next.comments?.length &&
        prev.commentContent === next.commentContent &&
        prev.showComments === next.showComments &&
        prev.visibleComments === next.visibleComments &&
        prev.showReactions === next.showReactions &&
        prev.editingPost === next.editingPost &&
        prev.editContent === next.editContent &&
        prev.showMenu === next.showMenu
    );
});
