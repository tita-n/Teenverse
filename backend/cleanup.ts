import { db } from "./database";

export function cleanupPosts() {
    db.run(`
        DELETE FROM posts 
        WHERE mode = 'undercover' 
        AND likes < 50 
        AND created_at < DATETIME('now', '-1 day')
    `);
}

// Run cleanup every hour
setInterval(cleanupPosts, 60 * 60 * 1000);