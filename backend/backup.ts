import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const dbPath = path.join(__dirname, "../users.db");
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const fileId = process.env.GOOGLE_DRIVE_FILE_ID || "";

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

// Retry logic for network issues
async function withRetry(fn: () => Promise<void>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Attempt ${i + 1} failed:`, err);
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Upload users.db to Google Drive
export async function backupDatabase() {
  await withRetry(async () => {
    try {
      const fileData = await fs.readFile(dbPath);
      const checksum = crypto.createHash("sha256").update(fileData).digest("hex");
      console.log(`[${new Date().toISOString()}] Backup checksum: ${checksum}`);
      const fileMetadata = { name: "users.db" };
      const media = { mimeType: "application/x-sqlite3", body: fileData };
      let response;
      if (fileId) {
        response = await drive.files.update({
          fileId,
          media,
          fields: "id",
        });
      } else {
        response = await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id",
        });
        console.log(`[${new Date().toISOString()}] New File ID: ${response.data.id}`);
      }
      console.log(`[${new Date().toISOString()}] Database backed up to Google Drive`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Backup error:`, err);
      throw err;
    }
  });
}

// Restore users.db from Google Drive
export async function restoreDatabase() {
  if (!fileId) {
    console.log(`[${new Date().toISOString()}] No backup file ID set, skipping restore`);
    return;
  }
  await withRetry(async () => {
    try {
      const response = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const fileData = Buffer.from(response.data as ArrayBuffer);
      const checksum = crypto.createHash("sha256").update(fileData).digest("hex");
      console.log(`[${new Date().toISOString()}] Restore checksum: ${checksum}`);
      await fs.writeFile(dbPath, fileData);
      console.log(`[${new Date().toISOString()}] Database restored from Google Drive`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Restore error:`, err);
      throw err;
    }
  });
}
