const STORAGE_KEY = "clinic-repeat-soap-drafts-v2";

const patientDefaults = {
  patientName: "",
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
    schedule: patientDefaults.schedule
  };
}

const state = {
  selected: {},
  sided: {},
  severity: {},
  orthosOpen: false,
  single: defaultSingle(),
  visitLevels: new Set(),
  levelFindings: {}
};

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

const subjectiveItems = [
  ["Same", "subjectiveChange", "Same"], ["Better", "subjectiveChange", "Better"], ["Worse", "subjectiveChange", "Worse"],
  ["CK"], ["C", "side"], ["T", "side"], ["LB", "side"], ["S", "side"], ["SI", "side"], ["SH", "side"], ["SB", "side"],
  ["EL", "side"], ["WR", "side"], ["FIN", "side"], ["HIP", "side"], ["KN", "side"], ["FT", "side"], ["Toe", "side"],
  ["TMJ", "side"], ["H", "side"], ["PMS"], ["GI"], ["SIC"], ["AL"], ["SIN"], ["DY"], ["TRAM"], ["STRES"], ["W"]
];
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
  ["SI-L", "level"], ["SI-R", "level"], ["Soft tissue only"], ["STX", "fixed"], ["Well"], ["Tight"]
];
const planItems = [
  ["PT"], ["NK"], ["DT"], ["Lfsty"], ["Nutr"],
  ["A", "acuity", "A"], ["SA", "acuity", "SA"], ["Chr", "acuity", "Chr"],
  ["TTC", "treatmentStatus", "TTC"], ["Freq", "schedulePicker"]
];
const objectiveDetailItems = [
  ["Ft flare", "side"], ["Psoas", "muscleStrength"], ["Pirif", "muscleStrength"], ["Glut", "muscleStrength"],
  ["Quad", "muscleStrength"], ["Delt", "muscleStrength"], ["Ham", "muscleStrength"], ["Lat", "muscleStrength"],
  ["Torque R"], ["Torque L"]
];
const orthoItems = [
  ["Heel to buttock", "orthoSided"], ["SLR", "orthoSided"], ["Yoman's", "orthoSided"],
  ["Valsalva's", "orthoResult"], ["Kemp's", "orthoSided"]
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function todayParts() {
  const now = new Date();
  return {
    monthYear: now.toLocaleDateString(undefined, { month: "2-digit", year: "numeric" }),
    day: now.toLocaleDateString(undefined, { day: "2-digit" })
  };
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
  const isDc = isTreatmentStatus && state.single.treatmentStatus === "DC";
  const isFixed = mode === "fixed";
  const active = isAutoLevel || isVisitLevel || isSided || isToggle || isSingle || isFixed || isTreatmentStatus || isSchedulePicker;
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
  button.innerHTML = `${displayLabel}${displayBadge ? `<span class="badge">${displayValue(displayBadge)}</span>` : ""}`;
}

function renderAll() {
  $$(".mark[data-line]").forEach(renderButton);
  updateDateParts();
  updateReexamFlag();
  renderDcNote();
  renderOrthos();
  renderPriorReference();
  $("#summaryText").textContent = buildSummary();
}

function updateDateParts() {
  const parts = todayParts();
  $("#monthYear").value = parts.monthYear;
  $("#visitDay").value = parts.day;
}

function updateReexamFlag() {
  const visit = Number($("#visitNumber").value || 0);
  const reexamAt = Number($("#reExamAt").value || 0);
  $("#visitRow").classList.toggle("is-reexam", visit > 0 && visit === reexamAt);
}

function selectedMarks(line) {
  const parts = [];
  Object.entries(state.selected).forEach(([key, selected]) => {
    if (selected && key.startsWith(`${line}:`)) {
      const severity = state.severity[key];
      const severityText = severity === "yellow" ? "yellow" : severity === "red" ? "red" : "";
      parts.push(`${key.split(":")[1]}${severityText ? ` ${severityText}` : ""}`);
    }
  });
  Object.entries(state.sided).forEach(([key, value]) => {
    if (key.startsWith(`${line}:`)) {
      const severity = state.severity[key];
      const severityText = severity === "yellow" ? "yellow" : severity === "red" ? "red" : "";
      parts.push(`${key.split(":")[1]} ${displayValue(value)}${severityText ? ` ${severityText}` : ""}`);
    }
  });
  return parts.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
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

function previousDraftForCurrentVisit() {
  const visit = Number($("#visitNumber").value || 0);
  if (!visit || visit <= 2) return null;
  return savedDrafts()
    .filter((draft) => samePatientOrBlank(draft) && Number(draft.visitNumber) === visit - 1)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function latestCarryForwardDraft() {
  return savedDrafts()
    .filter((draft) => samePatientOrBlank(draft) && draft.importantNotes)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function latestFrequencyDraft() {
  return savedDrafts()
    .filter((draft) => samePatientOrBlank(draft) && draft.single && draft.single.schedule)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0] || null;
}

function priorLine(label, value) {
  return value ? `${label}: ${value}` : "";
}

function renderPriorReference() {
  const prior = previousDraftForCurrentVisit();
  const target = $("#priorReference");
  if (!prior) {
    target.textContent = "No previous visit saved.";
    return;
  }
  target.textContent = [
    `Visit #${prior.visitNumber || ""}`,
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
  const orthos = selectedMarks("ORTHO");
  if (state.single.improvement) o.push(state.single.improvement);
  const a = selectedMarks("A");
  a.push("STX");
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

function buildSummary() {
  const patient = $("#patientName").value.trim();
  const doctor = $("#doctor").value;
  const visitNumber = $("#visitNumber").value;
  const reexamAt = $("#reExamAt").value;
  const time = $("#visitTime").value;
  const freeNote = $("#freeNote").value.trim();
  const dcNote = $("#dcNote").value.trim();
  const importantNotes = $("#importantNotes").value.trim();
  const parts = buildParts();
  return [
    `PATIENT NAME: ${patient}    MO/YR: ${$("#monthYear").value}    DAY: ${$("#visitDay").value}    TIME: ${time}`,
    `DR: ${doctor}    VISIT #: ${visitNumber}    RE-EXAM AT: ${reexamAt}`,
    "DX: Vertebral Subluxation Complex    PL of MAN: Correction of VSC",
    Number(visitNumber) === Number(reexamAt) ? "RE-EXAM VISIT" : "",
    "",
    `S: ${parts.sText}`,
    `O: ${parts.oText}`,
    `O detail: ${parts.oDetailText}`,
    parts.orthosText ? `Orthos: ${parts.orthosText}` : "",
    `A: ${parts.aText}`,
    `P: ${parts.pText}`,
    state.single.treatmentStatus === "DC" && dcNote ? `DC note: ${dcNote}` : "",
    importantNotes ? `Important notes: ${importantNotes}` : "",
    freeNote ? `Free note: ${freeNote}` : "",
    "",
    "* initial-visit pattern    ^ selected/modified this visit"
  ].filter((line) => line !== "").join("\n");
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
  return {
    patientName: $("#patientName").value,
    reExamAt: $("#reExamAt").value,
    visitTime: $("#visitTime").value,
    doctor: $("#doctor").value,
    visitNumber: $("#visitNumber").value,
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
    ...parts,
    summary: buildSummary(),
    updatedAt: new Date().toISOString()
  };
}

function loadNote(note) {
  $("#patientName").value = note.patientName || "";
  $("#reExamAt").value = note.reExamAt || patientDefaults.reExamEvery;
  $("#visitTime").value = note.visitTime || "";
  $("#doctor").value = note.doctor || "";
  $("#visitNumber").value = note.visitNumber || 2;
  $("#freeNote").value = note.freeNote || "";
  $("#dcNote").value = note.dcNote || "";
  $("#importantNotes").value = note.importantNotes || "";
  state.selected = note.selected || {};
  state.sided = note.sided || {};
  state.severity = note.severity || {};
  state.orthosOpen = Boolean(note.orthosOpen || note.orthosText);
  state.single = { ...defaultSingle(), ...(note.single || {}) };
  state.visitLevels = new Set(note.visitLevels || []);
  state.levelFindings = note.levelFindings || {};
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

function writeDrafts(drafts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts.slice(0, 25)));
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

function validateDcNote() {
  if (state.single.treatmentStatus !== "DC") return true;
  if ($("#dcNote").value.trim()) return true;
  $("#dcNote").focus();
  setStatus("Doctor note required for DC.");
  return false;
}

function saveDraft() {
  if (!validateDcNote()) return;
  const draft = noteData();
  draft.id = `${Date.now()}`;
  writeDrafts([draft, ...savedDrafts()]);
  renderDrafts();
  setStatus("Draft saved on this device.");
}

function exportNote() {
  if (!validateDcNote()) return;
  const draft = noteData();
  const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `repeat-visit-${draft.visitNumber || "note"}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetNote() {
  const carryForward = latestCarryForwardDraft();
  const carriedFrequency = latestFrequencyDraft();
  $("#patientName").value = patientDefaults.patientName;
  $("#reExamAt").value = patientDefaults.reExamEvery;
  $("#visitTime").value = "";
  $("#doctor").value = "";
  $("#visitNumber").value = 2;
  $("#freeNote").value = "";
  $("#dcNote").value = "";
  $("#importantNotes").value = carryForward?.importantNotes || "";
  state.selected = {};
  state.sided = {};
  state.severity = {};
  state.orthosOpen = false;
  state.single = defaultSingle();
  if (carriedFrequency?.single?.schedule) state.single.schedule = carriedFrequency.single.schedule;
  state.visitLevels = new Set();
  state.levelFindings = {};
  renderAll();
}

function bindEvents() {
  ["patientName", "reExamAt", "visitTime", "doctor", "visitNumber", "freeNote", "dcNote", "importantNotes"].forEach((id) => {
    $(`#${id}`).addEventListener("input", renderAll);
    $(`#${id}`).addEventListener("change", renderAll);
  });
  $("#newNote").addEventListener("click", resetNote);
  $("#orthosToggle").addEventListener("click", () => {
    state.orthosOpen = !state.orthosOpen;
    renderAll();
  });
  $("#saveNote").addEventListener("click", saveDraft);
  $("#exportNote").addEventListener("click", exportNote);
  $("#printNote").addEventListener("click", () => window.print());
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
}

mountLine("subjectiveLine", "S", subjectiveItems);
mountLine("objectiveLine", "O", objectiveItems);
mountLine("assessmentLine", "A", assessmentItems);
mountLine("planLine", "P", planItems);
mountLine("objectiveDetailLine", "OD", objectiveDetailItems);
mountLine("orthosLine", "ORTHO", orthoItems);
bindEvents();
resetNote();
renderDrafts();
