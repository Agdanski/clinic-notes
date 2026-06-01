# Chiropractic Repeat Visit SOAP Notes

This folder contains the first digital prototype for the day-to-day/repeat visit chiropractic clinical note.

## Files

- `index.html` - tablet-friendly SOAP note interface.
- `app.css` - visual layout and print styles.
- `app.js` - form behavior, local draft saving, export, and printable summary.
- `assets/SoapNote.pdf` - copy of the current paper repeat-visit source form.
- `docs/source-extraction.md` - notes on the paper form structure captured in this pass.

## Prototype Use

Open `C:\stuff\clinic notes\index.html` in a browser on the tablet or desktop. The prototype stores drafts only in the browser on that device and can export a JSON file or print a signed summary.

## Private Clinic Server Use

For clinic use with real patient records, run the private Node/SQLite server instead of opening the HTML files directly:

```powershell
npm install
npm start
```

Then open `http://SERVER-IP:3000` from clinic desktops or Android tablets on the clinic network. The server adds login accounts, central SQLite storage, audit events, diagnostic file uploads, and backup support. See `docs/clinic-server-deployment.md` for the step-by-step clinic-server setup.

The current repeat-visit screen is intentionally paper-like:

- Diagnosis and plan of management are fixed text.
- Patient name, visit date/time, doctor of record, visit number, re-exam visit, assessment defaults, and schedule are prepared for later automatic fill from the initial visit and appointment data.
- Subjective, objective, assessment, and plan rows use tap-to-highlight abbreviations.
- Left/right/both, better/worse, clockwise/counterclockwise, tone, unlevel, and strength choices appear only when the selected abbreviation needs that extra detail.
- CK is a simple checkup selection. SB is shoulder blade and uses left/right/both.
- Subjective has Same, Better, and Worse quick selections.
- Subjective sided findings cycle from side-selected, to yellow severity, to red severity, then clear.
- Subjective non-sided symptom findings also cycle from selected, to yellow severity, to red severity, then clear. CK stays a plain checkup toggle.
- CK is auto-selected on new repeat visits.
- Visit # starts at 2 by default because visit 1 belongs to the initial-visit form.
- Re-exam highlighting appears when the visit number equals the re-exam-at visit number.
- Re-exam visits show a banner and calculate the next re-exam 12 visits later.
- The second objective line holds foot flare, muscle strength, and torque findings.
- Objective muscles Psoas through Lat require left/right/both plus normal/weak.
- Optional Orthos extension can be opened for visits that need orthopedic tests.
- Orthos includes Heel to buttock, SLR, Yoman's, Valsalva's, and Kemp's, with side plus positive/negative where appropriate.
- Plan acuity and schedule buttons start at `A` and are visually separated to the right of the nutrition/advice group.
- `TTC` toggles to `DC`; choosing `DC` requires a doctor note before saving/exporting.
- Frequency is selected through one `Freq` picker: Daily, 3/wk, 2/wk, 1/wk, 2/mo, 1/mo, 3 wks, 5 wks, 6 wks, or TC.
- New visits carry forward the most recently saved treatment frequency for that patient.
- Previous-visit reference includes Orthos when the prior saved visit has orthopedic tests.
- Notes autosave locally after changes; the Save button remains as an explicit backup.
- Orthos appears after the five SOAP rows and remains collapsed unless needed.
- Objective improvement defaults to Same on every visit.
- The previous saved visit's O, second O line, A, and free note are shown as a quick reference on the next visit.
- Important notes are carried forward and remain editable from visit #2 onward.
- Assessment segments C0-L5 cycle from unselected, to visit-highlighted, to TOP, then clear.

## Important production notes

This is a working workflow prototype, not a production clinical records system. Before live use with patient information, the next design pass should decide where records are stored, how access is controlled, how backups work, how amendments are tracked, and how retention/export requirements will be satisfied for Ontario chiropractic practice.

Useful CCO references for that pass:

- Standard of Practice S-002: Record Keeping - https://cco.on.ca/cco-resources/s-002-record-keeping/
- Standard of Practice S-022: Ownership, Storage, Security and Destruction of Records of Personal Health Information - https://cco.on.ca/cco-resources/s-022-ownership-storage-security-and-destruction-of-records-of-personal-health-information/
