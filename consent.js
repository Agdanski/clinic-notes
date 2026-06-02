const CONSENT_STORAGE_KEY = "clinic-informed-consents-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";

const state = {
  autosaveReady: false,
  patientSignatureDirty: false,
  doctorSignatureDirty: false,
  janePatientSignature: false
};

let autosaveTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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

function savedConsents() {
  return readJson(CONSENT_STORAGE_KEY, []);
}

function writeConsents(records) {
  writeJson(CONSENT_STORAGE_KEY, records.slice(0, 75));
}

function savedProfiles() {
  return readJson(PROFILE_STORAGE_KEY, {});
}

function writeProfiles(profiles) {
  writeJson(PROFILE_STORAGE_KEY, profiles);
}

function currentProfile() {
  const key = patientKey($("#patientName").value);
  return key ? savedProfiles()[key] || null : null;
}

function setStatus(message) {
  $("#statusLine").textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    $("#statusLine").textContent = "";
  }, 2600);
}

function signatureIsBlank(canvas) {
  const context = canvas.getContext("2d");
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 0) return false;
  }
  return true;
}

function resizeCanvasForDisplay(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const previous = signatureIsBlank(canvas) ? "" : canvas.toDataURL("image/png");
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2.4;
  context.strokeStyle = "#172026";
  if (previous) drawSignatureImage(canvas, previous);
}

function drawSignatureImage(canvas, dataUrl, afterLoad) {
  if (!dataUrl) return;
  const image = new Image();
  image.onload = () => {
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
    if (afterLoad) afterLoad();
  };
  image.src = dataUrl;
}

function setupSignaturePad(canvas, dirtyKey) {
  let drawing = false;
  let lastPoint = null;

  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function start(event) {
    event.preventDefault();
    drawing = true;
    lastPoint = point(event);
    canvas.setPointerCapture(event.pointerId);
  }

  function move(event) {
    if (!drawing || !lastPoint) return;
    event.preventDefault();
    const next = point(event);
    const context = canvas.getContext("2d");
    context.beginPath();
    context.moveTo(lastPoint.x, lastPoint.y);
    context.lineTo(next.x, next.y);
    context.stroke();
    lastPoint = next;
    state[dirtyKey] = true;
    renderSummary();
    scheduleAutosave();
  }

  function end(event) {
    if (!drawing) return;
    drawing = false;
    lastPoint = null;
    try {
      canvas.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer may already be released by the browser.
    }
    renderSummary();
    scheduleAutosave();
  }

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  resizeCanvasForDisplay(canvas);
}

function clearSignature(canvas, dirtyKey) {
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  state[dirtyKey] = false;
  renderSummary();
  scheduleAutosave();
}

function fieldsData() {
  return {
    patientName: $("#patientName").value.trim(),
    patientId: currentProfile()?.patientId || "",
    dob: $("#dob").value,
    patientAge: $("#patientAge").value,
    consentDate: $("#consentDate").value,
    patientPrintedName: $("#patientPrintedName").value.trim(),
    chiropractorName: $("#chiropractorName").value,
    claimConfirm: $("#claimConfirm").checked,
    patientAccept: $("#patientAccept").checked
  };
}

function noteData() {
  const fields = fieldsData();
  const patientCanvas = $("#patientSignature");
  const doctorCanvas = $("#doctorSignature");
  const patientSignature = signatureIsBlank(patientCanvas) ? "" : patientCanvas.toDataURL("image/png");
  const doctorSignature = signatureIsBlank(doctorCanvas) ? "" : doctorCanvas.toDataURL("image/png");
  const patientSigned = Boolean(patientSignature || state.janePatientSignature);
  return {
    id: `consent-${slug(fields.patientName)}`,
    fields,
    patientSignature,
    doctorSignature,
    janePatientSignature: state.janePatientSignature,
    completed: Boolean(fields.claimConfirm && fields.patientAccept && fields.patientPrintedName && fields.chiropractorName && patientSigned && doctorSignature),
    summary: buildSummary(fields, patientSignature, doctorSignature, state.janePatientSignature),
    updatedAt: new Date().toISOString()
  };
}

