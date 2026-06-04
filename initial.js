const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";

const levels = [
  "C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7",
  "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12",
  "L1", "L2", "L3", "L4", "L5", "SI-L", "SI-R"
];
const subluxationPatternExtras = ["Torque R", "Torque L"];
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

const initialSubjectiveItems = [
  ["Constant", "subjectiveChange", "Constant"], ["Improving", "subjectiveChange", "Improving"], ["Worsening", "subjectiveChange", "Worsening"],
  ["CK"], ["C", "side"], ["T", "side"], ["LB", "side"], ["S", "side"], ["SI", "side"], ["SH", "side"], ["SB", "side"],
  ["EL", "side"], ["WR", "side"], ["FIN", "side"], ["HIP", "side"], ["KN", "side"], ["FT", "side"], ["Toe", "side"],
  ["TMJ", "side"], ["H", "side"], ["PMS"], ["GI"], ["SIC"], ["AL"], ["SIN"], ["DY"], ["TRAM"], ["STRES"], ["W"]
];
const sideCycle = ["", "L", "R", "B"];

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
  const status = $("#statusLine");
  status.textContent = message;
  status.classList.toggle("is-active", Boolean(message));
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    status.textContent = "";
    status.classList.remove("is-active");
  }, 6000);
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

function currentPatientProfile() {
  const key = patientKey($("#patientName")?.value);
  return key ? savedProfiles()[key] || null : null;
}

function updatePatientNavLinks() {
  const patient = encodeURIComponent($("#patientName")?.value?.trim() || "");
  const links = {
    navSoap: "index.html",
    navConsent: "consent.html",
    navExam: "exam.html",
    navReports: "reports.html"
  };
  Object.entries(links).forEach(([id, page]) => {
    const link = document.getElementById(id);
    if (link) link.href = patient ? `${page}?patient=${patient}` : page;
  });
}

function syncProfileSubluxationsToInitial(profile) {
  if (!Array.isArray(profile?.subluxations)) return;
  const profileSubluxations = profile.subluxations;
  state.choices.subluxationPattern = [...profileSubluxations];
}

function applyProfileToInitial() {
  const profile = currentPatientProfile();
  if (!profile) return;
  if (profile.patientName && !$("#patientName").value) $("#patientName").value = profile.patientName;
  if (profile.dob && !$("#dob").value) $("#dob").value = profile.dob;
  const importantNotes = document.getElementsByName("importantNotes")[0];
  if (importantNotes && profile.importantNotes !== undefined) importantNotes.value = profile.importantNotes || "";
  syncProfileSubluxationsToInitial(profile);
  updateAge();
  updatePatientNavLinks();
  renderChoices();
}

function writeProfiles(profiles) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function clearSuppressedImportantNotesMatching(matches) {
  const key = patientKey($("#patientName")?.value);
  if (!key) return;
  const profiles = savedProfiles();
  const profile = profiles[key];
  if (!profile || !Array.isArray(profile.suppressedImportantNotes)) return;
  const remaining = profile.suppressedImportantNotes.filter((line) => !matches(String(line || "")));
  if (remaining.length === profile.suppressedImportantNotes.length) return;
  profiles[key] = { ...profile, suppressedImportantNotes: remaining };
  writeProfiles(profiles);
}

