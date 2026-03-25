import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Zap } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage("Please fill in all fields");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post("/api/login", { email, password });
      if (res.status === 200) {
        const user = { email, username: res.data.username };
        login(user, res.data.token);
        navigate("/dashboard");
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Error logging in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-600 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TeenVerse</h1>
          <p className="text-white/70 mt-1">Welcome back! Sign in to continue.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-tx-primary text-center mb-6">Log In</h2>

          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            <Button
              onClick={handleLogin}
              loading={loading}
              className="w-full"
              size="lg"
            >
              Log In
            </Button>
          </div>

          {message && (
            <p className={`text-center text-sm mt-4 ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>
              {message}
            </p>
          )}

          <p className="text-center text-tx-secondary text-sm mt-6">
            Don't have an account?{" "}
            <a href="/register" className="text-brand-600 hover:text-brand-700 font-medium">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
