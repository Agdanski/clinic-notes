const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";
const CONSENT_STORAGE_KEY = "clinic-informed-consents-v1";
const DIAGNOSTIC_REPORT_STORAGE_KEY = "clinic-diagnostic-reports-v1";

const adultSixMonthSymptoms = [
  "Headaches", "Migraines", "Back Pain", "Neck Pain", "Pins & Needles in Arms", "Pins & Needles in Legs",
  "Numbness in Toes", "Numbness in Fingers", "Dizziness", "Fainting", "Loss of Balance", "Stiff Neck",
  "Fatigue", "Sleeping Problems", "Tension", "Nervousness", "Fever", "Upset Stomach", "Diarrhea",
  "Constipation", "Depression", "Irritability", "Mood Swings", "Loss of Taste", "Loss of Smell",
  "Buzzing in Ears", "Ringing in Ears", "Sensitive Eyes", "Cold Hands", "Cold Feet", "Cold Sweats",
  "Heartburn", "Ulcers", "Problem Urinating", "Gas/Bloating", "Gas / Bloating", "Joint pain/Stiffness",
  "Joint pain / Stiffness"
];

const adultDiagnosisFlags = [
  "High blood pressure", "Hardening of the arteries", "Diabetes", "Heart or blood vessel disease",
  "High cholesterol", "Bone spurs on neck", "Whiplash", "Are you considered overweight", "Stroke", "Cancer"
];

const adultStrokeScreenFlags = [
  "Sudden severe headache", "Sudden, severe headache", "Sudden unusual neck pain", "Sudden neck pain",
  "Dizziness, vertigo, or loss of balance", "Double vision", "Blurred vision",
  "Difficulty speaking", "Difficulty swallowing", "Numbness or tingling in your face or limbs",
  "Weakness in your arms or legs", "Drop attacks", "Fainting episodes",
  "Nausea or vomiting not explained by illness"
];

const childSymptoms = [
  "Weight loss", "Weight gain", "Dizziness", "Light sensitivity", "Irritability", "Colic", "Bloating/gas",
  "Food/drug reactions", "Allergies", "Sinus congestion", "Asthma", "Dental problems", "Frequent colds",
  "Sore throats", "Ear Pain/infection", "Ear Pain / infection", "Headaches", "Seizures",
  "Loss of balance", "Loss of concentration", "Reduced mobility", "Urinary problems", "Diarrhea",
  "Sleeping problems"
];

const childDiseases = [
  "Influenza", "Mumps", "Measles", "Rubella", "Poliomyelitis", "Chicken Pox", "Tuberculosis",
  "Hepatitis", "Meningitis"
];

const childTrauma = ["Fracture", "Dislocation", "Concussion", "Whiplash", "Head trauma", "Sports injuries"];

const familyHistoryItems = [
  "Heart Disease", "Heart disease", "Stroke", "Cancer", "Arthritis", "Diabetes", "Hypertension",
  "Osteoarthritis", "Osteoporosis", "Disc disease", "Migraines", "Headaches", "Scoliosis"
];
const janeSymptomItems = [
  ...adultSixMonthSymptoms,
  "Headache", "Neck pain", "Pain between shoulders", "Low back pain", "Knee pain", "Foot pain",
  "Spinal curvature", "Joint pain", "Stiffness in joints", "General stiffness", "Arthritis",
  "Walking problems", "Vision problems", "Ear aches", "Hearing difficulty", "Chest pain",
  "Difficulty breathing", "High/low blood pressure"
];
const janePreviousItems = [
  "Childhood traumas", "Sports injuries", "Falls", "Broken bones", "Workplace injury",
  "Motor vehicle accidents", "Surgeries", "Heavy lifting", "Repetitive strain",
  "Overhead work", "Prolonged sitting/standing", "Computer/desk work"
];

const $ = (selector) => document.querySelector(selector);
let lastMappedConsent = null;
let selectedPatient = null;
let patientDirectory = [];
let reservedManualPatientId = "";
let janeBatchRows = [];

function on(id, eventName, handler) {
  const element = document.getElementById(id);
  if (element) element.addEventListener(eventName, handler);
}

function setStatus(message) {
  const status = $("#statusLine") || $("#manualPatientStatus") || $("#janeBatchStatus");
  if (status) status.textContent = message;
}

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

