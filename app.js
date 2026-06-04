const STORAGE_KEY = "clinic-repeat-soap-drafts-v2";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";
const EXAM_STORAGE_KEY = "clinic-vsc-exam-records-v1";
const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";

const patientDefaults = {
  patientName: "",
  contraindications: "",
  reExamEvery: 12,
  initialLevels: [],
  schedule: "2/wk",
  acuity: "SA",
  improvement: "Same"
};

function defaultSingle() {
  return {
    subjectiveChange: "",
    improvement: patientDefaults.improvement,
    acuity: patientDefaults.acuity,
    treatmentStatus: "TTC",
    schedule: patientDefaults.schedule,
    shoulderLevel: "",
    hipLevel: ""
  };
}

const state = {
  selected: {},
  sided: {},
  severity: {},
  orthosOpen: false,
  profileAlerts: [],
  single: defaultSingle(),
  visitLevels: new Set(),
  levelFindings: {},
  reexamReview: { notes: "", results: {}, completed: false, updatedAt: "" },
  reexamPromptKey: "",
  orthoticsPromptKey: "",
  orthoticsReminderDone: false,
  currentDraftId: null,
  importantNotesCarriedFromSoap: false,
  profileImportantNotesApplied: false,
  profileSubjectiveDefaultsApplied: false,
  autosaveReady: false
};

let autosaveTimer = null;

const sideOptions = [
  { label: "Left", value: "L" },
  { label: "Right", value: "R" },
  { label: "Both", value: "B" }
];
const directionOptions = [{ label: "Up", value: "up" }, { label: "Down", value: "down" }];
const romOptions = [{ label: "Better", value: "better" }, { label: "Worse", value: "worse" }];
const rotationOptions = [{ label: "Clockwise", value: "CW" }, { label: "Counterclockwise", value: "CCW" }];
const toneOptions = [{ label: "Hypertonic", value: "hyper" }, { label: "Hypotonic", value: "hypo" }];
const unlOptions = [{ label: "Shoulders", value: "shoulders" }, { label: "Hips", value: "hips" }];
const frequencyOptions = [
  { label: "Daily", value: "Daily" },
  { label: "Three times a week", value: "3/wk" },
  { label: "Twice a week", value: "2/wk" },
  { label: "Once a week", value: "1/wk" },
  { label: "Twice a month", value: "2/mo" },
  { label: "Once a month", value: "1/mo" },
  { label: "Every three weeks", value: "3 wks" },
  { label: "Every five weeks", value: "5 wks" },
  { label: "Every six weeks", value: "6 wks" },
  { label: "To call", value: "TC" }
];
const muscleSideOptions = sideOptions;
const muscleStrengthOptions = [{ label: "Normal", value: "normal" }, { label: "Weak", value: "weak" }];
const plusMinusOptions = [{ label: "Positive", value: "+" }, { label: "Negative", value: "-" }];
const examRetestOptions = {
  grade: ["1", "2", "3", "4+"],
  ortho: ["L +", "L -", "R +", "R -", "Both +", "Both -"],
  dtr: ["0", "1+", "2+", "3+", "4+"],
  motor: ["0/5", "1/5", "2/5", "3/5", "4/5", "5/5"],
  sensation: ["Normal", "Decreased"],
  cranial: ["UR", "AbN"],
  shoulderMotion: ["L normal", "L decreased", "R normal", "R decreased"]
};
const examMuscleItems = ["Psoas", "Piriformis", "QF", "Glut", "Hamst", "Delt", "Pect", "Lats", "Other", "S. Spin"];
const examOrthoItems = ["Heel to buttock", "Ely's", "Yeomans", "SLR", "Kemp's", "Int shoulder rotation", "Ext shoulder rotation", "Figure 4"];
const examCompressionItems = ["Jacksons", "Spurlings"];
const examDtrItems = ["Triceps", "Biceps", "Radial", "Patellar", "Achilles"];
const examMotorItems = ["C5", "C6", "C7", "C8", "T1", "L3", "L4", "L5", "S1"];
const examSensationItems = ["C5", "C6", "C7", "C8", "T1", "L3", "L4", "L5"];
const examCranialItems = [
  "Visual acuity (II)", "Pupillary reactions (II, III)", "Extraocular movement (III, IV, VI)",
  "Corneal reflex / jaw movement (V)", "Facial sensation (V1, V2, V3)", "Facial movement (VII)",
  "Hearing (VIII)", "Swallowing / rising palate (IX, X)", "Voice / speech (X, V, VII, XII)",
  "Tongue inspection (XII)", "Babinsky"
];

const subjectiveItems = [
  ["Same", "subjectiveChange", "Same"], ["Better", "subjectiveChange", "Better"], ["Worse", "subjectiveChange", "Worse"],
  ["CK"], ["C", "side"], ["T", "side"], ["LB", "side"], ["S", "side"], ["SI", "side"], ["SH", "side"], ["SB", "side"],
  ["EL", "side"], ["WR", "side"], ["FIN", "side"], ["HIP", "side"], ["KN", "side"], ["FT", "side"], ["Toe", "side"],
  ["TMJ", "side"], ["H", "side"], ["PMS"], ["GI"], ["SIC"], ["AL"], ["SIN"], ["DY"], ["TRAM"], ["STRES"], ["W"]
];
const soapSubjectiveLabels = new Set(subjectiveItems.map(([label]) => label));
const objectiveItems = [
  ["ROM", "rom"], ["C"], ["T"], ["L"], ["K27", "rotation"], ["MM", "tone"], ["Fig 4", "sidePlusMinus"],
  ["UNL", "unlevel"], ["Trap", "tone"], ["Better", "improvement", "Better"], ["Same", "improvement", "Same"],
  ["Worse", "improvement", "Worse"], ["Off schedule"]
];
const cervical = ["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7"];
const thoracic = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
const lumbar = ["L1", "L2", "L3", "L4", "L5"];
const topEligibleLevels = new Set([...cervical, ...thoracic, ...lumbar]);
const assessmentItems = [
  ...cervical.map((item) => [item, "level"]),
  ...thoracic.map((item) => [item, "level"]),
  ...lumbar.map((item) => [item, "level"]),
  ["SI-L", "level"], ["SI-R", "level"], ["Soft tissue only"], ["Well"], ["Tight"]
];
const planItems = [
  ["Physio app"], ["PT"], ["NK"], ["DT"], ["Lfsty"], ["Nutr"],
  ["A", "acuity", "A"], ["SA", "acuity", "SA"], ["Chr", "acuity", "Chr"],
  ["TTC", "treatmentStatus", "TTC"], ["Freq", "schedulePicker"]
];
const objectiveDetailItems = [
  ["Ft flare", "side"], ["Psoas", "muscleStrength"], ["Pirif", "muscleStrength"], ["Glut", "muscleStrength"],
  ["Quad", "muscleStrength"], ["Delt", "muscleStrength"], ["Ham", "muscleStrength"], ["Lat", "muscleStrength"],
  ["Torque R"], ["Torque L"], ["Low left shoulder", "shoulderLevel", "low-left"], ["Even shoulders", "shoulderLevel", "even"],
  ["Low right shoulder", "shoulderLevel", "low-right"], ["High left hip", "hipLevel", "high-left"],
  ["Even hips", "hipLevel", "even"], ["High right hip", "hipLevel", "high-right"]
];
const orthoItems = [
  ["Heel to buttock", "orthoSided"], ["Ely's", "orthoSided"], ["Yeomans", "orthoSided"], ["SLR", "orthoSided"],
  ["Kemp's", "orthoSided"], ["Valsalvas", "orthoResult"], ["Int shoulder rotation", "orthoSided"],
  ["Ext shoulder rotation", "orthoSided"], ["Figure 4", "orthoSided"], ["Jacksons", "orthoSided"],
  ["Spurlings", "orthoSided"]
];
const profileAlertLabels = new Set(["NO NECK", "NOT NECK", "NOT NECK - MOB ONLY", "SOFT TISSUE ONLY", "VERY GENTLE"]);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function todayParts() {
  const now = new Date();
  return {
    monthYear: now.toLocaleDateString(undefined, { month: "2-digit", year: "numeric" }),
    day: now.toLocaleDateString(undefined, { day: "2-digit" })
  };
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

function makeKey(line, label) {
  return `${line}:${label}`;
}

function mountLine(targetId, line, items) {
  const target = $(`#${targetId}`);
  target.innerHTML = "";
  items.forEach(([label, mode, value]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mark";
    button.dataset.line = line;
    button.dataset.label = label;
    button.dataset.mode = mode || "toggle";
    if (value) button.dataset.value = value;
    if (mode === "shoulderLevel" || mode === "hipLevel") {
      button.classList.add("shoulder-level-button");
      button.title = label;
    }
    if (line === "P" && label === "A") button.classList.add("plan-right-start");
    button.addEventListener("click", () => handleMark(button));
    target.appendChild(button);
  });
}

function handleMark(button) {
  const { line, label, mode, value } = button.dataset;
  const key = makeKey(line, label);
  if (mode === "fixed") return;
  if (mode === "side") {
    if (line === "S" && state.sided[key]) {
      if (!state.severity[key]) state.severity[key] = "yellow";
      else if (state.severity[key] === "yellow") state.severity[key] = "red";
      else {
        delete state.sided[key];
        delete state.severity[key];
      }
      renderAll();
      return;
    }
    return choose(key, label, sideOptions);
  }
  if (mode === "direction") return choose(key, label, directionOptions);
  if (mode === "rom") return choose(key, label, romOptions);
  if (mode === "rotation") return choose(key, label, rotationOptions);
  if (mode === "tone") return choose(key, label, toneOptions);
  if (mode === "unlevel") return choose(key, label, unlOptions);
  if (mode === "muscleStrength") return chooseMuscleStrength(key, label);
  if (mode === "schedulePicker") return chooseFrequency();
  if (mode === "orthoSided") return chooseOrthoTest(key, label, true);
  if (mode === "orthoResult") return chooseOrthoTest(key, label, false);
  if (mode === "sidePlusMinus") return chooseFig4(key, label);
  if (mode === "treatmentStatus") {
    state.single.treatmentStatus = state.single.treatmentStatus === "DC" ? "TTC" : "DC";
    renderAll();
    return;
  }
  if (mode === "subjectiveChange" || mode === "improvement" || mode === "acuity" || mode === "schedule") {
    state.single[mode] = state.single[mode] === value ? "" : value;
    renderAll();
    return;
  }
  if (mode === "shoulderLevel") {
    state.single.shoulderLevel = state.single.shoulderLevel === value ? "" : value;
    renderAll();
    return;
  }
  if (mode === "hipLevel") {
    state.single.hipLevel = state.single.hipLevel === value ? "" : value;
    renderAll();
    return;
  }
  if (mode === "level") {
    if (topEligibleLevels.has(label)) {
      if (!state.visitLevels.has(label)) state.visitLevels.add(label);
      else if (state.levelFindings[label] !== "TOP") state.levelFindings[label] = "TOP";
      else {
        state.visitLevels.delete(label);
        delete state.levelFindings[label];
      }
    } else if (state.visitLevels.has(label)) {
      state.visitLevels.delete(label);
      delete state.levelFindings[label];
    } else {
      state.visitLevels.add(label);
    }
    renderAll();
    return;
  }
  if (line === "S" && mode === "toggle" && label !== "CK") {
    if (!state.selected[key]) state.selected[key] = true;
    else if (!state.severity[key]) state.severity[key] = "yellow";
    else if (state.severity[key] === "yellow") state.severity[key] = "red";
    else {
      delete state.selected[key];
      delete state.severity[key];
    }
    renderAll();
    return;
  }
  state.selected[key] = !state.selected[key];
  if (!state.selected[key]) delete state.severity[key];
  renderAll();
}

function addClearChoice(buttons, dialog, clearFn) {
  const clear = document.createElement("button");
  clear.type = "button";
  clear.textContent = "Clear";
  clear.className = "wide";
  clear.addEventListener("click", () => {
    clearFn();
    dialog.close();
    renderAll();
  });
  buttons.appendChild(clear);
}

function choose(key, label, options) {
  const dialog = $("#choiceDialog");
  $("#choiceTitle").textContent = label;
  const buttons = $("#choiceButtons");
  buttons.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.label;
    button.addEventListener("click", () => {
      state.sided[key] = option.value;
      delete state.severity[key];
      dialog.close();
      renderAll();
    });
    buttons.appendChild(button);
  });
  addClearChoice(buttons, dialog, () => {
    delete state.sided[key];
    delete state.severity[key];
    delete state.selected[key];
  });
  dialog.showModal();
}

