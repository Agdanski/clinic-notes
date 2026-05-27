const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";

const levels = [
  "C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7",
  "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12",
  "L1", "L2", "L3", "L4", "L5", "SI-L", "SI-R"
];
const xrayAreas = [
  "Skull", "Facial Bones", "Nasal Bones", "Mandible", "Pre-MRI Orbits", "Nasopharynx",
  "Ribs L", "Ribs R", "Sternoclavicular Joints", "Sternum", "Abdomen/KUB", "Acute Abdomen",
  "Pelvis", "Pelvis and Hip L", "Pelvis and Hip R", "Cervical Spine", "Thoracic Spine",
  "Lumbar Spine", "Sacrum and Coccyx", "Sacroiliac Joints", "Scoliosis", "Leg Length",
  "Hip L", "Hip R", "Femur L", "Femur R", "Knee L", "Knee R", "Tib-Fib L", "Tib-Fib R",
  "Ankle L", "Ankle R", "Heel L", "Heel R", "Foot L", "Foot R", "Toe L", "Toe R",
  "Shoulder L", "Shoulder R", "AC Joint L", "AC Joint R", "Clavicle L", "Clavicle R",
  "Scapula L", "Scapula R", "Humerus L", "Humerus R", "Elbow L", "Elbow R",
  "Forearm L", "Forearm R", "Wrist L", "Wrist R", "Hand L", "Hand R", "Finger L", "Finger R",
  "Chest X-Ray"
];
const state = {
  choices: {},
  autosaveReady: false
};

let autosaveTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function todayParts() {
  const now = new Date();
  return {
    monthYear: now.toLocaleDateString(undefined, { month: "2-digit", year: "numeric" }),
    day: now.toLocaleDateString(undefined, { day: "2-digit" })
  };
}

function patientKey(name) {
  return String(name || "").trim().toLowerCase();
}

function storageId(data) {
  const patient = patientKey(data.fields.patientName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
  return `initial-${patient}`;
}

function setStatus(message) {
  $("#statusLine").textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    $("#statusLine").textContent = "";
  }, 2400);
}

function savedInitials() {
  try {
    return JSON.parse(localStorage.getItem(INITIAL_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeInitials(records) {
  localStorage.setItem(INITIAL_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
}

function savedProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeProfiles(profiles) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function mountLevels() {
  const primary = $("#primarySubluxation");
  primary.innerHTML = '<option value=""></option>';
  levels.forEach((level) => {
    const option = document.createElement("option");
    option.value = level;
    option.textContent = level;
    primary.appendChild(option);
  });

  const grid = $("#subluxationGrid");
  levels.forEach((level) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.value = level;
    button.textContent = level;
    grid.appendChild(button);
  });
}

function mountXrayAreas() {
  const select = $("#xrayLocation");
  select.innerHTML = '<option value=""></option>';
  xrayAreas.forEach((area) => {
    const option = document.createElement("option");
    option.value = area;
    option.textContent = area;
    select.appendChild(option);
  });
}

function bindChoiceGroups() {
  $$(".choice-group").forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-value]");
      if (!button) return;
      const key = group.dataset.group;
      const value = button.dataset.value;
      if (group.classList.contains("multi")) {
        const values = new Set(state.choices[key] || []);
        if (values.has(value)) values.delete(value);
        else values.add(value);
        state.choices[key] = Array.from(values);
        if (key === "xrayRecommend") normalizeXrayChoices(value);
      } else {
        state.choices[key] = state.choices[key] === value ? "" : value;
      }
      if (key === "neckAdj") normalizeNeckSetup();
      renderChoices();
      scheduleAutosave();
    });
  });
}

function normalizeXrayChoices(changedValue) {
  const values = new Set(state.choices.xrayRecommend || []);
  const regionChoices = ["C", "T", "LB", "Other"];
  if (regionChoices.includes(changedValue) && values.has(changedValue)) values.delete("None");
  if (changedValue === "None" && values.has("None")) {
    regionChoices.forEach((item) => values.delete(item));
    values.delete("Out");
  }
  if (regionChoices.some((item) => values.has(item))) values.add("Out");
  state.choices.xrayRecommend = Array.from(values);
}

