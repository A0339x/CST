/**
 * CST Tools — Google Apps Script
 *
 * Paste this entire file into Extensions → Apps Script → Code.gs
 * Save (Ctrl+S), then reload the Google Sheet.
 * A "📋 CST Tools" menu will appear in the toolbar.
 *
 * Sheet names expected (matches All-Client-Data-Updated.xlsx structure):
 *   "Clients"       — Col A: Client Name, B: Row ID, Y(25): Next Steps/Value, AG(33): Last Contact Date
 *   "History Notes2"— Col A: Row ID, B: Client/ID, C: Notes, K(11): Client Name, L(12): Date (ISO), M(13): Coach
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
    input[type="text"], input[type="date"], textarea, select {
      width: 100%;
      box-sizing: border-box;
      padding: 8px;
      border: 1px solid #dadce0;
      border-radius: 4px;
      font-size: 14px;
    }
    textarea {
      height: 120px;
      resize: vertical;
    }
    .notes-wrap {
      position: relative;
    }
    .notes-loading {
      display: none;
      position: absolute;
      inset: 0;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      color: #888;
      font-style: italic;
      pointer-events: none;
      text-align: center;
      padding: 8px;
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
    .amend  { color: #e37400; }
    .error  { color: #d93025; }
  </style>
</head>
<body>
  <label>Client</label>
  <select id="client" onchange="onClientChange()">
    <option value="">— Select client —</option>
    ${clientNames.map(n => `<option value="${escapeHtml_(n)}">${escapeHtml_(n)}</option>`).join("\n")}
  </select>

  <label>Date</label>
  <input type="date" id="date" value="${today}" onchange="loadExistingEntry()">

  <label>Coach</label>
  <select id="coach">
    <option value="">— Select coach —</option>
    <option value="Greg Esman" ${lastCoach === "Greg Esman" ? "selected" : ""}>Greg Esman</option>
    <option value="Shane" ${lastCoach === "Shane" ? "selected" : ""}>Shane</option>
  </select>

  <label>Notes</label>
  <div class="notes-wrap">
    <textarea id="notes" disabled></textarea>
    <div class="notes-loading" id="notes-loading"></div>
  </div>

  <div class="status" id="status"></div>

  <div class="btn-row">
    <button class="btn-cancel" onclick="google.script.host.close()">Cancel</button>
    <button class="btn-submit" onclick="submitEntry()">Add Entry</button>
  </div>

  <script>
    const waitingMessages = [
      "Pick a client. It's a dropdown. You've done this before.",
      "No client, no notes. This isn't complicated.",
      "The client dropdown is literally right there.",
      "Still waiting. Still no client selected. Interesting choice.",
      "At some point you're going to have to pick a client.",
      "I built all this and you won't even select a client.",
      "A client. Pick one. Any one. There are 260 of them.",
      "Client. Dropdown. Click. In that order.",
      "We can't take notes on nobody. Select a client.",
      "I'm not mad. I'm just not doing anything until you pick a client.",
      "Go on then. Pick a client. I'll wait here.",
      "This is the part where you select a client.",
      "You opened this dialog to log a client note. So... pick a client.",
      "260 clients and you haven't picked one yet. Bold strategy.",
      "The client dropdown isn't going to click itself.",
      "Friendly reminder: you need a client before you can log a note.",
      "No client selected. That's not a note, that's just a blank box.",
      "There's a whole list of clients up there. Take your pick.",
      "Genuinely unsure what you're waiting for. A client, presumably.",
      "Every second without a client selected is a second wasted. Just saying.",
      "The client list is alphabetical. That should help narrow it down.",
      "You know who has a client selected? People who are done with this dialog.",
      "Select a client. Your future self will thank you.",
      "No client, no entry. No entry, no record. No record, no memory. Pick a client.",
      "I've seen people select clients much faster than this.",
      "A client selection is all that stands between you and a very empty notes field.",
      "If you're looking for the client dropdown, it's above this box. You're welcome.",
      "This is awkward for both of us. Select a client.",
      "Still here. Still waiting. Still no client. We're doing great.",
      "The correct next step is to select a client. Just in case that wasn't clear.",
      "I don't want to tell you how to do your job, but... select a client.",
      "At this rate the client is going to call you before you log a note.",
      "Pick a client. Any client. Preferably one you actually spoke to.",
    ];
    let waitingMsgIndex = Math.floor(Math.random() * waitingMessages.length);
    let waitingInterval = null;

    function startWaitingMessages() {
      const loadingEl = document.getElementById("notes-loading");
      loadingEl.style.display = "flex";
      loadingEl.textContent = waitingMessages[waitingMsgIndex % waitingMessages.length];
      waitingInterval = setInterval(function() {
        waitingMsgIndex++;
        loadingEl.textContent = waitingMessages[waitingMsgIndex % waitingMessages.length];
      }, 7000);
    }

    function stopWaitingMessages() {
      if (waitingInterval) { clearInterval(waitingInterval); waitingInterval = null; }
      document.getElementById("notes-loading").style.display = "none";
    }

    function onClientChange() {
      const notesEl = document.getElementById("notes");
      const client  = document.getElementById("client").value;
      if (!client) {
        notesEl.disabled = true;
        notesEl.placeholder = "";
      } else {
        stopWaitingMessages();
        loadExistingEntry();
      }
    }

    const loadingMessages = [
      "Asking the spreadsheet nicely...",
      "Checking if past-you was thorough...",
      "Consulting the archive...",
      "Rummaging through the notes...",
      "Your past self is typing...",
      "Interrogating the database...",
      "We wrote it down. Somewhere.",
      "One sec, bribing the servers..."
    ];
    let loadingMsgIndex = Math.floor(Math.random() * loadingMessages.length);

    function loadExistingEntry() {
      const client = document.getElementById("client").value;
      const date   = document.getElementById("date").value;
      const statusEl  = document.getElementById("status");
      const notesEl   = document.getElementById("notes");
      const loadingEl = document.getElementById("notes-loading");

      if (!client || !date) {
        statusEl.textContent = "";
        statusEl.className = "status";
        return;
      }

      loadingEl.textContent = loadingMessages[loadingMsgIndex % loadingMessages.length];
      loadingMsgIndex++;
      loadingEl.style.display = "flex";
      notesEl.placeholder = "";
      notesEl.disabled = true;

      google.script.run
        .withSuccessHandler(function(result) {
          loadingEl.style.display = "none";
          if (result) {
            notesEl.value = result.notes || "";
            if (result.coach) document.getElementById("coach").value = result.coach;
            statusEl.textContent = "Existing note loaded — amending";
            statusEl.className = "status amend";
          } else {
            notesEl.value = "";
            statusEl.textContent = "";
            statusEl.className = "status";
          }
          notesEl.disabled = false;
          notesEl.placeholder = "Enter call notes…";
          notesEl.focus();
        })
        .withFailureHandler(function() {
          loadingEl.style.display = "none";
          notesEl.disabled = false;
          notesEl.placeholder = "Enter call notes…";
        })
        .getEntryForDate(client, date);
    }

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
        .withSuccessHandler(function(wasAmended) {
          showStatus(wasAmended ? "Note updated successfully!" : "Entry added successfully!");
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

    startWaitingMessages();
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
 * Called from the dialog. Updates an existing History Notes2 row in-place if one exists
 * for clientName + dateStr, otherwise appends a new row. Returns true if amended.
 */
