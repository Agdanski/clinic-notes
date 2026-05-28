const EXAM_STORAGE_KEY = "clinic-vsc-exam-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";

const levels = [
  "OCC", "ATLAS", "AXIS", "C3", "C4", "C5", "C6", "C7",
  "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12",
  "L1", "L2", "L3", "L4", "L5", "SAC", "SI FIX"
];
const posturalItems = ["Shoulder high", "Hip high", "K27", "Pronation", "Long leg"];
const muscleItems = ["Psoas", "Piriformis", "QF", "Glut", "Hamst", "Delt", "Pect", "Lats", "Other", "S. Spin"];
const orthoItems = ["Ely's", "Yeomans", "SLR", "Int. shoulder rotation", "Ext. shoulder rotation", "Figure 4"];
const reflexItems = [
  "Triceps", "Biceps", "Radial", "C5 motor", "C6 motor", "C7 motor", "C8 motor", "T1 motor",
  "C5 sensation", "C6 sensation", "C7 sensation", "C8 sensation", "T1 sensation",
  "Patellar", "Achilles", "L3 motor", "L4 motor", "L5 motor", "S1 motor",
  "L3 sensation", "L4 sensation", "L5 sensation"
];
const cranialItems = [
  "Visual acuity (II)", "Pupillary reactions (II, III)", "Extraocular movement (III, IV, VI)",
  "Corneal reflex / jaw movement (V)", "Facial sensation (V1, V2, V3)", "Facial movement (VII)",
  "Hearing (VIII)", "Swallowing / rising palate (IX, X)", "Voice / speech (X, V, VII, XII)",
  "Tongue inspection (XII)", "Babinsky"
];
const compressionItems = ["Jacksons", "Spurlings"];

const state = {
  choices: {},
  autosaveReady: false
};

let autosaveTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function patientKey(name) {
  return String(name || "").trim().toLowerCase();
}

function storageId(fields) {
  const patient = patientKey(fields.patientName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
  return `exam-${patient}`;
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

function setStatus(message) {
  $("#statusLine").textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    $("#statusLine").textContent = "";
  }, 2400);
}

function choiceValue(key) {
  const value = state.choices[key];
  if (Array.isArray(value)) return value.length ? value.join(", ") : "";
  return value || "";
}

function fieldsData() {
  const fields = {};
  $$("input[name], textarea[name], select[name]").forEach((field) => {
    fields[field.name] = field.value;
  });
  return fields;
}

function makeChoiceGroup(key, options, multi = false) {
  const group = document.createElement("span");
  group.className = `choice-group inline${multi ? " multi" : ""}`;
  group.dataset.group = key;
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = option;
    button.textContent = option;
    group.appendChild(button);
  });
  return group;
}

function addRow(target, label, group) {
  const row = document.createElement("div");
  row.className = "exam-row";
  const title = document.createElement("strong");
  title.textContent = label;
  row.appendChild(title);
  row.appendChild(group);
  target.appendChild(row);
}

function mountPosture() {
  const target = $("#postureGrid");
  posturalItems.forEach((item) => addRow(target, item, makeChoiceGroup(`posture:${item}`, ["L", "N", "R"])));
}

function mountLevels() {
  const target = $("#levelGrid");
  levels.forEach((level) => {
    const card = document.createElement("div");
    card.className = "level-card";
    const title = document.createElement("strong");
    title.textContent = level;
    card.appendChild(title);
    card.appendChild(makeChoiceGroup(`level:${level}:side`, ["L", "R"], true));
    card.appendChild(makeChoiceGroup(`level:${level}:top`, ["TOP"], true));
    target.appendChild(card);
  });
}

function mountMuscles() {
  const target = $("#muscleGrid");
  muscleItems.forEach((item) => addRow(target, item, makeChoiceGroup(`muscle:${item}`, ["L hyper", "L hypo", "R hyper", "R hypo"], true)));
}

function mountOrthos() {
  const target = $("#orthoGrid");
  orthoItems.forEach((item) => addRow(target, item, makeChoiceGroup(`ortho:${item}`, ["L +", "L -", "R +", "R -"], true)));
  addRow(target, "Valsalvas", makeChoiceGroup("ortho:Valsalvas", ["+", "-"]));
}

