import {
    getUserByEmail,
    getPostById,
    getPosts,
    createPost,
    updatePost,
    deletePost,
    incrementPostLikes,
    getCommentsForPost,
    createComment,
    addReply,
    incrementCommentLikes,
    unpinAllComments,
    pinComment,
    sharePost,
    hasUserLikedPost,
    addLike,
    getTotalUserLikes,
    setNewsKingBadge,
} from "../db";
import { query } from "../database";
import { AppError } from "../middleware/errorHandler";

export async function fetchPosts(limit: number, offset: number, excludeRants: boolean = false) {
    return getPosts(limit, offset, excludeRants);
}

export async function createNewPost(email: string, content: string, mode: string) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    await createPost({
        userId: user.id,
        username: user.username,
        content,
        mode,
    });

    return user;
}

export async function editPost(email: string, postId: number, content: string) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");
    if (post.user_id !== user.id) {
        throw new AppError("You can only edit your own posts", 403, "FORBIDDEN");
    }

    await updatePost(postId, content);
    return { message: "Post updated successfully" };
}

export async function deletePostByEmail(email: string, postId: number) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");
    if (post.user_id !== user.id) {
        throw new AppError("You can only delete your own posts", 403, "FORBIDDEN");
    }

    await deletePost(postId);
    return { message: "Post deleted successfully" };
}

export async function likePost(email: string, postId: number) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const alreadyLiked = await hasUserLikedPost(postId, user.id);
    if (alreadyLiked) {
        throw new AppError("Already liked this post", 400, "ALREADY_LIKED");
    }

    await addLike(postId, user.id);

    const totalLikes = await getTotalUserLikes(user.id);
    if (totalLikes >= 100) {
        await setNewsKingBadge(user.id);
    }

    return { message: "Post liked" };
}

export async function reactToPost(email: string, postId: number, reaction: string) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");

    let reactions: Record<string, string[]> = {};
    try {
        reactions = post.reactions ? JSON.parse(post.reactions) : {};
    } catch {
        reactions = {};
    }

    reactions[reaction] = reactions[reaction] || [];
    if (!reactions[reaction].includes(user.username)) {
        reactions[reaction].push(user.username);
    }

    await query(
        "UPDATE posts SET reactions = $1 WHERE id = $2",
        [JSON.stringify(reactions), postId]
    );

    return { message: "Reaction added successfully" };
}

export async function sharePostToSquad(email: string, postId: number, squadId: number) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");

    await sharePost({
        postId,
        userId: user.id,
        squadId,
        content: post.content,
        mode: post.mode,
        mediaUrl: post.media_url,
        mediaType: post.media_type,
    });

    return { message: "Post shared successfully" };
}

export async function getPostComments(postId: number) {
    return getCommentsForPost(postId);
}

export async function addCommentToPost(email: string, postId: number, content: string) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");

    await createComment({ postId, userId: user.id, content });
    return { message: "Comment added successfully" };
}

export async function addReplyToComment(email: string, commentId: number, content: string) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    await addReply({ commentId, userId: user.id, content });
    return { message: "Reply added successfully" };
}

export async function likeComment(email: string, commentId: number) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    await incrementCommentLikes(commentId);
    return { message: "Comment liked successfully" };
}

export async function pinPostComment(email: string, postId: number, commentId: number) {
    const user = await getUserByEmail(email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");
    if (post.user_id !== user.id) {
        throw new AppError("You can only pin comments on your own posts", 403, "FORBIDDEN");
    }

    await unpinAllComments(postId);
    await pinComment(commentId);
    return { message: "Comment pinned successfully" };
}
