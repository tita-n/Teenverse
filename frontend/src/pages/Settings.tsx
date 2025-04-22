import React, { useState, useEffect } from "react";
import axios from "axios";

const Settings = () => {
    const [activeTab, setActiveTab] = useState("account");
    const [account, setAccount] = useState({});
    const [profile, setProfile] = useState({});
    const [economy, setEconomy] = useState({});
    const [customization, setCustomization] = useState({});
    const [privacy, setPrivacy] = useState({});
    const [blockUserId, setBlockUserId] = useState("");

    const token = localStorage.getItem("token");

    // Fetch all settings on mount
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const headers = { Authorization: `Bearer ${token}` };
                const [accountRes, profileRes, economyRes, customizationRes, privacyRes] = await Promise.all([
                    axios.get("/api/settings/account", { headers }),
                    axios.get("/api/settings/profile", { headers }),
                    axios.get("/api/settings/economy", { headers }),
                    axios.get("/api/settings/customization", { headers }),
                    axios.get("/api/settings/privacy", { headers }),
                ]);
                setAccount(accountRes.data);
                setProfile(profileRes.data);
                setEconomy(economyRes.data);
                setCustomization(customizationRes.data);
                setPrivacy(privacyRes.data);
            } catch (err) {
                console.error("Error fetching settings:", err);
            }
        };
        fetchSettings();
    }, []);

    // Handlers for updating settings
    const updateAccount = async (updates) => {
        try {
            await axios.post("/api/settings/account", updates, { headers: { Authorization: `Bearer ${token}` } });
            setAccount({ ...account, ...updates });
            alert("Account updated successfully!");
        } catch (err) {
            console.error("Error updating account:", err);
            alert("Failed to update account.");
        }
    };

    const updateProfile = async (updates) => {
        try {
            await axios.post("/api/settings/profile", updates, { headers: { Authorization: `Bearer ${token}` } });
            setProfile({ ...profile, ...updates });
            alert("Profile updated successfully!");
        } catch (err) {
            console.error("Error updating profile:", err);
            alert("Failed to update profile.");
        }
    };

    const updateEconomy = async (updates) => {
        try {
            await axios.post("/api/settings/economy", updates, { headers: { Authorization: `Bearer ${token}` } });
            setEconomy({ ...economy, ...updates });
            alert("Economy settings updated successfully!");
        } catch (err) {
            console.error("Error updating economy:", err);
            alert("Failed to update economy settings.");
        }
    };

    const updateCustomization = async (updates) => {
        try {
            await axios.post("/api/settings/customization", updates, { headers: { Authorization: `Bearer ${token}` } });
            setCustomization({ ...customization, ...updates });
            alert("Customization settings updated successfully!");
        } catch (err) {
            console.error("Error updating customization:", err);
            alert("Failed to update customization settings.");
        }
    };

    const blockUser = async () => {
        if (!blockUserId) {
            alert("Please enter a user ID to block.");
            return;
        }
        try {
            await axios.post(
                "/api/settings/privacy/block",
                { blockedUserId: blockUserId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPrivacy({ ...privacy, blockList: [...(privacy.blockList || []), { blocked_user_id: blockUserId, username: "User " + blockUserId }] });
            setBlockUserId("");
            alert("User blocked successfully!");
        } catch (err) {
            console.error("Error blocking user:", err);
            alert("Failed to block user.");
        }
    };

    const unblockUser = async (blockedUserId) => {
        try {
            await axios.post(
                "/api/settings/privacy/unblock",
                { blockedUserId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setPrivacy({
                ...privacy,
                blockList: privacy.blockList.filter((user) => user.blocked_user_id !== blockedUserId),
            });
            alert("User unblocked successfully!");
        } catch (err) {
            console.error("Error unblocking user:", err);
            alert("Failed to unblock user.");
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-4xl font-bold text-center mb-8">Settings - Your Mission Control</h1>

                {/* Tabs */}
                <div className="flex justify-center space-x-4 mb-6">
                    {["account", "profile", "economy", "customization", "privacy"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 ${
                                activeTab === tab
                                    ? "bg-indigo-600 text-white"
                                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                            }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
                    {/* 1. Account Settings */}
                    {activeTab === "account" && (
                        <div>
                            <h2 className="text-2xl font-semibold mb-4">Account Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={account.username || ""}
                                        onChange={(e) => setAccount({ ...account, username: e.target.value })}
                                        onBlur={(e) => updateAccount({ username: e.target.value })}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={account.email || ""}
                                        onChange={(e) => setAccount({ ...account, email: e.target.value })}
                                        onBlur={(e) => updateAccount({ email: e.target.value })}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Password</label>
                                    <input
                                        type="password"
                                        placeholder="Enter new password"
                                        onBlur={(e) => updateAccount({ password: e.target.value })}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Date of Birth</label>
                                    <p className="text-gray-400">{account.dob} (Not editable)</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 2. Profile Settings */}
                    {activeTab === "profile" && (
                        <div>
                            <h2 className="text-2xl font-semibold mb-4">Profile Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Bio</label>
                                    <textarea
                                        value={profile.bio || ""}
                                        onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                                        onBlur={(e) => updateProfile({ bio: e.target.value })}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                        rows={4}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Profile Picture</label>
                                    <p className="text-gray-400">Coming soon with Cloudinary!</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Background Theme</label>
                                    <select
                                        value={profile.backgroundTheme || "default"}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setProfile({ ...profile, backgroundTheme: value });
                                            updateProfile({ backgroundTheme: value });
                                        }}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="default">Default</option>
                                        <option value="dark">Dark</option>
                                        <option value="light">Light</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Coin & Economy Settings */}
                    {activeTab === "economy" && (
                        <div>
                            <h2 className="text-2xl font-semibold mb-4">Coin & Economy Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Coin Balance</label>
                                    <p className="text-gray-400">{economy.balance || 0} Coins</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Transaction History</label>
                                    <div className="max-h-48 overflow-y-auto">
                                        {(economy.history || []).map((tx) => (
                                            <div key={tx.id} className="p-2 bg-gray-700 rounded-lg mb-2">
                                                <p>Bet: {tx.bet_amount} | Won: {tx.won_amount} | Result: {tx.result}</p>
                                                <p className="text-sm text-gray-400">{tx.created_at}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={economy.spendingRestrictions || false}
                                            onChange={(e) => {
                                                const value = e.target.checked;
                                                setEconomy({ ...economy, spendingRestrictions: value });
                                                updateEconomy({ spendingRestrictions: value });
                                            }}
                                            className="mr-2"
                                        />
                                        Enable Spending Restrictions
                                    </label>
                                </div>
                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={economy.autoEarn?.uploads || false}
                                            onChange={(e) => {
                                                const value = e.target.checked;
                                                setEconomy({ ...economy, autoEarn: { ...economy.autoEarn, uploads: value } });
                                                updateEconomy({ autoEarnUploads: value });
                                            }}
                                            className="mr-2"
                                        />
                                        Auto-Earn for Uploads
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Customization Settings */}
                    {activeTab === "customization" && (
                        <div>
                            <h2 className="text-2xl font-semibold mb-4">Customization Settings</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Theme</label>
                                    <select
                                        value={customization.theme || "Neon Glow"}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setCustomization({ ...customization, theme: value });
                                            updateCustomization({ theme: value });
                                        }}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="Neon Glow">Neon Glow</option>
                                        <option value="Graffiti">Graffiti</option>
                                        <option value="Clean Mode">Clean Mode</option>
                                        <option value="Retro">Retro</option>
                                        <option value="Midnight Vibe">Midnight Vibe</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={customization.animationsEnabled || false}
                                            onChange={(e) => {
                                                const value = e.target.checked;
                                                setCustomization({ ...customization, animationsEnabled: value });
                                                updateCustomization({ animationsEnabled: value });
                                            }}
                                            className="mr-2"
                                        />
                                        Enable Animations
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Font Size</label>
                                    <select
                                        value={customization.fontSize || "medium"}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setCustomization({ ...customization, fontSize: value });
                                            updateCustomization({ fontSize: value });
                                        }}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="small">Small</option>
                                        <option value="medium">Medium</option>
                                        <option value="large">Large</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Language</label>
                                    <select
                                        value={customization.language || "en"}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setCustomization({ ...customization, language: value });
                                            updateCustomization({ language: value });
                                        }}
                                        className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="en">English</option>
                                        <option value="es">Spanish</option>
                                        <option value="fr">French</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 5. Privacy & Safety */}
                    {activeTab === "privacy" && (
                        <div>
                            <h2 className="text-2xl font-semibold mb-4">Privacy & Safety</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Block List</label>
                                    <div className="max-h-48 overflow-y-auto">
                                        {(privacy.blockList || []).map((user) => (
                                            <div key={user.blocked_user_id} className="flex justify-between items-center p-2 bg-gray-700 rounded-lg mb-2">
                                                <span>{user.username}</span>
                                                <button
                                                    onClick={() => unblockUser(user.blocked_user_id)}
                                                    className="px-3 py-1 bg-red-600 rounded-lg hover:bg-red-700 transition-all duration-300"
                                                >
                                                    Unblock
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Block a User</label>
                                    <div className="flex space-x-2">
                                        <input
                                            type="text"
                                            placeholder="Enter user ID"
                                            value={blockUserId}
                                            onChange={(e) => setBlockUserId(e.target.value)}
                                            className="w-full p-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500"
                                        />
                                        <button
                                            onClick={blockUser}
                                            className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-all duration-300"
                                        >
                                            Block
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Snitch Risk Meter</label>
                                    <div className="w-full bg-gray-700 rounded-full h-4">
                                        <div
                                            className="bg-indigo-600 h-4 rounded-full"
                                            style={{ width: `${privacy.snitchRisk || 0}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-sm text-gray-400 mt-1">{privacy.snitchRisk || 0}%</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;