function chooseMuscleStrength(key, label) {
  const dialog = $("#choiceDialog");
  $("#choiceTitle").textContent = label;
  const buttons = $("#choiceButtons");
  buttons.innerHTML = "";
  buttons.classList.add("muscle-picker");
  let selectedSide = "";
  const sideRow = document.createElement("div");
  sideRow.className = "choice-row";
  const strengthRow = document.createElement("div");
  strengthRow.className = "choice-row";
  function refreshStrengthButtons() {
    strengthRow.querySelectorAll("button").forEach((button) => {
      button.disabled = !selectedSide;
    });
    sideRow.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-choice-active", button.dataset.value === selectedSide);
    });
  }
  muscleSideOptions.forEach((side) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = side.label;
    button.dataset.value = side.value;
    button.addEventListener("click", () => {
      selectedSide = side.value;
      refreshStrengthButtons();
    });
    sideRow.appendChild(button);
  });
  muscleStrengthOptions.forEach((strength) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = strength.label;
    button.disabled = true;
    button.addEventListener("click", () => {
      if (!selectedSide) return;
      state.sided[key] = `${selectedSide} ${strength.value}`;
      delete state.severity[key];
      dialog.close();
      buttons.classList.remove("muscle-picker");
      renderAll();
    });
    strengthRow.appendChild(button);
  });
  buttons.appendChild(sideRow);
  buttons.appendChild(strengthRow);
  addClearChoice(buttons, dialog, () => {
    delete state.sided[key];
    delete state.severity[key];
    delete state.selected[key];
  });
  dialog.addEventListener("close", () => buttons.classList.remove("muscle-picker"), { once: true });
  dialog.showModal();
}

function chooseFrequency() {
  const dialog = $("#choiceDialog");
  $("#choiceTitle").textContent = "Frequency";
  const buttons = $("#choiceButtons");
  buttons.innerHTML = "";
  buttons.classList.add("frequency-picker");
  frequencyOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = option.label;
    button.classList.toggle("is-choice-active", state.single.schedule === option.value);
    button.addEventListener("click", () => {
      state.single.schedule = option.value;
      dialog.close();
      buttons.classList.remove("frequency-picker");
      renderAll();
    });
    buttons.appendChild(button);
  });
  addClearChoice(buttons, dialog, () => {
    state.single.schedule = "";
  });
  dialog.addEventListener("close", () => buttons.classList.remove("frequency-picker"), { once: true });
  dialog.showModal();
}

function chooseOrthoTest(key, label, needsSide) {
  const dialog = $("#choiceDialog");
  $("#choiceTitle").textContent = label;
  const buttons = $("#choiceButtons");
  buttons.innerHTML = "";
  buttons.classList.add("ortho-picker");
  let selectedSide = needsSide ? "" : "none";
  if (needsSide) {
    const sideRow = document.createElement("div");
    sideRow.className = "choice-row";
    sideOptions.forEach((side) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = side.label;
      button.dataset.value = side.value;
      button.addEventListener("click", () => {
        selectedSide = side.value;
        sideRow.querySelectorAll("button").forEach((item) => item.classList.toggle("is-choice-active", item.dataset.value === selectedSide));
        buttons.querySelectorAll(".choice-row + .choice-row button").forEach((item) => {
          item.disabled = false;
        });
      });
      sideRow.appendChild(button);
    });
    buttons.appendChild(sideRow);
  }
  const resultRow = document.createElement("div");
  resultRow.className = "choice-row";
  plusMinusOptions.forEach((result) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = result.label;
    button.disabled = needsSide && !selectedSide;
    button.addEventListener("click", () => {
      if (needsSide && !selectedSide) return;
      state.sided[key] = needsSide ? `${selectedSide} ${result.value}` : result.value;
      dialog.close();
      buttons.classList.remove("ortho-picker");
      renderAll();
    });
    resultRow.appendChild(button);
  });
  buttons.appendChild(resultRow);
  addClearChoice(buttons, dialog, () => {
    delete state.sided[key];
  });
  dialog.addEventListener("close", () => buttons.classList.remove("ortho-picker"), { once: true });
  dialog.showModal();
}

