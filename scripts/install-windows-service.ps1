param(
  [string]$AppDir = "C:\ClinicNotes\app",
  [string]$NodeExe = "C:\Program Files\nodejs\node.exe",
  [string]$NssmExe = "C:\nssm\nssm.exe"
)

if (!(Test-Path $NssmExe)) {
  Write-Error "NSSM was not found at $NssmExe. Ask IT to install NSSM or adjust the path."
  exit 1
}

& $NssmExe install ClinicNotes $NodeExe "$AppDir\server.js"
& $NssmExe set ClinicNotes AppDirectory $AppDir
& $NssmExe set ClinicNotes AppEnvironmentExtra "CLINIC_NOTES_DATA_DIR=C:\ClinicNotes\data" "CLINIC_NOTES_UPLOAD_DIR=C:\ClinicNotes\uploads" "CLINIC_NOTES_BACKUP_DIR=C:\ClinicNotes\backups" "CLINIC_NOTES_HOST=0.0.0.0" "CLINIC_NOTES_PORT=3000"
& $NssmExe set ClinicNotes Start SERVICE_AUTO_START
& $NssmExe start ClinicNotes

Write-Host "ClinicNotes service installed and started."