function addEntry(clientName, dateStr, notes, coach) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const historySheet = ss.getSheetByName("History Notes2");
  if (!historySheet) throw new Error('Sheet "History Notes2" not found.');

  const lastRow = historySheet.getLastRow();
  let amended = false;

  if (lastRow >= 2) {
    // Read all 13 columns; client name is col K (index 10), date is col L (index 11)
    const data = historySheet.getRange(2, 1, lastRow - 1, 13).getValues();
    const targetClient = clientName.trim().toLowerCase();
    const targetDate   = dateStr.trim();
    let matchRow = -1;

    for (let i = data.length - 1; i >= 0; i--) {
      const rowClient = String(data[i][10]).trim().toLowerCase(); // col K
      const rowDate   = normalizeDate_(data[i][11]);              // col L
      if (rowClient === targetClient && rowDate === targetDate) {
        matchRow = i + 2; // 1-based, offset by header row
        break;
      }
    }

    if (matchRow > 0) {
      // Update col C (notes) and col M (coach) in the matched row
      historySheet.getRange(matchRow, 3).setValue(notes);
      historySheet.getRange(matchRow, 13).setValue(coach || "");
      amended = true;
    }
  }

  if (!amended) {
    // Look up the encoded client ID from Clients col B
    const clientsSheet = ss.getSheetByName("Clients");
    const clientRowId  = clientsSheet ? getClientRowId_(clientsSheet, clientName) : "";

    // Append new 13-column row: A=rowId, B=clientId, C=notes, D-J=empty, K=name, L=isoDate, M=coach
    const isoDate = dateStr + "T00:00:00.000Z";
    historySheet.appendRow([
      generateRowId_(), // A: Row ID
      clientRowId,      // B: Client / ID
      notes,            // C: Value (notes)
      "", "", "", "", "", "", "", // D–J: unused
      clientName,       // K: Filter (client name)
      isoDate,          // L: Modified / Date
      coach || "",      // M: Modified / By
    ]);
  }

  // Update Clients sheet: Next Steps/Value (col Y=25) and Last Contact Date (col AG=33)
  const clientsSheet = ss.getSheetByName("Clients");
  if (clientsSheet) {
    const row = findClientRow_(clientsSheet, clientName);
    if (row > 0) {
      clientsSheet.getRange(row, 25).setValue(notes);   // col Y: Next Steps / Value
      clientsSheet.getRange(row, 33).setValue(dateStr); // col AG: CSM / Date of Last Contact
    }
  }

  // Force all buffered writes to disk before returning
  SpreadsheetApp.flush();

  // Persist coach name for next time
  if (coach) {
    PropertiesService.getUserProperties().setProperty("lastCoach", coach);
  }

  return amended;
}

