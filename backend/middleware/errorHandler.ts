import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
    statusCode: number;
    code: string;

    constructor(message: string, statusCode: number = 500, code: string = "INTERNAL_ERROR") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "AppError";
    }
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
    res.status(404).json({ message: "Route not found", code: "NOT_FOUND" });
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            message: err.message,
            code: err.code,
        });
        return;
    }

    console.error(`[${new Date().toISOString()}] Unhandled error at ${req.method} ${req.path}:`, err.message, err.stack);

    res.status(500).json({
        message: "Internal server error",
        code: "INTERNAL_ERROR",
    });
}

// Multer error handler
export function multerErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({ message: "File too large", code: "FILE_TOO_LARGE" });
        return;
    }
    if (err.message && err.message.includes("Only video files are allowed")) {
        res.status(400).json({ message: err.message, code: "INVALID_FILE_TYPE" });
        return;
    }
    next(err);
}
