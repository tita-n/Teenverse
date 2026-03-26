declare global {
    namespace Express {
        interface Request {
            user: {
                id: number;
                email: string;
                verified: number;
                role?: string;
                username?: string;
                coins?: number;
                xp?: number;
                creator_badge?: number;
            };
        }
    }
}

export {};
