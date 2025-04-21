import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Navigation from "../components/Navigation";

interface UserProfile {
    username: string;
    verified: number;
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

export default function Profile() {
    const { username } = useParams<{ username: string }>();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);

    useEffect(() => {
        // Hardcode the API response to test rendering
        const mockResponse = {
            user: {
                username: "titan",
                verified: 0,
            },
            posts: [
                {
                    id: 1,
                    user_id: 1,
                    username: "titan",
                    content: "Hi",
                    mode: "main",
                    likes: 0,
                    created_at: "2025-04-21 00:10:52",
                    reactions: "{}",
                },
            ],
        };

        const userData = mockResponse.user;
        setProfile(userData);

        const fetchedPosts = mockResponse.posts;
        setPosts(
            fetchedPosts.map((post: Post) => ({
                ...post,
                reactions: post.reactions && typeof post.reactions === "string"
                    ? JSON.parse(post.reactions)
                    : {},
            }))
        );
    }, [username]);

    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
                <div className="max-w-2xl mx-auto">
                    {profile ? (
                        <>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-4">
                                {profile.username}'s Profile{" "}
                                {profile.verified ? (
                                    <span className="inline-block bg-black text-white rounded-full h-5 w-5 text-center leading-5 text-xs">
                                        ✓
                                    </span>
                                ) : null}
                            </h1>
                            <div className="space-y-6">
                                {posts.length > 0 ? (
                                    posts.map((post) => (
                                        <div key={post.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                                            <p className="text-gray-700 whitespace-pre-wrap">{post.content}</p>
                                            <p className="text-gray-500 text-sm mt-1">
                                                {new Date(post.created_at).toLocaleString()}
                                            </p>
                                            <div className="flex items-center justify-between mt-3 border-t pt-2">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-blue-600">👍 {post.likes || 0}</span>
                                                    <div className="flex items-center space-x-1">
                                                        {Object.entries(post.reactions || {}).map(
                                                            ([reaction, users]: [string, string[]]) => (
                                                                users.length > 0 ? (
                                                                    <span key={reaction} className="text-sm text-gray-600">
                                                                        {reaction}: {users.length}
                                                                    </span>
                                                                ) : null
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-600 text-center">No posts yet.</p>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-gray-600 text-center text-lg">Loading profile...</p>
                    )}
                </div>
            </div>
        </div>
    );
}