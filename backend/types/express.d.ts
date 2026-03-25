import { User } from "../types";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: number;
                email: string;
                verified: number;
                username?: string;
                coins?: number;
                xp?: number;
                creator_badge?: number;
            };
        }
    }
}

export {};
