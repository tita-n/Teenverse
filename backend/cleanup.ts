import { initDb } from './database';

// Initialize database and define cleanup function
let db: any; // Temporary storage for db instance

initDb().then((database) => {
    db = database; // Store db for use in cleanupPosts
    console.log("Database initialized for cleanup");
}).catch((err) => {
    console.error("Failed to initialize database for cleanup:", err);
    process.exit(1); // Exit or handle gracefully
});

export function cleanupPosts() {
    if (!db) {
        console.error("Database not initialized for cleanup");
        return;
    }
    db.run(`
        DELETE FROM posts 
        WHERE mode = 'undercover' 
        AND likes < 50 
        AND created_at < DATETIME('now', '-1 day')
    `, (err: Error | null) => {
        if (err) {
            console.error("Error cleaning up posts:", err);
        } else {
            console.log("Undercover posts cleaned up successfully");
        }
    });
}

// Run cleanup every hour
setInterval(cleanupPosts, 60 * 60 * 1000);