function normalizeNeckSetup() {
  if (state.choices.neckAdj === "Y") {
    const current = Array.isArray(state.choices.neckSetup) ? state.choices.neckSetup : [];
    state.choices.neckSetup = current.length ? current : ["Sup"];
    return;
  }
  delete state.choices.neckSetup;
}

function renderChoices() {
  $$(".choice-group").forEach((group) => {
    const key = group.dataset.group;
    const current = state.choices[key];
    group.querySelectorAll("button[data-value]").forEach((button) => {
      const value = button.dataset.value;
      const active = Array.isArray(current) ? current.includes(value) : current === value;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  });
  renderConditionalFields();
  $("#summaryText").textContent = buildSummary();
}

function selectedIncludes(key, value) {
  const current = state.choices[key];
  return Array.isArray(current) ? current.includes(value) : current === value;
}

function renderConditionalFields() {
  $("#exerciseOtherWrap").hidden = !selectedIncludes("exercise", "Other");
  $("#xrayOtherWrap").hidden = !selectedIncludes("xrayRecommend", "Other");
  $("#neckSetupWrap").hidden = state.choices.neckAdj !== "Y";
  $("#rmtWhoWrap").hidden = state.choices.rmt !== "Y";
  $("#acuWhoWrap").hidden = state.choices.acu !== "Y";
}

function fieldsData() {
  const fields = {};
  $$("input[name], textarea[name], select[name]").forEach((field) => {
    fields[field.name] = field.value;
  });
  return fields;
}

function noteData() {
  const fields = fieldsData();
  const record = {
    id: "",
    fields,
    choices: state.choices,
    summary: "",
    updatedAt: new Date().toISOString()
  };
  record.id = storageId(record);
  record.summary = buildSummary();
  return record;
}

function filled(value, fallback = "Not documented") {
  const text = String(value || "").trim();
  return text || fallback;
}

function choiceText(key, fallback = "Not documented") {
  const value = state.choices[key];
  if (Array.isArray(value)) return value.length ? value.join(", ") : fallback;
  return value || fallback;
}

function combinedText(choiceKey, freeText) {
  return [choiceText(choiceKey, ""), String(freeText || "").trim()].filter(Boolean).join("; ");
}

function linesForFields(fields, pairs) {
  return pairs.map(([label, key]) => `${label}: ${filled(fields[key])}`);
}

function buildSummary() {
  const fields = fieldsData();
  return [
    "Gdanski Chiropractic Clinic",
    "Initial Visit Clinical Note",
    "",
    "Patient",
    ...linesForFields(fields, [
      ["Patient", "patientName"],
      ["Date", "monthYear"],
      ["Day", "visitDay"],
      ["DOB", "dob"],
      ["Age", "patientAge"],
      ["Doctor", "doctor"]
    ]),
    `Visit type: ${choiceText("visitType")}`,
    `Adjusted first visit: ${choiceText("adjusted")}`,
    "",
    "Chief Complaint",
    ...linesForFields(fields, [["Chief complaint", "chiefComplaint"]]),
    "",
    "History And DC Comments",
    ...linesForFields(fields, [
      ["History", "historyNotes"],
      ["DC comments", "dcComments"]
    ]),
    "",
    "Assessment Setup",
    ...linesForFields(fields, [
      ["Diagnosis", "diagnosis"],
      ["Primary subluxation", "primarySubluxation"]
    ]),
    `D.D. options: ${choiceText("differentialDxOptions")}`,
    ...linesForFields(fields, [
      ["D.D. other/details", "differentialDiagnosis"],
      ["Treatment plan", "treatmentPlan"],
      ["Frequency", "frequency"]
    ]),
    `Contraindication/caution options: ${choiceText("contraindicationOptions")}`,
    ...linesForFields(fields, [["Contraindications/details", "contraindications"]]),
    `Subluxations to correct: ${choiceText("subluxationPattern")}`,
    `Neck adjustment: ${choiceText("neckAdj")}`,
    `Neck setup: ${state.choices.neckAdj === "Y" ? choiceText("neckSetup") : "Not applicable"}`,
    `Click ok: ${choiceText("clickOk")}`,
    `Care model: ${choiceText("careModel")}`,
    `Lifetime adjustment: ${choiceText("lifetimeAdj")}`,
    `Wants click: ${choiceText("wantsClick")}`,
    `Intensity: ${choiceText("intensity")}`,
    `Soft tissue only: ${choiceText("softTissueOnly")}`,
    "",
    "Risk And Prognosis",
    `Prognosis: ${choiceText("prognosis")}`,
    `Refer MD: ${choiceText("referMd")}`,
    `Family history: ${choiceText("familyHistory")}`,
    ...linesForFields(fields, [["Stroke risk", "strokeRisk"]]),
    `Risk/benefit discussion: ${choiceText("riskBenefit")}`,
    `Under MD supervision: ${choiceText("underMd")}`,
    `Alternative care options: ${choiceText("alternativeCareOptions")}`,
    ...linesForFields(fields, [["Other alternative care", "alternativeCare"]]),
    "",
    "Exam Findings Transferred",
    ...linesForFields(fields, [
      ["Muscle testing positives", "examMuscleFindings"],
      ["Neurological testing positives", "examNeuroFindings"]
    ]),
    "",
    "Doctor Recommendations",
    `Recommend: ${choiceText("recommend")}`,
    `Exercise: ${choiceText("exercise")}`,
    ...linesForFields(fields, [["Other exercise", "exerciseOther"]]),
    `X-ray recommendation: ${choiceText("xrayRecommend")}`,
    ...linesForFields(fields, [["Other x-ray", "xrayOther"]]),
    "",
    "Referral / Prior Care",
    ...linesForFields(fields, [
      ["Referred by", "referredBy"],
      ["MD", "md"],
      ["MD last seen", "mdLastSeen"],
      ["Previous DC", "previousDc"],
      ["Previous DC last seen", "previousDcLastSeen"],
      ["X-ray date", "xrayDate"],
      ["X-ray body area", "xrayLocation"]
    ]),
    `Recent x-ray: ${choiceText("recentXray")}`,
    "",
    "Goals And Lifestyle",
    ...linesForFields(fields, [
      ["Goals", "goals"],
      ["Worst habit", "worstHabit"],
      ["Major stress", "majorStress"]
    ]),
    `Spouse patient: ${choiceText("spousePatient")}`,
    ...linesForFields(fields, [["Spouse name", "spouseName"]]),
    `Kids patient: ${choiceText("kidsPatient")}`,
    ...linesForFields(fields, [["Kids name", "kidsName"]]),
    "",
    "Orthotics And Practitioners",
    `Orthotics: ${choiceText("orthotics")}`,
    ...linesForFields(fields, [["Last orthotics date", "orthoticsLastDate"]]),
    ...linesForFields(fields, [["Orthotics re-check date", "recheckDate"]]),
    `RMT: ${choiceText("rmt")}`,
    ...linesForFields(fields, [["RMT who", "rmtWho"]]),
    `ACU: ${choiceText("acu")}`,
    ...linesForFields(fields, [["ACU who", "acuWho"]])
  ].join("\n");
}

function saveProfile(record) {
  const fields = record.fields;
  const key = patientKey(fields.patientName);
  if (!key) return;
  const profiles = savedProfiles();
  profiles[key] = {
    patientName: fields.patientName,
    contraindications: combinedText("contraindicationOptions", fields.contraindications),
    neckAdjustment: state.choices.neckAdj || "",
    softTissueOnly: state.choices.softTissueOnly || "",
    intensity: state.choices.intensity || "",
    schedule: fields.frequency,
    diagnosis: fields.diagnosis,
    primarySubluxation: fields.primarySubluxation,
    subluxations: state.choices.subluxationPattern || [],
    treatmentPlan: fields.treatmentPlan,
    doctor: fields.doctor,
    updatedAt: record.updatedAt
  };
  writeProfiles(profiles);
}

function saveInitial(statusMessage = "Initial visit saved.") {
  const record = noteData();
  const records = savedInitials().filter((item) => item.id !== record.id);
  writeInitials([record, ...records]);
  saveProfile(record);
  if (statusMessage) setStatus(statusMessage);
}

function scheduleAutosave() {
  if (!state.autosaveReady) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => saveInitial("Autosaved."), 700);
}

function addYears(dateValue, years) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function updateOrthoticsRecheck() {
  if (state.choices.orthotics !== "Y") return;
  const lastDate = document.querySelector('[name="orthoticsLastDate"]').value;
  const recheck = document.querySelector('[name="recheckDate"]');
  if (!lastDate) return;
  recheck.value = addYears(lastDate, 2);
}

function setInitialDefaults() {
  state.choices.xrayRecommend = ["None"];
  state.choices.riskBenefit = [
    "Chiropractic risks reviewed",
    "Chiropractic benefits reviewed",
    "Alternatives reviewed",
    "MD referral considered"
  ];
  state.choices.alternativeCareOptions = [
    "Massage therapy",
    "Acupuncture",
    "Allopathic medicine",
    "Physiotherapy",
    "Exercise/rehab",
    "Medication",
    "Imaging"
  ];
  renderChoices();
}

function exportInitial() {
  const record = noteData();
  saveProfile(record);
  const blob = new Blob([record.summary], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const patient = patientKey(record.fields.patientName).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
  link.href = url;
  link.download = `${patient}-initial-visit.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function printInitial() {
  window.print();
}

function clearSaved() {
  const record = noteData();
  const records = savedInitials().filter((item) => item.id !== record.id);
  writeInitials(records);
  setStatus("Saved initial visit cleared.");
}

function loadInitialRecord(record) {
  Object.entries(record.fields || {}).forEach(([name, value]) => {
    const field = document.getElementsByName(name)[0];
    if (field) field.value = value || "";
  });
  state.choices = { ...(record.choices || {}) };
  normalizeNeckSetup();
  updateAge();
  updateOrthoticsRecheck();
  renderChoices();
  setStatus("Initial visit loaded.");
}

function loadRequestedInitialFromUrl() {
  const patient = String(new URLSearchParams(window.location.search).get("patient") || "").trim().toLowerCase();
  if (!patient) return;
  const record = savedInitials().find((item) => patientKey(item?.fields?.patientName) === patient);
  if (record) loadInitialRecord(record);
}

function updateDateParts() {
  const parts = todayParts();
  $("#monthYear").value = parts.monthYear;
  $("#visitDay").value = parts.day;
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

function updateAge() {
  $("#patientAge").value = calculateAge($("#dob").value);
}

function bindFields() {
  $$("input[name], textarea[name], select[name]").forEach((field) => {
    field.addEventListener("input", () => {
      if (field.name === "orthoticsLastDate") updateOrthoticsRecheck();
      if (field.name === "dob") updateAge();
      renderChoices();
      scheduleAutosave();
    });
    field.addEventListener("change", () => {
      if (field.name === "orthoticsLastDate") updateOrthoticsRecheck();
      if (field.name === "dob") updateAge();
      renderChoices();
      scheduleAutosave();
    });
  });
}

function bindActions() {
  $("#saveInitial").addEventListener("click", () => saveInitial("Initial visit saved."));
  $("#exportInitial").addEventListener("click", exportInitial);
  $("#printInitial").addEventListener("click", printInitial);
  $("#copyInitial").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#summaryText").textContent);
    setStatus("Initial note copied.");
  });
  $("#clearInitial").addEventListener("click", clearSaved);
}

mountLevels();
mountXrayAreas();
bindChoiceGroups();
bindFields();
bindActions();
updateDateParts();
updateAge();
setInitialDefaults();
loadRequestedInitialFromUrl();
state.autosaveReady = true;
