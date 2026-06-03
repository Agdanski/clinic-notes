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
  "reports.html",
  "dashboard.html",
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
  "reports.js",
  "dashboard.js",
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
CREATE TABLE IF NOT EXISTS patient_ids (
  patient_key TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL UNIQUE,
  patient_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_counters (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
`);

ensureColumn("uploads", "patient_id", "TEXT");
seedAdminUser();
normalizeStoredPatientIds();

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
  normalizeStoredPatientIds();
  const rows = db.prepare("SELECT key, value, updated_at FROM storage ORDER BY key").all();
  const storage = {};
  rows.forEach((row) => {
    storage[row.key] = row.value;
  });
  res.json({ storage, updatedAt: Object.fromEntries(rows.map((row) => [row.key, row.updated_at])) });
});

app.put("/api/storage/:key", requireAuth, (req, res) => {
  const key = storageKey(req.params.key);
  const requestedValue = String(req.body?.value ?? "");
  const now = new Date().toISOString();
  const priorStorage = readStorageObject();
  const prior = priorStorage[key];
  const nextStorage = { ...priorStorage, [key]: requestedValue };
  const normalized = normalizePatientIdsInStorage(nextStorage);
  saveChangedStorageValues(priorStorage, normalized, req.user.id, now);
  const value = normalized[key] ?? requestedValue;
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

app.get("/api/patients", requireAuth, (_req, res) => {
  normalizeStoredPatientIds();
  const patients = db.prepare("SELECT patient_id, patient_key, patient_name, created_at, updated_at FROM patient_ids ORDER BY patient_id").all();
  res.json({ patients });
});

app.post("/api/patients/reserve", requireAuth, (req, res) => {
  const patientId = reservePatientId();
  audit(req, req.user, "patient_id_reserve", "patient", patientId, `Reserved patient ID ${patientId}`, { patientId });
  res.json({ patientId });
});

app.post("/api/patients", requireAuth, (req, res) => {
  try {
    const patient = savePatientProfile(req.body || {}, req.user.id);
    audit(req, req.user, "patient_profile_save", "patient", patient.patientId, `Saved patient ${patient.patientName}`, { patientId: patient.patientId });
    res.json({ patient });
  } catch (error) {
    res.status(400).json({ error: error.message || "Could not save patient." });
  }
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
  const patientId = getOrCreatePatientId(patientName || patientKey, patientName);
  const category = String(req.body?.category || "diagnostic-report").trim();
  const result = db.prepare(`
    INSERT INTO uploads (
      patient_key, patient_id, patient_name, category, original_name, stored_name, mime_type, size,
      report_type, report_date, body_area, notes, uploaded_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    patientKey,
    patientId,
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
  const patientId = String(req.query.patientId || "").trim();
  const rows = patientKey
    ? db.prepare("SELECT * FROM uploads WHERE patient_key = ? ORDER BY id DESC").all(patientKey)
    : patientId
    ? db.prepare("SELECT * FROM uploads WHERE patient_id = ? ORDER BY id DESC").all(patientId)
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

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (columns.includes(column)) return;
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
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

function patientKey(value) {
  return String(value || "").trim().toLowerCase();
}

function clinicPatientKey(value) {
  return patientKey(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "";
}

function nextPatientId() {
  const row = db.prepare("SELECT value FROM app_counters WHERE name = 'patient_id'").get();
  const next = Number(row?.value || 0) + 1;
  db.prepare(`
    INSERT INTO app_counters (name, value)
    VALUES ('patient_id', ?)
    ON CONFLICT(name) DO UPDATE SET value = excluded.value
  `).run(next);
  return `P${String(next).padStart(6, "0")}`;
}

function reservePatientId() {
  const patientId = nextPatientId();
  const key = `reserved-${patientId.toLowerCase()}`;
  const now = new Date().toISOString();
  db.prepare("INSERT INTO patient_ids (patient_key, patient_id, patient_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(key, patientId, `Reserved ${patientId}`, now, now);
  return patientId;
}

function assignPatientIdToName(patientId, nameOrKey, displayName = "") {
  const id = String(patientId || "").trim().toUpperCase();
  const name = String(displayName || nameOrKey || "").trim();
  const key = clinicPatientKey(nameOrKey || name);
  if (!id || !key) return getOrCreatePatientId(nameOrKey, displayName);
  const now = new Date().toISOString();
  const existingByKey = db.prepare("SELECT patient_id FROM patient_ids WHERE patient_key = ?").get(key);
  if (existingByKey && existingByKey.patient_id !== id) return existingByKey.patient_id;
  const existingById = db.prepare("SELECT patient_key FROM patient_ids WHERE patient_id = ?").get(id);
  if (existingById && existingById.patient_key !== key && !existingById.patient_key.startsWith("reserved-")) {
    throw new Error(`Patient ID ${id} already belongs to another patient.`);
  }
  if (existingById) {
    db.prepare("UPDATE patient_ids SET patient_key = ?, patient_name = ?, updated_at = ? WHERE patient_id = ?")
      .run(key, name || key, now, id);
    return id;
  }
  db.prepare("INSERT INTO patient_ids (patient_key, patient_id, patient_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(key, id, name || key, now, now);
  return id;
}

function getOrCreatePatientId(nameOrKey, displayName = "") {
  const name = String(displayName || nameOrKey || "").trim();
  const key = clinicPatientKey(nameOrKey || name);
  if (!key) return "";
  const existing = db.prepare("SELECT patient_id, patient_name FROM patient_ids WHERE patient_key = ?").get(key);
  const now = new Date().toISOString();
  if (existing) {
    if (name && name !== existing.patient_name) {
      db.prepare("UPDATE patient_ids SET patient_name = ?, updated_at = ? WHERE patient_key = ?").run(name, now, key);
    }
    return existing.patient_id;
  }
  const patientId = nextPatientId();
  db.prepare("INSERT INTO patient_ids (patient_key, patient_id, patient_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(key, patientId, name || key, now, now);
  return patientId;
}

function patientDisplayName(data) {
  const firstName = String(data.firstName || "").trim();
  const middleName = String(data.middleName || "").trim();
  const lastName = String(data.lastName || "").trim();
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ").trim();
  return String(data.patientName || fullName || data.preferredName || data.janePatientNumber || "").trim();
}

function profileKeyForPatient(data) {
  const name = patientDisplayName(data);
  return patientKey(name);
}

function findProfileKeyByJaneId(profiles, janePatientNumber) {
  const jane = String(janePatientNumber || "").trim().toLowerCase();
  if (!jane) return "";
  return Object.entries(profiles).find(([, profile]) => (
    String(profile?.janePatientNumber || "").trim().toLowerCase() === jane
  ))?.[0] || "";
}

function savePatientProfile(data, userId) {
  const displayName = patientDisplayName(data);
  if (!displayName) throw new Error("Patient name is required.");
  const storage = readStorageObject();
  const storageKeyName = "clinic-patient-profiles-v1";
  const profiles = parseStorageJson(storage[storageKeyName], {});
  const existingJaneKey = findProfileKeyByJaneId(profiles, data.janePatientNumber);
  const profileKey = existingJaneKey || profileKeyForPatient(data);
  const existing = profiles[profileKey] || {};
  const patientId = existing.patientId
    || (data.patientId ? assignPatientIdToName(data.patientId, displayName, displayName) : getOrCreatePatientId(displayName, displayName));
  const now = new Date().toISOString();
  profiles[profileKey] = {
    ...existing,
    patientName: displayName,
    patientId,
    firstName: String(data.firstName || existing.firstName || "").trim(),
    middleName: String(data.middleName || existing.middleName || "").trim(),
    lastName: String(data.lastName || existing.lastName || "").trim(),
    preferredName: String(data.preferredName || existing.preferredName || "").trim(),
    janePatientNumber: String(data.janePatientNumber || existing.janePatientNumber || "").trim(),
    dob: String(data.dob || existing.dob || "").trim(),
    patientAge: String(data.patientAge || "").trim(),
    needsManualVisitNumber: Boolean(data.needsManualVisitNumber || existing.needsManualVisitNumber),
    source: String(data.source || existing.source || "manual"),
    updatedAt: now
  };
  if (!existing.createdAt) profiles[profileKey].createdAt = now;
  const before = { ...storage };
  const after = { ...storage, [storageKeyName]: JSON.stringify(profiles) };
  saveChangedStorageValues(before, after, userId, now);
  return profiles[profileKey];
}

function readStorageObject() {
  const rows = db.prepare("SELECT key, value FROM storage").all();
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

function parseStorageJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed === undefined || parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function normalizeStoredPatientIds() {
  const storage = readStorageObject();
  const normalized = normalizePatientIdsInStorage(storage);
  saveChangedStorageValues(storage, normalized, null, new Date().toISOString());
  normalizeUploadPatientIds();
}

function normalizePatientIdsInStorage(storage) {
  const normalized = { ...storage };
  normalizeProfiles(normalized);
  normalizeRecordArray(normalized, "clinic-initial-visit-records-v1", "fields");
  normalizeRecordArray(normalized, "clinic-vsc-exam-records-v1", "fields");
  normalizeRecordArray(normalized, "clinic-informed-consents-v1", "fields");
  normalizeRecordArray(normalized, "clinic-repeat-soap-drafts-v2", null);
  normalizeRecordArray(normalized, "clinic-diagnostic-reports-v1", null);
  return normalized;
}

function normalizeProfiles(storage) {
  const key = "clinic-patient-profiles-v1";
  if (!Object.prototype.hasOwnProperty.call(storage, key)) return;
  const profiles = parseStorageJson(storage[key], {});
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) return;
  let changed = false;
  Object.entries(profiles).forEach(([profileKey, profile]) => {
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) return;
    const patientName = String(profile.patientName || profileKey || "").trim();
    const patientId = profile.patientId
      ? assignPatientIdToName(profile.patientId, patientName || profileKey, patientName)
      : getOrCreatePatientId(patientName || profileKey, patientName);
    if (patientId && profile.patientId !== patientId) {
      profile.patientId = patientId;
      changed = true;
    }
  });
  if (changed) storage[key] = JSON.stringify(profiles);
}

function normalizeRecordArray(storage, key, fieldsKey) {
  if (!Object.prototype.hasOwnProperty.call(storage, key)) return;
  const records = parseStorageJson(storage[key], []);
  if (!Array.isArray(records)) return;
  let changed = false;
  records.forEach((record) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) return;
    const fields = fieldsKey ? record[fieldsKey] || {} : record;
    const patientName = String(fields.patientName || record.patientName || "").trim();
    if (!patientName) return;
    const patientId = getOrCreatePatientId(patientName, patientName);
    if (!patientId) return;
    if (record.patientId !== patientId) {
      record.patientId = patientId;
      changed = true;
    }
    if (fieldsKey && record[fieldsKey] && record[fieldsKey].patientId !== patientId) {
      record[fieldsKey].patientId = patientId;
      changed = true;
    }
  });
  if (changed) storage[key] = JSON.stringify(records);
}

function saveChangedStorageValues(before, after, userId, now) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  keys.forEach((key) => {
    const beforeValue = before[key];
    const afterValue = after[key];
    if (beforeValue === afterValue) return;
    db.prepare(`
      INSERT INTO storage (key, value, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at
    `).run(key, String(afterValue ?? ""), userId, now);
    db.prepare("INSERT INTO storage_versions (key, value, action, changed_by, changed_at) VALUES (?, ?, ?, ?, ?)")
      .run(key, String(afterValue ?? ""), beforeValue === undefined ? "create" : "update", userId, now);
  });
}

function normalizeUploadPatientIds() {
  const rows = db.prepare("SELECT id, patient_key, patient_name, patient_id FROM uploads").all();
  rows.forEach((row) => {
    if (row.patient_id) return;
    const patientId = getOrCreatePatientId(row.patient_name || row.patient_key, row.patient_name);
    if (!patientId) return;
    db.prepare("UPDATE uploads SET patient_id = ? WHERE id = ?").run(patientId, row.id);
  });
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
