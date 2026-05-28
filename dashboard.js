const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";

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

const $ = (selector) => document.querySelector(selector);

function setStatus(message) {
  $("#statusLine").textContent = message;
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

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\r/g, "")
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

function parseDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
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

function applyImport() {
  const data = previewData();
  if (!data.patientName) {
    setStatus("Patient name is required before applying.");
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
  updateLinks();
  setStatus("Imported into this browser. Open Initial, Exam, or SOAP to review.");
}

function updateLinks() {
  const patient = encodeURIComponent($("#patientName").value.trim());
  $("#openInitial").href = patient ? `initial.html?patient=${patient}` : "initial.html";
  $("#openExam").href = patient ? `exam.html?patient=${patient}` : "exam.html";
  $("#openSoap").href = patient ? `index.html?patient=${patient}` : "index.html";
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
    const text = content.items.map((item) => item.str).join(" ");
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

function parseText() {
  const text = normalizeText($("#rawText").value);
  if (!text) {
    setStatus("Paste or extract text first.");
    return;
  }
  const data = $("#formType").value === "adult" ? parseAdult(text) : parseChild(text);
  writePreview(data);
  setStatus("Mapped fields. Please review before applying.");
}

$("#extractText").addEventListener("click", extractTextFromFile);
$("#parseText").addEventListener("click", parseText);
$("#applyImport").addEventListener("click", applyImport);
$("#dob").addEventListener("input", () => {
  $("#patientAge").value = calculateAge($("#dob").value);
  updateLinks();
});
["patientName", "patientAge", "recentXray", "xrayDate", "xrayLocation", "chiefComplaint", "historyNotes", "contraindications", "familyHistory", "strokeRiskFlags"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateLinks);
  document.getElementById(id).addEventListener("change", updateLinks);
});
updateLinks();
