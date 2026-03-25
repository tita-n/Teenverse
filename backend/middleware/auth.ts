import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { dbGet } from "../db";
import { db } from "../database";
import { AppError } from "./errorHandler";
import { JwtPayload } from "../types";

declare global {
    namespace Express {
        interface Request {
            user: {
                id: number;
                email: string;
                verified: number;
                role: string;
            };
        }
    }
}

const SECRET_KEY = process.env.SECRET_KEY;
if (!SECRET_KEY) {
    throw new Error("SECRET_KEY environment variable is required");
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return next(new AppError("Authentication token required", 401, "NO_TOKEN"));
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY) as JwtPayload;

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
            return next(new AppError("Token expired", 401, "TOKEN_EXPIRED"));
        }
        return next(new AppError("Invalid or expired token", 401, "INVALID_TOKEN"));
    }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (req.user.role !== "admin") {
        return next(new AppError("Admin access required", 403, "NOT_ADMIN"));
    }
    next();
}

export function generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, SECRET_KEY as string, { expiresIn: "24h" });
}
