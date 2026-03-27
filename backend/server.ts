import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express, { Request, Response, NextFunction } from "express";
import { db, query, queryOne } from "./database";
import http from "http";
import { Server } from "socket.io";
import { authenticateToken } from "./middleware/auth";
import { metricsMiddleware, default as metricsRouter } from "./routes/metrics";
import { initializeDatabase } from "./database";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

const isAdmin = (email: string): boolean => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        console.error("[SECURITY ERROR] ADMIN_EMAIL environment variable is required!");
        return false;
    }
    return email === adminEmail;
};

const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
const LOG_LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const log = (level: string, message: string, ...args: unknown[]) => {
    if ((LOG_LEVELS[level] || 0) <= (LOG_LEVELS[LOG_LEVEL] || 0)) {
        console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, ...args);
    }
};

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                mediaSrc: ["'self'", "https:", "blob:"],
                connectSrc: ["'self'", "https://api.cloudinary.com"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
    })
);

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://teenverse.onrender.com",
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || ALLOWED_ORIGINS.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Origin ${origin} not allowed by CORS`));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many login attempts, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
    console.error("[SECURITY ERROR] SECRET_KEY environment variable is required!");
    console.error("[SECURITY ERROR] Generate a key: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
    process.exit(1);
}

if (SECRET_KEY === "teenverse_secret" || SECRET_KEY.length < 32) {
    console.warn("[SECURITY WARNING] SECRET_KEY appears weak. Use a 64+ char hex string.");
}

app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        log("info", `${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
});

app.get("/health", async (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();
    try {
        await query("SELECT 1");
        res.json({
            status: "ok",
            timestamp: Date.now(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || "development",
            version: "1.0.0",
            services: {
                database: "connected",
                memory: {
                    usedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                    totalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
                },
            },
        });
    } catch (err) {
        res.status(503).json({
            status: "unhealthy",
            timestamp: Date.now(),
            uptime: process.uptime(),
            services: { database: "error" },
        });
    }
});

app.get("/ready", async (req: Request, res: Response) => {
    try {
        await query("SELECT 1");
        res.json({ ready: true });
    } catch (err) {
        res.status(503).json({ ready: false, error: "Database not ready" });
    }
});

if (process.env.NODE_ENV !== "production") {
    app.get("/debug-users", authenticateToken, async (req: Request, res: Response) => {
        if (!isAdmin(req.user?.email || "")) {
            return res.status(403).json({ message: "Admin access required" });
        }
        try {
            const schema = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
            log("debug", "Database schema:", schema);
            res.send("Debug info logged");
        } catch (err: any) {
            res.status(500).send("Error fetching debug info");
        }
    });

    app.get("/clear-users", authenticateToken, async (req: Request, res: Response) => {
        if (!isAdmin(req.user?.email || "")) {
            return res.status(403).json({ message: "Admin access required" });
        }
        try {
            await query("DELETE FROM users");
            res.send("Users table cleared");
        } catch (err: any) {
            res.status(500).send("Error clearing users");
        }
    });
}

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS,
        methods: ["GET", "POST"],
        credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
});

app.use(metricsMiddleware);
app.use("/", metricsRouter);

const authRoutes = require("./routes/auth").default;
const postRoutes = require("./routes/posts").default;
const usersRouter = require("./routes/users").default;
const dmRoutes = require("./routes/dms").default;
const settingsRouter = require("./routes/settings").default;
const rantRoutes = require("./routes/rants").default;
const squadRoutes = require("./routes/squads").default;
const tournamentRoutes = require("./routes/tournaments").default;
const shopRoutes = require("./routes/shop").default;
const showdownRoutes = require("./routes/showdown").default;
const battleRoutes = require("./routes/battles").default;

