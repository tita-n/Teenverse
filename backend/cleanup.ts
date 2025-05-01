import { db } from "./database";

export async function cleanupPosts() {
    try {
        await db.run(`
            DELETE FROM posts 
            WHERE mode = 'undercover' 
            AND likes < 50 
            AND created_at < DATETIME('now', '-1 day')
        `);
        console.log(`[${new Date().toISOString()}] Cleanup: Deleted old undercover posts with < 50 likes`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Cleanup error:`, err);
    }
}

// Run cleanup every hour
setInterval(cleanupPosts, 60 * 60 * 1000);

// Run once on startup
cleanupPosts();