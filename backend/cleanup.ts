import { initDb } from './database.ts';

// Initialize database and mount routes
initDb().then((db) => {
    app.set('db', db); // Store db in app for routes to access

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
