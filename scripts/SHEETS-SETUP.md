# Google Sheets CST Setup Guide

Two people on separate networks can use this shared sheet to log client notes and track Next Steps during the transition period.

---

## Step 1 — Generate the CSV Files

From the project root, run:

```bash
python scripts/generate-sheets-csv.py
```

This produces two files in `sheets-export/`:
- `clients.csv` — one row per client (~200 clients)
- `notes-log.csv` — all historical call notes

**Requires:** `pip install openpyxl`

---

## Step 2 — Create a New Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com)
2. Click **Blank** to create a new spreadsheet
3. Rename it (click "Untitled spreadsheet" at top): **CST Client Tracker**

---

## Step 3 — Import clients.csv as the "Clients" Sheet

1. In the new sheet, the default tab is called "Sheet1" — rename it:
   - Right-click the tab → **Rename** → type `Clients` → Enter
2. Go to **File → Import**
3. Click **Upload** → select `sheets-export/clients.csv`
4. Import settings:
   - Import location: **Replace current sheet**
   - Separator type: **Comma**
   - Convert text to numbers/dates/formulas: **Yes**
5. Click **Import data**

---

## Step 4 — Import notes-log.csv as the "Notes Log" Sheet

1. Click the **+** button at the bottom left to add a new sheet tab
2. Rename it `Notes Log`
3. Go to **File → Import**
4. Click **Upload** → select `sheets-export/notes-log.csv`
5. Import settings:
   - Import location: **Replace current sheet**
   - Separator type: **Comma**
   - Convert text to numbers/dates/formulas: **Yes**
6. Click **Import data**

---

## Step 5 — Format the Sheets

### Clients sheet:
1. Click the row 1 header (the "1" row number) to select the entire row
2. **View → Freeze → 1 row** (so headers stay visible when scrolling)
3. Click row 1 again → set background color to a light blue or gray (Format → Theme or the fill bucket icon)
4. Make row 1 bold: **Ctrl+B**
5. Resize columns to fit: select all (Ctrl+A) → right-click any column header → **Resize columns** → **Fit to data**
6. Select column E (Next Step): click the "E" column header → set background color to **light yellow** to highlight it as the primary field
7. Column C (Notes) on Notes Log: make it wider (drag the column divider) and enable text wrap:
   - Select the column → **Format → Wrapping → Wrap**

### Notes Log sheet:
1. Freeze row 1 (same as above)
2. Bold and color the header row
3. Select column C → set width to ~400px and enable text wrap

---

## Step 6 — Add the Apps Script

1. In the Google Sheet, go to **Extensions → Apps Script**
2. A new browser tab opens with the script editor
3. Delete all existing code in the editor
4. Open `scripts/apps-script.js` from this project and copy the entire contents
5. Paste it into the Apps Script editor
6. Click the **Save** button (floppy disk icon) or press **Ctrl+S**
7. Close the Apps Script tab
8. **Reload the Google Sheet** (refresh the browser tab)
9. After reload, a new **"📋 CST Tools"** menu appears in the toolbar

> **First use:** Google will ask you to authorize the script. Click **Review permissions** → select your Google account → click **Advanced** → **Go to CST Client Tracker (unsafe)** → **Allow**. This is normal for personal scripts.

---

## Step 7 — Share with Your Colleague

1. Click the **Share** button (top right, blue button)
2. Enter your colleague's Google account email address
3. Set permission to **Editor**
4. Uncheck "Notify people" if you prefer to send the link manually
5. Click **Share**

Your colleague opens the link, and they will have full edit access in real time from any network.

---

## Day-to-Day Usage

### Logging a call note

1. Click **📋 CST Tools → Add Today's Entry**
2. A dialog opens:
   - **Client** — select from the dropdown (all ~200 clients listed)
   - **Date** — pre-filled with today's date (read-only)
   - **Coach** — type your name (remembered for next time)
   - **Notes** — type your call notes
3. Click **Add Entry**
4. The note is appended to the Notes Log sheet
5. The client's **Last Contact Date** in the Clients sheet is updated automatically

### Updating a client's Next Step

1. Click **📋 CST Tools → Update Next Step**
2. Select the client — the current Next Step value loads automatically
3. Edit the text
4. Click **Update**
5. Column E in the Clients sheet is updated immediately

### Editing directly

You can also click directly on any cell in the Clients or Notes Log sheet and edit it — the sheet is a normal spreadsheet. The script just makes common tasks faster.

---

## Step 9 — Exporting Data Later (for CST Import)

When the full CST app is ready, export the updated data:

1. Click on the **Clients** tab
2. **File → Download → Comma Separated Values (.csv)**
3. Repeat for the **Notes Log** tab
4. Import these CSVs into the CST app using the existing import tooling

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "CST Tools" menu not showing | Reload the sheet (F5). On first load, the menu may take a moment. |
| Script authorization prompt | Follow the authorization steps in Step 6 above — this is required once per user. |
| Client not found after updating | The client name in the dialog must exactly match Col A. Check for extra spaces or different casing. |
| Notes Log sheet not found | Make sure the tab is named exactly `Notes Log` (case-sensitive). |
| Clients sheet not found | Make sure the tab is named exactly `Clients` (case-sensitive). |