function chooseFig4(key, label) {
  const dialog = $("#choiceDialog");
  $("#choiceTitle").textContent = label;
  const buttons = $("#choiceButtons");
  buttons.innerHTML = "";
  sideOptions.forEach((side) => {
    plusMinusOptions.forEach((sign) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${side.value} ${sign.value}`;
      button.addEventListener("click", () => {
        state.sided[key] = `${side.value}${sign.value}`;
        dialog.close();
        renderAll();
      });
      buttons.appendChild(button);
    });
  });
  addClearChoice(buttons, dialog, () => {
    delete state.sided[key];
  });
  dialog.showModal();
}

function displayValue(value) {
  if (value === "up") return "↑";
  if (value === "down") return "↓";
  if (value === "better") return "Better";
  if (value === "worse") return "Worse";
  if (value === "hyper") return "Hyper";
  if (value === "hypo") return "Hypo";
  if (value === "shoulders") return "Shoulders";
  if (value === "hips") return "Hips";
  if (value === "normal") return "Normal";
  if (value === "weak") return "Weak";
  return value;
}

function shoulderLevelText(value) {
  if (value === "low-left") return "Shoulders low left";
  if (value === "even") return "Shoulders even";
  if (value === "low-right") return "Shoulders low right";
  return "";
}

function hipLevelText(value) {
  if (value === "high-left") return "Hips high left";
  if (value === "even") return "Hips even";
  if (value === "high-right") return "Hips high right";
  return "";
}

function shoulderLevelMarkup(value) {
  const className = value === "low-left" ? "low-left" : value === "low-right" ? "low-right" : "even";
  return `<span class="shoulder-symbol ${className}" aria-hidden="true"><span class="shoulder-bar"></span><span class="shoulder-stem"></span></span>`;
}

function hipLevelMarkup(value) {
  const className = value === "high-left" ? "high-left" : value === "high-right" ? "high-right" : "even";
  return `<span class="shoulder-symbol hip-symbol ${className}" aria-hidden="true"><span class="shoulder-bar"></span><span class="shoulder-stem"></span></span>`;
}

function examShoulderLevelMarkup(value) {
  const className = value === "L" ? "high-left" : value === "R" ? "high-right" : "even";
  return `<span class="shoulder-symbol ${className}" aria-hidden="true"><span class="shoulder-bar"></span><span class="shoulder-stem"></span></span>`;
}

function examHipLevelMarkup(value) {
  const className = value === "L" ? "high-left" : value === "R" ? "high-right" : "even";
  return `<span class="shoulder-symbol hip-symbol ${className}" aria-hidden="true"><span class="shoulder-bar"></span><span class="shoulder-stem"></span></span>`;
}

function renderButton(button) {
  const { line, label, mode, value } = button.dataset;
  const key = makeKey(line, label);
  const isAutoLevel = mode === "level" && patientDefaults.initialLevels.includes(label);
  const isVisitLevel = mode === "level" && state.visitLevels.has(label);
  const levelFinding = mode === "level" ? state.levelFindings[label] : "";
  const severity = line === "S" && (mode === "side" || (mode === "toggle" && label !== "CK")) ? state.severity[key] : "";
  const isSided = Boolean(state.sided[key]);
  const isToggle = Boolean(state.selected[key]);
  const isSingle = (mode === "subjectiveChange" || mode === "improvement" || mode === "acuity" || mode === "schedule") && state.single[mode] === value;
  const isTreatmentStatus = mode === "treatmentStatus";
  const isSchedulePicker = mode === "schedulePicker";
  const isShoulderLevel = mode === "shoulderLevel" && state.single.shoulderLevel === value;
  const isHipLevel = mode === "hipLevel" && state.single.hipLevel === value;
  const isDc = isTreatmentStatus && state.single.treatmentStatus === "DC";
  const isFixed = mode === "fixed" || isAutoLevel;
  const active = isAutoLevel || isVisitLevel || isSided || isToggle || isSingle || isShoulderLevel || isHipLevel || isFixed || isTreatmentStatus || isSchedulePicker;
  button.classList.toggle("is-selected", active && !isVisitLevel && !isSingle && !severity);
  button.classList.toggle("is-visit", isVisitLevel);
  button.classList.toggle("is-single", isSingle);
  button.classList.toggle("is-fixed", isFixed);
  button.classList.toggle("is-dc", isDc);
  button.classList.toggle("is-severity-yellow", severity === "yellow");
  button.classList.toggle("is-severity-red", severity === "red");
  button.setAttribute("aria-pressed", String(active));
  const badge = severity ? (state.sided[key] || "") : state.sided[key] || levelFinding;
  const displayLabel = isTreatmentStatus ? (state.single.treatmentStatus === "DC" ? "DC" : "TTC") : label;
  const displayBadge = isSchedulePicker ? state.single.schedule : badge;
  if (mode === "shoulderLevel") {
    button.setAttribute("aria-label", label);
    button.innerHTML = shoulderLevelMarkup(value);
    return;
  }
  if (mode === "hipLevel") {
    button.setAttribute("aria-label", label);
    button.innerHTML = hipLevelMarkup(value);
    return;
  }
  button.innerHTML = `${displayLabel}${displayBadge ? `<span class="badge">${displayValue(displayBadge)}</span>` : ""}`;
}

function renderAll() {
  applyPatientProfile();
  $$(".mark[data-line]").forEach(renderButton);
  updateDateParts();
  updateReexamFlag();
  renderReexamReview();
  renderManualVisitWarning();
  updatePatientNavLinks();
  renderPatientAlerts();
  renderOrthoticsReminder();
  renderDcNote();
  renderOrthos();
  renderPriorReference();
  $("#summaryText").textContent = buildSummary();
  scheduleAutosave();
}

function updateDateParts() {
  if ($("#monthYear").value && $("#visitDay").value) return;
  const parts = todayParts();
  $("#monthYear").value = parts.monthYear;
  $("#visitDay").value = parts.day;
}

function updateReexamFlag() {
  const visit = currentVisitNumber();
  const reexamAt = currentReexamAt();
  $("#reExamAt").min = visit ? String(visit) : "2";
  const isReexam = currentVisitIsReexam();
  $("#visitRow").classList.toggle("is-reexam", isReexam);
  $("#reexamFlag").textContent = isReexam ? `RE-EXAM VISIT #${visit}` : "Re-exam visit";
  $("#nextReexamFlag").textContent = isReexam ? `Next re-exam: visit ${visit + 12}` : "";
}

function currentVisitNumber() {
  return Number($("#visitNumber").value || 0);
}

function currentReexamAt() {
  return Number($("#reExamAt").value || 0);
}

function currentVisitIsReexam() {
  const visit = currentVisitNumber();
  const reexamAt = currentReexamAt();
  return visit > 0 && visit === reexamAt;
}

function manualVisitNumberRequired() {
  if (!currentPatientProfile()?.needsManualVisitNumber) return false;
  return !String($("#visitNumber").value || "").trim() || !String($("#reExamAt").value || "").trim();
}

function renderManualVisitWarning() {
  const warning = $("#manualVisitWarning");
  if (!warning) return;
  warning.hidden = !manualVisitNumberRequired();
}

function patientNavUrl(page) {
  const patient = $("#patientName").value.trim();
  return patient ? `${page}?patient=${encodeURIComponent(patient)}` : page;
}

function updatePatientNavLinks() {
  const links = [
    ["navInitial", "initial.html"],
    ["navConsent", "consent.html"],
    ["navExam", "exam.html"],
    ["navReports", "reports.html"]
  ];
  links.forEach(([id, page]) => {
    const link = document.getElementById(id);
    if (link) link.href = patientNavUrl(page);
  });
}

function selectedMarks(line) {
  const parts = [];
  Object.entries(state.selected).forEach(([key, selected]) => {
    if (selected && key.startsWith(`${line}:`)) {
      const severity = state.severity[key];
      const severityText = severity === "yellow" ? "moderate" : severity === "red" ? "severe" : "";
      parts.push(`${key.split(":")[1]}${severityText ? ` ${severityText}` : ""}`);
    }
  });
  Object.entries(state.sided).forEach(([key, value]) => {
    if (key.startsWith(`${line}:`)) {
      const severity = state.severity[key];
      const severityText = severity === "yellow" ? "moderate" : severity === "red" ? "severe" : "";
      parts.push(`${key.split(":")[1]} ${displayValue(value)}${severityText ? ` ${severityText}` : ""}`);
    }
  });
  return parts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function reexamOriginalFindings() {
  return reexamOriginalItems().map((item) => `${item.section}\n${item.label}: ${item.original}`).join("\n\n");
}

function reexamOriginalItems() {
  const profile = currentPatientProfile() || {};
  if (Array.isArray(profile.examRetestItems) && profile.examRetestItems.length) return profile.examRetestItems;
  const examItems = reexamItemsFromExamRecord(currentPatientExamRecord());
  if (examItems.length) return examItems;
  return [
    ["Posture", profile.examPostureFindings],
    ["Myopathology", profile.examMuscleFindings],
    ["Orthopaedic tests", profile.examOrthoFindings],
    ["Neurological / DTR / motor / sensation", profile.examNeuroFindings]
  ].flatMap(([section, value]) => {
    const text = String(value || "").trim();
    if (!text) return [];
    return text.split(";").map((line, index) => {
      const clean = line.trim();
      return clean ? {
        id: `${section}-${index}`,
        section,
        label: clean.split(":")[0] || section,
        original: clean.includes(":") ? clean.split(":").slice(1).join(":").trim() : clean,
        groups: [{ key: "result", label: "Result", options: ["Resolved", "Improved", "Same", "Worse"] }]
      } : null;
    }).filter(Boolean);
  });
}

function savedExamRecords() {
  try {
    return JSON.parse(localStorage.getItem(EXAM_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function currentPatientExamRecord() {
  const patient = currentPatientName();
  if (!patient) return null;
  return savedExamRecords().find((record) => String(record?.fields?.patientName || "").trim().toLowerCase() === patient) || null;
}

function postureLevelOriginal(kind, value) {
  if (kind === "hip") {
    if (value === "L") return "High left hip";
    if (value === "N") return "Even hips";
    if (value === "R") return "High right hip";
    return "";
  }
  if (value === "L") return "High left shoulder";
  if (value === "N") return "Even shoulders";
  if (value === "R") return "High right shoulder";
  return "";
}

function reexamItemsFromExamRecord(record) {
  const choices = record?.choices || {};
  const items = [];
  const add = (item) => items.push({ id: item.id, section: item.section, label: item.label, original: item.original, groups: item.groups });
  if (choices.fhpGrade) add({ id: "fhpGrade", section: "Posture", label: "FHP grade", original: `Grade ${choices.fhpGrade}`, groups: [{ key: "grade", label: "Grade", options: examRetestOptions.grade }] });
  if (choices.swaybackGrade) add({ id: "swaybackGrade", section: "Posture", label: "Swayback grade", original: `Grade ${choices.swaybackGrade}`, groups: [{ key: "grade", label: "Grade", options: examRetestOptions.grade }] });
  if (choices["posture:Shoulder high"]) add({ id: "posture:Shoulder high", section: "Posture", label: "Shoulder level", original: postureLevelOriginal("shoulder", choices["posture:Shoulder high"]), groups: [{ key: "level", label: "Level", options: ["L", "N", "R"], display: "shoulderLevel" }] });
  if (choices["posture:Hip high"]) add({ id: "posture:Hip high", section: "Posture", label: "Hip level", original: postureLevelOriginal("hip", choices["posture:Hip high"]), groups: [{ key: "level", label: "Level", options: ["L", "N", "R"], display: "hipLevel" }] });

  examMuscleItems.forEach((item) => {
    const finding = choices[`muscle:${item}:finding`];
    if (!finding || finding === "Normal") return;
    const side = choices[`muscle:${item}:side`];
    add({
      id: `muscle:${item}`,
      section: "Myopathology",
      label: item,
      original: `${finding}${side ? ` ${side}` : ""}`,
      groups: [
        { key: "finding", label: "Finding", options: ["Normal", "Weak", "Painful"] },
        { key: "side", label: "Side", options: ["L", "R", "Both"] }
      ]
    });
  });
  examOrthoItems.forEach((item) => {
    const values = Array.isArray(choices[`ortho:${item}`]) ? choices[`ortho:${item}`] : [];
    if (values.length) add({ id: `ortho:${item}`, section: "Orthopaedic tests", label: item, original: values.join(", "), groups: [{ key: "result", label: "Result", options: examRetestOptions.ortho, multi: true }] });
  });
  if (choices["ortho:Valsalvas"]) add({ id: "ortho:Valsalvas", section: "Orthopaedic tests", label: "Valsalvas", original: choices["ortho:Valsalvas"], groups: [{ key: "result", label: "Result", options: ["+", "-"] }] });
  ["C/S rotation", "C/S lateral flexion"].forEach((item) => {
    const values = Array.isArray(choices[`motion:${item}`]) ? choices[`motion:${item}`].filter((entry) => entry.includes("decreased")) : [];
    if (values.length) add({ id: `motion:${item}`, section: "Orthopaedic tests", label: item, original: values.join(", "), groups: [{ key: "motion", label: "Motion", options: examRetestOptions.shoulderMotion, multi: true }] });
  });
  examCompressionItems.forEach((item) => {
    const values = Array.isArray(choices[`compression:${item}`]) ? choices[`compression:${item}`].filter((entry) => entry.includes("+") || entry.includes("AbN")) : [];
    if (values.length) add({ id: `compression:${item}`, section: "Compression tests", label: item, original: values.join(", "), groups: [{ key: "result", label: "Result", options: examRetestOptions.ortho, multi: true }] });
  });
  examDtrItems.forEach((item) => ["L", "R"].forEach((side) => {
    const value = choices[`dtr:${item}:${side}`];
    if (value && value !== "2+") add({ id: `dtr:${item}:${side}`, section: "DTR / Motor / Sensation", label: `${item} DTR ${side}`, original: value, groups: [{ key: "grade", label: "Grade", options: examRetestOptions.dtr }] });
  }));
  examMotorItems.forEach((item) => ["L", "R"].forEach((side) => {
    const value = choices[`motor:${item}:${side}`];
    if (value && value !== "5/5") add({ id: `motor:${item}:${side}`, section: "DTR / Motor / Sensation", label: `${item} motor ${side}`, original: value, groups: [{ key: "grade", label: "Grade", options: examRetestOptions.motor }] });
  }));
  examSensationItems.forEach((item) => ["L", "R"].forEach((side) => {
    const value = choices[`sensation:${item}:${side}`];
    if (value === "Decreased") add({ id: `sensation:${item}:${side}`, section: "DTR / Motor / Sensation", label: `${item} sensation ${side}`, original: "Decreased", groups: [{ key: "sensation", label: "Sensation", options: examRetestOptions.sensation }] });
  }));
  examCranialItems.forEach((item) => {
    if (choices[`cranial:${item}`] === "AbN") add({ id: `cranial:${item}`, section: "Neurological Assessment", label: item, original: "AbN", groups: [{ key: "result", label: "Result", options: examRetestOptions.cranial }] });
  });
  return items;
}

function reexamReviewRequired() {
  return currentVisitIsReexam() && Boolean(reexamOriginalFindings());
}

function reexamReviewPromptKey() {
  return [currentPatientName(), $("#visitNumber").value, $("#reExamAt").value].join("|");
}

function renderReexamReview() {
  const dialog = $("#reexamDialog");
  if (!dialog) return;
  renderReexamFindingCards();
  if ($("#reexamReviewNote") !== document.activeElement) $("#reexamReviewNote").value = state.reexamReview.notes || "";
  const shouldPrompt = reexamReviewRequired() && !state.reexamReview.completed;
  if (!shouldPrompt) return;
  const key = reexamReviewPromptKey();
  if (state.reexamPromptKey === key || dialog.open) return;
  state.reexamPromptKey = key;
  window.setTimeout(() => {
    if (!dialog.open && reexamReviewRequired() && !state.reexamReview.completed) dialog.showModal();
  }, 0);
}

function saveReexamReview(closeDialog = true) {
  const note = $("#reexamReviewNote").value.trim();
  state.reexamReview = {
    notes: note,
    results: state.reexamReview.results || {},
    completed: true,
    updatedAt: new Date().toISOString()
  };
  if (closeDialog) $("#reexamDialog").close();
  renderAll();
  setStatus("Re-exam re-test saved.");
  return true;
}

function reexamResultFor(itemId, groupKey) {
  return state.reexamReview.results?.[itemId]?.[groupKey];
}

function setReexamResult(itemId, group, value) {
  const results = { ...(state.reexamReview.results || {}) };
  const itemResults = { ...(results[itemId] || {}) };
  if (group.multi) {
    const values = new Set(Array.isArray(itemResults[group.key]) ? itemResults[group.key] : []);
    if (values.has(value)) values.delete(value);
    else values.add(value);
    if (values.size) itemResults[group.key] = Array.from(values);
    else delete itemResults[group.key];
  } else {
    itemResults[group.key] = itemResults[group.key] === value ? "" : value;
    if (!itemResults[group.key]) delete itemResults[group.key];
  }
  if (Object.keys(itemResults).length) results[itemId] = itemResults;
  else delete results[itemId];
  state.reexamReview = {
    ...state.reexamReview,
    results,
    completed: false
  };
  renderAll();
}

function renderReexamFindingCards() {
  const target = $("#reexamOriginalFindings");
  const items = reexamOriginalItems();
  target.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "reexam-test-card";
    empty.textContent = "No positive exam findings documented from the Exam page.";
    target.appendChild(empty);
    return;
  }
  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "reexam-test-card";
    const head = document.createElement("header");
    const title = document.createElement("strong");
    title.textContent = item.label;
    const original = document.createElement("span");
    original.textContent = `${item.section}: original ${item.original}`;
    head.append(title, original);
    card.appendChild(head);
    (item.groups || []).forEach((group) => {
      const row = document.createElement("div");
      row.className = "reexam-choice-row";
      const label = document.createElement("em");
      label.textContent = group.label || group.key;
      row.appendChild(label);
      (group.options || []).forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.itemId = item.id;
        button.dataset.groupKey = group.key;
        button.dataset.value = option;
        button.textContent = option;
        if (group.display === "shoulderLevel") button.innerHTML = examShoulderLevelMarkup(option);
        if (group.display === "hipLevel") button.innerHTML = examHipLevelMarkup(option);
        const current = reexamResultFor(item.id, group.key);
        const active = Array.isArray(current) ? current.includes(option) : current === option;
        button.classList.toggle("is-selected", active);
        button.addEventListener("click", () => setReexamResult(item.id, group, option));
        row.appendChild(button);
      });
      card.appendChild(row);
    });
    target.appendChild(card);
  });
}

function reexamReviewResultText() {
  const results = state.reexamReview.results || {};
  return reexamOriginalItems().map((item) => {
    const itemResults = results[item.id] || {};
    const parts = (item.groups || []).map((group) => {
      const value = itemResults[group.key];
      const text = Array.isArray(value) ? value.join(", ") : value;
      return text ? `${group.label || group.key}: ${text}` : "";
    }).filter(Boolean);
    return parts.length ? `${item.label}: ${parts.join("; ")}` : "";
  }).filter(Boolean).join("\n");
}

function renderOrthos() {
  $("#orthosToggle").setAttribute("aria-expanded", String(state.orthosOpen));
  $("#orthosPanel").hidden = !state.orthosOpen;
}

function renderDcNote() {
  const isDc = state.single.treatmentStatus === "DC";
  $("#dcNoteWrap").hidden = !isDc;
  $("#dcNote").required = isDc;
}

function selectedLevelText() {
  const auto = patientDefaults.initialLevels.map((item) => `${item}*`);
  const visit = Array.from(state.visitLevels).map((item) => state.levelFindings[item] === "TOP" ? `${item} TOP^` : `${item}^`);
  return [...auto, ...visit].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(", ");
}

function currentPatientName() {
  return $("#patientName").value.trim().toLowerCase();
}

function samePatientOrBlank(draft) {
  const current = currentPatientName();
  if (!current) return true;
  return String(draft.patientName || "").trim().toLowerCase() === current;
}

function sameSelectedPatient(draft) {
  const current = currentPatientName();
  if (!current) return false;
  return String(draft.patientName || "").trim().toLowerCase() === current;
}

function previousDraftForCurrentVisit() {
  const visit = Number($("#visitNumber").value || 0);
  if (!visit || visit <= 2) return null;
  return savedDrafts()
    .filter((draft) => samePatientOrBlank(draft) && Number(draft.visitNumber) === visit - 1)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function torqueSideFromProfile(profile) {
  if (profile?.examTorque === "R" || profile?.examTorque === "L") return profile.examTorque;
  const subluxations = Array.isArray(profile?.subluxations) ? profile.subluxations : [];
  if (subluxations.includes("Torque R")) return "R";
  if (subluxations.includes("Torque L")) return "L";
  return "";
}

function draftHasTorque(draft, side) {
  const label = `Torque ${side}`;
  return Boolean(draft?.selected?.[makeKey("OD", label)] || String(draft?.oDetailText || "").split(",").map((item) => item.trim()).includes(label));
}

function torqueTally() {
  const profile = currentPatientProfile();
  const currentVisit = Number($("#visitNumber").value || 0);
  const counts = { R: 0, L: 0 };
  const profileTorque = torqueSideFromProfile(profile);
  if (profileTorque) counts[profileTorque] += 1;
  savedDrafts()
    .filter((draft) => samePatientOrBlank(draft))
    .filter((draft) => {
      const visit = Number(draft.visitNumber || 0);
      return !currentVisit || !visit || visit < currentVisit;
    })
    .forEach((draft) => {
      if (draftHasTorque(draft, "R")) counts.R += 1;
      if (draftHasTorque(draft, "L")) counts.L += 1;
    });
  return counts;
}

function torqueTallyText() {
  const counts = torqueTally();
  if (!counts.R && !counts.L) return "";
  return `torque R ${counts.R}x L ${counts.L}x`;
}

function latestCarryForwardDraft() {
  return savedDrafts()
    .filter(sameSelectedPatient)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function latestFrequencyDraft() {
  return savedDrafts()
    .filter((draft) => sameSelectedPatient(draft) && draft.single && draft.single.schedule)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function latestReexamDraft() {
  return savedDrafts()
    .filter((draft) => sameSelectedPatient(draft) && draft.nextReExamAt)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function priorLine(label, value) {
  return value ? `${label}: ${value}` : "";
}

function renderPriorReference() {
  const prior = previousDraftForCurrentVisit();
  const target = $("#priorReference");
  const torqueLine = torqueTallyText();
  if (!prior) {
    target.textContent = torqueLine || "No previous visit saved.";
    return;
  }
  target.textContent = [
    `Visit #${prior.visitNumber || ""}`,
    torqueLine,
    priorLine("S", prior.sText),
    priorLine("O", prior.oText),
    priorLine("O detail", prior.oDetailText),
    priorLine("Orthos", prior.orthosText),
    priorLine("A", prior.aText),
    prior.freeNote ? `Free note: ${prior.freeNote}` : ""
  ].filter(Boolean).join("\n");
}

function buildParts() {
  const s = selectedMarks("S");
  if (state.single.subjectiveChange) s.push(state.single.subjectiveChange);
  const o = selectedMarks("O");
  const oDetail = selectedMarks("OD");
  const shoulderLevel = shoulderLevelText(state.single.shoulderLevel);
  if (shoulderLevel) oDetail.push(shoulderLevel);
  const hipLevel = hipLevelText(state.single.hipLevel);
  if (hipLevel) oDetail.push(hipLevel);
  const orthos = selectedMarks("ORTHO");
  if (state.single.improvement) o.push(state.single.improvement);
  const a = selectedMarks("A");
  const levels = selectedLevelText();
  if (levels) a.unshift(`Levels ${levels}`);
  const p = selectedMarks("P");
  if (state.single.acuity) p.push(state.single.acuity);
  p.push(state.single.treatmentStatus === "DC" ? "DC" : "TTC");
  if (state.single.schedule) p.push(`Schedule ${state.single.schedule}`);
  return {
    sText: s.join(", "),
    oText: o.join(", "),
    oDetailText: oDetail.join(", "),
    orthosText: orthos.join(", "),
    aText: a.join(", "),
    pText: p.join(", ")
  };
}

function filled(value, fallback = "Not documented") {
  const text = String(value || "").trim();
  return text || fallback;
}

function optionalLine(label, value) {
  const text = String(value || "").trim();
  return text ? `${label}: ${text}` : "";
}

function displayVisitDate() {
  const monthYear = $("#monthYear").value;
  const day = $("#visitDay").value;
  const [month, year] = monthYear.split("/");
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return filled([monthYear, day].filter(Boolean).join(" day "));
  return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

function visitIsoDate() {
  const [month, year] = $("#monthYear").value.split("/");
  const day = $("#visitDay").value;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(parsed.getTime())) return "";
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addYearsToIso(dateValue, years) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  date.setFullYear(date.getFullYear() + years);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function orthoticsDueDate(profile) {
  return profile?.orthoticsRecheckDate || addYearsToIso(profile?.orthoticsLastDate, 2);
}

function renderOrthoticsReminder() {
  const dialog = $("#orthoticsDialog");
  if (!dialog || dialog.open || state.orthoticsReminderDone) return;
  const profile = currentPatientProfile();
  const dueDate = orthoticsDueDate(profile);
  if (!dueDate) return;
  const visitDate = visitIsoDate() || new Date().toISOString().slice(0, 10);
  if (visitDate < dueDate) return;
  const key = `${currentPatientName()}|${$("#visitNumber").value}|${dueDate}`;
  if (state.orthoticsPromptKey === key) return;
  state.orthoticsPromptKey = key;
  $("#orthoticsMessage").textContent = `Orthotics re-check is due. Due date: ${dueDate}.`;
  dialog.showModal();
}

function priorReferenceText() {
  return $("#priorReference").textContent.trim() || "No previous visit saved.";
}

function buildSummary() {
  const patient = $("#patientName").value.trim();
  const patientAge = $("#patientAge").value.trim();
  const patientId = currentPatientProfile()?.patientId || "";
  const doctor = $("#doctor").value;
  const visitNumber = $("#visitNumber").value;
  const reexamAt = $("#reExamAt").value;
  const freeNote = $("#freeNote").value.trim();
  const dcNote = $("#dcNote").value.trim();
  const importantNotes = $("#importantNotes").value.trim();
  const contraindications = $("#contraindications").value.trim();
  const parts = buildParts();
  const isReexam = Number(visitNumber) === Number(reexamAt);
  const visitLines = [
    `Patient: ${filled(patient)}`,
    `Patient ID: ${filled(patientId)}`,
    `Age: ${filled(patientAge)}`,
    `Date: ${displayVisitDate()}`,
    `Doctor of record: ${filled(doctor)}`,
    `Visit number: ${filled(visitNumber)}`,
    `Re-exam at visit: ${filled(reexamAt)}`,
    isReexam ? `Re-exam status: This visit is a re-exam. Next re-exam defaults to visit ${Number(visitNumber) + 12}.` : ""
  ].filter(Boolean);
  const soapLines = [
    `Subjective: ${filled(parts.sText)}`,
    `Objective: ${filled(parts.oText)}`,
    `Objective detail: ${filled(parts.oDetailText)}`,
    `Orthopedic tests: ${filled(parts.orthosText, "Not performed/documented")}`,
    `Assessment: ${filled(parts.aText)}`,
    `Plan: ${filled(parts.pText)}`,
    state.single.treatmentStatus === "DC" ? optionalLine("Discontinuing care doctor note", dcNote) : "",
    optionalLine("Free note", freeNote)
  ].filter(Boolean);
  const reexamLines = reexamReviewRequired() || state.reexamReview.notes ? [
    "Re-exam Re-test",
    `Original positive findings: ${filled(reexamOriginalFindings(), "No positive exam findings documented from the Exam page.")}`,
    `Re-test selections: ${filled(reexamReviewResultText(), "No re-test selections documented")}`,
    state.reexamReview.notes ? `Doctor re-test findings: ${state.reexamReview.notes}` : ""
  ].filter(Boolean) : [];
  return [
    "Gdanski Chiropractic Clinic",
    "Repeat Visit SOAP Note",
    "",
    "Visit Details",
    ...visitLines,
    "",
    "Diagnosis and Plan of Management",
    "Diagnosis: Vertebral Subluxation Complex",
    "Plan of management: Correction of VSC",
    `Contraindications: ${filled(contraindications, "None documented")}`,
    "",
    "Previous Visit Reference",
    priorReferenceText(),
    "",
    "Important Notes",
    filled(importantNotes, "None documented"),
    "",
    "SOAP Note",
    ...soapLines,
    ...(reexamLines.length ? ["", ...reexamLines] : []),
    "",
    "Assessment Legend",
    "* initial-visit pattern",
    "^ selected/modified this visit"
  ].join("\n");
}

function setStatus(message) {
  $("#statusLine").textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    $("#statusLine").textContent = "";
  }, 2400);
}

function noteData() {
  const parts = buildParts();
  const visitNumber = Number($("#visitNumber").value || 0);
  const reExamAt = Number($("#reExamAt").value || 0);
  const isReexam = visitNumber > 0 && visitNumber === reExamAt;
  return {
    patientId: currentPatientProfile()?.patientId || "",
    patientName: $("#patientName").value,
    patientAge: $("#patientAge").value,
    patientDob: currentPatientProfile()?.dob || "",
    reExamAt: $("#reExamAt").value,
    visitTime: $("#visitTime").value,
    monthYear: $("#monthYear").value,
    visitDay: $("#visitDay").value,
    visitDate: displayVisitDate(),
    visitDateIso: visitIsoDate(),
    doctor: $("#doctor").value,
    visitNumber: $("#visitNumber").value,
    contraindications: $("#contraindications").value,
    isReexam,
    nextReExamAt: isReexam ? String(visitNumber + 12) : "",
    freeNote: $("#freeNote").value,
    dcNote: $("#dcNote").value,
    importantNotes: $("#importantNotes").value,
    selected: state.selected,
    sided: state.sided,
    severity: state.severity,
    orthosOpen: state.orthosOpen,
    single: state.single,
    visitLevels: Array.from(state.visitLevels),
    levelFindings: state.levelFindings,
    reexamReview: state.reexamReview,
    orthoticsReminderDone: state.orthoticsReminderDone,
    ...parts,
    summary: buildSummary(),
    updatedAt: new Date().toISOString()
  };
}

function loadNote(note) {
  $("#patientName").value = note.patientName || "";
  $("#patientAge").value = calculateAge(note.patientDob) || note.patientAge || "";
  $("#reExamAt").value = note.reExamAt || patientDefaults.reExamEvery;
  $("#visitTime").value = note.visitTime || "";
  $("#monthYear").value = note.monthYear || "";
  $("#visitDay").value = note.visitDay || "";
  $("#contraindications").value = note.contraindications || patientDefaults.contraindications;
  $("#doctor").value = note.doctor || "";
  $("#visitNumber").value = note.visitNumber || 2;
  $("#freeNote").value = note.freeNote || "";
  $("#dcNote").value = note.dcNote || "";
  $("#importantNotes").value = filterProfileAlertNotes(note.importantNotes || "");
  state.selected = note.selected || {};
  state.sided = note.sided || {};
  state.severity = note.severity || {};
  state.orthosOpen = Boolean(note.orthosOpen || note.orthosText);
  state.single = { ...defaultSingle(), ...(note.single || {}) };
  state.visitLevels = new Set(note.visitLevels || []);
  state.levelFindings = note.levelFindings || {};
  state.reexamReview = { notes: "", results: {}, completed: false, updatedAt: "", ...(note.reexamReview || {}) };
  state.reexamPromptKey = "";
  state.orthoticsPromptKey = "";
  state.orthoticsReminderDone = Boolean(note.orthoticsReminderDone);
  state.currentDraftId = note.id || `draft-${Date.now()}`;
  state.importantNotesCarriedFromSoap = true;
  state.profileImportantNotesApplied = true;
  state.profileSubjectiveDefaultsApplied = true;
  renderAll();
  setStatus("Draft loaded.");
}

function savedDrafts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
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

function currentPatientProfile() {
  const patient = currentPatientName();
  if (!patient) return null;
  return savedProfiles()[patient] || null;
}

function applyPatientProfile() {
  const profile = currentPatientProfile();
  state.profileAlerts = [];
  patientDefaults.initialLevels = [];
  if (!profile) return;
  const contraindications = $("#contraindications");
  const patientAge = $("#patientAge");
  const importantNotes = $("#importantNotes");
  const currentAge = calculateAge(profile.dob) || profile.patientAge || "";
  if (currentAge !== "" && patientAge.value !== String(currentAge)) {
    patientAge.value = currentAge;
  }
  if (profile.contraindications !== undefined && contraindications.value !== profile.contraindications) {
    contraindications.value = profile.contraindications || "";
  }
  if (profile.schedule && state.single.schedule === patientDefaults.schedule) {
    state.single.schedule = profile.schedule;
  }
  if (Array.isArray(profile.subluxations)) {
    patientDefaults.initialLevels = profile.subluxations;
  }
  if (profile.neckAdjustment === "N") {
    state.profileAlerts.push(profile.neckMob === "Yes" ? "not neck - mob only" : "not neck");
  }
  if (profile.softTissueOnly === "Yes") {
    state.selected[makeKey("A", "Soft tissue only")] = true;
  }
  applyProfileSubjectiveDefaults(profile);
  const profileImportantNotes = profileDefaultImportantNotes(profile);
  if (profileImportantNotes && !state.profileImportantNotesApplied) {
    importantNotes.value = mergeImportantNotes(importantNotes.value, profileImportantNotes);
    state.profileImportantNotesApplied = true;
  }
}

function filterProfileAlertNotes(value) {
  return String(value || "")
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter((line) => line && !profileAlertLabels.has(line.toUpperCase()))
    .join("\n");
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

function isDefaultImportantNoteLine(line) {
  return /^ltd click\b/i.test(line) ||
    /^ant -\b/i.test(line) ||
    /^(v\.gen|gen|heavy|ST only)$/i.test(line) ||
    /^[RLB] fig 4\+$/i.test(line);
}

function fig4ImportantNotes(profile) {
  const suppressed = new Set((profile?.suppressedImportantNotes || []).map((line) => String(line).toLowerCase()));
  const findings = Array.isArray(profile?.examFig4Findings) ? profile.examFig4Findings : [];
  if (findings.length) return findings.filter((line) => !suppressed.has(String(line).toLowerCase()));
  const latestExam = currentPatientExamRecord();
  return Array.isArray(latestExam?.examFig4Findings) ? latestExam.examFig4Findings.filter((line) => !suppressed.has(String(line).toLowerCase())) : [];
}

function profileDefaultImportantNotes(profile) {
  return uniqueNoteLines([
    ...noteLines(filterProfileAlertNotes(profile?.importantNotes || "")),
    ...fig4ImportantNotes(profile)
  ]).join("\n");
}

function mergeImportantNotes(existing, defaults) {
  return uniqueNoteLines([
    ...noteLines(filterProfileAlertNotes(existing || "")).filter((line) => !isDefaultImportantNoteLine(line)),
    ...noteLines(defaults)
  ]).join("\n");
}

function syncSoapImportantNotesToProfile(draft) {
  const profileKey = draftPatientKey(draft);
  if (!profileKey) return;
  const importantNotes = filterProfileAlertNotes(draft.importantNotes || "");
  const noteSet = new Set(noteLines(importantNotes).map((line) => line.toLowerCase()));
  const profiles = savedProfiles();
  const existing = profiles[profileKey] || {};
  const autoLines = uniqueNoteLines([
    ...(Array.isArray(existing.importantNotesAutoLines) ? existing.importantNotesAutoLines : []),
    ...(Array.isArray(existing.examFig4Findings) ? existing.examFig4Findings : [])
  ]);
  profiles[profileKey] = {
    ...existing,
    patientName: draft.patientName || existing.patientName || "",
    patientId: draft.patientId || existing.patientId || "",
    importantNotes,
    suppressedImportantNotes: autoLines.filter((line) => !noteSet.has(String(line).toLowerCase())),
    updatedAt: new Date().toISOString()
  };
  writeProfiles(profiles);

  const initials = savedInitials();
  let changed = false;
  const updatedInitials = initials.map((record) => {
    if (String(record?.fields?.patientName || "").trim().toLowerCase() !== profileKey) return record;
    changed = true;
    return {
      ...record,
      fields: { ...(record.fields || {}), importantNotes },
      updatedAt: profiles[profileKey].updatedAt
    };
  });
  if (changed) writeInitials(updatedInitials);
}

function applyProfileSubjectiveDefaults(profile) {
  if (state.currentDraftId) return;
  if (state.profileSubjectiveDefaultsApplied) return;
  const defaults = profile.subjectiveDefaults || {};
  if (defaults.single?.subjectiveChange && !state.single.subjectiveChange) {
    state.single.subjectiveChange = defaults.single.subjectiveChange;
  }
  Object.entries(defaults.selected || {}).forEach(([label, selected]) => {
    if (selected && soapSubjectiveLabels.has(label)) state.selected[makeKey("S", label)] = true;
  });
  Object.entries(defaults.sided || {}).forEach(([label, side]) => {
    if (side && soapSubjectiveLabels.has(label)) state.sided[makeKey("S", label)] = side;
  });
  state.selected[makeKey("S", "CK")] = true;
  state.profileSubjectiveDefaultsApplied = true;
}

function renderPatientAlerts() {
  const alertBox = $("#patientAlerts");
  alertBox.innerHTML = "";
  alertBox.hidden = state.profileAlerts.length === 0;
  state.profileAlerts.forEach((message) => {
    const alert = document.createElement("strong");
    alert.textContent = message;
    alertBox.appendChild(alert);
  });
}

function writeDrafts(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(0, 25)));
}

function draftPatientKey(draft) {
  return String(draft.patientName || "").trim().toLowerCase();
}

function draftVisitKey(draft) {
  return String(draft.visitNumber || "").trim();
}

function draftStorageId(draft) {
  const patient = draftPatientKey(draft).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "patient";
  const visit = draftVisitKey(draft).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "visit";
  return `draft-${patient}-visit-${visit}`;
}

function samePatientVisit(a, b) {
  return draftPatientKey(a) === draftPatientKey(b) && draftVisitKey(a) === draftVisitKey(b);
}

function noteHasMeaningfulContent() {
  return Boolean(
    $("#patientName").value.trim() ||
    $("#patientAge").value.trim() ||
    $("#visitTime").value ||
    $("#doctor").value ||
    $("#contraindications").value.trim() ||
    $("#freeNote").value.trim() ||
    $("#dcNote").value.trim() ||
    $("#importantNotes").value.trim() ||
    Object.keys(state.selected).some((key) => state.selected[key]) ||
    Object.keys(state.sided).length ||
    Object.keys(state.severity).length ||
    state.visitLevels.size ||
    Object.keys(state.levelFindings).length ||
    state.orthosOpen ||
    Object.keys(state.reexamReview.results || {}).length ||
    state.reexamReview.notes ||
    state.reexamReview.completed ||
    state.single.subjectiveChange ||
    state.single.treatmentStatus === "DC" ||
    state.single.acuity !== patientDefaults.acuity ||
    state.single.improvement !== patientDefaults.improvement ||
    state.single.schedule !== patientDefaults.schedule ||
    state.single.shoulderLevel ||
    state.single.hipLevel
  );
}

function persistDraft(statusMessage) {
  const draft = noteData();
  draft.id = draftStorageId(draft);
  state.currentDraftId = draft.id;
  const drafts = savedDrafts().filter((item) => item.id !== draft.id && !samePatientVisit(item, draft));
  writeDrafts([draft, ...drafts]);
  syncSoapImportantNotesToProfile(draft);
  renderDrafts();
  if (statusMessage) setStatus(statusMessage);
}

function scheduleAutosave() {
  if (!state.autosaveReady || !noteHasMeaningfulContent()) return;
  if (manualVisitNumberRequired()) return;
  if (!reexamAtIsValid()) return;
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    persistDraft("Autosaved.");
  }, 700);
}

function renderDrafts() {
  const mount = $("#draftList");
  mount.innerHTML = "";
  savedDrafts().forEach((draft) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${draft.patientName || "Unnamed"} - visit ${draft.visitNumber || ""}`;
    button.addEventListener("click", () => loadNote(draft));
    mount.appendChild(button);
  });
}

function loadRequestedNoteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const patient = String(params.get("patient") || "").trim().toLowerCase();
  const visit = String(params.get("visit") || "").trim();
  if (!patient) return;

  const matchingDrafts = savedDrafts()
    .filter((draft) => draftPatientKey(draft) === patient)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  const requested = visit ? matchingDrafts.find((draft) => draftVisitKey(draft) === visit) : matchingDrafts[0];

  if (requested) {
    loadNote(requested);
    return;
  }

  $("#patientName").value = params.get("patient");
  if (currentPatientProfile()?.needsManualVisitNumber) {
    $("#visitNumber").value = "";
    $("#reExamAt").value = "";
  }
  renderAll();
}

function noteDateLabel(draft) {
  if (draft.visitDate) return draft.visitDate;
  if (draft.monthYear && draft.visitDay) return `${draft.monthYear} day ${draft.visitDay}`;
  if (draft.updatedAt) {
    const parsed = new Date(draft.updatedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  }
  return "Date not saved";
}

function draftIsoDate(draft) {
  if (draft.visitDateIso) return draft.visitDateIso;
  if (draft.monthYear && draft.visitDay) {
    const [month, year] = String(draft.monthYear).split("/");
    const parsed = new Date(Number(year), Number(month) - 1, Number(draft.visitDay));
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }
  if (draft.updatedAt) {
    const parsed = new Date(draft.updatedAt);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
    }
  }
  return "";
}

function historySummary(draft) {
  if (draft.summary) return draft.summary;
  return [
    `Patient: ${filled(draft.patientName)}`,
    `Visit number: ${filled(draft.visitNumber)}`,
    `Date: ${noteDateLabel(draft)}`,
    `Subjective: ${filled(draft.sText)}`,
    `Objective: ${filled(draft.oText)}`,
    `Objective detail: ${filled(draft.oDetailText)}`,
    `Orthopedic tests: ${filled(draft.orthosText, "Not performed/documented")}`,
    `Contraindications: ${filled(draft.contraindications, "None documented")}`,
    `Assessment: ${filled(draft.aText)}`,
    `Plan: ${filled(draft.pText)}`,
    optionalLine("Important notes", draft.importantNotes),
    optionalLine("Free note", draft.freeNote)
  ].filter(Boolean).join("\n");
}

function searchableHistoryText(draft) {
  return [
    draft.patientName,
    draft.doctor,
    draft.visitNumber,
    draft.visitDate,
    draftIsoDate(draft),
    noteDateLabel(draft),
    draft.monthYear,
    draft.visitDay,
    draft.contraindications,
    draft.sText,
    draft.oText,
    draft.oDetailText,
    draft.orthosText,
    draft.aText,
    draft.pText,
    draft.importantNotes,
    draft.freeNote,
    draft.dcNote,
    draft.summary
  ].filter(Boolean).join(" ").toLowerCase();
}

function renderHistory() {
  const mount = $("#historyResults");
  const patient = currentPatientName();
  const query = $("#historySearch").value.trim().toLowerCase();
  const tokens = query ? query.split(/\s+/).filter(Boolean) : [];
  const date = $("#historyDate").value;
  mount.innerHTML = "";
  if (!patient) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Enter or open a patient before searching previous SOAP notes.";
    mount.appendChild(empty);
    return;
  }
  const drafts = savedDrafts()
    .filter((draft) => {
      if (!samePatientOrBlank(draft)) return false;
      const haystack = searchableHistoryText(draft);
      const matchesText = tokens.every((token) => haystack.includes(token));
      const matchesDate = !date || draftIsoDate(draft) === date || haystack.includes(date);
      return matchesText && matchesDate;
    })
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  if (!drafts.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "No matching SOAP notes saved for this patient on this device.";
    mount.appendChild(empty);
    return;
  }
  drafts.forEach((draft) => {
    const card = document.createElement("article");
    card.className = "history-card";

    const head = document.createElement("div");
    head.className = "history-card-head";
    const title = document.createElement("div");
    title.className = "history-card-title";
    const primary = document.createElement("strong");
    primary.textContent = `${draft.patientName || "Unnamed patient"} - visit ${draft.visitNumber || ""}`;
    const meta = document.createElement("span");
    meta.textContent = `${noteDateLabel(draft)}${draft.doctor ? ` - ${draft.doctor}` : ""}`;
    title.append(primary, meta);

    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "Open";
    open.addEventListener("click", () => {
      loadNote(draft);
      $("#historyDialog").close();
    });
    head.append(title, open);

    const summary = document.createElement("pre");
    summary.textContent = historySummary(draft);
    card.append(head, summary);
    mount.appendChild(card);
  });
}

function openHistory() {
  renderHistory();
  $("#historyDialog").showModal();
  $("#historySearch").focus();
}

function validateDcNote() {
  if (state.single.treatmentStatus !== "DC") return true;
  if ($("#dcNote").value.trim()) return true;
  $("#dcNote").focus();
  setStatus("Doctor note required for DC.");
  return false;
}

function validateVisitNumber() {
  if (!manualVisitNumberRequired()) return true;
  $("#visitNumber").focus();
  setStatus("Visit number and re-exam-at visit required from the paper file.");
  return false;
}

function validateReexamAt() {
  if (reexamAtIsValid()) return true;
  $("#reExamAt").focus();
  setStatus("Re-exam at visit cannot be less than the current visit number.");
  return false;
}

function validateReexamReview() {
  if (!reexamReviewRequired()) return true;
  if (state.reexamReview.completed) return true;
  if (!$("#reexamDialog").open) $("#reexamDialog").showModal();
  $("#reexamReviewNote").focus();
  setStatus("Click Done in the re-exam re-test before saving this SOAP note.");
  return false;
}

function reexamAtIsValid() {
  const visit = Number($("#visitNumber").value || 0);
  const reexamAt = Number($("#reExamAt").value || 0);
  return !visit || !reexamAt || reexamAt >= visit;
}

function saveDraft() {
  if (!validateVisitNumber()) return;
  if (!validateReexamAt()) return;
  if (!validateDcNote()) return;
  if (!validateReexamReview()) return;
  if (!validateDoctor()) return;
  persistDraft(window.ClinicServer ? "Draft saved to the clinic server." : "Draft saved on this device.");
}

function validateDoctor() {
  if ($("#doctor").value.trim()) return true;
  $("#doctor").focus();
  setStatus("Doctor of record required before leaving or saving this SOAP note.");
  return false;
}

function canLeavePage() {
  if (!validateDoctor()) return false;
  if (!validateVisitNumber()) return false;
  if (!validateReexamAt()) return false;
  if (!validateDcNote()) return false;
  if (!validateReexamReview()) return false;
  return true;
}

function autosaveBeforeLeave() {
  if (!noteHasMeaningfulContent()) return;
  if (manualVisitNumberRequired() || !reexamAtIsValid() || !$("#doctor").value.trim()) return;
  if (reexamReviewRequired() && !state.reexamReview.completed) return;
  persistDraft("");
}

function exportNote() {
  if (!validateVisitNumber()) return;
  if (!validateReexamAt()) return;
  if (!validateDcNote()) return;
  if (!validateReexamReview()) return;
  if (!validateDoctor()) return;
  const draft = noteData();
  const text = buildSummary();
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const patient = filled(draft.patientName, "patient").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  link.download = `${patient || "patient"}-repeat-visit-${draft.visitNumber || "note"}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function printNote() {
  if (!validateVisitNumber()) return;
  if (!validateReexamAt()) return;
  if (!validateDcNote()) return;
  if (!validateReexamReview()) return;
  if (!validateDoctor()) return;
  window.print();
}

function resetNote() {
  const carryForward = latestCarryForwardDraft();
  const carriedFrequency = latestFrequencyDraft();
  const carriedReexam = latestReexamDraft();
  $("#patientName").value = patientDefaults.patientName;
  $("#patientAge").value = "";
  $("#reExamAt").value = carriedReexam?.nextReExamAt || patientDefaults.reExamEvery;
  $("#visitTime").value = "";
  $("#monthYear").value = "";
  $("#visitDay").value = "";
  $("#contraindications").value = patientDefaults.contraindications;
  $("#doctor").value = "";
  $("#visitNumber").value = 2;
  $("#freeNote").value = "";
  $("#dcNote").value = "";
  $("#importantNotes").value = filterProfileAlertNotes(carryForward?.importantNotes || "");
  state.importantNotesCarriedFromSoap = Boolean(carryForward);
  state.profileImportantNotesApplied = false;
  state.selected = {};
  state.sided = {};
  state.severity = {};
  state.orthosOpen = false;
  state.single = defaultSingle();
  if (carriedFrequency?.single?.schedule) state.single.schedule = carriedFrequency.single.schedule;
  state.selected["S:CK"] = true;
  state.visitLevels = new Set();
  state.levelFindings = {};
  state.reexamReview = { notes: "", results: {}, completed: false, updatedAt: "" };
  state.reexamPromptKey = "";
  state.orthoticsPromptKey = "";
  state.orthoticsReminderDone = false;
  state.currentDraftId = null;
  state.profileSubjectiveDefaultsApplied = false;
  renderAll();
}

function bindEvents() {
  ["patientName", "patientAge", "reExamAt", "visitTime", "doctor", "visitNumber", "freeNote", "dcNote", "importantNotes", "contraindications"].forEach((id) => {
    $(`#${id}`).addEventListener("input", renderAll);
    $(`#${id}`).addEventListener("change", renderAll);
  });
  $("#orthosToggle").addEventListener("click", () => {
    state.orthosOpen = !state.orthosOpen;
    renderAll();
  });
  $("#saveNote").addEventListener("click", saveDraft);
  $("#exportNote").addEventListener("click", exportNote);
  $("#printNote").addEventListener("click", printNote);
  $("#historyNote").addEventListener("click", openHistory);
  $("#historyClose").addEventListener("click", () => $("#historyDialog").close());
  $("#historyDialog form").addEventListener("submit", (event) => event.preventDefault());
  $("#historySearch").addEventListener("input", renderHistory);
  $("#historyDate").addEventListener("input", renderHistory);
  $("#reexamClose").addEventListener("click", () => $("#reexamDialog").close());
  $("#reexamDialog form").addEventListener("submit", (event) => event.preventDefault());
  $("#reexamReviewNote").addEventListener("input", () => {
    state.reexamReview.notes = $("#reexamReviewNote").value;
    state.reexamReview.completed = false;
    scheduleAutosave();
  });
  $("#reexamSave").addEventListener("click", () => saveReexamReview(true));
  $("#reexamDone").addEventListener("click", () => saveReexamReview(true));
  $("#orthoticsClose").addEventListener("click", () => $("#orthoticsDialog").close());
  $("#orthoticsDialog form").addEventListener("submit", (event) => event.preventDefault());
  $("#orthoticsDone").addEventListener("click", () => {
    state.orthoticsReminderDone = true;
    $("#orthoticsDialog").close();
    scheduleAutosave();
  });
  $("#copySummary").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#summaryText").textContent);
    setStatus("Summary copied.");
  });
  $("#clearDrafts").addEventListener("click", () => {
    if (!window.confirm("Clear saved drafts from this browser?")) return;
    localStorage.removeItem(STORAGE_KEY);
    renderDrafts();
    setStatus("Drafts cleared.");
  });
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.href.startsWith("javascript:")) return;
    if (!canLeavePage()) {
      event.preventDefault();
      return;
    }
    autosaveBeforeLeave();
  });
  window.addEventListener("pagehide", autosaveBeforeLeave);
  window.addEventListener("beforeunload", (event) => {
    if ($("#doctor").value.trim()) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

mountLine("subjectiveLine", "S", subjectiveItems);
mountLine("objectiveLine", "O", objectiveItems);
mountLine("assessmentLine", "A", assessmentItems);
mountLine("planLine", "P", planItems);
mountLine("objectiveDetailLine", "OD", objectiveDetailItems);
mountLine("orthosLine", "ORTHO", orthoItems);
bindEvents();
resetNote();
loadRequestedNoteFromUrl();
state.autosaveReady = true;
renderDrafts();
