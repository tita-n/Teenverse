import { google } from "googleapis";
import fs from "fs/promises";
import path from "path";

const dbPath = path.join(__dirname, "../users.db");
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const fileId = process.env.GOOGLE_DRIVE_FILE_ID || ""; // Set after first upload

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

auth.on("tokens", (tokens) => {
  if (tokens.refresh_token) {
    console.log("New refresh token:", tokens.refresh_token);
  }
});

const drive = google.drive({ version: "v3", auth });

// Upload users.db to Google Drive
export async function backupDatabase() {
  try {
    const fileMetadata = { name: "users.db" };
    const media = {
      mimeType: "application/x-sqlite3",
      body: await fs.readFile(dbPath),
    };
    let response;
    if (fileId) {
      // Update existing file
      response = await drive.files.update({
        fileId,
        media,
        fields: "id",
      });
    } else {
      // Create new file
      response = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: "id",
      });
      console.log(`[${new Date().toISOString()}] New File ID: ${response.data.id}`);
    }
    console.log(`[${new Date().toISOString()}] Database backed up to Google Drive`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Backup error:`, err);
  }
}

// Restore users.db from Google Drive
export async function restoreDatabase() {
  if (!fileId) {
    console.log(`[${new Date().toISOString()}] No backup file ID set, skipping restore`);
    return;
  }
  try {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );
    await fs.writeFile(dbPath, Buffer.from(response.data as ArrayBuffer));
    console.log(`[${new Date().toISOString()}] Database restored from Google Drive`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Restore error:`, err);
  }
}