function mountReflexes() {
  const target = $("#reflexGrid");
  reflexItems.forEach((item) => addRow(target, item, makeChoiceGroup(`reflex:${item}`, ["L AbN", "R AbN"], true)));
}

function mountCranial() {
  const target = $("#cranialGrid");
  cranialItems.forEach((item) => addRow(target, item, makeChoiceGroup(`cranial:${item}`, ["UR", "AbN"])));
}

function mountCompression() {
  const target = $("#compressionGrid");
  compressionItems.forEach((item) => addRow(target, item, makeChoiceGroup(`compression:${item}`, ["UR", "L AbN", "R AbN"], true)));
}

function bindChoiceGroups() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".choice-group button[data-value]");
    if (!button) return;
    const group = button.closest(".choice-group");
    const key = group.dataset.group;
    const value = button.dataset.value;
    if (group.classList.contains("multi")) {
      const values = new Set(state.choices[key] || []);
      if (values.has(value)) values.delete(value);
      else values.add(value);
      state.choices[key] = Array.from(values);
    } else {
      state.choices[key] = state.choices[key] === value ? "" : value;
    }
    render();
    scheduleAutosave();
  });
}

function renderChoices() {
  $$(".choice-group").forEach((group) => {
    const key = group.dataset.group;
    const current = state.choices[key];
    group.querySelectorAll("button[data-value]").forEach((button) => {
      const active = Array.isArray(current) ? current.includes(button.dataset.value) : current === button.dataset.value;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  });
}

function abnormalEntries(prefix, normalValues = []) {
  return Object.entries(state.choices)
    .filter(([key, value]) => key.startsWith(prefix) && value && (!Array.isArray(value) || value.length))
    .map(([key, value]) => {
      const label = key.split(":").slice(1).join(" ");
      const text = Array.isArray(value) ? value.join(", ") : value;
      if (normalValues.includes(text)) return "";
      return `${label}: ${text}`;
    })
    .filter(Boolean);
}

function muscleFindings() {
  return abnormalEntries("muscle:");
}

function orthoFindings() {
  return abnormalEntries("ortho:").filter((line) => line.includes("+") || line.includes("AbN"));
}

function neuroFindings() {
  return [
    ...abnormalEntries("reflex:"),
    ...abnormalEntries("cranial:", ["UR"]),
    ...abnormalEntries("compression:", ["UR"])
  ];
}

function levelFindings() {
  return levels.map((level) => {
    const side = choiceValue(`level:${level}:side`);
    const top = choiceValue(`level:${level}:top`);
    if (!side && !top) return "";
    return [level, side, top].filter(Boolean).join(" ");
  }).filter(Boolean);
}

function buildSummary() {
  const fields = fieldsData();
  const posture = abnormalEntries("posture:", ["N"]);
  const lines = [
    "Gdanski Chiropractic Clinic",
    "VSC Examination",
    "",
    "Patient",
    `Patient: ${fields.patientName || "Not documented"}`,
    `Age: ${fields.patientAge || "Not documented"}`,
    `Date: ${fields.examDate || "Not documented"}`,
    `Doctor: ${fields.doctor || "Not documented"}`,
    "",
    "Cervical / Dorsolumbar",
    `FHP: ${fields.fhpCm || "Not documented"} cm; grade ${choiceValue("fhpGrade") || "Not documented"}`,
    `Trap tension: ${fields.trapTension || "Not documented"}/10`,
    `Occipital trigger: ${fields.occTrigger || "Not documented"}/10`,
    `Swayback: ${fields.swaybackCm || "Not documented"} cm; grade ${choiceValue("swaybackGrade") || "Not documented"}`,
    `Foot flare: ${choiceValue("footFlare") || "Not documented"}`,
    `Glute trigger: ${fields.glutTrigger || "Not documented"}/10`,
    "",
    "Postural Analysis",
    posture.length ? posture.join("\n") : "No abnormal posture findings documented.",
    "",
    "Kinesiopathology",
    levelFindings().length ? levelFindings().join("\n") : "No segmental findings documented.",
    "",
    "Myopathology Positives",
    muscleFindings().length ? muscleFindings().join("\n") : "No positive muscle findings documented.",
    "",
    "Orthopaedic Tests Positives",
    orthoFindings().length ? orthoFindings().join("\n") : "No positive orthopaedic findings documented.",
    `Apley's: L ${fields.apleyL || "-"} in, R ${fields.apleyR || "-"} in`,
    `C/S rotation: L ${fields.csRotationL || "-"} in, R ${fields.csRotationR || "-"} in`,
    `C/S lateral flexion: L ${fields.csLatFlexL || "-"} in, R ${fields.csLatFlexR || "-"} in`,
    "",
    "Neurological Positives",
    neuroFindings().length ? neuroFindings().join("\n") : "No positive neurological findings documented.",
    "",
    "Gait",
    choiceValue("gait") || "Not documented",
    "",
    "Notes",
    fields.examNotes || "None documented"
  ];
  return lines.join("\n");
}

function noteData() {
  const fields = fieldsData();
  return {
    id: storageId(fields),
    fields,
    choices: state.choices,
    muscleFindings: muscleFindings().join("; "),
    orthoFindings: orthoFindings().join("; "),
    neuroFindings: neuroFindings().join("; "),
    summary: buildSummary(),
    updatedAt: new Date().toISOString()
  };
}

function savedExams() {
  return readJson(EXAM_STORAGE_KEY, []);
}

function writeExams(exams) {
  writeJson(EXAM_STORAGE_KEY, exams.slice(0, 50));
}

function savedProfiles() {
  return readJson(PROFILE_STORAGE_KEY, {});
}

function writeProfiles(profiles) {
  writeJson(PROFILE_STORAGE_KEY, profiles);
}

function saveProfile(record) {
  const key = patientKey(record.fields.patientName);
  if (!key) return;
  const profiles = savedProfiles();
  profiles[key] = {
    ...(profiles[key] || {}),
    patientName: record.fields.patientName,
    examMuscleFindings: record.muscleFindings,
    examOrthoFindings: record.orthoFindings,
    examNeuroFindings: record.neuroFindings,
    examUpdatedAt: record.updatedAt
  };
  writeProfiles(profiles);
}

function saveExam(statusMessage = "Exam saved.") {
  const record = noteData();
  const records = savedExams().filter((item) => item.id !== record.id);
  writeExams([record, ...records]);
  saveProfile(record);
  if (statusMessage) setStatus(statusMessage);
}

function scheduleAutosave() {
  if (!state.autosaveReady) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => saveExam("Autosaved."), 700);
}

function render() {
  renderChoices();
  $("#summaryText").textContent = buildSummary();
}

function loadExam(record) {
  Object.entries(record.fields || {}).forEach(([name, value]) => {
    const field = document.getElementsByName(name)[0];
    if (field) field.value = value || "";
  });
  state.choices = { ...(record.choices || {}) };
  render();
  setStatus("Exam loaded.");
}

function loadRequestedExam() {
  const params = new URLSearchParams(window.location.search);
  const patient = String(params.get("patient") || "").trim().toLowerCase();
  if (!patient) return;
  const record = savedExams().find((item) => patientKey(item?.fields?.patientName) === patient);
  if (record) {
    loadExam(record);
    return;
  }
  $("#patientName").value = params.get("patient");
}

function setDefaults() {
  $("#examDate").value = todayIso();
}

function bindFields() {
  $$("input[name], textarea[name], select[name]").forEach((field) => {
    field.addEventListener("input", () => {
      render();
      scheduleAutosave();
    });
    field.addEventListener("change", () => {
      render();
      scheduleAutosave();
    });
  });
}

function exportExam() {
  const record = noteData();
  saveProfile(record);
  const blob = new Blob([record.summary], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const patient = patientKey(record.fields.patientName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
  link.href = url;
  link.download = `${patient}-vsc-exam.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function clearSaved() {
  const record = noteData();
  writeExams(savedExams().filter((item) => item.id !== record.id));
  setStatus("Saved exam cleared.");
}

function bindActions() {
  $("#saveExam").addEventListener("click", () => saveExam("Exam saved."));
  $("#exportExam").addEventListener("click", exportExam);
  $("#printExam").addEventListener("click", () => window.print());
  $("#copyExam").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#summaryText").textContent);
    setStatus("Exam copied.");
  });
  $("#clearExam").addEventListener("click", clearSaved);
}

mountPosture();
mountLevels();
mountMuscles();
mountOrthos();
mountReflexes();
mountCranial();
mountCompression();
bindChoiceGroups();
bindFields();
bindActions();
setDefaults();
loadRequestedExam();
render();
state.autosaveReady = true;