function buildSummary(fields = fieldsData(), patientSignature = "", doctorSignature = "", janePatientSignature = false) {
  return [
    "Gdanski Chiropractic Clinic",
    "Consent To Chiropractic Treatment",
    "",
    `Patient: ${fields.patientName || "Not documented"}`,
    `Patient ID: ${fields.patientId || "Not documented"}`,
    `DOB: ${fields.dob || "Not documented"}`,
    `Age: ${fields.patientAge || "Not documented"}`,
    `Consent date: ${fields.consentDate || "Not documented"}`,
    "",
    "Patient Acknowledgements",
    `Claim confirmation: ${fields.claimConfirm ? "Accepted" : "Not accepted"}`,
    `Treatment consent: ${fields.patientAccept ? "Accepted" : "Not accepted"}`,
    "",
    "Signatures",
    `Patient/guardian printed name: ${fields.patientPrintedName || "Not documented"}`,
    `Patient/guardian signature: ${patientSignature ? "Signed digitally" : janePatientSignature ? "Imported from Jane PDF" : "Not signed"}`,
    `Chiropractor: ${fields.chiropractorName || "Not documented"}`,
    `Chiropractor signature: ${doctorSignature ? "Signed digitally" : "Not signed"}`,
    "",
    "Consent Text",
    "The patient/guardian reviewed the benefits, risks, alternatives, questions/concerns section, claim confirmation, and consent statement as displayed in the digital informed consent form."
  ].join("\n");
}

function renderSummary() {
  const record = noteData();
  $("#summaryText").textContent = record.summary;
  $("#savedConsentStatus").innerHTML = "";
  const badge = document.createElement("span");
  badge.textContent = record.completed ? "Complete: ready to save" : "Draft: missing required acceptance/signature";
  $("#savedConsentStatus").appendChild(badge);
  if (state.janePatientSignature) {
    const imported = document.createElement("span");
    imported.textContent = "Patient signature imported from Jane";
    $("#savedConsentStatus").appendChild(imported);
  }
}

function updateAge() {
  $("#patientAge").value = calculateAge($("#dob").value);
}

function applyProfile(profile) {
  if (!profile) return;
  if (profile.patientName && !$("#patientName").value) $("#patientName").value = profile.patientName;
  if (profile.dob && !$("#dob").value) $("#dob").value = profile.dob;
  if (profile.doctor && !$("#chiropractorName").value) {
    $("#chiropractorName").value = profile.doctor.replace("Dr. Allan", "Dr. Allan Gdanski").replace("Dr. Daniel", "Dr. Daniel Delellis");
  }
  updateAge();
}

function saveProfile(record) {
  const key = patientKey(record.fields.patientName);
  if (!key) return;
  const profiles = savedProfiles();
  profiles[key] = {
    ...(profiles[key] || {}),
    patientName: record.fields.patientName,
    patientId: record.fields.patientId || profiles[key]?.patientId || "",
    dob: record.fields.dob,
    patientAge: record.fields.patientAge,
    consentCompleted: record.completed,
    consentDate: record.fields.consentDate,
    consentUpdatedAt: record.updatedAt
  };
  writeProfiles(profiles);
}

function saveConsent(statusMessage = "Consent saved.", requireComplete = true) {
  const record = noteData();
  if (!record.fields.patientName) {
    setStatus("Patient name is required.");
    return false;
  }
  if (requireComplete && !record.completed) {
    setStatus("Consent needs the confirmation, consent checkbox, printed names, and both signatures.");
    return false;
  }
  const records = savedConsents().filter((item) => item.id !== record.id);
  writeConsents([record, ...records]);
  saveProfile(record);
  setStatus(statusMessage);
  renderSummary();
  return true;
}

