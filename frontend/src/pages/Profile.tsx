import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

interface UserProfile {
    username: string;
    verified: number;
}

export default function Profile() {
    const { username } = useParams<{ username: string }>();
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        console.log("useEffect running, username:", username);
        const mockResponse = {
            user: {
                username: "titan",
                verified: 0,
            },
        };
        setProfile(mockResponse.user);
        console.log("Profile set to:", mockResponse.user);
    }, [username]);

    useEffect(() => {
        console.log("Profile state updated:", profile);
    }, [profile]);

    return (
        <div style={{ backgroundColor: "lightblue", minHeight: "100vh", padding: "20px" }}>
            {profile ? (
                <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "black" }}>
                    {profile.username}'s Profile
                </h1>
            ) : (
                <p style={{ color: "gray", textAlign: "center", fontSize: "18px" }}>
                    Loading profile...
                </p>
            )}
        </div>
    );
}