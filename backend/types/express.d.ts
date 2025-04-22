declare global {
    namespace Express {
        interface Request {
            user?: { 
                email: string; 
                verified: number; 
                id?: number; 
            };
        }
    }
}

// Ensures the file is treated as a module
export {};
