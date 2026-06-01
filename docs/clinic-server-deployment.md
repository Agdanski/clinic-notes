# Clinic Server Deployment

This app is now set up to run as a private clinic web app with central storage.

## Simple Overview

1. The Dell PowerEdge server runs `server.js`.
2. Staff and doctors open `http://SERVER-IP:3000` from clinic desktops or Android tablets.
3. Everyone logs in with an individual username.
4. Notes still look the same, but saves/autosaves sync to SQLite on the server.
5. Uploaded diagnostic files are saved in the server uploads folder.

Do not expose this app to the public internet. Keep it clinic-network-only unless IT later adds VPN and HTTPS.

## First Server Install

Ask IT to install:

- Node.js 22 LTS or newer.
- Git.
- NSSM or another Windows service runner.

Recommended folders:

- `C:\ClinicNotes\app`
- `C:\ClinicNotes\data`
- `C:\ClinicNotes\uploads`
- `C:\ClinicNotes\backups`

Copy or clone this repository into `C:\ClinicNotes\app`, then run:

```powershell
cd C:\ClinicNotes\app
npm install
$env:CLINIC_NOTES_DATA_DIR="C:\ClinicNotes\data"
$env:CLINIC_NOTES_UPLOAD_DIR="C:\ClinicNotes\uploads"
$env:CLINIC_NOTES_BACKUP_DIR="C:\ClinicNotes\backups"
$env:CLINIC_NOTES_ADMIN_PASSWORD="CHANGE THIS BEFORE LIVE USE"
npm start
```

Open:

```text
http://SERVER-IP:3000
```

Default admin username is `admin`. If `CLINIC_NOTES_ADMIN_PASSWORD` was not set, the temporary password is `ChangeMe-ClinicNotes!`; change this before live use.

## Accounts

After logging in as admin:

1. Open `Admin`.
2. Create one account per person.
3. Use `doctor` for chiropractors, `staff` for front desk, and `admin` only for people managing users/backups.
4. Do not share accounts for live records.

## Backups

Manual backup from the app:

1. Login as admin.
2. Open `Admin`.
3. Click `Backup now`.

Command-line backup:

```powershell
cd C:\ClinicNotes\app
npm run backup
```

For real live records, add an encrypted off-server backup as soon as possible. Server-only backups do not protect against theft, fire, drive failure, or ransomware.

## Android Tablets

1. Connect the tablet to clinic Wi-Fi.
2. Open Chrome.
3. Go to `http://SERVER-IP:3000`.
4. Login.
5. Chrome menu > Add to Home screen.

For live use, IT should add private HTTPS and install/trust the certificate on the tablets.

The current app keeps a short-term browser cache while a user is working. Staff should log out at the end of use, which clears the clinical cache on that device. Tablets should also have screen locks enabled.
