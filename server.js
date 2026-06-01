const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const Database = require("better-sqlite3");
const express = require("express");
const multer = require("multer");

const ROOT_DIR = __dirname;
const PORT = Number(process.env.CLINIC_NOTES_PORT || 3000);
const HOST = process.env.CLINIC_NOTES_HOST || "0.0.0.0";
const DATA_DIR = path.resolve(process.env.CLINIC_NOTES_DATA_DIR || path.join(ROOT_DIR, "data"));
const UPLOAD_DIR = path.resolve(process.env.CLINIC_NOTES_UPLOAD_DIR || path.join(ROOT_DIR, "uploads"));
const BACKUP_DIR = path.resolve(process.env.CLINIC_NOTES_BACKUP_DIR || path.join(ROOT_DIR, "backups"));
const DB_PATH = path.join(DATA_DIR, "clinic-notes.sqlite");
const SESSION_COOKIE = "clinic_notes_session";
const SESSION_HOURS = 12;
const COOKIE_SECURE = String(process.env.CLINIC_NOTES_COOKIE_SECURE || "").toLowerCase() === "true";
const PUBLIC_FILES = new Set(["/login.html", "/login.js", "/server.css", "/app.css"]);
const CLIENT_FILES = new Set([
  "index.html",
  "initial.html",
  "exam.html",
  "consent.html",
  "dashboard.html",
  "demo.html",
  "admin.html",
  "app.css",
  "initial.css",
  "exam.css",
  "consent.css",
  "dashboard.css",
  "server.css",
  "app.js",
  "initial.js",
  "exam.js",
  "consent.js",
  "dashboard.js",
  "demo.js",
  "central-storage.js",
  "admin.js"
]);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'doctor', 'staff')),
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS storage (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id),
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS storage_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT,
  action TEXT NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  changed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  username TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  summary TEXT,
  metadata_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_key TEXT,
  patient_name TEXT,
  category TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL,
  report_type TEXT,
  report_date TEXT,
  body_area TEXT,
  notes TEXT,
  uploaded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL
);
`);

seedAdminUser();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Cache-Control", "no-store");
  next();
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
      cb(null, `${id}-${safeFileName(file.originalname)}`);
    }
  }),
  limits: { fileSize: 30 * 1024 * 1024 }
});

app.post("/api/login", (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = db.prepare("SELECT * FROM users WHERE username = ? AND disabled = 0").get(username);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    audit(req, null, "login_failed", "user", username, "Failed login attempt", {});
    return res.status(401).json({ error: "Invalid username or password." });
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(tokenHash, user.id, expires, now.toISOString());
  audit(req, user, "login_success", "user", String(user.id), "User logged in", {});
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60
  }));
  res.json({ user: publicUser(user) });
});

app.post("/api/logout", requireAuth, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(req.sessionTokenHash);
  audit(req, req.user, "logout", "user", String(req.user.id), "User logged out", {});
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "Lax",
    path: "/",
    maxAge: 0
  }));
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/storage", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT key, value, updated_at FROM storage ORDER BY key").all();
  const storage = {};
  rows.forEach((row) => {
    storage[row.key] = row.value;
  });
  res.json({ storage, updatedAt: Object.fromEntries(rows.map((row) => [row.key, row.updated_at])) });
});

app.put("/api/storage/:key", requireAuth, (req, res) => {
  const key = storageKey(req.params.key);
  const value = String(req.body?.value ?? "");
  const now = new Date().toISOString();
  const prior = db.prepare("SELECT value FROM storage WHERE key = ?").get(key);
  db.prepare(`
    INSERT INTO storage (key, value, updated_by, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  `).run(key, value, req.user.id, now);
  db.prepare("INSERT INTO storage_versions (key, value, action, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)")
    .run(key, value, prior ? "update" : "create", req.user.id, now);
  audit(req, req.user, prior ? "storage_update" : "storage_create", "storage", key, storageSummary(key, value), { key });
  res.json({ ok: true, key, updatedAt: now });
});

app.delete("/api/storage/:key", requireAuth, (req, res) => {
  const key = storageKey(req.params.key);
  const prior = db.prepare("SELECT value FROM storage WHERE key = ?").get(key);
  db.prepare("DELETE FROM storage WHERE key = ?").run(key);
  db.prepare("INSERT INTO storage_versions (key, value, action, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)")
    .run(key, prior?.value || null, "delete", req.user.id, new Date().toISOString());
  audit(req, req.user, "storage_delete", "storage", key, `Deleted ${key}`, { key });
  res.json({ ok: true });
});

app.get("/api/users", requireAdmin, (_req, res) => {
  const users = db.prepare("SELECT id, username, display_name, role, disabled, created_at, updated_at FROM users ORDER BY username").all();
  res.json({ users });
});

app.post("/api/users", requireAdmin, (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const displayName = String(req.body?.displayName || username).trim();
  const role = String(req.body?.role || "staff").trim();
  const password = String(req.body?.password || "");
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: "Username must be 3-40 letters/numbers/dots/dashes." });
  if (!["admin", "doctor", "staff"].includes(role)) return res.status(400).json({ error: "Invalid role." });
  if (password.length < 10) return res.status(400).json({ error: "Password must be at least 10 characters." });
  const hashed = hashPassword(password);
  const now = new Date().toISOString();
  try {
    const result = db.prepare(`
      INSERT INTO users (username, display_name, role, password_salt, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(username, displayName, role, hashed.salt, hashed.hash, now, now);
    audit(req, req.user, "user_create", "user", String(result.lastInsertRowid), `Created user ${username}`, { role });
    res.status(201).json({ ok: true });
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) return res.status(409).json({ error: "Username already exists." });
    throw error;
  }
});