async function syncStorageKeyToServer(key) {
  if (!window.ClinicServer) return;
  const value = localStorage.getItem(key) || "";
  const response = await fetch(`/api/storage/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ value })
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not save to the clinic server.");
  }
}

async function refreshServerStorage() {
  if (!window.ClinicServer) return {};
  const response = await fetch("/api/storage", { credentials: "same-origin" });
  if (!response.ok) return {};
  const data = await response.json().catch(() => ({}));
  const storage = data.storage || {};
  Object.entries(storage).forEach(([key, value]) => localStorage.setItem(key, value));
  return storage;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/\uFB00/g, "ff")
    .replace(/\uFB01/g, "fi")
    .replace(/\uFB02/g, "fl")
    .replace(/\uFB03/g, "ffi")
    .replace(/\uFB04/g, "ffl")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function patientKey(name) {
  return String(name || "").trim().toLowerCase();
}

function slug(name) {
  return patientKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function calculateAge(dobValue) {
  if (!dobValue) return "";
  const dob = new Date(`${dobValue}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const birthdayThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  if (today < birthdayThisYear) age -= 1;
  return age >= 0 ? String(age) : "";
}

function displayAge(patient) {
  return calculateAge(patient?.dob) || patient?.patientAge || "";
}

function patientProfileList() {
  const profiles = readJson(PROFILE_STORAGE_KEY, {});
  return Object.entries(profiles)
    .map(([key, profile]) => ({
      key,
      patientKey: key,
      patientId: profile?.patientId || "",
      patientName: profile?.patientName || key,
      firstName: profile?.firstName || "",
      middleName: profile?.middleName || "",
      lastName: profile?.lastName || "",
      preferredName: profile?.preferredName || "",
      janePatientNumber: profile?.janePatientNumber || "",
      dob: profile?.dob || "",
      patientAge: displayAge(profile),
      needsManualVisitNumber: Boolean(profile?.needsManualVisitNumber),
      source: "profile"
    }))
    .filter((patient) => patient.patientName);
}

async function loadServerPatientList() {
  if (!window.ClinicServer) return [];
  const response = await fetch("/api/patients", { credentials: "same-origin" });
  if (!response.ok) return [];
  const data = await response.json().catch(() => ({}));
  return (data.patients || []).map((patient) => ({
    patientKey: patient.patient_key || patientKey(patient.patient_name),
    patientId: patient.patient_id || "",
    patientName: patient.patient_name || "",
    dob: "",
    patientAge: "",
    source: "server"
  }));
}

function mergePatients(profilePatients, serverPatients) {
  const merged = new Map();
  [...profilePatients, ...serverPatients].forEach((patient) => {
    const key = patientKey(patient.patientName || patient.patientKey);
    if (!key) return;
    const prior = merged.get(key) || {};
    merged.set(key, {
      ...prior,
      ...patient,
      dob: prior.dob || patient.dob || "",
      patientAge: prior.patientAge || patient.patientAge || "",
      patientId: patient.patientId || prior.patientId || "",
      firstName: prior.firstName || patient.firstName || "",
      middleName: prior.middleName || patient.middleName || "",
      lastName: prior.lastName || patient.lastName || "",
      preferredName: prior.preferredName || patient.preferredName || "",
      janePatientNumber: prior.janePatientNumber || patient.janePatientNumber || "",
      needsManualVisitNumber: Boolean(prior.needsManualVisitNumber || patient.needsManualVisitNumber)
    });
  });
  return [...merged.values()].sort((a, b) => a.patientName.localeCompare(b.patientName));
}

async function loadPatientDirectory() {
  const profilePatients = patientProfileList();
  const serverPatients = await loadServerPatientList();
  patientDirectory = mergePatients(profilePatients, serverPatients);
  renderPatientSearchResults();
  if (selectedPatient) {
    const match = patientDirectory.find((patient) => patientKey(patient.patientName) === patientKey(selectedPatient.patientName));
    if (match) selectPatient(match, { silent: true });
  }
}

function patientFileUrl(page, patient) {
  const name = patient?.patientName || $("#patientName")?.value?.trim() || "";
  return name ? `${page}?patient=${encodeURIComponent(name)}` : page;
}

function updatePatientFileLinks() {
  const patient = selectedPatient || { patientName: $("#patientName")?.value?.trim() || "" };
  const links = [
    ["fileInitial", "initial.html"],
    ["fileConsent", "consent.html"],
    ["fileExam", "exam.html"],
    ["fileSoap", "index.html"]
  ];
  links.forEach(([id, page]) => {
    const link = document.getElementById(id);
    if (link) link.href = patientFileUrl(page, patient);
  });
}

function renderSelectedPatient() {
  const card = $("#selectedPatientCard");
  if (!card) return;
  const openButton = $("#fileSoap");
  if (!selectedPatient) {
    card.hidden = true;
    card.innerHTML = "";
    if (openButton) {
      openButton.classList.add("is-disabled");
      openButton.setAttribute("aria-disabled", "true");
    }
    updatePatientFileLinks();
    return;
  }
  card.hidden = false;
  if (openButton) {
    openButton.classList.remove("is-disabled");
    openButton.setAttribute("aria-disabled", "false");
  }
  const age = displayAge(selectedPatient) || "Not documented";
  card.innerHTML = `
    <h3>${escapeHtml(selectedPatient.patientName)}</h3>
    <dl>
      <dt>ID</dt><dd>${escapeHtml(selectedPatient.patientId || "Assigned after server save")}</dd>
      <dt>Jane ID</dt><dd>${escapeHtml(selectedPatient.janePatientNumber || "Not documented")}</dd>
      <dt>DOB</dt><dd>${escapeHtml(selectedPatient.dob || "Not documented")}</dd>
      <dt>Age</dt><dd>${escapeHtml(age)}</dd>
    </dl>
  `;
  updatePatientFileLinks();
}

function selectPatient(patient, options = {}) {
  selectedPatient = {
    patientName: patient.patientName || "",
    patientId: patient.patientId || "",
    firstName: patient.firstName || "",
    middleName: patient.middleName || "",
    lastName: patient.lastName || "",
    preferredName: patient.preferredName || "",
    janePatientNumber: patient.janePatientNumber || "",
    dob: patient.dob || "",
    patientAge: displayAge(patient),
    needsManualVisitNumber: Boolean(patient.needsManualVisitNumber)
  };
  if ($("#patientName")) $("#patientName").value = selectedPatient.patientName;
  if ($("#dob") && selectedPatient.dob) $("#dob").value = selectedPatient.dob;
  if ($("#patientAge")) $("#patientAge").value = selectedPatient.patientAge;
  updateLinks();
  renderSelectedPatient();
  if (!options.silent) setStatus(`Opened patient file: ${selectedPatient.patientName}`);
}

function dateSearchVariants(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return [];
  const [, yyyy, mm, dd] = match;
  return [`${mm}/${dd}/${yyyy}`, `${dd}/${mm}/${yyyy}`, `${yyyy}/${mm}/${dd}`];
}

function renderPatientSearchResults() {
  const mount = $("#patientSearchResults");
  if (!mount) return;
  const rawQuery = $("#patientSearch")?.value || "";
  const query = patientKey(rawQuery);
  const parsedDateQuery = parseDate(rawQuery);
  mount.innerHTML = "";
  if (!query) {
    mount.innerHTML = patientDirectory.length ? "" : "<p class=\"patient-result-meta\">No patients found yet.</p>";
    return;
  }
  const matches = patientDirectory
    .filter((patient) => {
      const haystack = [
        patient.patientName,
        patient.firstName,
        patient.middleName,
        patient.lastName,
        patient.preferredName,
        patient.janePatientNumber,
        patient.patientId,
        patient.dob,
        ...dateSearchVariants(patient.dob),
        displayAge(patient)
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(query) || Boolean(parsedDateQuery && haystack.includes(parsedDateQuery));
    })
    .slice(0, 12);
  if (!matches.length) {
    mount.innerHTML = "<p class=\"patient-result-meta\">No matching patient found.</p>";
    return;
  }
  matches.forEach((patient) => {
    const button = document.createElement("button");
    button.type = "button";
    const age = displayAge(patient);
    button.innerHTML = `
      <span>
        <span class="patient-result-main">${escapeHtml(patient.patientName)}</span>
        <span class="patient-result-meta">${escapeHtml([patient.patientId, patient.janePatientNumber ? `Jane ${patient.janePatientNumber}` : "", patient.dob, age ? `Age ${age}` : ""].filter(Boolean).join(" | "))}</span>
      </span>
    `;
    button.addEventListener("click", () => selectPatient(patient));
    mount.appendChild(button);
  });
}

function fullPatientName(patient) {
  const full = [patient.firstName, patient.middleName, patient.lastName].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
  const preferred = String(patient.preferredName || "").trim();
  if (full && preferred) return `${full} '${preferred}'`;
  return full || String(patient.patientName || preferred || "").trim();
}

async function reserveManualPatientId() {
  if (reservedManualPatientId) return reservedManualPatientId;
  const fallback = `PENDING-${Date.now()}`;
  if (!window.ClinicServer) {
    reservedManualPatientId = fallback;
    return reservedManualPatientId;
  }
  const response = await fetch("/api/patients/reserve", {
    method: "POST",
    credentials: "same-origin"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not reserve a patient ID.");
  reservedManualPatientId = data.patientId || fallback;
  return reservedManualPatientId;
}

async function savePatient(patient, options = {}) {
  if (window.ClinicServer) {
    const response = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patient)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Could not save patient.");
    if (options.refresh !== false) await refreshServerStorage();
    return data.patient || patient;
  }
  const profiles = readJson(PROFILE_STORAGE_KEY, {});
  const name = fullPatientName(patient);
  const key = patientKey(name);
  profiles[key] = {
    ...(profiles[key] || {}),
    ...patient,
    patientName: name,
    patientId: patient.patientId || profiles[key]?.patientId || `LOCAL-${Date.now()}`,
    patientAge: calculateAge(patient.dob),
    updatedAt: new Date().toISOString()
  };
  writeJson(PROFILE_STORAGE_KEY, profiles);
  return profiles[key];
}

async function startManualPatient() {
  $("#manualPatientForm").hidden = false;
  $("#manualPatientStatus").textContent = "Reserving patient number.";
  try {
    const patientId = await reserveManualPatientId();
    $("#manualPatientId").textContent = patientId;
    $("#manualPatientStatus").textContent = "Patient number reserved. Complete the fields and save.";
  } catch (error) {
    console.error(error);
    $("#manualPatientStatus").textContent = error.message;
  }
}

async function createManualPatient() {
  const firstName = $("#manualFirstName").value.trim();
  const middleName = $("#manualMiddleName").value.trim();
  const lastName = $("#manualLastName").value.trim();
  const preferredName = $("#manualPreferredName").value.trim();
  const janePatientNumber = $("#manualJanePatientNumber").value.trim();
  const dob = $("#manualDob").value;
  const age = calculateAge(dob);
  const status = $("#manualPatientStatus");
  const name = fullPatientName({ firstName, middleName, lastName, preferredName });
  if (!name) {
    status.textContent = "First name, last name, or preferred name is required.";
    return;
  }
  const patient = {
    patientId: reservedManualPatientId,
    patientName: name,
    firstName,
    middleName,
    lastName,
    preferredName,
    janePatientNumber,
    dob,
    patientAge: age,
    needsManualVisitNumber: false,
    source: "manual"
  };
  status.textContent = window.ClinicServer ? "Saving patient on server." : "Patient created in this browser.";
  try {
    const saved = await savePatient(patient);
    reservedManualPatientId = "";
    await loadPatientDirectory();
    const created = patientDirectory.find((item) => item.patientId === saved.patientId || patientKey(item.patientName) === patientKey(saved.patientName)) || saved;
    selectPatient(created, { silent: true });
    status.textContent = `Patient saved: ${selectedPatient.patientId || saved.patientId}`;
    $("#manualFirstName").value = "";
    $("#manualMiddleName").value = "";
    $("#manualLastName").value = "";
    $("#manualPreferredName").value = "";
    $("#manualJanePatientNumber").value = "";
    $("#manualDob").value = "";
    $("#manualPatientAge").value = "";
    $("#manualPatientId").textContent = "Not assigned yet";
    $("#manualPatientForm").hidden = true;
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
  }
}

function normalizeHeader(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function rowValue(row, aliases) {
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const alias of aliases) {
    const value = normalized[normalizeHeader(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return typeof value === "string" ? value.trim() : value;
    }
  }
  return "";
}

function excelDateToIso(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const utcDays = Math.floor(value - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  const parsed = parseDate(String(value));
  if (parsed) return parsed;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function mapJaneBatchRow(row) {
  const patient = {
    janePatientNumber: rowValue(row, ["Jane Patient Number", "Patient Number", "Patient ID", "Client ID", "Jane ID", "ID"]),
    firstName: rowValue(row, ["First Name", "Firstname", "Given Name"]),
    middleName: rowValue(row, ["Middle Name", "Middlename"]),
    lastName: rowValue(row, ["Last Name", "Lastname", "Surname", "Family Name"]),
    preferredName: rowValue(row, ["Preferred Name", "Preferred", "Nickname"]),
    dob: excelDateToIso(rowValue(row, ["Date of Birth", "Birth Date", "DOB", "Birthday"])),
    source: "jane-batch",
    needsManualVisitNumber: true
  };
  patient.patientName = fullPatientName(patient);
  patient.patientAge = calculateAge(patient.dob);
  return patient;
}

async function readJaneBatchRows() {
  const file = $("#janeBatchFile").files[0];
  if (!file) throw new Error("Choose the Jane XLSX file first.");
  if (!window.XLSX) throw new Error("XLSX importer did not load. Check internet access or add the local XLSX library.");
  const buffer = await file.arrayBuffer();
  const workbook = window.XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = window.XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows.map(mapJaneBatchRow).filter((patient) => patient.patientName || patient.janePatientNumber);
}

function renderJaneBatchPreview() {
  const mount = $("#janeBatchPreview");
  mount.innerHTML = "";
  if (!janeBatchRows.length) {
    mount.innerHTML = "<p class=\"patient-result-meta\">No patients ready to import.</p>";
    return;
  }
  janeBatchRows.slice(0, 12).forEach((patient) => {
    const card = document.createElement("article");
    card.innerHTML = `
      <strong>${escapeHtml(patient.patientName || "Unnamed patient")}</strong>
      <span>${escapeHtml([patient.janePatientNumber ? `Jane ${patient.janePatientNumber}` : "", patient.dob, patient.patientAge ? `Age ${patient.patientAge}` : ""].filter(Boolean).join(" | "))}</span>
    `;
    mount.appendChild(card);
  });
  if (janeBatchRows.length > 12) {
    const more = document.createElement("p");
    more.className = "patient-result-meta";
    more.textContent = `${janeBatchRows.length - 12} more patients not shown.`;
    mount.appendChild(more);
  }
}

async function previewJaneBatch() {
  const status = $("#janeBatchStatus");
  status.textContent = "Reading Jane file.";
  try {
    janeBatchRows = await readJaneBatchRows();
    renderJaneBatchPreview();
    status.textContent = `${janeBatchRows.length} patient${janeBatchRows.length === 1 ? "" : "s"} ready to import.`;
  } catch (error) {
    console.error(error);
    status.textContent = error.message;
  }
}

async function importJaneBatch() {
  const status = $("#janeBatchStatus");
  if (!janeBatchRows.length) {
    await previewJaneBatch();
    if (!janeBatchRows.length) return;
  }
  status.textContent = "Importing Jane patients.";
  let count = 0;
  try {
    for (const patient of janeBatchRows) {
      await savePatient(patient, { refresh: false });
      count += 1;
    }
    await refreshServerStorage();
    await loadPatientDirectory();
    status.textContent = `Imported ${count} patient${count === 1 ? "" : "s"} from Jane.`;
  } catch (error) {
    console.error(error);
    status.textContent = `Imported ${count}. ${error.message}`;
  }
}

function parseDate(value) {
  const text = String(value || "")
    .replace(/\bMasel\b/gi, "March")
    .replace(/\bMaseh\b/gi, "March")
    .replace(/[“”]/g, "'")
    .trim();
  if (!text) return "";
  const monthNames = {
    january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03", april: "04", apr: "04",
    may: "05", june: "06", jun: "06", july: "07", jul: "07", august: "08", aug: "08",
    september: "09", sept: "09", sep: "09", october: "10", oct: "10", november: "11", nov: "11",
    december: "12", dec: "12"
  };
  const written = text.match(/\b(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sept|Sep|October|Oct|November|Nov|December|Dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?[\s,'-]+([\dA-Za-z€¢?]{2,4})\b/i);
  if (written) {
    const yearToken = normalizeOcrYearToken(written[3]);
    const year = yearToken.length === 2 ? inferCenturyYear(yearToken) : yearToken;
    if (!/^\d{4}$/.test(year)) return "";
    return `${year}-${monthNames[written[1].toLowerCase()]}-${written[2].padStart(2, "0")}`;
  }
  const iso = text.match(/\b(20\d{2}|19\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const mdy = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (!mdy) return "";
  const year = mdy[3].length === 2 ? inferCenturyYear(mdy[3]) : mdy[3];
  return `${year}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
}

function inferCenturyYear(twoDigitYear) {
  const yy = Number(twoDigitYear);
  const currentYY = new Date().getFullYear() % 100;
  return String(yy > currentYY ? 1900 + yy : 2000 + yy);
}

function normalizeOcrYearToken(token) {
  const text = String(token || "")
    .replace(/\?{1,2}A/g, "82")
    .replace(/[€E]/g, "8")
    .replace(/[A¢]/g, "2")
    .replace(/[oO]/g, "0")
    .replace(/[Il]/g, "1")
    .replace(/[^0-9]/g, "");
  return text;
}

function cleanValue(value) {
  return String(value || "")
    .replace(/[_]{2,}/g, " ")
    .replace(/[\u2610\u2611\u2612\u2713\u2714\u25a1\u25a0\u25cf]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[:?,-]+/, "")
    .trim();
}

function valueAfter(text, labels) {
  for (const label of labels) {
    const source = escapeRegex(label).replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`${source}\\s*[:?]?\\s*([^\\n]+)`, "i");
    const match = text.match(pattern);
    if (match) return cleanValue(match[1]);
  }
  return "";
}

function blockBetween(text, start, end) {
  const pattern = new RegExp(`${escapeRegex(start)}([\\s\\S]*?)${escapeRegex(end)}`, "i");
  const match = text.match(pattern);
  return match ? cleanValue(match[1]) : "";
}

function checkedItems(text, items) {
  const checkedMarker = "(?:\\u2611|\\u2612|\\u2713|\\u2714|\\u25a0|\\u25cf|\\[x\\]|\\(x\\)|\\b[xX]\\b)";
  return items.filter((item) => {
    const label = escapeRegex(item).replace(/\s+/g, "\\s+");
    const before = new RegExp(`${checkedMarker}[\\s\\S]{0,30}${label}`, "i");
    const after = new RegExp(`${label}[\\s\\S]{0,30}${checkedMarker}`, "i");
    return before.test(text) || after.test(text);
  });
}

function sectionText(text, starts, ends, fallback = "") {
  const startPattern = starts.map((item) => escapeRegex(item)).join("|");
  const startMatch = text.match(new RegExp(startPattern, "i"));
  if (!startMatch) return fallback;
  const afterStart = text.slice(startMatch.index + startMatch[0].length);
  const endPattern = ends.map((item) => escapeRegex(item)).join("|");
  const endMatch = afterStart.match(new RegExp(endPattern, "i"));
  return endMatch ? afterStart.slice(0, endMatch.index) : afterStart;
}

function yesNoNear(text, phrase) {
  const source = escapeRegex(phrase).replace(/\s+/g, "\\s+");
  const snippet = text.match(new RegExp(`${source}[\\s\\S]{0,220}`, "i"))?.[0] || "";
  const checkedMarker = "(?:\\u2611|\\u2612|\\u2713|\\u2714|\\u25a0|\\u25cf|\\[x\\]|\\(x\\)|\\b[xX]\\b)";
  if (new RegExp(`${checkedMarker}[\\s\\S]{0,20}Yes|Yes[\\s\\S]{0,20}${checkedMarker}`, "i").test(snippet)) return "Y";
  if (new RegExp(`${checkedMarker}[\\s\\S]{0,20}No|No[\\s\\S]{0,20}${checkedMarker}`, "i").test(snippet)) return "N";
  return "";
}

function mergeLine(title, values) {
  const items = values.filter(Boolean);
  return items.length ? `${title}: ${Array.from(new Set(items)).join(", ")}` : "";
}

function appendIfValue(lines, title, value) {
  if (value) lines.push(`${title}: ${value}`);
}

function legacyValueBetween(text, start, ends) {
  const block = sectionText(text, [start], ends, "");
  if (!block) return "";
  return cleanLegacyFreeText(block.split("\n").filter((line) => !/^\s*$/.test(line)).join(" "));
}

function cleanLegacyFreeText(value) {
  return cleanValue(value)
    .replace(/^[_\s]+/, "")
    .replace(/\bmons?\s+a\s*ge\b/gi, "months ago")
    .replace(/\bage[:\s]*sex[:\s]*[^\n]+/gi, "")
    .replace(/\bQ\s*(Yes|No)\b/gi, "")
    .replace(/\bOQ?\s*(Yes|No)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function legacyRawValueAfter(text, label, endLabels) {
  const pattern = new RegExp(`${escapeRegex(label)}\\s*:?\\s*([\\s\\S]*?)(?:${endLabels.map(escapeRegex).join("|")})`, "i");
  const match = text.match(pattern);
  return match ? cleanLegacyFreeText(match[1]) : "";
}

function saneLegacyPatientName(value) {
  const text = cleanLegacyFreeText(value)
    .replace(/[^A-Za-z .'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const letters = (text.match(/[A-Za-z]/g) || []).length;
  if (letters < 5) return "";
  if (/\b(birthdate|date|age|sex|address)\b/i.test(text)) return "";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 4) return "";
  return text;
}

function numericAge(value, dob) {
  const match = String(value || "").match(/\b(\d{1,3})\b/);
  if (match) {
    const age = Number(match[1]);
    if (age >= 0 && age <= 120) return String(age);
  }
  return calculateAge(dob);
}

function legacyItemChecked(section, item) {
  const label = escapeRegex(item).replace(/\s+/g, "\\s+");
  const prefix = "(?:\\[x\\]|\\(x\\)|x+\\w{0,2}|X+\\w{0,2}|@|✓|✔|☑|\\[|[~\\[/]?\\s*[WBS]\\w{0,2}|[1-9]\\d?[-/]?)";
  return new RegExp(`(?:^|\\n|\\s)${prefix}\\s*${label}`, "i").test(section);
}

function legacyCheckedInSection(text, start, ends, items) {
  const section = sectionText(text, [start], ends, "");
  if (!section) return [];
  return items.filter((item) => legacyItemChecked(section, item));
}

function legacyYesNo(text, start, ends) {
  const section = sectionText(text, [start], ends, "");
  if (!section) return "";
  if (/(?:Q|O|0)?\s*[\/\\]\s*No\b|(?:@|X|x|✓|✔|☑)\s*No\b/i.test(section)) return "N";
  if (/(?:Q|O|0)?\s*[\/\\]\s*Yes\b|(?:@|X|x|✓|✔|☑)\s*Yes\b/i.test(section)) return "Y";
  if (legacyItemChecked(section, "No")) return "N";
  if (legacyItemChecked(section, "Yes")) return "Y";
  return "";
}

function legacySeverity(text) {
  const worst = legacyRawValueAfter(text, "Please describe how it feels when this problem is at its worse", ["On a scale", "Compare this problem"]);
  const number = worst.match(/\b([1-9]|10)\b/);
  if (number) return number[1];
  const scale = sectionText(text, ["rate the severity of your pain"], ["Compare this problem", "Your ability"], "");
  if (/least|most/i.test(scale)) return "";
  return cleanLegacyFreeText(scale);
}

function checkedFromText(text, items) {
  const marked = checkedItems(text, items);
  if (marked.length) return marked;
  return [];
}

function textLines(text) {
  return normalizeText(text).split("\n").map((line) => cleanValue(line)).filter(Boolean);
}

function isJaneNoiseLine(line) {
  return (
    /^=+ PAGE \d+ =+$/i.test(line) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4},/.test(line) ||
    /^https?:\/\//i.test(line) ||
    /^Gdanski Chiropractic Clinic$/i.test(line) ||
    /^Edit Close preview$/i.test(line) ||
    /^Select an option/i.test(line) ||
    /^Select a /i.test(line) ||
    /^Questionnaires .* Step/i.test(line) ||
    /^Consents .* Step/i.test(line) ||
    /^Profile Information .* Step/i.test(line) ||
    /^You are completing/i.test(line) ||
    /^You are filling out/i.test(line) ||
    /^Only staff members/i.test(line) ||
    /^Terms of Use/i.test(line) ||
    /^Privacy Policy/i.test(line) ||
    line === "Yes" ||
    line === "No" ||
    line === "Yes No" ||
    line === "Draw Type" ||
    /^Canada$/i.test(line) ||
    /^C$/.test(line) ||
    /^xx$/i.test(line) ||
    /^xxxx$/i.test(line)
  );
}

function stripRequired(label) {
  return String(label || "").replace(/\s*(?:\u2013|-)\s*Required\s*$/i, "").replace(/\*$/, "").trim();
}

function isStopLabel(line, stopLabels) {
  const normalized = stripRequired(line).toLowerCase();
  return stopLabels.some((label) => normalized === label.toLowerCase() || normalized.startsWith(`${label.toLowerCase()}:`));
}

function janeValueAfter(text, labels, stopLabels = []) {
  const lines = textLines(text);
  const labelList = labels.map((label) => label.toLowerCase());
  for (let index = 0; index < lines.length; index += 1) {
    const stripped = stripRequired(lines[index]);
    const lower = stripped.toLowerCase();
    const label = labelList.find((item) => lower === item || lower.startsWith(`${item}:`) || lower.startsWith(`${item} `));
    if (!label) continue;

    const sameLine = cleanValue(stripped.slice(label.length).replace(/^[:?]/, ""));
    if (sameLine && !isJaneNoiseLine(sameLine) && !/required$/i.test(sameLine)) return sameLine;

    const values = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      const candidate = lines[next];
      if (isStopLabel(candidate, [...stopLabels, ...labels])) break;
      if (isJaneNoiseLine(candidate)) continue;
      if (/required$/i.test(candidate)) continue;
      values.push(candidate);
      if (values.length >= 6) break;
    }
    return cleanValue(values.join("; "));
  }
  return "";
}

function janePatientName(text) {
  const full = janeValueAfter(text, ["Patient Name", "Name"], ["New patients", "First Name", "Email"]);
  const first = janeValueAfter(text, ["First Name"], ["Last Name", "Email", "Preferred Name"]);
  const last = janeValueAfter(text, ["Last Name"], ["Email", "Preferred Name", "Prefix / Title", "Pronouns"]);
  const combined = [first, last].filter(Boolean).join(" ");
  if (combined) return combined;
  return /new patients are required|first name|email|required/i.test(full) ? "" : full;
}

function janeDob(text) {
  const direct = parseDate(janeValueAfter(text, ["Date of Birth"], ["Gender", "Sex", "Occupation", "Guardian"]));
  if (direct) return direct;
  const snippet = sectionText(text, ["Date of Birth"], ["Gender", "Sex", "Occupation", "Guardian"], "");
  const monthMap = {
    january: "01", jan: "01", february: "02", feb: "02", march: "03", mar: "03", april: "04", apr: "04",
    may: "05", june: "06", jun: "06", july: "07", jul: "07", august: "08", aug: "08",
    september: "09", sep: "09", october: "10", oct: "10", november: "11", nov: "11", december: "12", dec: "12"
  };
  const match = snippet.match(/Month\s+([A-Za-z]+|\d{1,2})\s+Day\s+(\d{1,2})\s+Year\s+(\d{4})/i);
  if (!match || /select/i.test(match[1])) return "";
  const month = monthMap[match[1].toLowerCase()] || match[1].padStart(2, "0");
  return `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
}

function janeYesNo(text, label) {
  const answer = janeValueAfter(text, [label], ["If yes", "If Yes", "Please", "What", "Have you", "Has the"]);
  if (/^yes\b/i.test(answer)) return "Y";
  if (/^no\b/i.test(answer)) return "N";
  return yesNoNear(text, label);
}

function selectedFromJaneAnswer(answer, items) {
  const text = cleanValue(answer);
  if (!text) return [];
  const matches = items.filter((item) => new RegExp(`\\b${escapeRegex(item).replace(/\s+/g, "\\s+")}\\b`, "i").test(text));
  return matches.length > 12 ? [] : Array.from(new Set(matches));
}

function janeListAnswer(text, label, items, stopLabels) {
  const answer = janeValueAfter(text, [label], stopLabels);
  return selectedFromJaneAnswer(answer, items);
}

function parseAdult(text) {
  const patientName = valueAfter(text, ["NAME", "Name"]);
  const dob = parseDate(valueAfter(text, ["Birthdate", "Birth date", "Date of Birth"]));
  const patientAge = valueAfter(text, ["Age"]) || calculateAge(dob);
  const symptoms = checkedItems(text, adultSixMonthSymptoms);
  const familySection = sectionText(text, ["Family history", "Family medical history"], ["Have you ever been diagnosed", "Have you ever experienced"], "");
  const diagnosisSection = sectionText(text, ["Have you ever been diagnosed", "Have you ever been told"], ["Have you ever experienced", "What is your Primary Complaint"], text);
  const strokeSection = sectionText(text, ["Have you ever experienced"], ["What is your Primary Complaint", "Primary Complaint"], text);
  const diagnoses = checkedItems(diagnosisSection, adultDiagnosisFlags);
  const strokeFlags = checkedItems(strokeSection, adultStrokeScreenFlags);
  const family = checkedItems(familySection, familyHistoryItems);
  const smoker = yesNoNear(text, "Were you ever a smoker") || yesNoNear(text, "Are you still a smoker");
  const recentXray = yesNoNear(text, "spinal x-rays taken") || yesNoNear(text, "spinal x-rays");

  const chiefComplaint = [];
  appendIfValue(chiefComplaint, "Primary complaint", valueAfter(text, ["What is your Primary Complaint", "Primary Complaint"]));
  appendIfValue(chiefComplaint, "Location", valueAfter(text, ["Describe the location of your symptoms", "Location of your symptoms"]));
  appendIfValue(chiefComplaint, "Onset", valueAfter(text, ["When did this condition begin", "When did this begin"]));
  appendIfValue(chiefComplaint, "Aggravates", blockBetween(text, "What aggravates your condition", "What relieves your condition"));
  appendIfValue(chiefComplaint, "Relieves", blockBetween(text, "What relieves your condition", "Is it getting"));
  appendIfValue(chiefComplaint, "Referral", valueAfter(text, ["Does this problem refer to other areas", "Refer to other areas"]));
  appendIfValue(chiefComplaint, "Character", blockBetween(text, "Character of pain", "Other treatment"));
  appendIfValue(chiefComplaint, "Severity", valueAfter(text, ["Rate the severity of your pain", "Severity of your pain"]));

  const history = [];
  const otherTreatments = valueAfter(text, ["Other treatment(s) tried for this condition", "Other treatments tried for this condition"]);
  history.push(mergeLine("Past 6 months", symptoms));
  appendIfValue(history, "Other treatments tried", otherTreatments);
  appendIfValue(history, "Childhood traumas", valueAfter(text, ["Childhood traumas"]));
  appendIfValue(history, "Sports injuries", valueAfter(text, ["Sports injuries"]));
  appendIfValue(history, "Falls", valueAfter(text, ["Falls"]));
  appendIfValue(history, "Broken bones", valueAfter(text, ["Broken bones"]));
  appendIfValue(history, "Workplace injury", valueAfter(text, ["Workplace injury"]));
  appendIfValue(history, "Motor vehicle accidents", valueAfter(text, ["Motor vehicle accidents"]));
  appendIfValue(history, "Past surgeries", valueAfter(text, ["Past surgeries"]));

  const contraindications = [];
  if (smoker === "Y") contraindications.push("Current or former smoker reported");
  contraindications.push(mergeLine("Diagnosed/told", diagnoses));
  contraindications.push(mergeLine("Stroke risk review flags", strokeFlags));

  return {
    patientName,
    dob,
    patientAge,
    recentXray,
    xrayDate: parseDate(valueAfter(text, ["Date x-rays taken", "X-ray date", "Date"])),
    xrayLocation: valueAfter(text, ["Location/body area", "Location", "Facility/location"]),
    chiefComplaint: chiefComplaint.filter(Boolean).join("\n"),
    historyNotes: history.filter(Boolean).join("\n"),
    contraindications: contraindications.filter(Boolean).join("\n"),
    familyHistory: Array.from(new Set(family.map(normalizeFamilyHistory))).join(", "),
    strokeRiskFlags: Array.from(new Set([...diagnoses, ...strokeFlags, ...family])).join(", ")
  };
}

function parseChild(text) {
  const patientName = valueAfter(text, ["Child's Name", "Childs Name", "Child name", "Name"]);
  const dob = parseDate(valueAfter(text, ["Birthdate", "Birth date", "Date of Birth"]));
  const patientAge = valueAfter(text, ["Age"]) || calculateAge(dob);
  const symptoms = checkedItems(text, childSymptoms);
  const diseases = checkedItems(text, childDiseases);
  const trauma = checkedItems(text, childTrauma);
  const familySection = sectionText(text, ["Family medical history", "Family history"], ["Consent", "I hereby"], "");
  const family = checkedItems(familySection, familyHistoryItems);
  const recentXray = yesNoNear(text, "Previous x-rays") || yesNoNear(text, "x-rays");

  const chiefComplaint = [];
  appendIfValue(chiefComplaint, "Complaint", valueAfter(text, ["Present health complaints or concerns", "Complaint"]));
  appendIfValue(chiefComplaint, "Onset", valueAfter(text, ["When did this start", "When did this begin"]));
  appendIfValue(chiefComplaint, "Radiation", valueAfter(text, ["Does the problem radiate", "Does this problem radiate"]));
  appendIfValue(chiefComplaint, "Worse", valueAfter(text, ["What makes this worse"]));
  appendIfValue(chiefComplaint, "Better", valueAfter(text, ["What makes this better"]));

  const history = [];
  history.push(mergeLine("Child symptoms", symptoms));
  history.push(mergeLine("Childhood diseases", diseases));
  history.push(mergeLine("Trauma/injury", trauma));
  appendIfValue(history, "Trauma description", valueAfter(text, ["Please describe"]));
  appendIfValue(history, "Major falls", valueAfter(text, ["Has the child had any major falls", "Major falls"]));
  appendIfValue(history, "Car accidents", valueAfter(text, ["Has the child been involved in any car accidents", "Car accidents"]));
  appendIfValue(history, "Hospitalized", valueAfter(text, ["Has the child ever been hospitalized"]));
  appendIfValue(history, "Surgery", valueAfter(text, ["Has the child ever had surgery"]));
  appendIfValue(history, "Additional information", valueAfter(text, ["Any Additional Information", "Additional Information"]));

  return {
    patientName,
    dob,
    patientAge,
    recentXray,
    xrayDate: parseDate(valueAfter(text, ["Date x-rays taken", "X-ray date"])),
    xrayLocation: valueAfter(text, ["Facility/location", "Location/body area", "Location"]),
    chiefComplaint: chiefComplaint.filter(Boolean).join("\n"),
    historyNotes: history.filter(Boolean).join("\n"),
    contraindications: "",
    familyHistory: Array.from(new Set(family.map(normalizeFamilyHistory))).join(", "),
    strokeRiskFlags: Array.from(new Set(family)).join(", ")
  };
}

function parseJaneAdultLike(text) {
  const patientName = janePatientName(text);
  const dob = janeDob(text);
  const patientAge = calculateAge(dob);
  const recentXray = janeYesNo(text, "Have you had x-rays taken in the last 6 months?");
  const xrayDetails = janeValueAfter(text, ["If yes, which location and date X-rays taken"], ["Other diagnostic imaging", "Please check"]);
  const xrayDate = parseDate(xrayDetails);

  const symptoms = [
    ...checkedItems(text, janeSymptomItems),
    ...janeListAnswer(text, "Please check any of the following you have had in the last 6 months", janeSymptomItems, ["Medical history", "Have you been diagnosed"])
  ];
  const diagnoses = [
    ...checkedItems(sectionText(text, ["Have you been diagnosed"], ["Have you ever experienced", "Were you ever a smoker"], ""), adultDiagnosisFlags),
    ...janeListAnswer(text, "Have you been diagnosed with or told you have any of the following", adultDiagnosisFlags, ["Have you ever experienced"])
  ];
  const strokeFlags = [
    ...checkedItems(sectionText(text, ["Have you ever experienced"], ["Were you ever a smoker", "Please list any medications"], ""), adultStrokeScreenFlags),
    ...janeListAnswer(text, "Have you ever experienced any of the following", adultStrokeScreenFlags, ["Were you ever a smoker"])
  ];
  const family = [
    ...checkedItems(sectionText(text, ["Indicate if YOU or any IMMEDIATE FAMILY"], ["Current Health Conditions", "What is your primary complaint"], ""), familyHistoryItems),
    ...janeListAnswer(text, "Indicate if YOU or any IMMEDIATE FAMILY member have had any of the following", familyHistoryItems, ["If you selected yes", "Current Health Conditions"])
  ];
  const smoker = janeYesNo(text, "Were you ever a smoker");

  const chiefComplaint = [];
  appendIfValue(chiefComplaint, "Primary complaint", janeValueAfter(text, ["What is your primary complaint"], ["Describe the location", "When did this condition", "Yes No"]));
  appendIfValue(chiefComplaint, "Location", janeValueAfter(text, ["Describe the location of your symptoms"], ["When did this condition begin"]));
  appendIfValue(chiefComplaint, "Onset", janeValueAfter(text, ["When did this condition begin"], ["Has this condition occurred before"]));
  appendIfValue(chiefComplaint, "Occurred before", janeValueAfter(text, ["Has this condition occurred before"], ["What aggravates your condition"]));
  appendIfValue(chiefComplaint, "Aggravates", janeValueAfter(text, ["What aggravates your condition"], ["What relieves your condition"]));
  appendIfValue(chiefComplaint, "Relieves", janeValueAfter(text, ["What relieves your condition"], ["Is it getting"]));
  appendIfValue(chiefComplaint, "Status", janeValueAfter(text, ["Is it getting"], ["Describe the discomfort"]));
  appendIfValue(chiefComplaint, "Pain/discomfort", janeValueAfter(text, ["Describe the discomfort and any areas or pain"], ["Rate the severity"]));
  appendIfValue(chiefComplaint, "Severity", janeValueAfter(text, ["Rate the severity of your pain"], ["Character of pain"]));
  appendIfValue(chiefComplaint, "Character", janeValueAfter(text, ["Character of pain"], ["Other treatment"]));

  const previous = [
    ...checkedItems(text, janePreviousItems),
    ...janeListAnswer(text, "Check any of the following you have had previously", janePreviousItems, ["If you answered yes", "What type of physical stress"])
  ];
  const history = [];
  history.push(mergeLine("Past 6 months", symptoms));
  appendIfValue(history, "Other treatments tried", janeValueAfter(text, ["Other treatment(s) tried for this condition"], ["What activities"]));
  appendIfValue(history, "Activities prevented", janeValueAfter(text, ["What activities does this prevent you from doing"], ["Check any", "Previous"]));
  history.push(mergeLine("Previous", previous));
  appendIfValue(history, "Previous details", janeValueAfter(text, ["If you answered yes to the to any in the previous question", "If you answered yes to any Previous"], ["What type of physical stress", "Is there anything preventing"]));
  appendIfValue(history, "Physical stress", janeValueAfter(text, ["What type of physical stress do you have at home/work"], ["Lifestyle Stress Levels"]));

  const contraindications = [];
  if (smoker === "Y") contraindications.push("Current or former smoker reported");
  contraindications.push(mergeLine("Diagnosed/told", diagnoses));
  contraindications.push(mergeLine("Stroke risk review flags", strokeFlags));

  return {
    patientName,
    dob,
    patientAge,
    recentXray,
    xrayDate,
    xrayLocation: xrayDetails,
    chiefComplaint: chiefComplaint.filter(Boolean).join("\n"),
    historyNotes: history.filter(Boolean).join("\n"),
    contraindications: contraindications.filter(Boolean).join("\n"),
    familyHistory: Array.from(new Set(family.map(normalizeFamilyHistory))).join(", "),
    strokeRiskFlags: Array.from(new Set([...diagnoses, ...strokeFlags, ...family])).join(", ")
  };
}

function parseJaneChild(text) {
  const patientName = janePatientName(text);
  const dob = janeDob(text);
  const patientAge = calculateAge(dob);
  const family = [
    ...checkedItems(sectionText(text, ["Family Medical History"], ["Thank you for completing"], ""), familyHistoryItems),
    ...janeListAnswer(text, "Has anyone in your family had any of the following diseases/conditions", familyHistoryItems, ["If cancer", "Thank you"])
  ];
  const symptoms = checkedItems(text, childSymptoms);
  const diseases = [
    ...checkedItems(text, childDiseases),
    ...janeListAnswer(text, "Has the child had any of the following infectious childhood disease", childDiseases, ["If other", "Current medications"])
  ];
  const trauma = [
    ...checkedItems(text, childTrauma),
    ...janeListAnswer(text, "Has the child ever had any of the following", childTrauma, ["Does the child experience", "Family Medical History"])
  ];

  const chiefComplaint = [];
  appendIfValue(chiefComplaint, "Major", janeValueAfter(text, ["Major"], ["Minor"]));
  appendIfValue(chiefComplaint, "Minor", janeValueAfter(text, ["Minor"], ["When did this/these begin"]));
  appendIfValue(chiefComplaint, "Onset", janeValueAfter(text, ["When did this/these begin"], ["Is this complaint getting"]));
  appendIfValue(chiefComplaint, "Status", janeValueAfter(text, ["Is this complaint getting"], ["Is it"]));
  appendIfValue(chiefComplaint, "Radiation", janeValueAfter(text, ["Does this problem radiate"], ["If yes, where"]));
  appendIfValue(chiefComplaint, "Radiates to", janeValueAfter(text, ["If yes, where"], ["What makes this better"]));
  appendIfValue(chiefComplaint, "Better", janeValueAfter(text, ["What makes this better"], ["What makes this worse"]));
  appendIfValue(chiefComplaint, "Worse", janeValueAfter(text, ["What makes this worse"], ["Is the problem worse"]));

  const history = [];
  history.push(mergeLine("Child symptoms", symptoms));
  history.push(mergeLine("Childhood diseases", diseases));
  history.push(mergeLine("Trauma/injury", trauma));
  appendIfValue(history, "Hospitalized", janeValueAfter(text, ["Has the child ever been hospitalized"], ["If Yes - provide reasons"]));
  appendIfValue(history, "Hospital details", janeValueAfter(text, ["If Yes - provide reasons/details"], ["Has the child ever had surgery"]));
  appendIfValue(history, "Surgery", janeValueAfter(text, ["Has the child ever had surgery"], ["If Yes - provide reasons"]));
  appendIfValue(history, "Adverse vaccine reactions", janeValueAfter(text, ["Any adverse reactions to vaccines"], ["If Yes - please describe"]));
  appendIfValue(history, "Major falls", janeValueAfter(text, ["Major falls"], ["Been involved in any car accidents"]));
  appendIfValue(history, "Car accidents", janeValueAfter(text, ["Been involved in any car accidents"], ["Does the child experience"]));
  appendIfValue(history, "Additional notes", janeValueAfter(text, ["write them here"], ["Consents"]));

  return {
    patientName,
    dob,
    patientAge,
    recentXray: janeYesNo(text, "Previous x-rays"),
    xrayDate: "",
    xrayLocation: "",
    chiefComplaint: chiefComplaint.filter(Boolean).join("\n"),
    historyNotes: history.filter(Boolean).join("\n"),
    contraindications: "",
    familyHistory: Array.from(new Set(family.map(normalizeFamilyHistory))).join(", "),
    strokeRiskFlags: Array.from(new Set(family)).join(", ")
  };
}

function parseJaneConsent(text) {
  const isPreview = /Close preview|\/preview\b/i.test(text);
  return {
    target: "consent",
    patientName: janePatientName(text),
    dob: janeDob(text),
    patientAge: calculateAge(janeDob(text)),
    recentXray: "",
    xrayDate: "",
    xrayLocation: "",
    chiefComplaint: "",
    historyNotes: "Jane consent form imported.",
    contraindications: "",
    familyHistory: "",
    strokeRiskFlags: "",
    consentAccepted: !isPreview && /I hereby acknowledge|I consent to chiropractic treatment|Patient Signature/i.test(text),
    claimConfirm: !isPreview && /NOT related to an active MVA|active Personal Injury|reports will NOT be sent to lawyers/i.test(text),
    janePatientSignature: !isPreview && /Patient Signature/i.test(text)
  };
}

function parseLegacyInitial(text) {
  const nameMatch = text.match(/Name[:\s]+([\s\S]{0,90}?)(?:Birthdate|Today's Date|Date|Age|Sex|Address)/i);
  const patientName = saneLegacyPatientName(nameMatch?.[1] || valueAfter(text, ["Name"]));
  const dob = parseDate(valueAfter(text, ["Birthdate", "Birth date"])) || parseDate(text.match(/Birthdate[:\s]+([^\n]+)/i)?.[1] || "");
  const patientAge = numericAge(valueAfter(text, ["Age"]), dob);
  const xrayLine = legacyValueBetween(text, "Have you had X-rays taken in the last six months", ["Name:", "Intake", "Why Chiropractic Care", "Patient Signature"]);
  const concerns = legacyValueBetween(text, "Current Concerns/Challenges", ["Other doctors seen", "Type of Treatment"]);
  const onset = legacyValueBetween(text, "When did this condition begin", ["Has the condition occurred", "Is the condition"]);
  const aggravates = legacyCheckedInSection(text, "What aggravates your condition", ["What relieves your condition"], ["Sitting", "Standing", "Bending", "Lifting", "Walking", "Lying Down", "Cold", "Dampness"]);
  const relieves = legacyCheckedInSection(text, "What relieves your condition", ["Is it getting", "Character of Pain"], ["Bed Rest", "Ice", "Heat", "Massage", "Medication"]);
  const status = legacyCheckedInSection(text, "Is it getting", ["Character of Pain"], ["Worse", "Constant", "Comes/Goes", "Better"]);
  const character = legacyCheckedInSection(text, "Character of Pain", ["Please describe", "On a scale"], ["Sharp", "Dull", "Ache", "Pins & Needles", "Numb", "Burning", "Intermittent"]);
  const conditionType = legacyCheckedInSection(text, "Is the condition", ["Date of Accident", "What aggravates"], ["Job-related", "Auto-related", "Home Injury", "Fall", "Other"]);
  const intake = legacyCheckedInSection(text, "Intake", ["Satisfaction with Diet", "Do you have a regular"], ["Coffee", "Tea", "Alcohol", "Cigarettes", "White Sugar"]);
  const diseaseHistory = legacyCheckedInSection(text, "diseases you have had", ["Please outline", "Female", "Why Chiropractic Care"], [
    "Pneumonia", "Mumps", "Influenza", "Rheumatic Fever", "Small Pox", "Pleurisy", "Polio", "Chicken Pox",
    "Arthritis", "Tuberculosis", "Diabetes", "Epilepsy", "Whooping Cough", "Cancer", "Mental Disorder",
    "Anemia", "Heart Disease", "Lumbago", "Measles", "Thyroid", "Eczema"
  ]);
  const careGoal = legacyCheckedInSection(text, "Please check the type of care desired", ["I consent", "Patient Signature"], ["Preventative Care", "Corrective Care", "Relief Care"]);
  const stress = legacyCheckedInSection(text, "Lifestyle Stress Levels", ["Check any of the following", "Why Chiropractic Care"], ["High", "Moderate", "Very Little"]);
  const stressText = sectionText(text, ["Lifestyle Stress Levels"], ["Check any of the following", "Why Chiropractic Care"], "");
  if (!stress.length && /(?:^|\n)\s*oderate\b/i.test(stressText)) stress.push("Moderate");

  const chiefComplaint = [];
  appendIfValue(chiefComplaint, "Current concerns", concerns);
  appendIfValue(chiefComplaint, "Onset", onset);
  appendIfValue(chiefComplaint, "Aggravates", aggravates.join(", "));
  appendIfValue(chiefComplaint, "Relieves", relieves.join(", "));
  appendIfValue(chiefComplaint, "Status", status.join(", "));
  appendIfValue(chiefComplaint, "Character", character.join(", "));
  appendIfValue(chiefComplaint, "Severity", legacySeverity(text));

  const history = [];
  history.push(mergeLine("Condition type", conditionType));
  history.push(mergeLine("Intake", intake));
  history.push(mergeLine("Disease history", diseaseHistory));
  history.push(mergeLine("Care goal", careGoal));
  history.push(mergeLine("Lifestyle stress", stress));
  appendIfValue(history, "Work interference", legacyValueBetween(text, "ability to work", ["Your ability to enjoy your family", "Your ability to enjoy your hobbies", "Do you suffer", "On a scale", "Have you had X-rays", "Name:"]));
  const otherConditions = legacyValueBetween(text, "Do you suffer from any other condition", ["On a scale", "Have you had X-rays"]);
  if (otherConditions && !/^than the one/i.test(otherConditions)) appendIfValue(history, "Other conditions", otherConditions);

  return {
    patientName,
    dob,
    patientAge,
    recentXray: legacyYesNo(text, "Have you had X-rays taken in the last six months", ["Name:", "Intake", "Why Chiropractic Care", "Patient Signature"]),
    xrayDate: "",
    xrayLocation: legacyYesNo(text, "Have you had X-rays taken in the last six months", ["Name:", "Intake", "Why Chiropractic Care", "Patient Signature"]) === "Y" ? xrayLine : "",
    chiefComplaint: chiefComplaint.filter(Boolean).join("\n"),
    historyNotes: history.filter(Boolean).join("\n"),
    contraindications: "",
    familyHistory: Array.from(new Set(diseaseHistory.map(normalizeFamilyHistory))).join(", "),
    strokeRiskFlags: diseaseHistory.filter((item) => /heart|diabetes|cancer/i.test(item)).join(", ")
  };
}

function normalizeFamilyHistory(item) {
  if (/heart/i.test(item)) return "Heart";
  if (/stroke/i.test(item)) return "Stroke";
  if (/cancer/i.test(item)) return "Cancer";
  if (/diabetes/i.test(item)) return "Diabetes";
  if (/arthritis/i.test(item)) return "Rheumatoid";
  return item;
}

function selectedFamilyHistory(text) {
  const selected = [];
  if (/stroke/i.test(text)) selected.push("Stroke");
  if (/heart|hypertension/i.test(text)) selected.push("Heart");
  if (/cancer/i.test(text)) selected.push("Cancer");
  if (/diabetes/i.test(text)) selected.push("Diabetes");
  if (/arthritis/i.test(text)) selected.push("Rheumatoid");
  return Array.from(new Set(selected));
}

function contraindicationOptions(text) {
  const selected = [];
  if (/osteoporosis/i.test(text)) selected.push("Osteoporosis");
  if (/no x-rays?/i.test(text)) selected.push("No x-rays");
  if (/rheumatoid/i.test(text)) selected.push("Rheumatoid arthritis");
  if (/high blood pressure|hypertension/i.test(text)) selected.push("High blood pressure");
  if (/stroke|drop attacks|double vision|difficulty speaking|difficulty swallowing/i.test(text)) selected.push("Stroke");
  if (/heart attack|heart or blood vessel|heart disease/i.test(text)) selected.push("Heart attack");
  if (/degenerative disc|disc disease/i.test(text)) selected.push("Degenerative disc disease");
  if (/disc herniation/i.test(text)) selected.push("Disc herniation");
  if (/osteoarthritis/i.test(text)) selected.push("Osteoarthritis");
  return Array.from(new Set(selected));
}

function todayParts() {
  const now = new Date();
  return {
    monthYear: now.toLocaleDateString(undefined, { month: "2-digit", year: "numeric" }),
    day: now.toLocaleDateString(undefined, { day: "2-digit" })
  };
}

function initialRecord(data) {
  const parts = todayParts();
  const fields = {
    patientName: data.patientName,
    monthYear: parts.monthYear,
    visitDay: parts.day,
    dob: data.dob,
    patientAge: data.patientAge,
    doctor: "",
    chiefComplaint: data.chiefComplaint,
    historyNotes: data.historyNotes,
    dcComments: "",
    diagnosis: "VSC",
    primarySubluxation: "",
    differentialDiagnosis: "",
    contraindications: data.contraindications,
    treatmentPlan: "Correction of VSC",
    frequency: "",
    strokeRisk: "",
    alternativeCare: "",
    examMuscleFindings: "",
    examNeuroFindings: "",
    exerciseOther: "",
    xrayOther: "",
    referredBy: "",
    md: "",
    mdLastSeen: "",
    previousDc: "",
    previousDcLastSeen: "",
    xrayDate: data.xrayDate,
    xrayLocation: data.xrayLocation,
    goals: "",
    worstHabit: "",
    majorStress: "",
    spouseName: "",
    kidsName: "",
    orthoticsLastDate: "",
    recheckDate: "",
    rmtWho: "",
    acuWho: ""
  };
  const choices = {
    visitType: "NP",
    recentXray: data.recentXray,
    familyHistory: selectedFamilyHistory(data.familyHistory),
    contraindicationOptions: contraindicationOptions(`${data.contraindications} ${data.strokeRiskFlags}`),
    riskBenefit: ["Chiropractic risks reviewed", "Chiropractic benefits reviewed", "Alternatives reviewed", "MD referral considered"],
    alternativeCareOptions: ["Massage therapy", "Acupuncture", "Allopathic medicine", "Physiotherapy", "Exercise/rehab", "Medication", "Imaging"],
    xrayRecommend: ["None"]
  };
  return {
    id: `initial-${slug(data.patientName)}`,
    fields,
    choices,
    summary: initialSummary(fields, choices),
    updatedAt: new Date().toISOString()
  };
}

function initialSummary(fields, choices) {
  return [
    "Gdanski Chiropractic Clinic",
    "Initial Visit Clinical Note",
    "",
    `Patient: ${fields.patientName || "Not documented"}`,
    `DOB: ${fields.dob || "Not documented"}`,
    `Age: ${fields.patientAge || "Not documented"}`,
    `Recent spinal x-rays: ${choices.recentXray || "Not documented"}`,
    "",
    "Chief Complaint",
    fields.chiefComplaint || "Not documented",
    "",
    "History",
    fields.historyNotes || "Not documented",
    "",
    "Contraindications / Cautions",
    fields.contraindications || "None documented"
  ].join("\n");
}

function consentRecord(data) {
  const fields = {
    patientName: data.patientName,
    dob: data.dob,
    patientAge: data.patientAge,
    consentDate: todayIso(),
    patientPrintedName: data.patientName,
    chiropractorName: "",
    claimConfirm: Boolean(data.claimConfirm),
    patientAccept: Boolean(data.consentAccepted)
  };
  return {
    id: `consent-${slug(data.patientName)}`,
    fields,
    patientSignature: "",
    doctorSignature: "",
    janePatientSignature: Boolean(data.janePatientSignature),
    completed: false,
    summary: [
      "Gdanski Chiropractic Clinic",
      "Consent To Chiropractic Treatment",
      "",
      `Patient: ${fields.patientName || "Not documented"}`,
      `DOB: ${fields.dob || "Not documented"}`,
      `Age: ${fields.patientAge || "Not documented"}`,
      `Consent date: ${fields.consentDate || "Not documented"}`,
      "",
      "Jane Import",
      `Claim confirmation: ${fields.claimConfirm ? "Accepted in Jane" : "Not detected"}`,
      `Treatment consent: ${fields.patientAccept ? "Accepted in Jane" : "Not detected"}`,
      `Patient signature: ${data.janePatientSignature ? "Imported from Jane PDF" : "Not detected"}`,
      "Chiropractor signature: Not signed in this app"
    ].join("\n"),
    updatedAt: new Date().toISOString()
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function previewData() {
  return {
    patientName: $("#patientName").value.trim(),
    dob: $("#dob").value,
    patientAge: $("#patientAge").value.trim() || calculateAge($("#dob").value),
    recentXray: $("#recentXray").value,
    xrayDate: $("#xrayDate").value,
    xrayLocation: $("#xrayLocation").value.trim(),
    chiefComplaint: $("#chiefComplaint").value.trim(),
    historyNotes: $("#historyNotes").value.trim(),
    contraindications: $("#contraindications").value.trim(),
    familyHistory: $("#familyHistory").value.trim(),
    strokeRiskFlags: $("#strokeRiskFlags").value.trim()
  };
}

function writePreview(data) {
  Object.entries(data).forEach(([key, value]) => {
    const field = document.getElementById(key);
    if (field) field.value = value || "";
  });
  if ($("#dob").value && !$("#patientAge").value) $("#patientAge").value = calculateAge($("#dob").value);
  updateLinks();
}

async function applyImport() {
  const data = previewData();
  if (!data.patientName) {
    setStatus("Patient name is required before applying.");
    return;
  }
  if ($("#formType").value === "janeConsent") {
    await applyConsentImport(data);
    return;
  }
  const record = initialRecord(data);
  const initials = readJson(INITIAL_STORAGE_KEY, []).filter((item) => item.id !== record.id);
  writeJson(INITIAL_STORAGE_KEY, [record, ...initials].slice(0, 50));

  const profiles = readJson(PROFILE_STORAGE_KEY, {});
  const key = patientKey(data.patientName);
  profiles[key] = {
    ...(profiles[key] || {}),
    patientName: data.patientName,
    dob: data.dob,
    patientAge: data.patientAge,
    contraindications: data.contraindications,
    strokeRiskFlags: data.strokeRiskFlags,
    recentXray: data.recentXray,
    xrayDate: data.xrayDate,
    xrayLocation: data.xrayLocation,
    importedChiefComplaint: data.chiefComplaint,
    importedHistory: data.historyNotes,
    familyHistory: data.familyHistory,
    updatedAt: new Date().toISOString()
  };
  writeJson(PROFILE_STORAGE_KEY, profiles);
  try {
    await syncStorageKeyToServer(PROFILE_STORAGE_KEY);
    await refreshServerStorage();
    await loadPatientDirectory();
    const imported = patientDirectory.find((patient) => patientKey(patient.patientName) === patientKey(data.patientName));
    if (imported) selectPatient(imported, { silent: true });
  } catch (error) {
    console.error(error);
  }
  updateLinks();
  setStatus(window.ClinicServer ? "Imported to the clinic server. Open Initial, Consent, Exam, or SOAP to review." : "Imported into this browser. Open Initial, Consent, Exam, or SOAP to review.");
}

async function applyConsentImport(data) {
  const record = consentRecord({
    ...data,
    consentAccepted: lastMappedConsent?.consentAccepted,
    claimConfirm: lastMappedConsent?.claimConfirm,
    janePatientSignature: lastMappedConsent?.janePatientSignature
  });
  const consents = readJson(CONSENT_STORAGE_KEY, []).filter((item) => item.id !== record.id);
  writeJson(CONSENT_STORAGE_KEY, [record, ...consents].slice(0, 75));

  const profiles = readJson(PROFILE_STORAGE_KEY, {});
  const key = patientKey(data.patientName);
  profiles[key] = {
    ...(profiles[key] || {}),
    patientName: data.patientName,
    dob: data.dob,
    patientAge: data.patientAge,
    consentCompleted: false,
    consentImportedFromJane: true,
    consentDate: record.fields.consentDate,
    consentUpdatedAt: record.updatedAt
  };
  writeJson(PROFILE_STORAGE_KEY, profiles);
  try {
    await syncStorageKeyToServer(PROFILE_STORAGE_KEY);
    await refreshServerStorage();
    await loadPatientDirectory();
    const imported = patientDirectory.find((patient) => patientKey(patient.patientName) === patientKey(data.patientName));
    if (imported) selectPatient(imported, { silent: true });
  } catch (error) {
    console.error(error);
  }
  updateLinks();
  setStatus("Jane consent imported. Open Consent for chiropractor review/signature.");
}

function updateLinks() {
  const patient = encodeURIComponent($("#patientName")?.value?.trim() || selectedPatient?.patientName || "");
  if ($("#openInitial")) $("#openInitial").href = patient ? `initial.html?patient=${patient}` : "initial.html";
  if ($("#openConsent")) $("#openConsent").href = patient ? `consent.html?patient=${patient}` : "consent.html";
  if ($("#openExam")) $("#openExam").href = patient ? `exam.html?patient=${patient}` : "exam.html";
  if ($("#openSoap")) $("#openSoap").href = patient ? `index.html?patient=${patient}` : "index.html";
  updatePatientFileLinks();
  renderReportList();
}

async function extractTextFromFile() {
  const file = $("#formFile").files[0];
  if (!file) {
    setStatus("Choose a scanned form first.");
    return;
  }
  setStatus("Extracting text. This can take a minute for scanned pages.");
  try {
    let text = "";
    if (file.type === "application/pdf" && window.pdfjsLib) {
      text = await extractPdfText(file);
    } else if (file.type.startsWith("image/") && window.Tesseract) {
      text = await ocrImage(file);
    } else {
      text = await file.text();
    }
    $("#rawText").value = normalizeText(text);
    setStatus("Text extracted. Review it, then map to fields.");
  } catch (error) {
    setStatus("Could not extract text automatically. Staff can paste OCR text into the box.");
    console.error(error);
  }
}

async function extractPdfText(file) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join("\n");
    if (text.trim().length > 40) pages.push(text);
    else if (window.Tesseract) pages.push(await ocrPdfPage(page));
  }
  return pages.join("\n\n");
}

async function ocrPdfPage(page) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  const result = await window.Tesseract.recognize(canvas, "eng");
  return result.data.text;
}

async function ocrImage(file) {
  const result = await window.Tesseract.recognize(file, "eng");
  return result.data.text;
}

function setReportStatus(message) {
  $("#reportStatus").textContent = message;
}

function savedReports() {
  return readJson(DIAGNOSTIC_REPORT_STORAGE_KEY, []);
}

function writeReports(reports) {
  writeJson(DIAGNOSTIC_REPORT_STORAGE_KEY, reports.slice(0, 200));
}

function diagnosticReportSummary(record) {
  return [
    "Gdanski Chiropractic Clinic",
    "Diagnostic Report",
    "",
    `Patient: ${record.patientName || "Not documented"}`,
    `Type: ${record.reportType || "Not documented"}`,
    `Date: ${record.reportDate || "Not documented"}`,
    `Body area/location: ${record.bodyArea || "Not documented"}`,
    `Source file: ${record.fileName || "Not documented"}`,
    "",
    "Report Text / Findings",
    record.reportText || "Not documented"
  ].join("\n");
}

function reportRecord() {
  const patientName = $("#patientName").value.trim();
  const reportType = $("#reportType").value;
  const reportDate = $("#reportDate").value;
  const bodyArea = $("#reportBodyArea").value.trim();
  const reportText = $("#reportText").value.trim();
  const file = $("#reportFile").files[0];
  const id = `report-${slug(patientName)}-${Date.now()}`;
  const record = {
    id,
    patientName,
    reportType,
    reportDate,
    bodyArea,
    fileName: file?.name || "",
    reportText,
    updatedAt: new Date().toISOString()
  };
  record.summary = diagnosticReportSummary(record);
  return record;
}

function inferReportFields(text, fileName = "") {
  const source = `${fileName}\n${text}`;
  const date = parseDate(valueAfter(source, ["Report Date", "Exam Date", "Date of Exam", "Date"])) || parseDate(source);
  const bodyAreas = [
    "Cervical spine", "Thoracic spine", "Lumbar spine", "Sacrum", "Sacroiliac joints", "Pelvis",
    "Shoulder", "Elbow", "Wrist", "Hand", "Hip", "Knee", "Ankle", "Foot", "Chest", "Abdomen"
  ];
  const found = bodyAreas.find((area) => new RegExp(escapeRegex(area), "i").test(source));
  if (date && !$("#reportDate").value) $("#reportDate").value = date;
  if (found && !$("#reportBodyArea").value) $("#reportBodyArea").value = found;
}

async function extractDiagnosticReport() {
  const file = $("#reportFile").files[0];
  if (!file) {
    setReportStatus("Choose a diagnostic report first.");
    return;
  }
  setReportStatus("Extracting report text.");
  try {
    let text = "";
    if (file.type === "application/pdf" && window.pdfjsLib) {
      text = await extractPdfText(file);
    } else if (file.type.startsWith("image/") && window.Tesseract) {
      text = await ocrImage(file);
    } else {
      text = await file.text();
    }
    $("#reportText").value = normalizeText(text);
    inferReportFields(text, file.name);
    setReportStatus("Report text extracted. Review before saving.");
  } catch (error) {
    setReportStatus("Could not extract report text. Staff can paste report findings into the box.");
    console.error(error);
  }
}

function updateInitialWithReport(record) {
  if (record.reportType !== "X-ray") return;
  const initials = readJson(INITIAL_STORAGE_KEY, []);
  const index = initials.findIndex((item) => patientKey(item?.fields?.patientName) === patientKey(record.patientName));
  if (index < 0) return;
  initials[index] = {
    ...initials[index],
    fields: {
      ...(initials[index].fields || {}),
      xrayDate: record.reportDate || initials[index].fields?.xrayDate || "",
      xrayLocation: record.bodyArea || initials[index].fields?.xrayLocation || ""
    },
    choices: {
      ...(initials[index].choices || {}),
      recentXray: "Y"
    },
    updatedAt: new Date().toISOString()
  };
  writeJson(INITIAL_STORAGE_KEY, initials);
}

async function uploadDiagnosticReportFile(record) {
  const file = $("#reportFile").files[0];
  if (!file || !window.ClinicServer) return null;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("patientName", record.patientName);
  formData.append("patientKey", patientKey(record.patientName));
  formData.append("category", "diagnostic-report");
  formData.append("reportType", record.reportType || "");
  formData.append("reportDate", record.reportDate || "");
  formData.append("bodyArea", record.bodyArea || "");
  formData.append("notes", record.reportText || "");
  const response = await fetch("/api/uploads", {
    method: "POST",
    credentials: "same-origin",
    body: formData
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Could not upload report file to the clinic server.");
  return data;
}

async function applyDiagnosticReport() {
  const record = reportRecord();
  if (!record.patientName) {
    setReportStatus("Patient name is required before saving a report.");
    return;
  }
  if (!record.reportText && !record.fileName) {
    setReportStatus("Upload a report or paste report text before saving.");
    return;
  }
  setReportStatus("Saving diagnostic report.");
  try {
    const upload = await uploadDiagnosticReportFile(record);
    if (upload) {
      record.uploadId = upload.id;
      record.serverStoredName = upload.storedName;
      record.serverUploadedAt = upload.createdAt;
    }
  } catch (error) {
    console.error(error);
    setReportStatus(error.message);
    return;
  }
  const reports = savedReports().filter((item) => item.id !== record.id);
  writeReports([record, ...reports]);

  const profiles = readJson(PROFILE_STORAGE_KEY, {});
  const key = patientKey(record.patientName);
  const priorProfile = profiles[key] || {};
  const reportBrief = `${record.reportType}${record.reportDate ? ` ${record.reportDate}` : ""}${record.bodyArea ? ` - ${record.bodyArea}` : ""}`;
  profiles[key] = {
    ...priorProfile,
    patientName: record.patientName,
    diagnosticReports: [reportBrief, ...(priorProfile.diagnosticReports || [])].slice(0, 20),
    diagnosticReportsUpdatedAt: record.updatedAt,
    recentXray: record.reportType === "X-ray" ? "Y" : priorProfile.recentXray,
    xrayDate: record.reportType === "X-ray" ? record.reportDate || priorProfile.xrayDate || "" : priorProfile.xrayDate,
    xrayLocation: record.reportType === "X-ray" ? record.bodyArea || priorProfile.xrayLocation || "" : priorProfile.xrayLocation
  };
  writeJson(PROFILE_STORAGE_KEY, profiles);
  updateInitialWithReport(record);
  renderReportList();
  setReportStatus(window.ClinicServer ? "Diagnostic report saved to the clinic server." : "Diagnostic report saved to this browser.");
}

function renderReportList() {
  const mount = $("#reportList");
  if (!mount) return;
  const patient = patientKey($("#patientName").value);
  mount.innerHTML = "";
  if (!patient) {
    mount.innerHTML = "<p>Select or enter a patient name to see saved diagnostic reports.</p>";
    return;
  }
  const reports = savedReports()
    .filter((record) => patientKey(record.patientName) === patient)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  if (!reports.length) {
    mount.innerHTML = "<p>No diagnostic reports saved for this patient in this browser.</p>";
    return;
  }
  reports.slice(0, 8).forEach((record) => {
    const card = document.createElement("article");
    const title = document.createElement("h3");
    title.textContent = `${record.reportType || "Report"}${record.reportDate ? ` - ${record.reportDate}` : ""}`;
    const meta = document.createElement("p");
    meta.textContent = [record.bodyArea, record.fileName].filter(Boolean).join(" | ") || "No body area/file noted";
    card.append(title, meta);
    mount.appendChild(card);
  });
}

function parseText() {
  const text = normalizeText($("#rawText").value);
  if (!text) {
    setStatus("Paste or extract text first.");
    return;
  }
  const parser = {
    adult: parseAdult,
    child: parseChild,
    janeAdult: parseJaneAdultLike,
    janeTeen: parseJaneAdultLike,
    janeChild: parseJaneChild,
    janeConsent: parseJaneConsent,
    legacyInitial: parseLegacyInitial
  }[$("#formType").value] || parseJaneAdultLike;
  const data = parser(text);
  lastMappedConsent = data.target === "consent" ? data : null;
  writePreview(data);
  setStatus("Mapped fields. Please review before applying.");
}

on("extractText", "click", extractTextFromFile);
on("parseText", "click", parseText);
on("applyImport", "click", applyImport);
on("extractReport", "click", extractDiagnosticReport);
on("applyReport", "click", applyDiagnosticReport);
on("startManualPatient", "click", startManualPatient);
on("createManualPatient", "click", createManualPatient);
on("previewJaneBatch", "click", previewJaneBatch);
on("importJaneBatch", "click", importJaneBatch);
on("manualDob", "input", () => {
  $("#manualPatientAge").value = calculateAge($("#manualDob").value);
});
on("patientSearch", "input", renderPatientSearchResults);
on("dob", "input", () => {
  $("#patientAge").value = calculateAge($("#dob").value);
  updateLinks();
});
["patientName", "patientAge", "recentXray", "xrayDate", "xrayLocation", "chiefComplaint", "historyNotes", "contraindications", "familyHistory", "strokeRiskFlags"].forEach((id) => {
  on(id, "input", updateLinks);
  on(id, "change", updateLinks);
});
["reportType", "reportDate", "reportBodyArea", "reportText"].forEach((id) => {
  on(id, "input", renderReportList);
  on(id, "change", renderReportList);
});
updateLinks();
renderSelectedPatient();
loadPatientDirectory();
