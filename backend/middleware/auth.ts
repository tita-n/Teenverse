import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY environment variable is required");
}

declare global {
    namespace Express {
        interface Request {
            user: {
                id?: number;
                email: string;
                verified: number;
                role: string;
            };
        }
    }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Authentication token required" });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY!) as Record<string, any>;

        // Attach user info from JWT directly
        req.user = {
            id: decoded.id,
            email: decoded.email,
            verified: decoded.verified,
            role: decoded.role || "user",
        };

        next();
    } catch (err: any) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired" });
        }
        return res.status(403).json({ message: "Invalid or expired token" });
    }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.user || req.user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
    }
    next();
}

export function generateToken(payload: { id: number; email: string; verified: number; role: string }): string {
    return jwt.sign(payload, SECRET_KEY!, { expiresIn: "24h" });
}
