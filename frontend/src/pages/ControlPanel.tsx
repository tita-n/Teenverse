import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import Navigation from "../components/Navigation";

export default function ControlPanel() {
    const [username, setUsername] = useState("");
    const [message, setMessage] = useState("");
    const { user, token } = useAuth();

    const handleVerify = async (verified: boolean) => {
        if (!user || !token) {
            setMessage("Please log in to verify users.");
            return;
        }
        if (user.email !== "restorationmichael3@gmail.com") {
            setMessage("Unauthorized: Only the creator can access this page.");
            return;
        }

        try {
            const res = await axios.post(
                "/api/users/verify",
                { email: user.email, username, verified },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setMessage(res.data.message);
            setUsername("");
        } catch (err) {
            setMessage("Error: " + (err.response?.data?.message || err.message));
        }
    };

    if (!user || !token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Please log in to access the control panel.</div>
            </div>
        );
    }

    if (user.email !== "restorationmichael3@gmail.com") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center text-red-500 text-xl">Unauthorized: Only the creator can access this page.</div>
            </div>
        );
    }

    return (
        <div>
            <Navigation />
            <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6">Control Panel</h1>
                    <p className="text-center text-green-600 mb-6">{message}</p>

                    <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md mb-6">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Verify a User</h2>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username to verify/unverify"
                            className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={() => handleVerify(true)}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
                            >
                                Verify
                            </button>
                            <button
                                onClick={() => handleVerify(false)}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
                            >
                                Unverify
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}