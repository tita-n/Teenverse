import { db } from "./database";

export async function backupDatabase() {
    try {
        console.log(`[${new Date().toISOString()}] Starting database backup (Neon handles automatic backups)`);
        const result = await db.query("SELECT NOW() as timestamp");
        console.log(`[${new Date().toISOString()}] Database backup check completed at: ${result.rows[0].timestamp}`);
    } catch (err: any) {
        console.error(`[${new Date().toISOString()}] Backup error:`, err.message);
        throw err;
    }
}

export async function localBackup() {
    console.log(`[${new Date().toISOString()}] Local backup requested (Neon provides automatic PostgreSQL backups)`);
    await backupDatabase();
}
