import { createContext, useContext, useCallback, useRef, useEffect, useState, ReactNode, useMemo } from "react";
import { io, Socket } from "socket.io-client";

interface OnlineUser {
  userId: string;
  status: "online" | "offline";
  lastSeen?: string;
}

interface SocketContextType {
  socket: Socket | null;
  connect: (token: string, userId?: string) => void;
  disconnect: () => void;
  onlineUsers: OnlineUser[];
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback((token: string, userId?: string) => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    const newSocket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
      auth: { token },
      transports: ["websocket"],
      reconnectionAttempts: 3,
    });

    // Handle online status updates
    newSocket.on("user_status", (data: { userId: string; status: "online" | "offline" }) => {
      setOnlineUsers(prev => {
        const filtered = prev.filter(u => u.userId !== data.userId);
        if (data.status === "online") {
          return [...filtered, { userId: data.userId, status: "online" }];
        }
        return filtered;
      });
    });

    // Announce this user is online
    if (userId) {
      newSocket.emit("user_online", userId);
    }

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, []);

  const disconnect = useCallback(() => {
    // Announce user is offline before disconnecting
    const userId = socketRef.current?.io?.id;
    if (socketRef.current && userId) {
      socketRef.current.emit("user_offline", userId);
    }
    
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setSocket(null);
    setOnlineUsers([]);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const value = useMemo(() => ({ socket, connect, disconnect, onlineUsers }), [socket, connect, disconnect, onlineUsers]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};
