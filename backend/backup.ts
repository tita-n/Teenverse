import B2 from "b2";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

console.log(`[${new Date().toISOString()}] Initializing backup module...`);

const dbPath = path.join(__dirname, "../users.db");
const b2KeyId = process.env.B2_KEY_ID;
const b2ApplicationKey = process.env.B2_APPLICATION_KEY;
const b2BucketName = process.env.B2_BUCKET_NAME || "Teenverse";

// Validate credentials at module level
if (!b2KeyId || !b2ApplicationKey) {
  console.error(
    `[${new Date().toISOString()}] Backup module error: Missing B2_KEY_ID or B2_APPLICATION_KEY`
  );
}

// Initialize Backblaze B2 client
let b2;
try {
  b2 = new B2({
    applicationKeyId: b2KeyId,
    applicationKey: b2ApplicationKey,
  });
  await b2.authorize();
  console.log(`[${new Date().toISOString()}] Backblaze B2 authorized`);
} catch (err: any) {
  console.error(
    `[${new Date().toISOString()}] Backblaze B2 setup error:`,
    err.message,
    err.stack
  );
}

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

// Upload users.db to Backblaze B2
export async function backupDatabase() {
  if (!b2) {
    throw new Error("Backblaze B2 not initialized due to invalid credentials");
  }
  await withRetry(async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting B2 backup...`);
      // Verify credentials
      if (!b2KeyId || !b2ApplicationKey) {
        throw new Error("Missing B2_KEY_ID or B2_APPLICATION_KEY");
      }
      // Read database file for checksum
      const fileData = await fs.readFile(dbPath).catch((err) => {
        throw new Error(`Failed to read users.db: ${err.message}`);
      });
      const checksum = crypto.createHash("sha256").update(fileData).digest("hex");
      console.log(`[${new Date().toISOString()}] Backup checksum: ${checksum}`);
      // Get bucket info
      const bucketResponse = await b2.getBucket({ bucketName: b2BucketName });
      const bucketId = bucketResponse.data.buckets[0].bucketId;
      // Upload file
      const uploadUrlResponse = await b2.getUploadUrl({ bucketId });
      const uploadUrl = uploadUrlResponse.data.uploadUrl;
      const uploadAuthToken = uploadUrlResponse.data.authorizationToken;
      const fileName = `users.db`;
      await b2.uploadFile({
        uploadUrl,
        uploadAuthToken,
        fileName,
        data: fileData,
        mime: "application/x-sqlite3",
      });
      console.log(`[${new Date().toISOString()}] Database backed up to Backblaze B2`);
    } catch (err: any) {
      console.error(
        `[${new Date().toISOString()}] B2 backup error:`,
        err.message,
        err.stack
      );
      throw err;
    }
  });
}

// Restore users.db from Backblaze B2
export async function restoreDatabase() {
  if (!b2) {
    console.log(
      `[${new Date().toISOString()}] Backblaze B2 not initialized, skipping restore`
    );
    return;
  }
  await withRetry(async () => {
    try {
      console.log(`[${new Date().toISOString()}] Starting B2 restore...`);
      // Get bucket info
      const bucketResponse = await b2.getBucket({ bucketName: b2BucketName });
      const bucketId = bucketResponse.data.buckets[0].bucketId;
      // List files to find users.db
      const fileListResponse = await b2.listFileNames({
        bucketId,
        startFileName: "users.db",
        maxFileCount: 1,
      });
      const file = fileListResponse.data.files.find((f: any) => f.fileName === "users.db");
      if (!file) {
        console.log(
          `[${new Date().toISOString()}] No users.db found in B2 bucket, skipping restore`
        );
        return;
      }
      // Download file
      const downloadResponse = await b2.downloadFileByName({
        bucketName: b2BucketName,
        fileName: "users.db",
        responseType: "arraybuffer",
      });
      const fileData = Buffer.from(downloadResponse.data);
      const checksum = crypto.createHash("sha256").update(fileData).digest("hex");
      console.log(`[${new Date().toISOString()}] Restore checksum: ${checksum}`);
      await fs.writeFile(dbPath, fileData);
      console.log(`[${new Date().toISOString()}] Database restored from Backblaze B2`);
    } catch (err: any) {
      console.error(
        `[${new Date().toISOString()}] B2 restore error:`,
        err.message,
        err.stack
      );
      throw err;
    }
  });
}

// Local backup to Render disk
export async function localBackup() {
  try {
    console.log(`[${new Date().toISOString()}] Starting local backup...`);
    const fileData = await fs.readFile(dbPath);
    const checksum = crypto.createHash("sha256").update(fileData).digest("hex");
    const backupPath = path.join(__dirname, `../users-backup-${Date.now()}.db`);
    await fs.writeFile(backupPath, fileData);
    console.log(
      `[${new Date().toISOString()}] Local backup saved: ${backupPath}, checksum: ${checksum}`
    );
  } catch (err: any) {
    console.error(
      `[${new Date().toISOString()}] Local backup error:`,
      err.message,
      err.stack
    );
    throw err;
  }
  }
