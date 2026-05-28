const EXAM_STORAGE_KEY = "clinic-vsc-exam-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";

const levels = [
  "OCC", "ATLAS", "AXIS", "C3", "C4", "C5", "C6", "C7",
  "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12",
  "L1", "L2", "L3", "L4", "L5", "SAC", "SI-L", "SI-R"
];
const posturalItems = ["Shoulder high", "Hip high", "Foot pronation", "Long leg"];
const functionalItems = ["K27"];
const muscleItems = ["Psoas", "Piriformis", "QF", "Glut", "Hamst", "Delt", "Pect", "Lats", "Other", "S. Spin"];
const orthoItems = ["Ely's", "Yeomans", "SLR", "Int. shoulder rotation", "Ext. shoulder rotation", "Figure 4"];
const cervicalMotionItems = ["C/S rotation", "C/S lateral flexion"];
const dtrItems = ["Triceps", "Biceps", "Radial", "Patellar", "Achilles"];
const motorItems = ["C5", "C6", "C7", "C8", "T1", "L3", "L4", "L5", "S1"];
const sensationItems = ["C5", "C6", "C7", "C8", "T1", "L3", "L4", "L5"];
const dtrGrades = ["0", "1+", "2+", "3+", "4+"];
const motorGrades = ["0/5", "1/5", "2/5", "3/5", "4/5", "5/5"];
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

function addSplitRow(target, label, groups) {
  const row = document.createElement("div");
  row.className = "exam-row split-row";
  const title = document.createElement("strong");
  title.textContent = label;
  row.appendChild(title);
  const wrap = document.createElement("div");
  wrap.className = "split-controls";
  groups.forEach(({ label: groupLabel, group }) => {
    const item = document.createElement("div");
    item.className = "split-control";
    const caption = document.createElement("span");
    caption.textContent = groupLabel;
    item.appendChild(caption);
    item.appendChild(group);
    wrap.appendChild(item);
  });
  row.appendChild(wrap);
  target.appendChild(row);
}

function mountPosture() {
  const target = $("#postureGrid");
  posturalItems.forEach((item) => addRow(target, item, makeChoiceGroup(`posture:${item}`, ["L", "N", "R"])));
}

function mountFunctionalChecks() {
  const target = $("#functionalGrid");
  functionalItems.forEach((item) => addRow(target, item, makeChoiceGroup(`functional:${item}`, ["L", "N", "R"])));
}

function mountLevels() {
  const target = $("#levelGrid");
  levels.forEach((level) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level-button";
    button.dataset.level = level;
    button.textContent = level;
    target.appendChild(button);
  });
}

function mountMuscles() {
  const target = $("#muscleGrid");
  muscleItems.forEach((item) => {
    addSplitRow(target, item, [
      { label: "Finding", group: makeChoiceGroup(`muscle:${item}:finding`, ["Normal", "Weak", "Painful"]) },
      { label: "Side", group: makeChoiceGroup(`muscle:${item}:side`, ["L", "R", "Both"]) }
    ]);
  });
}

function mountOrthos() {
  const target = $("#orthoGrid");
  orthoItems.forEach((item) => addRow(target, item, makeChoiceGroup(`ortho:${item}`, ["L +", "L -", "R +", "R -"], true)));
  addRow(target, "Valsalvas", makeChoiceGroup("ortho:Valsalvas", ["+", "-"]));
  cervicalMotionItems.forEach((item) => addRow(target, item, makeChoiceGroup(`motion:${item}`, ["L normal", "L decreased", "R normal", "R decreased"], true)));
}

function mountDtrMotorSensation() {
  const dtr = $("#dtrGrid");
  dtrItems.forEach((item) => {
    addSplitRow(dtr, item, [
      { label: "L", group: makeChoiceGroup(`dtr:${item}:L`, dtrGrades) },
      { label: "R", group: makeChoiceGroup(`dtr:${item}:R`, dtrGrades) }
    ]);
  });

  const motor = $("#motorGrid");
  motorItems.forEach((item) => {
    addSplitRow(motor, item, [
      { label: "L", group: makeChoiceGroup(`motor:${item}:L`, motorGrades) },
      { label: "R", group: makeChoiceGroup(`motor:${item}:R`, motorGrades) }
    ]);
  });

  const sensation = $("#sensationGrid");
  sensationItems.forEach((item) => {
    addSplitRow(sensation, item, [
      { label: "L", group: makeChoiceGroup(`sensation:${item}:L`, ["Normal", "Decreased"]) },
      { label: "R", group: makeChoiceGroup(`sensation:${item}:R`, ["Normal", "Decreased"]) }
    ]);
  });
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
    const levelButton = event.target.closest(".level-button[data-level]");
    if (levelButton) {
      cycleLevel(levelButton.dataset.level);
      render();
      scheduleAutosave();
      return;
    }
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
    normalizeChoice(key);
    render();
    scheduleAutosave();
  });
}

