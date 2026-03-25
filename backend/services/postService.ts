import { db } from "../database";
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
    getUserById,
} from "../db";
import { AppError } from "../middleware/errorHandler";

export async function fetchPosts(limit: number, offset: number, excludeRants: boolean = false) {
    return getPosts(db, limit, offset, excludeRants);
}

export async function createNewPost(email: string, content: string, mode: string) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    await createPost(db, {
        userId: user.id,
        username: user.username,
        content,
        mode,
    });

    return user;
}

export async function editPost(email: string, postId: number, content: string) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(db, postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");
    if (post.user_id !== user.id) {
        throw new AppError("You can only edit your own posts", 403, "FORBIDDEN");
    }

    await updatePost(db, postId, content);
    return { message: "Post updated successfully" };
}

export async function deletePostByEmail(email: string, postId: number) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(db, postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");
    if (post.user_id !== user.id) {
        throw new AppError("You can only delete your own posts", 403, "FORBIDDEN");
    }

    await deletePost(db, postId);
    return { message: "Post deleted successfully" };
}

export async function likePost(email: string, postId: number) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const alreadyLiked = await hasUserLikedPost(db, postId, user.id);
    if (alreadyLiked) {
        throw new AppError("Already liked this post", 400, "ALREADY_LIKED");
    }

    await addLike(db, postId, user.id);

    // Check for news_king badge
    const totalLikes = await getTotalUserLikes(db, user.id);
    if (totalLikes >= 100) {
        await setNewsKingBadge(db, user.id);
    }

    return { message: "Post liked" };
}

export async function reactToPost(email: string, postId: number, reaction: string) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(db, postId);
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

    await db.run(
        "UPDATE posts SET reactions = ? WHERE id = ?",
        [JSON.stringify(reactions), postId],
        (err) => {
            if (err) throw err;
        }
    );

    return { message: "Reaction added successfully" };
}

export async function sharePostToSquad(email: string, postId: number, squadId: number) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(db, postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");

    await sharePost(db, {
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
    return getCommentsForPost(db, postId);
}

export async function addCommentToPost(email: string, postId: number, content: string) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(db, postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");

    await createComment(db, { postId, userId: user.id, content });
    return { message: "Comment added successfully" };
}

export async function addReplyToComment(email: string, commentId: number, content: string) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    await addReply(db, { commentId, userId: user.id, content });
    return { message: "Reply added successfully" };
}

export async function likeComment(email: string, commentId: number) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    await incrementCommentLikes(db, commentId);
    return { message: "Comment liked successfully" };
}

export async function pinPostComment(email: string, postId: number, commentId: number) {
    const user = await getUserByEmail(db, email);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");

    const post = await getPostById(db, postId);
    if (!post) throw new AppError("Post not found", 404, "POST_NOT_FOUND");
    if (post.user_id !== user.id) {
        throw new AppError("You can only pin comments on your own posts", 403, "FORBIDDEN");
    }

    await unpinAllComments(db, postId);
    await pinComment(db, commentId);
    return { message: "Comment pinned successfully" };
}
