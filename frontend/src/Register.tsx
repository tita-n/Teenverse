import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import Button from "./components/ui/Button";
import Input from "./components/ui/Input";
import { Zap, Check, X, Sparkles, Calendar } from "lucide-react";

const passwordRequirements = [
  { test: (p: string) => p.length >= 8, label: "8+ chars" },
  { test: (p: string) => /[A-Z]/.test(p), label: "Uppercase" },
  { test: (p: string) => /[a-z]/.test(p), label: "Lowercase" },
  { test: (p: string) => /\d/.test(p), label: "Number" },
];

export default function Register() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const passwordMet = passwordRequirements.map((req) => req.test(password));

  const handleRegister = async () => {
    if (!email || !username || !password || !dob) {
      setMessage("Fill all fields fi");
      return;
    }
    try {
      setLoading(true);
      const formattedDob = new Date(dob).toISOString().split("T")[0];
      const res = await axios.post("/api/register", { email, username, password, dob: formattedDob });
      if (res.status === 200) {
        setMessage("Ayo, you're in! 🎉");
        setTimeout(() => navigate("/"), 1500);
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-3 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[400px] h-[400px] bg-neon-red/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] bg-neon-purple/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10 animate-in">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-neon-red to-red-700 rounded-2xl mb-3 shadow-glow-lg">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-gradient">TeenVerse</h1>
          <p className="text-dark-400 mt-1 text-sm">Join the crew 👊</p>
        </div>

        {/* Card */}
        <div className="card p-5 sm:p-6">
          <h2 className="text-lg font-bold text-white mb-5 text-center">Create Account</h2>

          <div className="space-y-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            
            {/* Password Requirements */}
            {password && (
              <div className="flex flex-wrap gap-2">
                {passwordRequirements.map((req, i) => (
                  <span 
                    key={i}
                    className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
                      passwordMet[i] ? "bg-green-500/20 text-green-400" : "bg-dark-700 text-dark-400"
                    }`}
                  >
                    {passwordMet[i] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {req.label}
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500 pointer-events-none" />
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="input pl-10"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <Button
              onClick={handleRegister}
              loading={loading}
              className="w-full mt-2"
            >
              Let's Go 🚀
            </Button>
          </div>

          {message && (
            <p className="text-center text-sm mt-3 text-green-400">
              {message}
            </p>
          )}

          <p className="text-center text-dark-400 text-xs mt-4">
            Already on TeenVerse?{" "}
            <Link to="/" className="text-neon-red font-bold hover:underline">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}