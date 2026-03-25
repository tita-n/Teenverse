import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { Zap, Check, X } from "lucide-react";

const passwordRequirements = [
  { test: (p: string) => p.length >= 8, label: "At least 8 characters" },
  { test: (p: string) => /[A-Z]/.test(p), label: "One uppercase letter" },
  { test: (p: string) => /[a-z]/.test(p), label: "One lowercase letter" },
  { test: (p: string) => /\d/.test(p), label: "One number" },
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
      setMessage("Please fill in all fields");
      return;
    }
    try {
      setLoading(true);
      const formattedDob = new Date(dob).toISOString().split("T")[0];
      const res = await axios.post("/api/register", { email, username, password, dob: formattedDob });
      if (res.status === 200) {
        localStorage.setItem("user", JSON.stringify({ email, username }));
        setMessage(res.data.message || "Registration successful!");
        setTimeout(() => navigate("/"), 2000);
      }
    } catch (err: any) {
      setMessage(err.response?.data?.message || "Error registering");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-brand-600 to-brand-700 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">TeenVerse</h1>
          <p className="text-white/70 mt-1">Create your account and join the community.</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-tx-primary text-center mb-6">Sign Up</h2>

          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Email address"
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
            {password && (
              <div className="mt-2 space-y-1">
                {passwordRequirements.map((req, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${passwordMet[i] ? "text-green-600" : "text-red-500"}`}>
                    {passwordMet[i] ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {req.label}
                  </div>
                ))}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-tx-secondary mb-1.5">Date of Birth</label>
              <Input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />
            </div>

            <Button
              onClick={handleRegister}
              loading={loading}
              className="w-full"
              size="lg"
            >
              Create Account
            </Button>
          </div>

          {message && (
            <p className={`text-center text-sm mt-4 ${message.includes("Error") ? "text-red-500" : "text-green-600"}`}>
              {message}
            </p>
          )}

          <p className="text-center text-tx-secondary text-sm mt-6">
            Already have an account?{" "}
            <a href="/" className="text-brand-600 hover:text-brand-700 font-medium">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
