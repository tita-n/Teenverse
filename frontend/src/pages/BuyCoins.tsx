import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Layout from "../components/ui/Layout";
import Button from "../components/ui/Button";
import { LoadingState, AuthRequiredState } from "../components/ui/PageStates";
import { Coins } from "lucide-react";

export default function BuyCoins() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, token, loading: authLoading } = useAuth();

  const handleBuy = async () => {
    if (!user || !token) return;
    try {
      setLoading(true);
      const res = await axios.post("/api/buy-coins", { email: user.email }, withAuth(token));
      setMessage(res.data.message);
    } catch (err: any) {
      setMessage("Error: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <LoadingState message="Checking authentication..." />;
  if (!user || !token) return <AuthRequiredState />;

  return (
    <Layout maxWidth="2xl">
      <div className="mb-6">
        <h1 className="text-h1 flex items-center gap-2">
          <Coins className="w-7 h-7 text-amber-500" />
          Buy Coins
        </h1>
        <p className="text-tx-secondary mt-1">Get coins to spend in the TeenVerse Shop</p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
          {message}
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-h3 mb-4">Coin Packages</h2>
        <p className="text-tx-secondary mb-4">Coin purchasing is not available yet. Check back soon!</p>
        <Button onClick={handleBuy} loading={loading} variant="success">
          <Coins className="w-4 h-4 mr-2" />
          Buy Coins (Coming Soon)
        </Button>
      </div>
    </Layout>
  );
}