app.patch("/api/users/:id", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  if (!user) return res.status(404).json({ error: "User not found." });
  const role = req.body?.role !== undefined ? String(req.body.role) : user.role;
  const disabled = req.body?.disabled !== undefined ? Number(Boolean(req.body.disabled)) : user.disabled;
  if (!["admin", "doctor", "staff"].includes(role)) return res.status(400).json({ error: "Invalid role." });
  if (id === req.user.id && disabled) return res.status(400).json({ error: "You cannot disable your own account." });
  db.prepare("UPDATE users SET role = ?, disabled = ?, updated_at = ? WHERE id = ?")
    .run(role, disabled, new Date().toISOString(), id);
  if (req.body?.password) {
    const password = String(req.body.password);
    if (password.length < 10) return res.status(400).json({ error: "Password must be at least 10 characters." });
    const hashed = hashPassword(password);
    db.prepare("UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?")
      .run(hashed.salt, hashed.hash, new Date().toISOString(), id);
  }
  audit(req, req.user, "user_update", "user", String(id), `Updated user ${user.username}`, { role, disabled });
  res.json({ ok: true });
});

app.get("/api/audit", requireAdmin, (req, res) => {
  const limit = Math.max(1, Math.min(500, Number(req.query.limit || 100)));
  const rows = db.prepare("SELECT * FROM audit_events ORDER BY id DESC LIMIT ?").all(limit);
  res.json({ events: rows });
});

app.post("/api/audit", requireAuth, (req, res) => {
  const action = String(req.body?.action || "client_event").slice(0, 80);
  const entityType = String(req.body?.entityType || "client").slice(0, 80);
  const entityId = String(req.body?.entityId || "").slice(0, 120);
  const summary = String(req.body?.summary || action).slice(0, 500);
  audit(req, req.user, action, entityType, entityId, summary, req.body?.metadata || {});
  res.json({ ok: true });
});

app.post("/api/uploads", requireAuth, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });
  const now = new Date().toISOString();
  const patientName = String(req.body?.patientName || "").trim();
  const patientKey = String(req.body?.patientKey || slug(patientName)).trim();
  const category = String(req.body?.category || "diagnostic-report").trim();
  const result = db.prepare(`
    INSERT INTO uploads (
      patient_key, patient_name, category, original_name, stored_name, mime_type, size,
      report_type, report_date, body_area, notes, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patientKey,
    patientName,
    category,
    req.file.originalname,
    req.file.filename,
    req.file.mimetype,
    req.file.size,
    String(req.body?.reportType || ""),
    String(req.body?.reportDate || ""),
    String(req.body?.bodyArea || ""),
    String(req.body?.notes || ""),
    req.user.id,
    now
  );
  audit(req, req.user, "upload_create", "upload", String(result.lastInsertRowid), `Uploaded ${req.file.originalname}`, { patientName, category });
  res.status(201).json({ id: result.lastInsertRowid, storedName: req.file.filename, createdAt: now });
});

app.get("/api/uploads", requireAuth, (req, res) => {
  const patientKey = String(req.query.patientKey || "").trim();
  const rows = patientKey
    ? db.prepare("SELECT * FROM uploads WHERE patient_key = ? ORDER BY id DESC").all(patientKey)
    : db.prepare("SELECT * FROM uploads ORDER BY id DESC LIMIT 200").all();
  res.json({ uploads: rows });
});

app.get("/api/uploads/:id/download", requireAuth, (req, res) => {
  const uploadRow = db.prepare("SELECT * FROM uploads WHERE id = ?").get(Number(req.params.id));
  if (!uploadRow) return res.status(404).send("Not found");
  const filePath = path.join(UPLOAD_DIR, uploadRow.stored_name);
  audit(req, req.user, "upload_download", "upload", String(uploadRow.id), `Downloaded ${uploadRow.original_name}`, {});
  res.download(filePath, uploadRow.original_name);
});

app.post("/api/backups", requireAdmin, async (req, res, next) => {
  try {
    const result = await runBackup();
    audit(req, req.user, "backup_create", "backup", path.basename(result.backupDir), "Manual backup created", result);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.use("/assets", express.static(path.join(ROOT_DIR, "assets"), { etag: false, maxAge: 0 }));
app.use((req, res, next) => {
  if (req.path === "/" && req.method === "GET") return res.redirect("/dashboard.html");
  if (PUBLIC_FILES.has(req.path)) return res.sendFile(path.join(ROOT_DIR, req.path.replace(/^\//, "")));
  next();
});
app.use(requireAuthPage);
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const fileName = decodeURIComponent(req.path.replace(/^\/+/, ""));
  if (!CLIENT_FILES.has(fileName)) return res.status(404).send("Not found");
  next();
});
app.use(express.static(ROOT_DIR, { etag: false, maxAge: 0, index: false }));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Server error. Please contact IT." });
});

http.createServer(app).listen(PORT, HOST, () => {
  console.log(`Clinic Notes running at http://${HOST}:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`Uploads: ${UPLOAD_DIR}`);
});

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: "Login required." });
  req.user = session.user;
  req.sessionTokenHash = session.tokenHash;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required." });
    next();
  });
}

