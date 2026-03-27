import { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Zap, Eye, EyeOff, Sparkles } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setMessage("Fill in all fields fi");
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
      setMessage(err.response?.data?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-neon-red/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[400px] h-[400px] bg-neon-cyan/10 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] bg-neon-gold/10 rounded-full blur-[80px]" />
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-[400px] animate-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-neon-red to-red-700 rounded-2xl mb-4 shadow-glow-lg">
              <Zap className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-display font-bold text-gradient">TeenVerse</h1>
            <p className="text-dark-300 mt-2 text-sm">Let's get you in 👀</p>
          </div>

          {/* Card */}
          <div className="card p-6 sm:p-8">
            <h2 className="text-xl font-bold text-white mb-6 text-center">Welcome back</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2 block">Email</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold text-dark-400 uppercase tracking-wider mb-2 block">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={handleLogin}
                loading={loading}
                className="w-full mt-2"
                size="lg"
              >
                Get In
              </Button>
            </div>

            {message && (
              <p className="text-center text-sm mt-4 text-red-400">
                {message}
              </p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-dark-600" />
              <span className="text-dark-500 text-xs">or</span>
              <div className="flex-1 h-px bg-dark-600" />
            </div>

            {/* Social Login Placeholders */}
            <div className="grid grid-cols-2 gap-3">
              <button className="flex items-center justify-center gap-2 py-3 px-4 bg-dark-700 rounded-xl border border-dark-600 hover:border-dark-500 transition-colors text-sm font-medium text-white">
                <Sparkles className="w-4 h-4 text-neon-gold" /> Google
              </button>
              <button className="flex items-center justify-center gap-2 py-3 px-4 bg-dark-700 rounded-xl border border-dark-600 hover:border-dark-500 transition-colors text-sm font-medium text-white">
                Apple
              </button>
            </div>

            <p className="text-center text-dark-400 text-sm mt-6">
              No account yet?{" "}
              <Link to="/register" className="text-neon-red font-bold hover:underline">
                Create one
              </Link>
            </p>
          </div>

          {/* Terms */}
          <p className="text-center text-dark-500 text-xs mt-6">
            By continuing, you agree to our Terms & Privacy
          </p>
        </div>
      </div>
    </div>
  );
}