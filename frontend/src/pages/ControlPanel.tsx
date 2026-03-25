import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { ShieldCheck } from "lucide-react";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";

export default function ControlPanel() {
  const { user, token, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleVerify = async (verify: boolean) => {
    if (!user || !token || !isAdmin || !username) return;
    try {
      setLoading(true);
      const res = await axios.post("/api/users/verify", { username, verify }, withAuth(token));
      setMessage(res.data.message);
      setUsername("");
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;
  if (!isAdmin) {
    return (
      <Layout>
        <div className="text-center py-12">
          <ShieldCheck className="w-16 h-16 mx-auto text-red-300 mb-4" />
          <h2 className="text-xl font-semibold text-tx-primary mb-2">Access Denied</h2>
          <p className="text-tx-secondary">Only administrators can access this page.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout maxWidth="2xl">
      <div className="mb-6">
        <h1 className="text-h1 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-brand-500" />
          Control Panel
        </h1>
        <p className="text-tx-secondary mt-1">Administrative tools</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-h3 mb-4">Verify / Unverify User</h2>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
          className="mb-4"
        />
        <div className="flex gap-3">
          <Button onClick={() => handleVerify(true)} loading={loading} disabled={!username.trim()}>
            Verify
          </Button>
          <Button onClick={() => handleVerify(false)} variant="danger" loading={loading} disabled={!username.trim()}>
            Unverify
          </Button>
        </div>
      </div>
    </Layout>
  );
}
