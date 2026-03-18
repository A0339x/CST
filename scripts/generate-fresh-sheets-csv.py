"""
generate-fresh-sheets-csv.py
Reads sheets-export/clients.csv and outputs two fresh CSVs to sheets-export/:
  - fresh-clients.csv   : same client list, Next Step and Last Contact Date cleared
  - fresh-notes-log.csv : headers only, zero data rows

Use this to start a new Google Sheets tracker without carrying over old notes.
Previous notes remain in the prior tracker.

Run from the project root:
    python scripts/generate-fresh-sheets-csv.py
"""

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT_DIR = ROOT / "sheets-export"
CLIENTS_CSV = OUT_DIR / "clients.csv"

CLIENT_FIELDS = ["Name", "Email", "Offer", "Coach", "Next Step", "Last Contact Date"]
NOTES_FIELDS  = ["Client Name", "Date", "Notes", "Coach"]


def main():
    if not CLIENTS_CSV.exists():
        sys.exit(
            f"File not found: {CLIENTS_CSV}\n"
            f"Run scripts/generate-sheets-csv.py first to produce sheets-export/clients.csv."
        )

    # Read existing client list
    with open(CLIENTS_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"Read {len(rows)} clients from {CLIENTS_CSV}")

    # Build fresh client rows — keep Name/Email/Offer/Coach, clear Next Step + Last Contact Date
    fresh_clients = []
    for row in rows:
        fresh_clients.append({
            "Name":              row.get("Name", ""),
            "Email":             row.get("Email", ""),
            "Offer":             row.get("Offer", ""),
            "Coach":             row.get("Coach", ""),
            "Next Step":         "",
            "Last Contact Date": "",
        })

    OUT_DIR.mkdir(exist_ok=True)

    fresh_clients_path = OUT_DIR / "fresh-clients.csv"
    with open(fresh_clients_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CLIENT_FIELDS)
        writer.writeheader()
        writer.writerows(fresh_clients)
    print(f"Wrote {len(fresh_clients)} client rows -> {fresh_clients_path}")

    fresh_notes_path = OUT_DIR / "fresh-notes-log.csv"
    with open(fresh_notes_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=NOTES_FIELDS)
        writer.writeheader()
        # intentionally no data rows
    print(f"Wrote headers only (0 data rows) -> {fresh_notes_path}")

    print("\nDone. Import both fresh CSVs into a new Google Sheet:")
    print("  1. Create a new blank Google Sheet")
    print("  2. Rename Sheet1 -> 'Clients', import fresh-clients.csv")
    print("  3. Add tab 'Notes Log', import fresh-notes-log.csv (headers only)")
    print("  4. Format: freeze row 1, bold headers, highlight Col E (Next Step) yellow")
    print("  5. Paste apps-script.js into Extensions -> Apps Script -> Save -> reload")
    print("  See scripts/SHEETS-SETUP.md for full instructions.")


if __name__ == "__main__":
    main()