function cycleLevel(level) {
  const key = `level:${level}`;
  const current = state.choices[key] || "";
  if (!current) state.choices[key] = "finding";
  else if (current === "finding") state.choices[key] = "TOP";
  else delete state.choices[key];
}

function normalizeChoice(key) {
  if (key.startsWith("muscle:") && key.endsWith(":finding")) {
    const item = key.split(":")[1];
    if (state.choices[key] === "Normal") delete state.choices[`muscle:${item}:side`];
  }
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
  $$(".level-button[data-level]").forEach((button) => {
    const value = state.choices[`level:${button.dataset.level}`] || "";
    button.classList.toggle("is-selected", value === "finding");
    button.classList.toggle("is-top", value === "TOP");
    button.textContent = value === "TOP" ? `${button.dataset.level} TOP` : button.dataset.level;
    button.setAttribute("aria-pressed", String(Boolean(value)));
  });
  muscleItems.forEach((item) => {
    const sideGroup = document.querySelector(`[data-group="muscle:${CSS.escape(item)}:side"]`);
    if (!sideGroup) return;
    const finding = state.choices[`muscle:${item}:finding`];
    const disabled = !finding || finding === "Normal";
    sideGroup.querySelectorAll("button").forEach((button) => {
      button.disabled = disabled;
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
  return muscleItems.map((item) => {
    const finding = state.choices[`muscle:${item}:finding`];
    if (!finding || finding === "Normal") return "";
    const side = state.choices[`muscle:${item}:side`];
    return `${item}: ${finding}${side ? ` ${side}` : ""}`;
  }).filter(Boolean);
}

function orthoFindings() {
  return [
    ...abnormalEntries("ortho:").filter((line) => line.includes("+") || line.includes("AbN")),
    ...motionFindings()
  ];
}

function neuroFindings() {
  return [
    ...dtrMotorSensationFindings(),
    ...cranialFindings(),
    ...compressionFindings()
  ];
}

function dtrMotorSensationFindings() {
  return [
    ...dtrFindings(),
    ...motorFindings(),
    ...sensationFindings()
  ];
}

function cranialFindings() {
  return abnormalEntries("cranial:", ["UR"]);
}

function compressionFindings() {
  return abnormalEntries("compression:", ["UR"]);
}

function motionFindings() {
  return cervicalMotionItems.map((item) => {
    const value = state.choices[`motion:${item}`] || [];
    const decreased = Array.isArray(value) ? value.filter((entry) => entry.includes("decreased")) : [];
    return decreased.length ? `${item}: ${decreased.join(", ")}` : "";
  }).filter(Boolean);
}

function dtrFindings() {
  return dtrItems.flatMap((item) => ["L", "R"].map((side) => {
    const value = state.choices[`dtr:${item}:${side}`];
    return value && value !== "2+" ? `${item} DTR ${side}: ${value}` : "";
  })).filter(Boolean);
}

function motorFindings() {
  return motorItems.flatMap((item) => ["L", "R"].map((side) => {
    const value = state.choices[`motor:${item}:${side}`];
    return value && value !== "5/5" ? `${item} motor ${side}: ${value}` : "";
  })).filter(Boolean);
}

function sensationFindings() {
  return sensationItems.flatMap((item) => ["L", "R"].map((side) => {
    const value = state.choices[`sensation:${item}:${side}`];
    return value === "Decreased" ? `${item} sensation ${side}: decreased` : "";
  })).filter(Boolean);
}

function levelFindings() {
  return levels.map((level) => {
    const value = state.choices[`level:${level}`];
    if (!value) return "";
    return value === "TOP" ? `${level} TOP` : level;
  }).filter(Boolean);
}

function allDtrMotorSensationNormal() {
  return [
    ...dtrItems.flatMap((item) => [`dtr:${item}:L`, `dtr:${item}:R`].map((key) => state.choices[key] === "2+")),
    ...motorItems.flatMap((item) => [`motor:${item}:L`, `motor:${item}:R`].map((key) => state.choices[key] === "5/5")),
    ...sensationItems.flatMap((item) => [`sensation:${item}:L`, `sensation:${item}:R`].map((key) => state.choices[key] === "Normal"))
  ].every(Boolean);
}

function allCranialNormal() {
  return cranialItems.every((item) => state.choices[`cranial:${item}`] === "UR");
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
    `FHP grade: ${choiceValue("fhpGrade") || "Not documented"}`,
    `Trap tension: ${fields.trapTension || "Not documented"}/10`,
    `Occipital trigger: ${fields.occTrigger || "Not documented"}/10`,
    `Swayback grade: ${choiceValue("swaybackGrade") || "Not documented"}`,
    `Foot flare: ${choiceValue("footFlare") || "Not documented"}`,
    `Glute trigger: ${fields.glutTrigger || "Not documented"}/10`,
    "",
    "Postural Analysis",
    posture.length ? posture.join("\n") : "No abnormal posture findings documented.",
    "",
    "Functional Checks",
    abnormalEntries("functional:", ["N"]).length ? abnormalEntries("functional:", ["N"]).join("\n") : "No abnormal functional checks documented.",
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
    "",
    "DTR / Motor / Sensation",
    dtrMotorSensationFindings().length ? dtrMotorSensationFindings().join("\n") : allDtrMotorSensationNormal() ? "All normal." : "No abnormal DTR, motor, or sensation findings documented.",
    "",
    "Neurological Assessment",
    cranialFindings().length ? cranialFindings().join("\n") : allCranialNormal() ? "All normal / UR." : "No abnormal neurological assessment findings documented.",
    "",
    "Compression Tests",
    compressionFindings().length ? compressionFindings().join("\n") : "No abnormal compression test findings documented.",
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
  state.choices = migrateChoices(record.choices || {});
  render();
  setStatus("Exam loaded.");
}

function migrateChoices(choices) {
  const migrated = { ...choices };
  if (migrated["level:SI FIX"]) {
    migrated["level:SI-R"] = migrated["level:SI FIX"];
    delete migrated["level:SI FIX"];
  }
  if (migrated["level:SI FIX:side"]) {
    const oldSide = migrated["level:SI FIX:side"];
    const sides = Array.isArray(oldSide) ? oldSide : [oldSide];
    sides.forEach((side) => {
      if (side === "L" || side === "R") migrated[`level:SI-${side}`] = "finding";
    });
    delete migrated["level:SI FIX:side"];
    delete migrated["level:SI FIX:top"];
  }
  muscleItems.forEach((item) => {
    const oldTone = migrated[`muscle:${item}:tone`];
    if (oldTone && !migrated[`muscle:${item}:finding`]) {
      migrated[`muscle:${item}:finding`] = oldTone === "Normal" ? "Normal" : "Weak";
      delete migrated[`muscle:${item}:tone`];
    }
    const oldMulti = migrated[`muscle:${item}`];
    if (Array.isArray(oldMulti) && oldMulti.length) {
      const weak = oldMulti.find((entry) => /hypo|weak/i.test(entry));
      const painful = oldMulti.find((entry) => /pain/i.test(entry));
      const side = oldMulti.join(" ").includes("L") && oldMulti.join(" ").includes("R") ? "Both" : oldMulti.join(" ").includes("L") ? "L" : oldMulti.join(" ").includes("R") ? "R" : "";
      migrated[`muscle:${item}:finding`] = painful ? "Painful" : weak ? "Weak" : "Weak";
      if (side) migrated[`muscle:${item}:side`] = side;
      delete migrated[`muscle:${item}`];
    }
  });
  return migrated;
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

function bindSteppers() {
  $$(".stepper").forEach((stepper) => {
    stepper.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-step]");
      if (!button) return;
      const input = stepper.querySelector("input");
      const current = input.value === "" ? 0 : Number(input.value);
      const next = Math.max(0, Math.min(12, current + Number(button.dataset.step)));
      input.value = String(next);
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
  $("#allNeuroNormal").addEventListener("click", () => {
    setAllDtrMotorSensationNormal();
    render();
    scheduleAutosave();
  });
  $("#allCranialNormal").addEventListener("click", () => {
    setAllCranialNormal();
    render();
    scheduleAutosave();
  });
  $("#copyExam").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#summaryText").textContent);
    setStatus("Exam copied.");
  });
  $("#clearExam").addEventListener("click", clearSaved);
}

function setAllDtrMotorSensationNormal() {
  dtrItems.forEach((item) => {
    state.choices[`dtr:${item}:L`] = "2+";
    state.choices[`dtr:${item}:R`] = "2+";
  });
  motorItems.forEach((item) => {
    state.choices[`motor:${item}:L`] = "5/5";
    state.choices[`motor:${item}:R`] = "5/5";
  });
  sensationItems.forEach((item) => {
    state.choices[`sensation:${item}:L`] = "Normal";
    state.choices[`sensation:${item}:R`] = "Normal";
  });
}

function setAllCranialNormal() {
  cranialItems.forEach((item) => {
    state.choices[`cranial:${item}`] = "UR";
  });
}

mountPosture();
mountFunctionalChecks();
mountLevels();
mountMuscles();
mountOrthos();
mountDtrMotorSensation();
mountCranial();
mountCompression();
bindChoiceGroups();
bindFields();
bindSteppers();
bindActions();
setDefaults();
loadRequestedExam();
render();
state.autosaveReady = true;
