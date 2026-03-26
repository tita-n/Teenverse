import { useState } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { withAuth } from "../lib/api";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Coins, Sparkles } from "lucide-react";

export default function CoinFlip() {
  const [betAmount, setBetAmount] = useState(10);
  const [result, setResult] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [flipping, setFlipping] = useState(false);
  const { user, token } = useAuth();

  const handleFlip = async () => {
    if (!user || !token || betAmount < 1 || betAmount > 100) return;
    try {
      setFlipping(true);
      setResult(null);
      const res = await axios.post("/api/users/coin-flip", { userId: user.email, betAmount }, withAuth(token));
      setResult(res.data.result);
      setBalance(res.data.newBalance);
    } catch (err) { console.error("Error:", err); }
    finally { setFlipping(false); }
  };

  return (
    <div className="card p-6 mb-6">
      <h2 className="text-h3 flex items-center gap-2 mb-4">
        <Coins className="w-5 h-5 text-amber-500" />
        Coin Flip
      </h2>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm text-tx-secondary">Bet:</label>
        <Input type="number" value={betAmount} onChange={(e) => setBetAmount(Number(e.target.value))} min={1} max={100} className="w-24" />
        <span className="text-sm text-tx-muted">coins</span>
      </div>
      <Button onClick={handleFlip} loading={flipping} disabled={betAmount < 1 || betAmount > 100}>
        <Sparkles className="w-4 h-4 mr-2" />
        Flip Coin
      </Button>
      {result && (
        <div className={`mt-4 p-3 rounded-lg text-center font-semibold ${result === "win" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"}`}>
          {result === "win" ? "🎉 You Won!" : "😢 You Lost!"}
        </div>
      )}
      {balance !== null && <p className="mt-2 text-sm text-tx-secondary">Balance: <span className="font-bold text-tx-primary">{balance} coins</span></p>}
    </div>
  );
}
