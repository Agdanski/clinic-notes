const INITIAL_STORAGE_KEY = "clinic-initial-visit-records-v1";
const SOAP_STORAGE_KEY = "clinic-repeat-soap-drafts-v2";
const EXAM_STORAGE_KEY = "clinic-vsc-exam-records-v1";
const PROFILE_STORAGE_KEY = "clinic-patient-profiles-v1";
const DEMO_PATIENT = "Demo Patient - Taylor Brooks";
const DEMO_KEY = "demo patient - taylor brooks";

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

function soapVisit({ visitNumber, dateIso, visitDay, time, selected, sided, severity, visitLevels, levelFindings, orthosOpen, freeNote, orthosText, subjectiveChange, schedule }) {
  const visit = {
    id: `draft-demo-patient-taylor-brooks-visit-${visitNumber}`,
    patientName: DEMO_PATIENT,
    reExamAt: "12",
    visitTime: time,
    monthYear: "05/2026",
    visitDay,
    visitDate: dateIso,
    visitDateIso: dateIso,
    doctor: "Dr. Allan",
    visitNumber: String(visitNumber),
    contraindications: "High blood pressure; Osteoarthritis; No neck adjustment",
    isReexam: false,
    nextReExamAt: "",
    freeNote,
    dcNote: "",
    importantNotes: "VERY GENTLE. NO NECK.",
    selected,
    sided,
    severity,
    orthosOpen,
    single: {
      subjectiveChange,
      improvement: "Same",
      acuity: "SA",
      treatmentStatus: "TTC",
      schedule
    },
    visitLevels,
    levelFindings,
    sText: "Demo subjective note",
    oText: "Same",
    oDetailText: "Demo objective detail",
    orthosText: orthosText || "",
    aText: "Levels L5*, SI-R*, T6*",
    pText: `SA, TTC, Schedule ${schedule}`,
    updatedAt: `${dateIso}T${time || "09:00"}:00.000Z`
  };
  visit.summary = [
    "Gdanski Chiropractic Clinic",
    "Repeat Visit SOAP Note",
    "",
    "Visit Details",
    `Patient: ${DEMO_PATIENT}`,
    `Date: ${visit.visitDate}`,
    `Time: ${visit.visitTime}`,
    `Doctor of record: ${visit.doctor}`,
    `Visit number: ${visit.visitNumber}`,
    `Re-exam at visit: ${visit.reExamAt}`,
    "",
    "SOAP Note",
    `Subjective: ${visit.sText}`,
    `Objective: ${visit.oText}`,
    `Objective detail: ${visit.oDetailText}`,
    `Orthopedic tests: ${visit.orthosText || "Not performed/documented"}`,
    `Assessment: ${visit.aText}`,
    `Plan: ${visit.pText}`,
    visit.freeNote ? `Free note: ${visit.freeNote}` : ""
  ].filter(Boolean).join("\n");
  return visit;
}

const demoInitialRecord = {
  id: "initial-demo-patient-taylor-brooks",
  fields: {
    patientName: DEMO_PATIENT,
    monthYear: "05/2026",
    visitDay: "21",
    dob: "1982-04-14",
    patientAge: "44",
    doctor: "Dr. Allan",
    chiefComplaint: "Intermittent right low back and SI discomfort after prolonged sitting.",
    historyNotes: "Symptoms began gradually over the past month. No recent trauma reported.",
    dcComments: "Demo record only. Patient prefers gentle care and no cervical adjustment.",
    diagnosis: "VSC",
    primarySubluxation: "L5",
    differentialDiagnosis: "Monitor for disc involvement if symptoms peripheralize.",
    contraindications: "No neck adjustment unless reviewed.",
    treatmentPlan: "Correction of VSC",
    frequency: "2/wk",
    strokeRisk: "Manual review required",
    alternativeCare: "",
    examMuscleFindings: "Future exam transfer example: right glute weak.",
    examNeuroFindings: "No positive neurological findings documented in demo.",
    exerciseOther: "",
    xrayOther: "",
    referredBy: "Online search",
    md: "Dr. Example",
    mdLastSeen: "2026-04-10",
    previousDc: "None",
    previousDcLastSeen: "",
    xrayDate: "",
    xrayLocation: "Lumbar Spine",
    goals: "Return to exercise and reduce sitting-related discomfort.",
    worstHabit: "Long sitting blocks at computer.",
    majorStress: "Work deadlines.",
    spouseName: "",
    kidsName: "",
    orthoticsLastDate: "2024-05-21",
    recheckDate: "2026-05-21",
    rmtWho: "Demo RMT",
    acuWho: ""
  },
  choices: {
    visitType: "NP",
    adjusted: "Yes",
    differentialDxOptions: ["Disc herniation", "Osteoarthritis", "SI dysfunction"],
    contraindicationOptions: ["High blood pressure", "Osteoarthritis"],
    subluxationPattern: ["L5", "SI-R", "T6"],
    neckAdj: "N",
    neckSetup: ["Sup"],
    clickOk: "N",
    careModel: ["Meric"],
    lifetimeAdj: "No",
    wantsClick: "N",
    intensity: "Very gentle",
    softTissueOnly: "No",
    prognosis: "Good",
    referMd: "No",
    familyHistory: "Reviewed",
    riskBenefit: ["Chiropractic risks reviewed", "Chiropractic benefits reviewed", "Alternatives reviewed", "MD referral considered"],
    underMd: "Yes",
    alternativeCareOptions: ["Massage therapy", "Acupuncture", "Allopathic medicine", "Physiotherapy", "Exercise/rehab", "Medication", "Imaging"],
    recommend: ["Ice"],
    exercise: ["FHP"],
    xrayRecommend: ["None"],
    recentXray: "No",
    spousePatient: "No",
    kidsPatient: "No",
    orthotics: "Y",
    rmt: "Y",
    acu: "N"
  },
  summary: "",
  updatedAt: "2026-05-21T13:15:00.000Z"
};