function requireAuthPage(req, res, next) {
  const session = readSession(req);
  if (!session) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/dashboard.html");
    return res.redirect(`/login.html?next=${nextUrl}`);
  }
  req.user = session.user;
  req.sessionTokenHash = session.tokenHash;
  next();
}

function readSession(req) {
  const token = parseCookies(req.headers.cookie || "")[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = db.prepare(`
    SELECT sessions.token_hash, sessions.expires_at, users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.disabled = 0
  `).get(tokenHash, new Date().toISOString());
  if (!row) return null;
  return { tokenHash, user: row };
}

function seedAdminUser() {
  const count = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  if (count > 0) return;
  const username = String(process.env.CLINIC_NOTES_ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = String(process.env.CLINIC_NOTES_ADMIN_PASSWORD || "ChangeMe-ClinicNotes!");
  const hashed = hashPassword(password);
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (username, display_name, role, password_salt, password_hash, created_at, updated_at)
    VALUES (?, ?, 'admin', ?, ?, ?, ?)
  `).run(username, "Clinic Administrator", hashed.salt, hashed.hash, now, now);
  console.warn(`Initial admin user created: ${username}`);
  if (!process.env.CLINIC_NOTES_ADMIN_PASSWORD) {
    console.warn("Default admin password is ChangeMe-ClinicNotes! - change it before live use.");
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseCookies(header) {
  return Object.fromEntries(header.split(";").map((part) => {
    const index = part.indexOf("=");
    if (index < 0) return ["", ""];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role
  };
}

function storageKey(key) {
  const cleaned = String(key || "").trim();
  if (!/^[a-zA-Z0-9_.:-]{1,120}$/.test(cleaned)) throw new Error("Invalid storage key.");
  return cleaned;
}

function storageSummary(key, value) {
  try {
    const parsed = JSON.parse(value);
    const size = Array.isArray(parsed) ? `${parsed.length} record(s)` : `${Object.keys(parsed || {}).length} item(s)`;
    return `Saved ${key}: ${size}`;
  } catch {
    return `Saved ${key}`;
  }
}

function audit(req, user, action, entityType, entityId, summary, metadata) {
  db.prepare(`
    INSERT INTO audit_events (user_id, username, action, entity_type, entity_id, summary, metadata_json, ip, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    user?.id || null,
    user?.username || null,
    action,
    entityType || null,
    entityId || null,
    summary || null,
    JSON.stringify(metadata || {}),
    req?.ip || null,
    new Date().toISOString()
  );
}

function safeFileName(name) {
  return path.basename(String(name || "upload.bin")).replace(/[^a-zA-Z0-9_. -]/g, "_").slice(0, 120) || "upload.bin";
}

function slug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
}

async function runBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetDir = path.join(BACKUP_DIR, stamp);
  await fsp.mkdir(targetDir, { recursive: true });
  const dbTarget = path.join(targetDir, "clinic-notes.sqlite");
  await db.backup(dbTarget);
  const uploadTarget = path.join(targetDir, "uploads");
  await copyDirectory(UPLOAD_DIR, uploadTarget);
  await writeRetentionManifest(targetDir);
  return { backupDir: targetDir, database: dbTarget, uploads: uploadTarget };
}

async function copyDirectory(source, target) {
  await fsp.mkdir(target, { recursive: true });
  const entries = await fsp.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) await fsp.copyFile(from, to);
  }
}

async function writeRetentionManifest(targetDir) {
  const manifest = [
    "Clinic Notes backup",
    `Created: ${new Date().toISOString()}`,
    `Database source: ${DB_PATH}`,
    `Upload source: ${UPLOAD_DIR}`,
    "",
    "Keep at least 30 daily backups and 12 monthly backups. Test restoring monthly."
  ].join("\n");
  await fsp.writeFile(path.join(targetDir, "README.txt"), manifest, "utf8");
}
