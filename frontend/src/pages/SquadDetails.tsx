import { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

export default function SquadDetails() {
    const { squadId } = useParams<{ squadId: string }>();
    const navigate = useNavigate();
    const { user, token } = useAuth();
    const [clips, setClips] = useState<any[]>([]);
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [matchTime, setMatchTime] = useState("");
    const [matchDescription, setMatchDescription] = useState("");
    const [clipFile, setClipFile] = useState<File | null>(null); // For the video file
    const [clipPreview, setClipPreview] = useState<string | null>(null); // For previewing the video
    const [clipDescription, setClipDescription] = useState("");
    const [message, setMessage] = useState("");
    const [isMember, setIsMember] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    console.log("SquadDetails - Initial render - user:", user, "token:", token);

    useEffect(() => {
        console.log("SquadDetails: useEffect triggered", { user, token, squadId });

        const checkMembership = async () => {
            if (!user || !token || !squadId) {
                console.log("SquadDetails: Missing user, token, or squadId", { user, token, squadId });
                setError("Missing authentication or squad ID.");
                return;
            }
            try {
                console.log("SquadDetails: Fetching user data...");
                const userRes: any = await axios.get("https://teenverse.onrender.com/api/users/me", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log("SquadDetails: User data fetched", userRes.data);
                const userId = userRes.data.id;

                console.log("SquadDetails: Checking membership for squad", squadId);
                const isMemberRes: any = await axios.get(`https://teenverse.onrender.com/api/squad-messages/${squadId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log("SquadDetails: Membership check response", isMemberRes);

                if (isMemberRes.status === 200) {
                    setIsMember(true);
                    setMessages(isMemberRes.data);
                    console.log("SquadDetails: User is a member, messages set", isMemberRes.data);
                }
            } catch (err) {
                console.error("SquadDetails: Error checking membership", err);
                setMessage("You must be a member of this squad to access this page.");
                setError("Failed to verify membership: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchClips = async () => {
            if (!user || !token || !squadId) {
                console.log("SquadDetails: Missing user, token, or squadId for clips", { user, token, squadId });
                return;
            }
            try {
                console.log("SquadDetails: Fetching clips for squad", squadId);
                const res = await axios.get(`https://teenverse.onrender.com/api/game-clips/${squadId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log("SquadDetails: Clips fetched", res.data);
                setClips(res.data);
            } catch (err) {
                console.error("SquadDetails: Error fetching clips", err);
                setMessage("Error fetching clips: " + (err.response?.data?.message || err.message));
                setError("Failed to fetch clips: " + (err.response?.data?.message || err.message));
            }
        };

        const fetchData = async () => {
            setLoading(true);
            console.log("SquadDetails: Starting data fetch...");
            await Promise.all([checkMembership(), fetchClips()]);
            setLoading(false);
            console.log("SquadDetails: Data fetch complete", { isMember, clips, messages });
        };

        if (user && token && squadId) {
            fetchData();
            const interval = setInterval(checkMembership, 5000);
            return () => clearInterval(interval);
        } else {
            setLoading(false);
            setError("User, token, or squad ID is missing.");
            console.log("SquadDetails: Skipping fetchData due to missing user, token, or squadId");
        }
    }, [user, token, squadId]);

    // Clean up the preview URL when the component unmounts or a new file is selected
    useEffect(() => {
        return () => {
            if (clipPreview) {
                URL.revokeObjectURL(clipPreview);
            }
        };
    }, [clipPreview]);

    const handleSendMessage = async () => {
        if (!user || !token || !squadId) {
            setMessage("Please log in to send a message.");
            return;
        }
        if (!newMessage) {
            setMessage("Please enter a message.");
            return;
        }
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/squad-messages", {
                email: user.email,
                squadId: parseInt(squadId),
                message: newMessage
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setNewMessage("");
            const messagesRes = await axios.get(`https://teenverse.onrender.com/api/squad-messages/${squadId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(messagesRes.data);
        } catch (err) {
            setMessage("Error sending message: " + (err.response?.data?.message || err.message));
        }
    };

    const handleScheduleMatch = async () => {
        if (!user || !token || !squadId) {
            setMessage("Please log in to schedule a match.");
            return;
        }
        if (!matchTime || !matchDescription) {
            setMessage("Please provide a match time and description.");
            return;
        }
        const message = `🎮 Match Scheduled: ${matchDescription} at ${matchTime}`;
        try {
            const res = await axios.post("https://teenverse.onrender.com/api/squad-messages", {
                email: user.email,
                squadId: parseInt(squadId),
                message
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessage(res.data.message);
            setMatchTime("");
            setMatchDescription("");
            const messagesRes = await axios.get(`https://teenverse.onrender.com/api/squad-messages/${squadId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(messagesRes.data);
        } catch (err) {
            setMessage("Error scheduling match: " + (err.response?.data?.message || err.message));
        }
    };

    const handleUploadClip = async () => {
        if (!user || !token || !squadId) {
            setMessage("Please log in to upload a clip.");
            return;
        }
        if (!clipFile || !clipDescription) {
            setMessage("Please select a video file and provide a description.");
            return;
        }

        const formData = new FormData();
        formData.append("clip", clipFile);
        formData.append("email", user.email);
        formData.append("squadId", squadId);
        formData.append("description", clipDescription);

        try {
            const res = await axios.post("https://teenverse.onrender.com/api/game-clips", formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "multipart/form-data",
                },
            });
            setMessage(res.data.message);
            setClipFile(null);
            setClipDescription("");
            if (clipPreview) {
                URL.revokeObjectURL(clipPreview); // Clean up preview URL
                setClipPreview(null);
            }
            const clipsRes = await axios.get(`https://teenverse.onrender.com/api/game-clips/${squadId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setClips(clipsRes.data);
        } catch (err) {
            setMessage("Error uploading clip: " + (err.response?.data?.message || err.message));
        }
    };

    // Handle file selection and create a preview URL
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files ? e.target.files[0] : null;
        setClipFile(file);
        if (clipPreview) {
            URL.revokeObjectURL(clipPreview); // Clean up previous preview
        }
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setClipPreview(previewUrl);
        } else {
            setClipPreview(null);
        }
    };

    console.log("SquadDetails: Rendering with state", { user, token, squadId, loading, isMember, error });

    if (!user || !token) {
        console.log("SquadDetails: Rendering login required message");
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Please log in to access this squad.</div>
            </div>
        );
    }

    if (loading) {
        console.log("SquadDetails: Rendering loading state");
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-800 text-xl">Loading...</div>
            </div>
        );
    }

    if (error) {
        console.log("SquadDetails: Rendering error state", error);
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <p className="text-red-500 text-xl mb-4">{error}</p>
                    <button
                        onClick={() => navigate("/game-squad")}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Back to Game Squad
                    </button>
                </div>
            </div>
        );
    }

    if (!isMember) {
        console.log("SquadDetails: Rendering non-member message", message);
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <p className="text-red-500 text-xl mb-4">{message || "You must be a member of this squad to access this page."}</p>
                    <button
                        onClick={() => navigate("/game-squad")}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Back to Game Squad
                    </button>
                </div>
            </div>
        );
    }

    console.log("SquadDetails: Rendering main content", { clips, messages });
    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-100 p-6">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-800">Squad Details</h1>
                        <button
                            onClick={() => navigate("/game-squad")}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            Back to Game Squad
                        </button>
                    </div>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Squad Chat</h2>
                        <p className="text-gray-600 mb-4">
                            Chat with your squad members here! Share strategies, plan matches, or just hang out. 😄
                        </p>
                        <div className="bg-gray-50 p-4 rounded-lg h-64 overflow-y-auto mb-4">
                            {messages.length > 0 ? (
                                messages.map((msg) => (
                                    <div key={msg.id} className="mb-2">
                                        <p className="text-gray-800 font-semibold">{msg.username}</p>
                                        <p className="text-gray-600">{msg.message}</p>
                                        <p className="text-gray-500 text-sm">{new Date(msg.created_at).toLocaleString()}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-600">No messages yet. Start the conversation!</p>
                            )}
                        </div>
                        <textarea
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                        />
                        <button
                            onClick={handleSendMessage}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
                        >
                            Send Message
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Schedule a Match</h2>
                        <p className="text-gray-600 mb-4">
                            Plan a gaming session with your squad! Select a time and add a description.
                        </p>
                        <input
                            type="datetime-local"
                            value={matchTime}
                            onChange={(e) => setMatchTime(e.target.value)}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        <textarea
                            value={matchDescription}
                            onChange={(e) => setMatchDescription(e.target.value)}
                            placeholder="Match Description (e.g., Ranked match in CODM)"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        <button
                            onClick={handleScheduleMatch}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                            Schedule Match
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Upload a Game Clip</h2>
                        <p className="text-gray-600 mb-4">
                            Share your best gaming moments! Upload a video (max 90 seconds).
                        </p>
                        <input
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        {clipPreview && (
                            <div className="mb-4">
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Preview:</h3>
                                <video
                                    src={clipPreview}
                                    controls
                                    className="w-full max-w-md rounded-lg"
                                />
                            </div>
                        )}
                        <textarea
                            value={clipDescription}
                            onChange={(e) => setClipDescription(e.target.value)}
                            placeholder="Clip Description"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
                        />
                        <button
                            onClick={handleUploadClip}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                        >
                            Upload Clip
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-lg mb-6">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Game Clips</h2>
                        {clips.length > 0 ? (
                            clips.map((clip) => (
                                <div key={clip.id} className="border-b py-4">
                                    <p className="text-gray-800 font-semibold">Uploaded by: {clip.username}</p>
                                    <p className="text-gray-600">{clip.description}</p>
                                    <video
                                        src={clip.clip_url}
                                        controls
                                        className="w-full max-w-md mt-2 rounded-lg"
                                    />
                                    <p className="text-gray-500 text-sm">{new Date(clip.created_at).toLocaleString()}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600">No clips yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}