demoInitialRecord.summary = [
  "Gdanski Chiropractic Clinic",
  "Initial Visit Clinical Note",
  "",
  "Patient",
  `Patient: ${DEMO_PATIENT}`,
  "Date: 05/2026",
  "Day: 21",
  "DOB: 1982-04-14",
  "Age: 44",
  "Doctor: Dr. Allan",
  "Visit type: NP",
  "Adjusted first visit: Yes",
  "",
  "Chief Complaint",
  demoInitialRecord.fields.chiefComplaint,
  "",
  "Assessment Setup",
  "Diagnosis: VSC",
  "Primary subluxation: L5",
  "Subluxations to correct: L5, SI-R, T6",
  "Neck adjustment: N",
  "Intensity: Very gentle"
].join("\n");

const demoProfile = {
  patientName: DEMO_PATIENT,
  contraindications: "High blood pressure; Osteoarthritis; No neck adjustment",
  neckAdjustment: "N",
  softTissueOnly: "No",
  intensity: "Very gentle",
  schedule: "2/wk",
  diagnosis: "VSC",
  primarySubluxation: "L5",
  subluxations: ["L5", "SI-R", "T6"],
  treatmentPlan: "Correction of VSC",
  doctor: "Dr. Allan",
  examMuscleFindings: "Psoas: Weak R; Glut: Weak R",
  examOrthoFindings: "SLR: R +",
  examNeuroFindings: "",
  examUpdatedAt: "2026-05-21T13:40:00.000Z",
  updatedAt: "2026-05-21T13:15:00.000Z"
};

const demoExamRecord = {
  id: "exam-demo-patient-taylor-brooks",
  fields: {
    patientName: DEMO_PATIENT,
    patientAge: "44",
    examDate: "2026-05-21",
    doctor: "Dr. Allan",
    fhpCm: "3",
    trapTension: "4",
    occTrigger: "3",
    swaybackCm: "2",
    glutTrigger: "5",
    examNotes: "Demo exam only. Findings selected to show transfer into initial form."
  },
  choices: {
    fhpGrade: "2",
    swaybackGrade: "1",
    "posture:Hip high": "R",
    "level:L5": "TOP",
    "level:SI-R": "finding",
    "muscle:Psoas:finding": "Weak",
    "muscle:Psoas:side": "R",
    "muscle:Glut:finding": "Weak",
    "muscle:Glut:side": "R",
    "ortho:SLR": ["R +"],
    gait: ["Slow"]
  },
  muscleFindings: "Psoas: Weak R; Glut: Weak R",
  orthoFindings: "SLR: R +",
  neuroFindings: "",
  summary: "Gdanski Chiropractic Clinic\nVSC Examination\n\nPatient\nPatient: Demo Patient - Taylor Brooks\nAge: 44\nDate: 2026-05-21\nDoctor: Dr. Allan\n\nMyopathology Positives\nPsoas: Weak R\nGlut: Weak R\n\nOrthopaedic Tests Positives\nSLR: R +\n\nNotes\nDemo exam only. Findings selected to show transfer into initial form.",
  updatedAt: "2026-05-21T13:40:00.000Z"
};