function clearGeneratedSuppressionFor(key) {
  if (key === "antAdjustment" || key === "antAreas") clearSuppressedImportantNotesMatching((line) => /^ant -\b/i.test(line));
  if (key === "ltdClick" || key === "ltdClickAreas") clearSuppressedImportantNotesMatching((line) => /^ltd click\b/i.test(line));
  if (key === "intensity") clearSuppressedImportantNotesMatching((line) => /^(v\.gen|gen|heavy)$/i.test(line));
  if (key === "softTissueOnly") clearSuppressedImportantNotesMatching((line) => /^ST only$/i.test(line));
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
  [...levels, ...subluxationPatternExtras].forEach((level) => {
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

function mountChiefComplaintButtons() {
  const target = $("#chiefComplaintButtons");
  if (!target) return;
  target.innerHTML = "";
  initialSubjectiveItems.forEach(([label, mode, value]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.label = label;
    button.dataset.mode = mode || "toggle";
    if (value) button.dataset.value = value;
    button.textContent = label;
    button.addEventListener("click", () => handleChiefComplaintButton(button));
    target.appendChild(button);
  });
}

function subjectiveDefaults() {
  const defaults = state.choices.subjectiveDefaults || {};
  return {
    selected: { ...(defaults.selected || {}) },
    sided: { ...(defaults.sided || {}) },
    single: { ...(defaults.single || {}) }
  };
}

function setSubjectiveDefaults(defaults) {
  state.choices.subjectiveDefaults = defaults;
}

function handleChiefComplaintButton(button) {
  const { label, mode, value } = button.dataset;
  const defaults = subjectiveDefaults();
  if (mode === "subjectiveChange") {
    defaults.single.subjectiveChange = defaults.single.subjectiveChange === value ? "" : value;
  } else if (mode === "side") {
    const current = defaults.sided[label] || "";
    const next = sideCycle[(sideCycle.indexOf(current) + 1) % sideCycle.length];
    if (next) defaults.sided[label] = next;
    else delete defaults.sided[label];
  } else {
    defaults.selected[label] = !defaults.selected[label];
    if (!defaults.selected[label]) delete defaults.selected[label];
  }
  setSubjectiveDefaults(defaults);
  renderChoices();
  scheduleAutosave();
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
      if (key === "ltdClick") normalizeLimitedClick();
      if (key === "antAdjustment") normalizeAntAdjustment();
      clearGeneratedSuppressionFor(key);
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
    delete state.choices.neckMob;
    return;
  }
  delete state.choices.neckSetup;
  if (state.choices.neckAdj !== "N") delete state.choices.neckMob;
}

function normalizeLimitedClick() {
  if (state.choices.ltdClick !== "Y") delete state.choices.ltdClickAreas;
}

function normalizeAntAdjustment() {
  if (state.choices.antAdjustment !== "Y") delete state.choices.antAreas;
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
  renderChiefComplaintButtons();
  syncImportantNotesFieldWithGenerated();
  $("#summaryText").textContent = buildSummary();
}

function renderChiefComplaintButtons() {
  const defaults = subjectiveDefaults();
  $$("#chiefComplaintButtons button[data-label]").forEach((button) => {
    const { label, mode, value } = button.dataset;
    const side = defaults.sided[label] || "";
    const selected = mode === "subjectiveChange" ? defaults.single.subjectiveChange === value : mode === "side" ? Boolean(side) : Boolean(defaults.selected[label]);
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
    button.innerHTML = `${label}${side ? `<span class="badge">${side}</span>` : ""}`;
  });
}

function selectedIncludes(key, value) {
  const current = state.choices[key];
  return Array.isArray(current) ? current.includes(value) : current === value;
}

function renderConditionalFields() {
  $("#exerciseOtherWrap").hidden = !selectedIncludes("exercise", "Other");
  $("#xrayOtherWrap").hidden = !selectedIncludes("xrayRecommend", "Other");
  $("#neckSetupWrap").hidden = state.choices.neckAdj !== "Y";
  $("#neckMobWrap").hidden = state.choices.neckAdj !== "N";
  $("#ltdClickAreasWrap").hidden = state.choices.ltdClick !== "Y";
  $("#antAreaWrap").hidden = state.choices.antAdjustment !== "Y";
  $("#rmtWhoWrap").hidden = state.choices.rmt !== "Y";
  $("#acuWhoWrap").hidden = state.choices.acu !== "Y";
}

function fieldsData() {
  const fields = {};
  $$("input[name], textarea[name], select[name]").forEach((field) => {
    fields[field.name] = field.value;
  });
  fields.patientId = currentPatientProfile()?.patientId || fields.patientId || "";
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

function profileContraindications(fields) {
  return [
    combinedText("contraindicationOptions", fields.contraindications),
    choiceText("familyHistory", "") ? `Family history: ${choiceText("familyHistory", "")}` : "",
    fields.strokeRisk ? `Stroke risk: ${fields.strokeRisk}` : ""
  ].filter(Boolean).join("; ");
}

function noteLines(value) {
  return String(value || "")
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueNoteLines(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isInitialGeneratedImportantNote(line) {
  return /^ltd click\b/i.test(line) ||
    /^ant -\b/i.test(line) ||
    /^(v\.gen|gen|heavy|ST only)$/i.test(line);
}

function rawGeneratedImportantNoteLines() {
  const lines = [];
  const ltdAreas = Array.isArray(state.choices.ltdClickAreas) ? state.choices.ltdClickAreas : [];
  if (state.choices.ltdClick === "Y" && ltdAreas.length) lines.push(`ltd click ${ltdAreas.join(", ")}`);
  const antAreas = Array.isArray(state.choices.antAreas) ? state.choices.antAreas : [];
  if (state.choices.antAdjustment === "Y" && antAreas.length) lines.push(`ant - ${antAreas.join(", ")}`);
  const intensityLabels = {
    "Very gentle": "v.gen",
    Gentle: "gen",
    Heavy: "heavy"
  };
  if (intensityLabels[state.choices.intensity]) lines.push(intensityLabels[state.choices.intensity]);
  if (state.choices.softTissueOnly === "Yes") lines.push("ST only");
  return uniqueNoteLines(lines);
}

function generatedImportantNoteLines() {
  const lines = rawGeneratedImportantNoteLines();
  const suppressed = new Set((currentPatientProfile()?.suppressedImportantNotes || []).map((line) => String(line).toLowerCase()));
  return lines.filter((line) => !suppressed.has(line.toLowerCase()));
}

function syncImportantNotesFieldWithGenerated() {
  const field = document.getElementsByName("importantNotes")[0];
  if (!field) return "";
  const manual = noteLines(field.value).filter((line) => !isInitialGeneratedImportantNote(line));
  const merged = uniqueNoteLines([...manual, ...generatedImportantNoteLines()]).join("\n");
  field.value = merged;
  return merged;
}

function profileImportantNotes(fields = fieldsData()) {
  return uniqueNoteLines(noteLines(fields.importantNotes)).join("\n");
}

function suppressedImportantNotes(fields = fieldsData()) {
  const visible = new Set(noteLines(fields.importantNotes).map((line) => line.toLowerCase()));
  return rawGeneratedImportantNoteLines().filter((line) => !visible.has(line.toLowerCase()));
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
      ["Patient ID", "patientId"],
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
    `Chief complaint quick selections: ${subjectiveDefaultsText() || "Not documented"}`,
    ...linesForFields(fields, [["Chief complaint", "chiefComplaint"]]),
    "",
    "History And DC Comments",
    ...linesForFields(fields, [
      ["History", "historyNotes"],
      ["DC comments", "dcComments"],
      ["Important notes", "importantNotes"]
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
    `Mob: ${state.choices.neckAdj === "N" ? choiceText("neckMob") : "Not applicable"}`,
    `Click ok: ${choiceText("clickOk")}`,
    `Care model: ${choiceText("careModel")}`,
    `Lifetime adjustment: ${choiceText("lifetimeAdj")}`,
    `Wants click: ${choiceText("wantsClick")}`,
    `Ant: ${choiceText("antAdjustment")}`,
    `Ant area: ${state.choices.antAdjustment === "Y" ? choiceText("antAreas") : "Not applicable"}`,
    `Ltd click: ${choiceText("ltdClick")}`,
    `Ltd click areas: ${state.choices.ltdClick === "Y" ? choiceText("ltdClickAreas") : "Not applicable"}`,
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
    ...(profiles[key] || {}),
    patientName: fields.patientName,
    patientId: fields.patientId || profiles[key]?.patientId || "",
    dob: fields.dob,
    patientAge: fields.patientAge,
    contraindications: profileContraindications(fields),
    importantNotes: profileImportantNotes(fields),
    importantNotesAutoLines: rawGeneratedImportantNoteLines(),
    suppressedImportantNotes: suppressedImportantNotes(fields),
    neckAdjustment: state.choices.neckAdj || "",
    neckMob: state.choices.neckMob || "",
    softTissueOnly: state.choices.softTissueOnly || "",
    intensity: state.choices.intensity || "",
    limitedClick: state.choices.ltdClick || "",
    limitedClickAreas: state.choices.ltdClickAreas || [],
    antAdjustment: state.choices.antAdjustment || "",
    antAreas: state.choices.antAreas || [],
    familyHistory: state.choices.familyHistory || [],
    strokeRisk: fields.strokeRisk || "",
    subjectiveDefaults: subjectiveDefaults(),
    schedule: fields.frequency,
    diagnosis: fields.diagnosis,
    primarySubluxation: fields.primarySubluxation,
    subluxations: state.choices.subluxationPattern || [],
    treatmentPlan: fields.treatmentPlan,
    orthoticsLastDate: fields.orthoticsLastDate || "",
    orthoticsRecheckDate: fields.recheckDate || "",
    doctor: fields.doctor,
    updatedAt: record.updatedAt
  };
  writeProfiles(profiles);
}

function subjectiveDefaultsText() {
  const defaults = subjectiveDefaults();
  const parts = [];
  if (defaults.single.subjectiveChange) parts.push(defaults.single.subjectiveChange);
  Object.entries(defaults.selected).forEach(([label, selected]) => {
    if (selected) parts.push(label);
  });
  Object.entries(defaults.sided).forEach(([label, side]) => {
    if (side) parts.push(`${label} ${side}`);
  });
  return parts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ");
}

function saveInitial(statusMessage = "Initial visit saved.", requireDoctor = false) {
  if (requireDoctor && !validateDoctor()) return;
  const record = noteData();
  const records = savedInitials().filter((item) => item.id !== record.id);
  writeInitials([record, ...records]);
  saveProfile(record);
  if (statusMessage) setStatus(statusMessage);
}

function validateDoctor() {
  const doctor = $("#doctor");
  if (doctor.value.trim()) return true;
  doctor.focus();
  setStatus("Doctor required before leaving or saving this initial visit.");
  return false;
}

function autosaveBeforeLeave() {
  saveInitial("");
}

function scheduleAutosave() {
  if (!state.autosaveReady) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => saveInitial("Autosaved."), 350);
}

function addYears(dateValue, years) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function updateOrthoticsRecheck() {
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
  if (!validateDoctor()) return;
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
  if (!validateDoctor()) return;
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
  normalizeLimitedClick();
  normalizeAntAdjustment();
  updateAge();
  updateOrthoticsRecheck();
  renderChoices();
  setStatus("Initial visit loaded.");
}

function applyExamTransferFromProfile() {
  const patient = patientKey($("#patientName").value);
  if (!patient) return;
  const profile = savedProfiles()[patient];
  if (!profile) return;
  const muscle = document.getElementsByName("examMuscleFindings")[0];
  const neuro = document.getElementsByName("examNeuroFindings")[0];
  if (muscle && profile.examMuscleFindings !== undefined) muscle.value = profile.examMuscleFindings || "";
  if (neuro && profile.examNeuroFindings !== undefined) {
    neuro.value = [profile.examNeuroFindings, profile.examOrthoFindings].filter(Boolean).join("; ");
  }
}

function loadRequestedInitialFromUrl() {
  const patient = String(new URLSearchParams(window.location.search).get("patient") || "").trim().toLowerCase();
  if (!patient) return;
  const record = savedInitials().find((item) => patientKey(item?.fields?.patientName) === patient);
  if (record) loadInitialRecord(record);
  else $("#patientName").value = new URLSearchParams(window.location.search).get("patient") || "";
  applyProfileToInitial();
  applyExamTransferFromProfile();
  updatePatientNavLinks();
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
      if (field.name === "patientName") updatePatientNavLinks();
      if (field.name === "importantNotes") {
        $("#summaryText").textContent = buildSummary();
        scheduleAutosave();
        return;
      }
      renderChoices();
      scheduleAutosave();
    });
    field.addEventListener("change", () => {
      if (field.name === "orthoticsLastDate") updateOrthoticsRecheck();
      if (field.name === "dob") updateAge();
      if (field.name === "patientName") updatePatientNavLinks();
      if (field.name === "importantNotes") {
        $("#summaryText").textContent = buildSummary();
        scheduleAutosave();
        return;
      }
      renderChoices();
      scheduleAutosave();
    });
  });
}

function bindActions() {
  $("#saveInitial").addEventListener("click", () => saveInitial("Initial visit saved.", true));
  $("#exportInitial").addEventListener("click", exportInitial);
  $("#printInitial").addEventListener("click", printInitial);
  $("#copyInitial").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#summaryText").textContent);
    setStatus("Initial note copied.");
  });
  $("#clearInitial").addEventListener("click", clearSaved);
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.href.startsWith("javascript:")) return;
    autosaveBeforeLeave();
    if (!validateDoctor()) {
      event.preventDefault();
      return;
    }
  });
  window.addEventListener("pagehide", autosaveBeforeLeave);
  window.addEventListener("beforeunload", (event) => {
    if ($("#doctor").value.trim()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

function bindRoleFilters() {
  const sheet = $(".initial-sheet");
  $$(".role-filter").forEach((button) => {
    button.addEventListener("click", () => {
      const view = button.dataset.roleFilter || "default";
      sheet.dataset.roleView = view;
      $$(".role-filter").forEach((item) => item.classList.toggle("is-selected", item === button));
    });
  });
}

mountLevels();
mountXrayAreas();
mountChiefComplaintButtons();
bindChoiceGroups();
bindFields();
bindActions();
bindRoleFilters();
updateDateParts();
updateAge();
setInitialDefaults();
loadRequestedInitialFromUrl();
applyExamTransferFromProfile();
state.autosaveReady = true;
