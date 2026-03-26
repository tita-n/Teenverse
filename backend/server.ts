import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express, { Request, Response, NextFunction } from "express";
import { db, dbGet } from "./database";
import http from "http";
import { Server } from "socket.io";
import { backupDatabase, localBackup } from "./backup";
import { authenticateToken } from "./middleware/auth";

// Route imports
import authRoutes from "./routes/auth";
import postRoutes from "./routes/posts";
import usersRouter from "./routes/users";
import dmRoutes from "./routes/dms";
import settingsRouter from "./routes/settings";
import rantRoutes from "./routes/rants";
import squadRoutes from "./routes/squads";
import tournamentRoutes from "./routes/tournaments";
import shopRoutes from "./routes/shop";
import showdownRoutes from "./routes/showdown";
import battleRoutes from "./routes/battles";

dotenv.config();

const app = express();

// ============= SECURITY HEADERS =============
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

// ============= CORS CONFIGURATION =============
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

// ============= RATE LIMITING =============
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { message: "Too many login attempts, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 100,
    message: { message: "Too many requests, please slow down" },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use("/api", apiLimiter);

// ============= BODY PARSING =============
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============= SECURITY: REQUIRE SECRET KEY =============
const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
    console.error("[SECURITY ERROR] SECRET_KEY environment variable is required!");
    console.error("[SECURITY ERROR] Generate a key: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"");
    process.exit(1);
}

if (SECRET_KEY === "teenverse_secret" || SECRET_KEY.length < 32) {
    console.warn("[SECURITY WARNING] SECRET_KEY appears weak. Use a 64+ char hex string.");
}

const isAdmin = (email: string): boolean => {
    return email === (process.env.ADMIN_EMAIL || "restorationmichael3@gmail.com");
};

// ============= LOGGING =============
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
const LOG_LEVELS: Record<string, number> = { error: 0, warn: 1, info: 2, debug: 3 };

const log = (level: string, message: string, ...args: unknown[]) => {
    if ((LOG_LEVELS[level] || 0) <= (LOG_LEVELS[LOG_LEVEL] || 0)) {
        console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`, ...args);
    }
};

// ============= REQUEST LOGGING =============
app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        log("info", `${req.method} ${req.url} ${res.statusCode} ${duration}ms`);
    });
    next();
});

// ============= HEALTH CHECKS =============
app.get("/health", (req: Request, res: Response) => {
    const memUsage = process.memoryUsage();
    const health = {
        status: "ok" as "ok" | "degraded" | "unhealthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
        services: {
            database: "connected" as "connected" | "error",
            memory: {
                usedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                totalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
            },
        },
    };

    db.get("SELECT 1", [], (err: Error | null) => {
        if (err) {
            health.services.database = "error";
            health.status = "degraded";
            return res.status(503).json(health);
        }
        res.json(health);
    });
});

app.get("/ready", (req: Request, res: Response) => {
    db.get("SELECT 1", [], (err: Error | null) => {
        if (err) {
            return res.status(503).json({ ready: false, error: "Database not ready" });
        }
        res.json({ ready: true });
    });
});

// ============= DEBUG ENDPOINTS (DEVELOPMENT ONLY) =============
if (process.env.NODE_ENV !== "production") {
    app.get("/debug-users", authenticateToken, async (req: Request, res: Response) => {
        if (!isAdmin(req.user?.email || "")) {
            return res.status(403).json({ message: "Admin access required" });
        }
        try {
            const schema = await new Promise((resolve, reject) => {
                db.all("PRAGMA table_info(users)", (err, rows) => {
                    if (err) reject(err);
                    resolve(rows);
                });
            });
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
            await new Promise<void>((resolve, reject) => {
                db.run("DELETE FROM users", (err) => {
                    if (err) reject(err);
                    resolve();
                });
            });
            res.send("Users table cleared");
        } catch (err: any) {
            res.status(500).send("Error clearing users");
        }
    });

    app.get("/trigger-backup", authenticateToken, async (req: Request, res: Response) => {
        if (!isAdmin(req.user?.email || "")) {
            return res.status(403).json({ message: "Admin access required" });
        }
        try {
            await backupDatabase();
            res.send("Backup triggered successfully");
        } catch (err: any) {
            res.status(500).send("Backup failed");
        }
    });
}

// ============= TRIGGER BACKUP ENDPOINT (PUBLIC WITH RATE LIMIT) =============
app.get("/trigger-backup", async (req: Request, res: Response) => {
    try {
        try {
            await backupDatabase();
            log("info", "Backup successful");
        } catch (b2Err: any) {
            log("error", "Backblaze B2 backup failed:", b2Err.message);
            log("info", "Falling back to local backup...");
            await localBackup();
            log("info", "Local backup successful");
        }
        res.send("Backup triggered successfully");
    } catch (err: any) {
        log("error", "Backup failed:", err.message);
        res.status(500).send("Backup failed");
    }
});

// ============= CREATE HTTP SERVER & SOCKET.IO =============
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

// ============= ROUTE MOUNTING =============

// Auth routes (register, login, me) - login specifically rate-limited
app.use("/api/login", loginLimiter);
app.use("/api", authRoutes);

// Routes with authentication middleware
app.use("/api/posts", authenticateToken, postRoutes);
app.use("/api/users", authenticateToken, usersRouter);
app.use("/api/dms", authenticateToken, dmRoutes({ db, SECRET_KEY }));
app.use("/api/settings", authenticateToken, settingsRouter);
app.use("/api", authenticateToken, rantRoutes);
app.use("/api", authenticateToken, battleRoutes);
app.use("/api", authenticateToken, squadRoutes);
app.use("/api", authenticateToken, tournamentRoutes);
app.use("/api/shop", authenticateToken, shopRoutes);

// Showdown routes need io instance
const showdownRouter = showdownRoutes(io);
app.use("/api", authenticateToken, showdownRouter);

// ============= SOCKET.IO SETUP =============
io.on("connection", (socket) => {
    log("info", `Socket connected: ${socket.id}`);

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
            const battle = await dbGet("SELECT votes, opponent_votes FROM hype_battles WHERE id = ?", [battleId]);
            if (!battle) return;

            if (voteFor === "creator") {
                await new Promise<void>((resolve, reject) => {
                    db.run("UPDATE hype_battles SET votes = votes + 1 WHERE id = ?", [battleId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
            } else {
                await new Promise<void>((resolve, reject) => {
                    db.run("UPDATE hype_battles SET opponent_votes = opponent_votes + 1 WHERE id = ?", [battleId], (err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
            }

            const updatedBattle = await dbGet("SELECT votes, opponent_votes FROM hype_battles WHERE id = ?", [battleId]);
            io.to(`battle-${battleId}`).emit("vote_update", updatedBattle);
        } catch (err) {
            log("error", "Vote broadcast error:", err);
        }
    });

    socket.on("disconnect", () => {
        log("info", `Socket disconnected: ${socket.id}`);
    });
});

// ============= SERVE STATIC FILES =============
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// SPA fallback
app.get("*", (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

// ============= ERROR HANDLING =============
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
    if (err.message && err.message.includes("Only")) {
        res.status(400).json({ message: err.message, code: "INVALID_FILE_TYPE" });
        return;
    }
    log("error", `Unhandled error at ${req.method} ${req.path}:`, err.message, err.stack);
    res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
});

// ============= GLOBAL ERROR HANDLERS =============
process.on("uncaughtException", (err) => {
    log("error", "Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason) => {
    log("error", "Unhandled Rejection:", reason);
});

// ============= START SERVER =============
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    log("info", `Server running on port ${PORT}`);
});

export default app;
