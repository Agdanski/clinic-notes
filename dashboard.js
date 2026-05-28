const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";
const CONSENT_STORAGE_KEY = "clinic-informed-consents-v1";

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

function applyImport() {
  const data = previewData();
  if (!data.patientName) {
    setStatus("Patient name is required before applying.");
    return;
  }
  if ($("#formType").value === "janeConsent") {
    applyConsentImport(data);
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
  setStatus("Imported into this browser. Open Initial, Consent, Exam, or SOAP to review.");
}

function applyConsentImport(data) {
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
  updateLinks();
  setStatus("Jane consent imported. Open Consent for chiropractor review/signature.");
}

function updateLinks() {
  const patient = encodeURIComponent($("#patientName").value.trim());
  $("#openInitial").href = patient ? `initial.html?patient=${patient}` : "initial.html";
  $("#openConsent").href = patient ? `consent.html?patient=${patient}` : "consent.html";
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
    janeConsent: parseJaneConsent
  }[$("#formType").value] || parseJaneAdultLike;
  const data = parser(text);
  lastMappedConsent = data.target === "consent" ? data : null;
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