// Mount auth without rate limiting globally - rate limit applied in auth.ts for login ONLY
app.use("/api", authRoutes);
app.use("/api/posts", authenticateToken, postRoutes);
app.use("/api", authenticateToken, require("./routes/comments").default);
app.use("/api/users", authenticateToken, usersRouter);
app.use("/api/dms", authenticateToken, dmRoutes({ db: { query, queryOne }, SECRET_KEY, io }));
app.use("/api/settings", authenticateToken, settingsRouter);
app.use("/api/rants", rantRoutes);
app.use("/api/hype-battles", authenticateToken, battleRoutes);
app.use("/api/game-squads", authenticateToken, squadRoutes);
app.use("/api/tournaments", authenticateToken, tournamentRoutes);
app.use("/api/shop", authenticateToken, shopRoutes);

const showdownRouter = showdownRoutes(io);
app.use("/api/showdown", authenticateToken, showdownRouter);

io.on("connection", (socket) => {
    log("info", `Socket connected: ${socket.id}`);

    // === USER ONLINE STATUS ===
    socket.on("user_online", (userId) => {
        socket.join(`user-${userId}`);
        io.emit("user_status", { userId, status: "online" });
        log("debug", `User ${userId} is online`);
    });

    socket.on("user_offline", (userId) => {
        io.emit("user_status", { userId, status: "offline" });
        log("debug", `User ${userId} is offline`);
    });

    // === CHAT ROOMS ===
    socket.on("join_chat", (conversationId) => {
        socket.join(`chat-${conversationId}`);
        log("debug", `User ${socket.id} joined chat-${conversationId}`);
    });

    socket.on("leave_chat", (conversationId) => {
        socket.leave(`chat-${conversationId}`);
        log("debug", `User ${socket.id} left chat-${conversationId}`);
    });

    socket.on("send_message", async (data) => {
        const { conversationId, message } = data;
        io.to(`chat-${conversationId}`).emit("new_message", message);
    });

    // === HYPER BATTLES ===
    socket.on("join_battle", (battleId) => {
        socket.join(`battle-${battleId}`);
        log("debug", `User ${socket.id} joined battle-${battleId}`);
    });

    socket.on("leave_battle", (battleId) => {
        socket.leave(`battle-${battleId}`);
        log("debug", `User ${socket.id} left battle-${battleId}`);
    });

    socket.on("vote_battle", async (data) => {
        const { battleId, voteFor } = data;
        try {
            if (voteFor === "creator") {
                await query("UPDATE hype_battles SET votes = votes + 1 WHERE id = $1", [battleId]);
            } else {
                await query("UPDATE hype_battles SET opponent_votes = opponent_votes + 1 WHERE id = $1", [battleId]);
            }

            const updatedBattle = await queryOne("SELECT votes, opponent_votes FROM hype_battles WHERE id = $1", [battleId]);
            io.to(`battle-${battleId}`).emit("vote_update", updatedBattle);
        } catch (err) {
            log("error", "Vote broadcast error:", err);
        }
    });

    // === SHOWDOWN ===
    socket.on("join_showdown", (tournamentId) => {
        socket.join(`showdown-${tournamentId}`);
    });

    socket.on("leave_showdown", (tournamentId) => {
        socket.leave(`showdown-${tournamentId}`);
    });

    socket.on("disconnect", () => {
        log("info", `Socket disconnected: ${socket.id}`);
    });
});

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

class AppError extends Error {
    statusCode: number;
    code: string;
    constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AppError";
    }
}

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({ message: err.message, code: err.code });
        return;
    }
    if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "File too large", code: "FILE_TOO_LARGE" });
        return;
    }
    log("error", `Unhandled error at ${req.method} ${req.path}:`, err.message, err.stack);
    res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
});

process.on("uncaughtException", (err) => {
    log("error", "Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
    log("error", "Unhandled Rejection:", reason);
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    try {
        await initializeDatabase();
        log("info", "Database initialized successfully");
        
        server.listen(PORT, () => {
            log("info", `Server running on port ${PORT}`);
        });
    } catch (err) {
        log("error", "Failed to initialize database:", err);
        process.exit(1);
    }
}

startServer();

export default app;
