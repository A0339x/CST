"""
import-milestones.py
Replaces dummy curriculum steps with 15 real milestones from the
FINAL Milestone Report sheet and populates client progress with
actual completion dates.

Source: "FINAL Milestone Report" sheet
  Col 0 = Client Name
  Col 1 = Milestone Name
  Col 2 = Start Date   (ignored)
  Col 3 = Completion Date
"""

import sqlite3
import uuid
import os
import re
from collections import defaultdict
from datetime import datetime, timezone

try:
    import openpyxl
except ImportError:
    print("ERROR: openpyxl not installed. Run: pip install openpyxl")
    raise

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(SCRIPT_DIR)
XLSX_PATH  = os.path.join(REPO_ROOT, "Client Data", "All-Client-Data-Updated.xlsx")
DB_PATH    = os.path.join(REPO_ROOT, "server", "prisma", "dev.db")

# Milestones in curriculum order (frequency-based ordering from the data)
MILESTONES = [
    "Onboarding. Bookmarks. CEX. Metamask. Koinly.",
    "Funding the Exchange",
    "Sending Money Safely + What Are Networks and Gas Tokens",
    "What are Liquidity Positions + TVL, Volume, TVL Optimizer",
    "Opening and Adjusting Liquidity Positions",
    "Average Volume",
    "Position Admin. Harvesting, Compounding, Add, Remove",
    "Correlations",
    "Setting Range",
    "Asset Selection",
    "Rebalancing",
    "Strategies Page",
    "More Advanced Websites. Vfat, Raydium, Orca, Phantom Wallet",
    "Build Long-term Portfolio (bull run)/ Asset Selection in Portfolio",
    "Lending Networks",
]

def new_id():
    return str(uuid.uuid4()).replace("-", "")[:25]

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def parse_date(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val.astimezone(timezone.utc)
    s = str(val).strip()
    m = re.match(r"(\d{4}-\d{2}-\d{2})", s)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None

def main():
    if not os.path.exists(XLSX_PATH):
        print(f"ERROR: xlsx not found at {XLSX_PATH}")
        return
    if not os.path.exists(DB_PATH):
        print(f"ERROR: database not found at {DB_PATH}")
        return

    print(f"Opening {XLSX_PATH} ...")
    wb = openpyxl.load_workbook(XLSX_PATH, read_only=True, data_only=True)

    # -------------------------------------------------------------------
    # Read FINAL Milestone Report → client → {milestone_name: completion_date}
    # -------------------------------------------------------------------
    print("Reading FINAL Milestone Report ...")
    ws = wb["FINAL Milestone Report"]
    milestone_index = {name: i for i, name in enumerate(MILESTONES)}

    # client_completions[name_lower][milestone_index] = earliest completion date
    client_completions = defaultdict(dict)

    skipped_unknown = set()
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or not row[0]:
            continue
        client_name = str(row[0]).strip()
        milestone_name = str(row[1]).strip() if row[1] else None
        completion_date = parse_date(row[3])

        if not milestone_name or milestone_name == "#N/A" or not completion_date:
            continue

        idx = milestone_index.get(milestone_name)
        if idx is None:
            skipped_unknown.add(milestone_name)
            continue

        key = client_name.lower()
        # Keep earliest completion date if duplicates exist
        if idx not in client_completions[key] or completion_date < client_completions[key][idx]:
            client_completions[key][idx] = completion_date

    clients_with_data = len(client_completions)
    total_completions = sum(len(v) for v in client_completions.values())
    print(f"  {clients_with_data} clients with milestone completions, {total_completions} total records.")
    if skipped_unknown:
        print(f"  Skipped unrecognized milestone names: {skipped_unknown}")

    wb.close()

    # -------------------------------------------------------------------
    # Connect to DB, replace curriculum steps
    # -------------------------------------------------------------------
    print(f"Connecting to {DB_PATH} ...")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    print(f"Replacing curriculum steps with {len(MILESTONES)} real milestones ...")
    cur.execute("DELETE FROM client_progress")
    cur.execute("DELETE FROM curriculum_steps")

    ts = now_iso()
    step_ids = []
    for i, title in enumerate(MILESTONES):
        step_id = f"milestone-{i+1}"
        cur.execute(
            "INSERT INTO curriculum_steps (id, title, \"order\", createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
            (step_id, title, i, ts, ts)
        )
        step_ids.append(step_id)
    con.commit()

    # -------------------------------------------------------------------
    # Insert client_progress rows
    # -------------------------------------------------------------------
    print("Inserting client progress records ...")
    clients = cur.execute("SELECT id, name FROM clients").fetchall()

    inserted = 0
    matched  = 0

    for client_id, client_name in clients:
        name_key = client_name.strip().lower()
        completions = client_completions.get(name_key, {})

        if completions:
            matched += 1

        for i, step_id in enumerate(step_ids):
            prog_id = new_id()
            comp_date = completions.get(i)
            is_completed = 1 if comp_date else 0
            completed_at = comp_date.isoformat() if comp_date else None

            cur.execute(
                "INSERT INTO client_progress "
                "(id, isCompleted, completedAt, createdAt, updatedAt, clientId, stepId) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (prog_id, is_completed, completed_at, ts, ts, client_id, step_id)
            )
            inserted += 1

        if inserted % (15 * 50) == 0 and inserted > 0:
            con.commit()

    con.commit()
    con.close()

    print()
    print("=" * 50)
    print(f"Milestones import complete!")
    print(f"  Curriculum steps       : {len(MILESTONES)}")
    print(f"  Progress rows inserted : {inserted}")
    print(f"  Clients with data      : {matched}/{len(clients)}")
    print(f"  Clients with 0 progress: {len(clients) - matched}")

if __name__ == "__main__":
    main()
