const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";
const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";
const DIAGNOSTIC_REPORT_STORAGE_KEY = "clinic-diagnostic-reports-v1";

const $ = (selector) => document.querySelector(selector);

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

function normalizeText(text) {
  return String(text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/\b(20\d{2}|19\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const mdy = text.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (!mdy) return "";
  const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
  return `${year}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
}

function valueAfter(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`${escapeRegex(label)}\\s*:?\\s*([^\\n]+)`, "i");
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

function requestedPatientName() {
  return String(new URLSearchParams(window.location.search).get("patient") || "").trim();
}

function requireSelectedPatient() {
  if (requestedPatientName()) return true;
  window.location.replace("dashboard.html");
  return false;
}

function currentProfile() {
  const name = requestedPatientName();
  return readJson(PROFILE_STORAGE_KEY, {})[patientKey(name)] || null;
}

function patientName() {
  return currentProfile()?.patientName || requestedPatientName();
}

function updateNavLinks() {
  const patient = encodeURIComponent(patientName());
  const links = {
    navSoap: "index.html",
    navInitial: "initial.html",
    navConsent: "consent.html",
    navExam: "exam.html"
  };
  Object.entries(links).forEach(([id, page]) => {
    const link = document.getElementById(id);
    if (link) link.href = patient ? `${page}?patient=${patient}` : page;
  });
}

function renderPatientHeader() {
  const profile = currentProfile();
  const name = patientName();
  $("#reportPatientName").textContent = name || "No patient selected";
  const age = calculateAge(profile?.dob) || profile?.patientAge || "";
  $("#reportPatientMeta").textContent = [profile?.patientId, profile?.janePatientNumber ? `Jane ${profile.janePatientNumber}` : "", age ? `Age ${age}` : ""].filter(Boolean).join(" | ");
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
    "Report / Diagnostic Report / Image",
    "",
    `Patient: ${record.patientName || "Not documented"}`,
    `Type: ${record.reportType || "Not documented"}`,
    `Date: ${record.reportDate || "Not documented"}`,
    `Body area/location: ${record.bodyArea || "Not documented"}`,
    `Source file: ${record.fileName || "Not documented"}`,
    "",
    "Report Text / Findings / Image Notes",
    record.reportText || "Not documented"
  ].join("\n");
}

function reportRecord() {
  const file = $("#reportFile").files[0];
  const record = {
    id: `report-${slug(patientName())}-${Date.now()}`,
    patientName: patientName(),
    reportType: $("#reportType").value,
    reportDate: $("#reportDate").value,
    bodyArea: $("#reportBodyArea").value.trim(),
    fileName: file?.name || "",
    reportText: $("#reportText").value.trim(),
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

async function extractPdfText(file) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join("\n");
    pages.push(text);
  }
  return pages.join("\n\n");
}

async function ocrImage(file) {
  const result = await window.Tesseract.recognize(file, "eng");
  return result.data.text;
}

async function extractDiagnosticReport() {
  const file = $("#reportFile").files[0];
  if (!file) {
    setReportStatus("Choose a report or image first.");
    return;
  }
  setReportStatus("Extracting report text.");
  try {
    let text = "";
    if (file.type === "application/pdf" && window.pdfjsLib) text = await extractPdfText(file);
    else if (file.type.startsWith("image/") && window.Tesseract) text = await ocrImage(file);
    else text = await file.text();
    $("#reportText").value = normalizeText(text);
    inferReportFields(text, file.name);
    setReportStatus("Report text extracted. Review before saving.");
  } catch (error) {
    console.error(error);
    setReportStatus("Could not extract report text. Staff can paste report findings into the box.");
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
    setReportStatus("Open a patient file before saving a report.");
    return;
  }
  if (!record.reportText && !record.fileName) {
    setReportStatus("Upload a report/image or enter notes before saving.");
    return;
  }
  setReportStatus("Saving report/image.");
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
  writeReports([record, ...savedReports().filter((item) => item.id !== record.id)]);
  updateInitialWithReport(record);
  renderReportList();
  setReportStatus(window.ClinicServer ? "Report/image saved to the clinic server." : "Report/image saved to this browser.");
}

function renderReportList() {
  const mount = $("#reportList");
  mount.innerHTML = "";
  const patient = patientKey(patientName());
  const reports = savedReports()
    .filter((record) => patientKey(record.patientName) === patient)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  if (!reports.length) {
    mount.innerHTML = "<p>No reports or images saved for this patient.</p>";
    return;
  }
  reports.forEach((record) => {
    const card = document.createElement("article");
    card.innerHTML = `
      <h3>${escapeHtml(record.reportType || "Report")}${record.reportDate ? ` - ${escapeHtml(record.reportDate)}` : ""}</h3>
      <p>${escapeHtml([record.bodyArea, record.fileName].filter(Boolean).join(" | ") || "No body area/file noted")}</p>
    `;
    mount.appendChild(card);
  });
}

if (requireSelectedPatient()) {
  $("#extractReport").addEventListener("click", extractDiagnosticReport);
  $("#applyReport").addEventListener("click", applyDiagnosticReport);
  ["reportType", "reportDate", "reportBodyArea", "reportText"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderReportList);
    document.getElementById(id).addEventListener("change", renderReportList);
  });

  renderPatientHeader();
  updateNavLinks();
  renderReportList();
}
