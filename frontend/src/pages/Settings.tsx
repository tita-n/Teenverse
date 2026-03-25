import React, { useState, useEffect } from "react";
import axios from "axios";
import { withAuth } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import Textarea from "../components/ui/Textarea";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { Settings as SettingsIcon, User, Palette, Coins, Shield } from "lucide-react";

type Tab = "account" | "profile" | "economy" | "customization" | "privacy";
const tabs: { id: Tab; label: string; icon: any }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "profile", label: "Profile", icon: User },
  { id: "economy", label: "Economy", icon: Coins },
  { id: "customization", label: "Customize", icon: Palette },
  { id: "privacy", label: "Privacy", icon: Shield },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>("account");
  const [account, setAccount] = useState<any>({});
  const [profile, setProfile] = useState<any>({});
  const [economy, setEconomy] = useState<any>({});
  const [customization, setCustomization] = useState<any>({});
  const [privacy, setPrivacy] = useState<any>({});
  const [blockUserId, setBlockUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const { user, token, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!user || !token) { setLoading(false); return; }
    const auth = withAuth(token);
    Promise.all([
      axios.get("/api/settings/account", auth),
      axios.get("/api/settings/profile", auth),
      axios.get("/api/settings/economy", auth),
      axios.get("/api/settings/customization", auth),
      axios.get("/api/settings/privacy", auth),
    ]).then(([aRes, pRes, eRes, cRes, prRes]) => {
      setAccount(aRes.data); setProfile(pRes.data); setEconomy(eRes.data);
      setCustomization(cRes.data); setPrivacy(prRes.data);
    }).catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [user, token]);

  const update = async (endpoint: string, data: any, setter: (d: any) => void, current: any) => {
    try {
      await axios.post(`/api/settings/${endpoint}`, data, withAuth(token));
      setter({ ...current, ...data });
    } catch (err) { console.error("Error:", err); }
  };

  const handleBlock = async () => {
    if (!blockUserId) return;
    try {
      await axios.post("/api/settings/privacy/block", { blockedUserId: blockUserId }, withAuth(token));
      setPrivacy({ ...privacy, blockList: [...(privacy.blockList || []), { blocked_user_id: blockUserId, username: "User " + blockUserId }] });
      setBlockUserId("");
    } catch (err) { console.error("Error:", err); }
  };

  const handleUnblock = async (id: string) => {
    try {
      await axios.post("/api/settings/privacy/unblock", { blockedUserId: id }, withAuth(token));
      setPrivacy({ ...privacy, blockList: privacy.blockList.filter((u: any) => u.blocked_user_id !== id) });
    } catch (err) { console.error("Error:", err); }
  };

  if (authLoading) return <LoadingState />;
  if (!user || !token) return <AuthRequiredState />;
  if (loading) return <LoadingState message="Loading settings..." />;

  return (
    <Layout maxWidth="3xl">
      <div className="mb-6">
        <h1 className="text-h1 flex items-center gap-2">
          <SettingsIcon className="w-7 h-7 text-brand-500" />
          Settings
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id ? "bg-brand-600 text-white" : "btn-secondary"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="card p-6">
        {activeTab === "account" && (
          <div className="space-y-4">
            <h2 className="text-h3">Account Settings</h2>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Username</label>
              <Input value={account.username || ""} onChange={(e) => setAccount({ ...account, username: e.target.value })} onBlur={() => update("account", { username: account.username }, setAccount, account)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Email</label>
              <Input type="email" value={account.email || ""} onChange={(e) => setAccount({ ...account, email: e.target.value })} onBlur={() => update("account", { email: account.email }, setAccount, account)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Password</label>
              <Input type="password" placeholder="Enter new password" onBlur={(e) => update("account", { password: (e.target as HTMLInputElement).value }, setAccount, account)} />
            </div>
            <p className="text-sm text-tx-muted">DOB: {account.dob} (not editable)</p>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-4">
            <h2 className="text-h3">Profile Settings</h2>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Bio</label>
              <Textarea value={profile.bio || ""} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} onBlur={() => update("profile", { bio: profile.bio }, setProfile, profile)} rows={4} />
            </div>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Background Theme</label>
              <select value={profile.backgroundTheme || "default"} onChange={(e) => { setProfile({ ...profile, backgroundTheme: e.target.value }); update("profile", { backgroundTheme: e.target.value }, setProfile, profile); }} className="input w-auto">
                <option value="default">Default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "economy" && (
          <div className="space-y-4">
            <h2 className="text-h3">Economy</h2>
            <p className="text-tx-secondary">Balance: <span className="font-bold text-tx-primary">{economy.balance || 0} Coins</span></p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={economy.spendingRestrictions || false} onChange={(e) => { setEconomy({ ...economy, spendingRestrictions: e.target.checked }); update("economy", { spendingRestrictions: e.target.checked }, setEconomy, economy); }} className="w-4 h-4 text-brand-600 rounded" />
              <span className="text-sm text-tx-secondary">Enable Spending Restrictions</span>
            </label>
          </div>
        )}

        {activeTab === "customization" && (
          <div className="space-y-4">
            <h2 className="text-h3">Customization</h2>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Theme</label>
              <select value={customization.theme || "Neon Glow"} onChange={(e) => { setCustomization({ ...customization, theme: e.target.value }); update("customization", { theme: e.target.value }, setCustomization, customization); }} className="input w-auto">
                <option value="Neon Glow">Neon Glow</option>
                <option value="Graffiti">Graffiti</option>
                <option value="Clean Mode">Clean Mode</option>
                <option value="Retro">Retro</option>
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={customization.animationsEnabled || false} onChange={(e) => { setCustomization({ ...customization, animationsEnabled: e.target.checked }); update("customization", { animationsEnabled: e.target.checked }, setCustomization, customization); }} className="w-4 h-4 text-brand-600 rounded" />
              <span className="text-sm text-tx-secondary">Enable Animations</span>
            </label>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Font Size</label>
              <select value={customization.fontSize || "medium"} onChange={(e) => { setCustomization({ ...customization, fontSize: e.target.value }); update("customization", { fontSize: e.target.value }, setCustomization, customization); }} className="input w-auto">
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "privacy" && (
          <div className="space-y-4">
            <h2 className="text-h3">Privacy & Safety</h2>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-2">Block List</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(privacy.blockList || []).map((u: any) => (
                  <div key={u.blocked_user_id} className="flex items-center justify-between p-2 bg-surface-muted rounded-lg">
                    <span className="text-sm">{u.username}</span>
                    <Button size="sm" variant="danger" onClick={() => handleUnblock(u.blocked_user_id)}>Unblock</Button>
                  </div>
                ))}
                {(!privacy.blockList || privacy.blockList.length === 0) && <p className="text-sm text-tx-muted">No blocked users</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Input value={blockUserId} onChange={(e) => setBlockUserId(e.target.value)} placeholder="Enter user ID to block" className="flex-1" />
              <Button onClick={handleBlock} disabled={!blockUserId}>Block</Button>
            </div>
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1">Snitch Risk</label>
              <div className="w-full bg-surface-muted rounded-full h-2">
                <div className="bg-brand-600 h-2 rounded-full transition-all" style={{ width: `${privacy.snitchRisk || 0}%` }} />
              </div>
              <p className="text-xs text-tx-muted mt-1">{privacy.snitchRisk || 0}%</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