const demoSoapVisits = [
  soapVisit({
    visitNumber: 4,
    dateIso: "2026-05-27",
    visitDay: "27",
    time: "09:15",
    selected: { "S:CK": true, "O:C": true, "O:T": true, "P:PT": true },
    sided: { "S:LB": "R", "S:SI": "R", "OD:Glut": "R weak", "OD:Ham": "R weak", "ORTHO:SLR": "R -", "ORTHO:Kemp's": "R +" },
    severity: { "S:LB": "yellow" },
    visitLevels: ["L4"],
    levelFindings: { L4: "TOP" },
    orthosOpen: true,
    orthosText: "SLR R -, Kemp's R +",
    freeNote: "Able to sit longer before symptoms start.",
    subjectiveChange: "Better",
    schedule: "2/wk"
  }),
  soapVisit({
    visitNumber: 3,
    dateIso: "2026-05-24",
    visitDay: "24",
    time: "10:00",
    selected: { "S:CK": true, "O:L": true, "P:NK": true },
    sided: { "S:LB": "R", "OD:Psoas": "R weak" },
    severity: { "S:LB": "red" },
    visitLevels: [],
    levelFindings: {},
    orthosOpen: false,
    freeNote: "No adverse response after prior care.",
    subjectiveChange: "Same",
    schedule: "2/wk"
  }),
  soapVisit({
    visitNumber: 2,
    dateIso: "2026-05-21",
    visitDay: "21",
    time: "13:15",
    selected: { "S:CK": true, "O:L": true },
    sided: { "S:LB": "R", "S:HIP": "R" },
    severity: {},
    visitLevels: [],
    levelFindings: {},
    orthosOpen: false,
    freeNote: "First repeat visit after initial intake.",
    subjectiveChange: "Same",
    schedule: "2/wk"
  })
];

function seedDemoData() {
  const initials = readJson(INITIAL_STORAGE_KEY, []).filter((record) => patientKey(record?.fields?.patientName) !== DEMO_KEY);
  writeJson(INITIAL_STORAGE_KEY, [demoInitialRecord, ...initials].slice(0, 50));

  const profiles = readJson(PROFILE_STORAGE_KEY, {});
  profiles[DEMO_KEY] = demoProfile;
  writeJson(PROFILE_STORAGE_KEY, profiles);

  const soapVisits = readJson(SOAP_STORAGE_KEY, []).filter((visit) => patientKey(visit.patientName) !== DEMO_KEY);
  writeJson(SOAP_STORAGE_KEY, [...demoSoapVisits, ...soapVisits].slice(0, 25));

  const exams = readJson(EXAM_STORAGE_KEY, []).filter((record) => patientKey(record?.fields?.patientName) !== DEMO_KEY);
  writeJson(EXAM_STORAGE_KEY, [demoExamRecord, ...exams].slice(0, 50));

  document.querySelector("#demoStatus").textContent = "Fake demo data loaded.";
}

function removeDemoData() {
  const initials = readJson(INITIAL_STORAGE_KEY, []).filter((record) => patientKey(record?.fields?.patientName) !== DEMO_KEY);
  writeJson(INITIAL_STORAGE_KEY, initials);

  const profiles = readJson(PROFILE_STORAGE_KEY, {});
  delete profiles[DEMO_KEY];
  writeJson(PROFILE_STORAGE_KEY, profiles);

  const soapVisits = readJson(SOAP_STORAGE_KEY, []).filter((visit) => patientKey(visit.patientName) !== DEMO_KEY);
  writeJson(SOAP_STORAGE_KEY, soapVisits);

  const exams = readJson(EXAM_STORAGE_KEY, []).filter((record) => patientKey(record?.fields?.patientName) !== DEMO_KEY);
  writeJson(EXAM_STORAGE_KEY, exams);

  document.querySelector("#demoStatus").textContent = "Fake demo data removed.";
}

document.querySelector("#seedDemo").addEventListener("click", seedDemoData);
document.querySelector("#removeDemo").addEventListener("click", removeDemoData);
document.querySelector("#openInitialDemo").addEventListener("click", seedDemoData);
document.querySelector("#openExamDemo").addEventListener("click", seedDemoData);
document.querySelector("#openSoapDemo").addEventListener("click", seedDemoData);
