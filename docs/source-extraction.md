# Repeat Visit Paper Source Extraction

Source PDF: `C:\Users\drall\Downloads\SoapNote.pdf`

The scanned paper sheet appears to contain four repeat-visit entries per page. Each entry has a compact header and four SOAP rows.

## Header

- Patient name
- Diagnosis, shown as `VSC` / vertebral subluxation complex
- Plan of management, shown as correction of VSC
- Re-exam at
- Month/year, day, doctor, visit number

## Subjective row

Fast region selections:

`CK, C, T, LB, S, SI, SH, EL, WR, FIN, HIP, KN, FT, Toe, L/R, TMJ, H, PMS, GI, SIC, AL, SIN, DY, TRAM, STRES, W`

## Objective row

Captured options and fields:

- ROM
- CTL
- K27
- C/T L/R
- MM
- Fig 4 +/-
- UnL Trap
- Sc
- Impression: B/S/W/OS
- BP

## Assessment row

Captured options and fields:

- C0-C7
- T1-T12
- L1-L5
- SI L/R
- St only
- Stx
- Well
- Tite

## Plan row

Captured options and fields:

- ex
- P.T.
- Nk
- Adv
- Dt.
- Nutr.
- Lfsty.
- E
- C.F.
- A
- SA
- Chr
- TTC schedule: 3x, 2x, 1x
- Ft
- FL
- L/R
- Psoas
- Pirif
- Glut
- QF
- Delt
- Ham
- Lat
- SpasmT L/R
- WM

Some source text is OCR-imperfect, so this file should be corrected against the original paper form during the next refinement pass.

## Refinement notes from workflow explanation

- Patient name will eventually come from the initial-visit form.
- Diagnosis is always Vertebral Subluxation Complex.
- Plan of management is always Correction of VSC.
- Re-exam defaults to every 12 visits, but must stay manually editable.
- A separate re-exam date field is not needed.
- Visit date parts and appointment time will eventually come from appointment data.
- Doctor of record must be selectable.
- Visit number starts at 2 on this repeat-visit sheet.
- If visit number equals the re-exam-at number, the visit should be highlighted as a re-exam.
- Subjective region abbreviations should stay in one fast line; CK means checkup and does not need side selection.
- Subjective also has Same, Better, and Worse quick selections.
- SB means shoulder blade and needs left/right/both selection.
- For subjective findings with left/right/both, after the side is selected a second tap turns the button yellow and a third tap turns it red for severity.
- For subjective findings without left/right/both, excluding CK and the Same/Better/Worse change buttons, the second tap turns yellow and the third tap turns red for severity.
- Objective ROM uses better/worse rather than up/down.
- K27 uses clockwise/counterclockwise.
- MM and Trap use hypertonic/hypotonic.
- UNL means unlevel and uses shoulders/hips.
- CT left and CT right are not used.
- Fig 4 still needs side plus positive/negative.
- Improvement labels should read Better, Same, and Worse. Off schedule is its own selectable finding.
- Same is automatically selected in Objective for each visit unless changed.
- The immediately previous visit's visit-specific O, second O line, A, and free note should be displayed on the current visit for quick reference.
- If the immediately previous visit includes Orthos, those orthopedic test findings should also display in the previous-visit reference.
- Assessment levels should be auto-highlighted from the initial visit, while visit-specific changes use a second highlight color.
- For assessment segments C0-L5, the first tap marks the visit-specific segment and the second tap adds TOP for tender on palpation.
- STX means same treatment and is always automatically highlighted.
- BP and scale fields are no longer used.
- Plan defaults should include subacute acuity and TTC, with schedule preselected from the initial visit unless changed.
- PT, NK, diet, lifestyle, nutrition, acuity, and schedule all need fast selection.
- In the plan row, nutrition stays with the advice group; buttons from acute onward are separated to the right side.
- TTC means Treatment to Continue and can be toggled to DC for Discontinuing Care.
- DC requires a mandatory doctor note explaining why care is being discontinued.
- Frequency is selected through one compact picker: Daily, 3/wk, 2/wk, 1/wk, 2/mo, 1/mo, 3 wks, 5 wks, 6 wks, or TC.
- Treatment frequency is set initially on the initial visit and then carried forward from the immediately previous saved visit unless changed.
- TC means To Call.
- Foot flare, psoas, piriformis, glute, quad, delt, ham, lat, and torque belong to objective as the second objective line.
- Psoas, piriformis, glute, quad, delt, ham, and lat use normal/weak.
- Psoas, piriformis, glute, quad, delt, ham, and lat also require left, right, or both.
- Torque uses immediate right/left buttons rather than a popup.
- Orthos is an optional visit extension, only opened when orthopedic tests are performed.
- Orthos appears after the five SOAP rows.
- Orthos should include Heel to buttock, SLR, Yoman's, Valsalva's, and Kemp's.
- Orthopedic tests should record positive/negative, and left/right/both when appropriate.
- Important notes should be available from visit #2 onward, free text, modifiable each visit, and carried forward to subsequent visits.
