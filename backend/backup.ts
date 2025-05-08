import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

const dbPath = path.join(__dirname, "../users.db");
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const fileId = process.env.GOOGLE_DRIVE_FILE_ID || "";

// Configure OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  "http://localhost" // Redirect URI (not used for refresh token flow)
);
if (refreshToken) {
  oAuth2Client.setCredentials({ refresh_token: refreshToken });
}

const drive = google.drive({ version: "v3", auth: oAuth2Client });

// Retry logic for network issues
async function withRetry(fn: () => Promise<void>, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await fn();
      return;
    } catch (err: any) {
      console.error(
        `[${new Date().toISOString()}] Attempt ${i + 1} failed:`,
        err.message,
        err.stack
      );
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// Buffer to readable stream
function bufferToStream(buffer: Buffer): Readable {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// Upload users.db to Google Drive
export async function backupDatabase() {
  await withRetry(async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting backup...`);
      // Verify credentials
      if (!clientId || !clientSecret) {
        throw new Error("Missing CLIENT_ID or CLIENT_SECRET");
      }
      if (!refreshToken) {
        throw new Error("Missing GOOGLE_REFRESH_TOKEN");
      }
      // Read database file for checksum
      const fileData = await fs.readFile(dbPath).catch((err) => {
        throw new Error(`Failed to read users.db: ${err.message}`);
      });
      const checksum = crypto.createHash("sha256").update(fileData).digest("hex");
      console.log(`[${new Date().toISOString()}] Backup checksum: ${checksum}`);
      const fileMetadata = { name: "users.db" };
      const media = { mimeType: "application/x-sqlite3", body: bufferToStream(fileData) };
      let response;
      if (fileId) {
        console.log(`[${new Date().toISOString()}] Updating existing file: ${fileId}`);
        response = await drive.files.update({
          fileId,
          media,
          fields: "id",
        });
      } else {
        console.log(`[${new Date().toISOString()}] Creating new file`);
        response = await drive.files.create({
          requestBody: fileMetadata,
          media,
          fields: "id",
        });
        console.log(`[${new Date().toISOString()}] New File ID: ${response.data.id}`);
      }
      console.log(`[${new Date().toISOString()}] Database backed up to Google Drive`);
    } catch (err: any) {
      console.error(
        `[${new Date().toISOString()}] Backup error:`,
        err.message,
        err.stack
      );
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
      console.log(`[${new Date().toISOString()}] Starting restore for file: ${fileId}`);
      const response = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );
      const fileData = Buffer.from(response.data as ArrayBuffer);
      const checksum = crypto.createHash("sha256").update(fileData).digest("hex");
      console.log(`[${new Date().toISOString()}] Restore checksum: ${checksum}`);
      await fs.writeFile(dbPath, fileData);
      console.log(`[${new Date().toISOString()}] Database restored from Google Drive`);
    } catch (err: any) {
      console.error(
        `[${new Date().toISOString()}] Restore error:`,
        err.message,
        err.stack
      );
      throw err;
    }
  });
}
