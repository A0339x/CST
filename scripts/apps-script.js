/**
 * CST Tools — Google Apps Script
 *
 * Paste this entire file into Extensions → Apps Script → Code.gs
 * Save (Ctrl+S), then reload the Google Sheet.
 * A "📋 CST Tools" menu will appear in the toolbar.
 *
 * Sheet names expected:
 *   "Clients"    — Col A: Name, B: Email, C: Offer, D: Coach, E: Next Step, F: Last Contact Date
 *   "Notes Log"  — Col A: Client Name, B: Date, C: Notes, D: Coach
 */

// ---------------------------------------------------------------------------
// Menu setup
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📋 CST Tools")
    .addItem("Add Today's Entry", "showAddEntryDialog")
    .addItem("View Client History", "showClientHistoryDialog")
    .addToUi();
}

// ---------------------------------------------------------------------------
// "Add Today's Entry" dialog
// ---------------------------------------------------------------------------

function showAddEntryDialog() {
  const clientNames = getClientNames_();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  const lastCoach = PropertiesService.getUserProperties().getProperty("lastCoach") || "";

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 14px;
      padding: 16px;
      margin: 0;
      color: #202124;
    }
    label {
      display: block;
      font-weight: bold;
      margin-top: 12px;
      margin-bottom: 4px;
    }
    input[type="text"], textarea, select {
      width: 100%;
      box-sizing: border-box;
      padding: 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
    }
    input[readonly] {
      background: #f1f3f4;
      color: #5f6368;
    }
    textarea {
      height: 120px;
      resize: vertical;
    }
    .btn-row {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    button {
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
    }
    .btn-cancel {
      background: #f1f3f4;
      color: #202124;
    }
    .btn-submit {
      background: #1a73e8;
      color: white;
    }
    .btn-submit:hover { background: #1557b0; }
    .status { margin-top: 8px; color: #188038; font-size: 13px; min-height: 18px; }
    .error  { color: #d93025; }
  </style>
</head>
<body>
  <label>Client</label>
  <select id="client">
    <option value="">— Select client —</option>
    ${clientNames.map(n => `<option value="${escapeHtml_(n)}">${escapeHtml_(n)}</option>`).join("\n")}
  </select>

  <label>Date</label>
  <input type="text" id="date" value="${today}" readonly>

  <label>Coach</label>
  <input type="text" id="coach" value="${escapeHtml_(lastCoach)}" placeholder="Your name">

  <label>Notes</label>
  <textarea id="notes" placeholder="Enter call notes…"></textarea>

  <div class="status" id="status"></div>

  <div class="btn-row">
    <button class="btn-cancel" onclick="google.script.host.close()">Cancel</button>
    <button class="btn-submit" onclick="submitEntry()">Add Entry</button>
  </div>

  <script>
    function submitEntry() {
      const client = document.getElementById("client").value.trim();
      const date   = document.getElementById("date").value.trim();
      const coach  = document.getElementById("coach").value.trim();
      const notes  = document.getElementById("notes").value.trim();

      if (!client) { showStatus("Please select a client.", true); return; }
      if (!notes)  { showStatus("Notes cannot be empty.", true);  return; }

      const btn = document.querySelector(".btn-submit");
      btn.disabled = true;
      btn.textContent = "Saving…";

      google.script.run
        .withSuccessHandler(function() {
          showStatus("Entry added successfully!");
          setTimeout(function() { google.script.host.close(); }, 1200);
        })
        .withFailureHandler(function(err) {
          showStatus("Error: " + err.message, true);
          btn.disabled = false;
          btn.textContent = "Add Entry";
        })
        .addEntry(client, date, notes, coach);
    }

    function showStatus(msg, isError) {
      const el = document.getElementById("status");
      el.textContent = msg;
      el.className = "status" + (isError ? " error" : "");
    }
  </script>
</body>
</html>
`)
    .setWidth(420)
    .setHeight(420)
    .setTitle("Add Today's Entry");

  SpreadsheetApp.getUi().showModalDialog(html, "Add Today's Entry");
}

/**
 * Called from the dialog. Appends a row to Notes Log and updates Clients sheet.
 */
function addEntry(clientName, dateStr, notes, coach) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Append to Notes Log
  const logSheet = ss.getSheetByName("Notes Log");
  if (!logSheet) throw new Error('Sheet "Notes Log" not found.');
  logSheet.appendRow([clientName, dateStr, notes, coach || ""]);

  // Update Clients sheet: Next Step (Col E) and Last Contact Date (Col F) — single atomic write
  const clientsSheet = ss.getSheetByName("Clients");
  if (clientsSheet) {
    const row = findClientRow_(clientsSheet, clientName);
    if (row > 0) {
      clientsSheet.getRange(row, 5, 1, 2).setValues([[notes, dateStr]]);
    }
  }

  // Force all buffered writes to disk before returning
  SpreadsheetApp.flush();

  // Persist coach name for next time
  if (coach) {
    PropertiesService.getUserProperties().setProperty("lastCoach", coach);
  }
}

// ---------------------------------------------------------------------------
// "View Client History" dialog
// ---------------------------------------------------------------------------

function showClientHistoryDialog() {
  const clientNames = getClientNames_();

  const html = HtmlService.createHtmlOutput(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 14px;
      padding: 16px;
      margin: 0;
      color: #202124;
    }
    label {
      display: block;
      font-weight: bold;
      margin-bottom: 4px;
    }
    select {
      width: 100%;
      box-sizing: border-box;
      padding: 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
      margin-bottom: 12px;
    }
    #history {
      overflow-y: auto;
      max-height: 400px;
      border-top: 1px solid #e0e0e0;
      padding-top: 8px;
    }
    .entry {
      border-bottom: 1px solid #f1f3f4;
      padding: 10px 0;
    }
    .entry:last-child { border-bottom: none; }
    .meta {
      font-size: 12px;
      color: #5f6368;
      margin-bottom: 4px;
    }
    .notes {
      white-space: pre-wrap;
      line-height: 1.5;
    }
    .empty {
      color: #9aa0a6;
      font-style: italic;
      padding: 16px 0;
    }
    .loading { color: #5f6368; font-style: italic; }
    .btn-row {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    button {
      padding: 8px 20px;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      background: #f1f3f4;
      color: #202124;
    }
  </style>
</head>
<body>
  <label>Client</label>
  <select id="client" onchange="loadHistory()">
    <option value="">— Select client —</option>
    ${clientNames.map(n => `<option value="${escapeHtml_(n)}">${escapeHtml_(n)}</option>`).join("\n")}
  </select>

  <div id="history"></div>

  <div class="btn-row">
    <button onclick="google.script.host.close()">Close</button>
  </div>

  <script>
    function loadHistory() {
      const client = document.getElementById("client").value;
      const container = document.getElementById("history");
      if (!client) { container.innerHTML = ""; return; }

      container.innerHTML = '<div class="loading">Loading...</div>';
      google.script.run
        .withSuccessHandler(function(entries) {
          if (!entries || entries.length === 0) {
            container.innerHTML = '<div class="empty">No notes found for this client.</div>';
            return;
          }
          container.innerHTML = entries.map(function(e) {
            const meta = [e.date || "No date", e.coach ? "Coach: " + e.coach : ""].filter(Boolean).join("  |  ");
            return '<div class="entry"><div class="meta">' + escHtml(meta) + '</div>'
                 + '<div class="notes">' + escHtml(e.notes || "") + '</div></div>';
          }).join("");
        })
        .withFailureHandler(function(err) {
          container.innerHTML = '<div class="empty">Error: ' + err.message + '</div>';
        })
        .getClientHistory(client);
    }

    function escHtml(s) {
      return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }
  </script>
</body>
</html>
`)
    .setWidth(520)
    .setHeight(560)
    .setTitle("Client History");

  SpreadsheetApp.getUi().showModalDialog(html, "Client History");
}

/**
 * Returns all notes for a client from the Notes Log sheet, newest first.
 */
function getClientHistory(clientName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Notes Log");
  if (!sheet) throw new Error('Sheet "Notes Log" not found.');

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const tz = Session.getScriptTimeZone();
  const target = clientName.trim().toLowerCase();
  const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();

  const entries = data
    .filter(row => String(row[0]).trim().toLowerCase() === target)
    .map(row => ({
      rawDate: row[1] instanceof Date ? row[1].getTime() : new Date(String(row[1] || "")).getTime() || 0,
      date:    row[1] instanceof Date
                 ? Utilities.formatDate(row[1], tz, "MMMM d, yyyy")
                 : String(row[1] || "").trim().slice(0, 10),
      notes: String(row[2] || "").trim(),
      coach: String(row[3] || "").trim(),
    }));

  entries.sort(function(a, b) { return b.rawDate - a.rawDate; });

  return entries.map(function(e) {
    return { date: e.date, notes: e.notes, coach: e.coach };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns all client names from Col A of the Clients sheet (skips header).
 */
function getClientNames_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Clients");
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map(r => String(r[0]).trim())
    .filter(n => n.length > 0);
}

/**
 * Finds the row number (1-based) for a client in Col A. Returns -1 if not found.
 */
function findClientRow_(sheet, clientName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const names = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < names.length; i++) {
    if (String(names[i][0]).trim().toLowerCase() === clientName.trim().toLowerCase()) {
      return i + 2; // +2 because data starts at row 2
    }
  }
  return -1;
}

/**
 * Escapes HTML special characters for safe insertion into HTML strings.
 * Only used server-side when building the HTML template.
 */
function escapeHtml_(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