function scheduleAutosave() {
  if (!state.autosaveReady) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    if (fieldsData().patientName) saveConsent("Autosaved draft.", false);
  }, 800);
}

function loadConsent(record) {
  const fields = record.fields || {};
  $("#patientName").value = fields.patientName || "";
  $("#dob").value = fields.dob || "";
  $("#patientAge").value = fields.patientAge || "";
  $("#consentDate").value = fields.consentDate || todayIso();
  $("#patientPrintedName").value = fields.patientPrintedName || "";
  $("#chiropractorName").value = fields.chiropractorName || "";
  $("#claimConfirm").checked = Boolean(fields.claimConfirm);
  $("#patientAccept").checked = Boolean(fields.patientAccept);
  clearSignature($("#patientSignature"), "patientSignatureDirty");
  clearSignature($("#doctorSignature"), "doctorSignatureDirty");
  state.janePatientSignature = Boolean(record.janePatientSignature);
  drawSignatureImage($("#patientSignature"), record.patientSignature, renderSummary);
  drawSignatureImage($("#doctorSignature"), record.doctorSignature, renderSummary);
  state.patientSignatureDirty = Boolean(record.patientSignature);
  state.doctorSignatureDirty = Boolean(record.doctorSignature);
  updateAge();
  renderSummary();
  setStatus("Consent loaded.");
}

function loadRequestedConsent() {
  const params = new URLSearchParams(window.location.search);
  const patient = String(params.get("patient") || "").trim().toLowerCase();
  if (!patient) return;
  const record = savedConsents().find((item) => patientKey(item?.fields?.patientName) === patient);
  if (record) {
    loadConsent(record);
    return;
  }
  $("#patientName").value = params.get("patient") || "";
  applyProfile(currentProfile());
}

function exportConsent() {
  if (!saveConsent("Consent saved.", true)) return;
  const record = noteData();
  const blob = new Blob([record.summary], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slug(record.fields.patientName)}-informed-consent.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function printConsent() {
  if (!saveConsent("Consent saved.", true)) return;
  window.print();
}

function clearSavedConsent() {
  const record = noteData();
  writeConsents(savedConsents().filter((item) => item.id !== record.id));
  setStatus("Saved consent cleared.");
}

function bindFields() {
  ["patientName", "dob", "consentDate", "patientPrintedName", "chiropractorName", "claimConfirm", "patientAccept"].forEach((id) => {
    const field = document.getElementById(id);
    field.addEventListener("input", () => {
      if (id === "dob") updateAge();
      renderSummary();
      scheduleAutosave();
    });
    field.addEventListener("change", () => {
      if (id === "dob") updateAge();
      renderSummary();
      scheduleAutosave();
    });
  });
}

function bindActions() {
  $("#saveConsent").addEventListener("click", () => saveConsent("Consent saved.", true));
  $("#exportConsent").addEventListener("click", exportConsent);
  $("#printConsent").addEventListener("click", printConsent);
  $("#copyConsent").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#summaryText").textContent);
    setStatus("Consent copied.");
  });
  $("#clearConsent").addEventListener("click", clearSavedConsent);
  $("#clearPatientSignature").addEventListener("click", () => clearSignature($("#patientSignature"), "patientSignatureDirty"));
  $("#clearDoctorSignature").addEventListener("click", () => clearSignature($("#doctorSignature"), "doctorSignatureDirty"));
}

function init() {
  $("#consentDate").value = todayIso();
  setupSignaturePad($("#patientSignature"), "patientSignatureDirty");
  setupSignaturePad($("#doctorSignature"), "doctorSignatureDirty");
  bindFields();
  bindActions();
  loadRequestedConsent();
  if (!$("#patientName").value) applyProfile(currentProfile());
  updateAge();
  renderSummary();
  state.autosaveReady = true;
}

init();
