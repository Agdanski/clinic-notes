import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.resolve(process.env.CLINIC_NOTES_DATA_DIR || path.join(root, "data"));
const uploadDir = path.resolve(process.env.CLINIC_NOTES_UPLOAD_DIR || path.join(root, "uploads"));
const backupRoot = path.resolve(process.env.CLINIC_NOTES_BACKUP_DIR || path.join(root, "backups"));
const dbPath = path.join(dataDir, "clinic-notes.sqlite");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const targetDir = path.join(backupRoot, stamp);

await mkdir(targetDir, { recursive: true });
const db = new Database(dbPath, { readonly: true });
await db.backup(path.join(targetDir, "clinic-notes.sqlite"));
await copyDirectory(uploadDir, path.join(targetDir, "uploads"));
await writeFile(path.join(targetDir, "README.txt"), [
  "Clinic Notes backup",
  `Created: ${new Date().toISOString()}`,
  `Database source: ${dbPath}`,
  `Upload source: ${uploadDir}`,
  "",
  "Keep at least 30 daily backups and 12 monthly backups. Test restoring monthly."
].join("\n"), "utf8");
db.close();

console.log(`Backup created: ${targetDir}`);

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  let entries = [];
  try {
    entries = await readdir(source, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}
