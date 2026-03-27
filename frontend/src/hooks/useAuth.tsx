import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import axios from "axios";
import { useSocket } from "../context/SocketContext";

interface AuthContextType {
  user: { email: string; username?: string; id?: number } | null;
  token: string | null;
  login: (user: { email: string; username?: string; id?: number }, token: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthContextType["user"]>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { connect: connectSocket, disconnect: disconnectSocket } = useSocket();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      const parsedUser = JSON.parse(storedUser);
      axios
        .get("/api/users/me", { headers: { Authorization: `Bearer ${storedToken}` } })
        .then((res) => {
          setUser(res.data);
          setToken(storedToken);
        })
        .catch(() => {
          localStorage.removeItem("user");
          localStorage.removeItem("token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback((userData: { email: string; username?: string; id?: number }, tokenStr: string) => {
    setUser(userData);
    setToken(tokenStr);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", tokenStr);
    // Connect to socket for real-time features
    connectSocket(tokenStr, userData.email);
  }, [connectSocket]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    // Disconnect socket
    disconnectSocket();
  }, [disconnectSocket]);

  const value = useMemo(() => ({ user, token, login, logout, loading }), [user, token, login, logout, loading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
