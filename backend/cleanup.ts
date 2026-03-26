import { query } from "./database";

export async function cleanupPosts() {
    try {
        await query(`
            DELETE FROM posts 
            WHERE mode = 'undercover' 
            AND likes < 50 
            AND created_at < NOW() - INTERVAL '1 day'
        `);
        console.log(`[${new Date().toISOString()}] Cleanup completed: removed expired undercover posts`);
    } catch (err) {
        console.error(`[${new Date().toISOString()}] Cleanup error:`, err);
    }
}

setInterval(cleanupPosts, 60 * 60 * 1000);