/**
 * Returns { notes, coach } for the most recent History Notes2 row matching clientName + dateStr,
 * or null if none found. Called from the dialog when client/date change.
 */
function getEntryForDate(clientName, dateStr) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("History Notes2");
  if (!sheet) return null;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  // Read all 13 columns; client name is col K (index 10), date col L (index 11)
  const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  const targetClient = clientName.trim().toLowerCase();
  const targetDate   = dateStr.trim();
  let match = null;

  for (let i = 0; i < data.length; i++) {
    const rowClient = String(data[i][10]).trim().toLowerCase(); // col K
    const rowDate   = normalizeDate_(data[i][11]);              // col L
    if (rowClient === targetClient && rowDate === targetDate) {
      match = {
        notes: String(data[i][2]  || "").trim(), // col C
        coach: String(data[i][12] || "").trim(), // col M
      };
    }
  }

  return match; // null if no match; last match wins if duplicates exist
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
 * Returns all notes for a client from History Notes2, newest first.
 * Also checks the Clients sheet col Y (Next Steps) + col AG (Last Contact Date) and
 * includes that entry if it isn't already represented in History Notes2.
 * col K (index 10) = client name, col L (index 11) = date, col C (index 2) = notes, col M (index 12) = coach
 */
function getClientHistory(clientName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("History Notes2");
  if (!sheet) throw new Error('Sheet "History Notes2" not found.');

  const tz = Session.getScriptTimeZone();
  const target = clientName.trim().toLowerCase();
  const entries = [];

  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    // Read all 13 columns
    const data = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
    data
      .filter(row => String(row[10]).trim().toLowerCase() === target) // col K
      .forEach(function(row) {
        const rawDateVal = row[11]; // col L: ISO string or Date
        let rawDate = 0;
        let displayDate = "";
        if (rawDateVal instanceof Date) {
          rawDate = rawDateVal.getTime();
          displayDate = Utilities.formatDate(rawDateVal, tz, "MMMM d, yyyy");
        } else {
          const s = String(rawDateVal || "").trim().slice(0, 10);
          const d = new Date(s);
          rawDate = isNaN(d.getTime()) ? 0 : d.getTime();
          displayDate = isNaN(d.getTime()) ? s : Utilities.formatDate(d, tz, "MMMM d, yyyy");
        }
        entries.push({
          rawDate:     rawDate,
          normalDate:  normalizeDate_(rawDateVal),
          date:        displayDate,
          notes:       String(row[2]  || "").trim(), // col C
          coach:       String(row[12] || "").trim(), // col M
        });
      });
  }

  // Also check Clients sheet col Y (Next Steps/Value) + col AG (Last Contact Date).
  // If a more recent entry exists there that isn't already in History Notes2, include it.
  const clientsSheet = ss.getSheetByName("Clients");
  if (clientsSheet) {
    const clientRow = findClientRow_(clientsSheet, clientName);
    if (clientRow > 0) {
      // col Y = column 25 (1-based), col AG = column 33 (1-based)
      const clientData = clientsSheet.getRange(clientRow, 25, 1, 9).getValues()[0];
      const nextStepText = String(clientData[0] || "").trim();  // col Y (offset 0)
      const lastContactVal = clientData[8];                      // col AG (offset 8 = col 33)

      if (nextStepText) {
        const normalLastContact = normalizeDate_(lastContactVal);
        // Only add if this date isn't already in History Notes2 entries
        const alreadyPresent = entries.some(function(e) {
          return e.normalDate === normalLastContact;
        });
        if (!alreadyPresent && normalLastContact) {
          let rawDate = 0;
          let displayDate = normalLastContact;
          const d = new Date(normalLastContact);
          if (!isNaN(d.getTime())) {
            rawDate = d.getTime();
            displayDate = Utilities.formatDate(d, tz, "MMMM d, yyyy");
          }
          entries.push({
            rawDate:    rawDate,
            normalDate: normalLastContact,
            date:       displayDate,
            notes:      nextStepText,
            coach:      "",
          });
        }
      }
    }
  }

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
  const seen = new Set();
  return sheet.getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map(r => String(r[0]).trim())
    .filter(n => {
      if (!n || seen.has(n.toLowerCase())) return false;
      seen.add(n.toLowerCase());
      return true;
    })
    .sort();
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
 * Normalizes a cell value (Date object or string) to a yyyy-MM-dd string.
 */
function normalizeDate_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  const s = String(value || "").trim();
  // Already yyyy-MM-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try parsing other formats
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return s;
}

/**
 * Generates a 22-character unique row ID matching the format used in History Notes2.
 */
function generateRowId_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 22);
}

/**
 * Looks up the encoded client Row ID (col B) for a given client name (col A).
 * Returns empty string if not found — note is still saved, client ID is non-critical.
 */
function getClientRowId_(sheet, clientName) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return '';
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const target = clientName.trim().toLowerCase();
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toLowerCase() === target) {
      return String(data[i][1] || '');
    }
  }
  return '';
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
