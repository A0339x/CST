/**
 * seed-clients.ts
 *
 * Wipes all client data and re-imports from Client-data.json.
 * Run from the server directory:
 *   npx tsx prisma/seed-clients.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Real coaches found in the data
// ---------------------------------------------------------------------------
const REAL_COACHES = [
  { name: 'Greg Esman',    email: 'greg@mastermind.com' },
  { name: 'Brandon Hofer', email: 'brandon@mastermind.com' },
  { name: 'David',         email: 'david@mastermind.com' },
  { name: 'Dennis',        email: 'dennis@mastermind.com' },
  { name: 'Shane',         email: 'shane@mastermind.com' },
];

// ---------------------------------------------------------------------------
// Types matching Client-data.json
// ---------------------------------------------------------------------------
interface CallEntry {
  date: string | null;
  notes: string | null;
  coach: string | null;
}

interface MilestoneEntry {
  milestone_name: string | null;
  start_date: string | null;
  completion_date: string | null;
  status: 'In Progress' | 'Completed';
}

interface ClientRecord {
  name: string;
  email: string | null;
  offer: string | null;
  current_milestone: string | null;
  call_history: CallEntry[];
  milestones: MilestoneEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('=== Real Client Seed ===\n');

  // -------------------------------------------------------------------------
  // 1. Load JSON
  // -------------------------------------------------------------------------
  const jsonPath = path.resolve(__dirname, '../../Client-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`Client-data.json not found at: ${jsonPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const { clients }: { clients: ClientRecord[] } = JSON.parse(raw);
  console.log(`Loaded ${clients.length} clients from JSON\n`);

  // -------------------------------------------------------------------------
  // 2. Wipe all client-related tables (cascade handles children)
  // -------------------------------------------------------------------------
  console.log('Wiping existing client data...');
  await prisma.note.deleteMany();
  await prisma.clientProgress.deleteMany();
  await prisma.outcome.deleteMany();
  await prisma.clientTag.deleteMany();
  await prisma.customFieldValue.deleteMany();
  await prisma.client.deleteMany();
  console.log('  Done.\n');

  // -------------------------------------------------------------------------
  // 3. Ensure real coaches exist
  // -------------------------------------------------------------------------
  console.log('Upserting coach users...');
  const coachPassword = await bcrypt.hash('coach123', 12);
  const coachMap: Map<string, string> = new Map(); // name (lowercase) -> userId

  for (const coach of REAL_COACHES) {
    const user = await prisma.user.upsert({
      where: { email: coach.email },
      update: { name: coach.name },
      create: {
        email: coach.email,
        passwordHash: coachPassword,
        name: coach.name,
        role: 'COACH',
      },
    });
    // Map both full name and first name (for entries that only recorded first name)
    coachMap.set(coach.name.toLowerCase(), user.id);
    const firstName = coach.name.split(' ')[0].toLowerCase();
    if (!coachMap.has(firstName)) {
      coachMap.set(firstName, user.id);
    }
    console.log(`  Upserted: ${coach.name} (${coach.email})`);
  }

  // Default coach = Greg Esman
  const defaultCoachId = coachMap.get('greg esman')!;

  // -------------------------------------------------------------------------
  // 4. Get curriculum steps (needed for ClientProgress)
  // -------------------------------------------------------------------------
  const steps = await prisma.curriculumStep.findMany({ orderBy: { order: 'asc' } });

  // -------------------------------------------------------------------------
  // 5. Import clients
  // -------------------------------------------------------------------------
  console.log(`\nImporting ${clients.length} clients...\n`);

  let imported = 0;
  let skipped = 0;
  const seenEmails = new Set<string>();

  for (const c of clients) {
    // Build a unique email — use real one if present, else generate placeholder
    let email = c.email?.trim() || `unknown-${slugify(c.name)}@placeholder.com`;

    // Guard against duplicate emails in the source data
    if (seenEmails.has(email.toLowerCase())) {
      console.warn(`  SKIP (duplicate email): ${c.name} <${email}>`);
      skipped++;
      continue;
    }
    seenEmails.add(email.toLowerCase());

    // Determine last contact date from most recent dated call entry
    const datedEntries = c.call_history.filter(h => h.date);
    const lastContactDate = datedEntries.length > 0
      ? parseDate(datedEntries[datedEntries.length - 1].date)
      : null;

    // Assign coach: use the coach from the most recent call, fallback to Greg
    let assignedCoachId = defaultCoachId;
    for (let i = c.call_history.length - 1; i >= 0; i--) {
      const coachName = c.call_history[i].coach?.toLowerCase();
      if (coachName && coachMap.has(coachName)) {
        assignedCoachId = coachMap.get(coachName)!;
        break;
      }
    }

    // Tags: offer as a tag if present
    const tags: string[] = [];
    if (c.offer) tags.push(c.offer);
    if (c.current_milestone) tags.push(`Milestone: ${c.current_milestone}`);

    try {
      const client = await prisma.client.create({
        data: {
          name: c.name,
          email,
          status: 'ACTIVE',
          onboardingStatus: 'COMPLETED',
          lastContactDate,
          coachId: assignedCoachId,
          tags: tags.length > 0 ? { create: tags.map(name => ({ name })) } : undefined,
          outcome: {
            create: {
              reviewStatus: 'POTENTIAL',
              endorsementStatus: 'POTENTIAL',
              innerCircleStatus: 'POTENTIAL',
            },
          },
          progress: steps.length > 0
            ? { create: steps.map(step => ({ stepId: step.id, isCompleted: false })) }
            : undefined,
        },
      });

      // -----------------------------------------------------------------------
      // Notes: call_history entries
      // -----------------------------------------------------------------------
      for (const entry of c.call_history) {
        if (!entry.notes?.trim()) continue;

        // Resolve author
        let authorId = assignedCoachId;
        if (entry.coach) {
          const key = entry.coach.toLowerCase();
          if (coachMap.has(key)) authorId = coachMap.get(key)!;
        }

        const createdAt = parseDate(entry.date) ?? new Date();

        await prisma.note.create({
          data: {
            clientId: client.id,
            authorId,
            content: entry.notes.trim(),
            tags: JSON.stringify(['Call Notes']),
            createdAt,
          },
        });
      }

      // -----------------------------------------------------------------------
      // Notes: milestones (stored as notes with Milestone tag)
      // -----------------------------------------------------------------------
      for (const m of c.milestones) {
        if (!m.milestone_name) continue;

        const startDate = parseDate(m.start_date);
        const completionDate = parseDate(m.completion_date);

        let content = `Milestone: ${m.milestone_name}\nStatus: ${m.status}`;
        if (startDate) content += `\nStarted: ${startDate.toISOString().split('T')[0]}`;
        if (completionDate) content += `\nCompleted: ${completionDate.toISOString().split('T')[0]}`;

        await prisma.note.create({
          data: {
            clientId: client.id,
            authorId: assignedCoachId,
            content,
            tags: JSON.stringify(['Milestone']),
            createdAt: startDate ?? new Date(),
          },
        });
      }

      imported++;
      if (imported % 50 === 0) {
        console.log(`  ${imported}/${clients.length} clients imported...`);
      }
    } catch (err: any) {
      if (err.code === 'P2002') {
        console.warn(`  SKIP (constraint): ${c.name} <${email}>`);
        skipped++;
      } else {
        throw err;
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. Summary
  // -------------------------------------------------------------------------
  const totalClients = await prisma.client.count();
  const totalNotes = await prisma.note.count();

  console.log(`\n=== Done ===`);
  console.log(`  Imported : ${imported} clients`);
  console.log(`  Skipped  : ${skipped} clients`);
  console.log(`  Total in DB: ${totalClients} clients, ${totalNotes} notes`);
  console.log(`\nCoach logins (password: coach123):`);
  for (const coach of REAL_COACHES) {
    console.log(`  ${coach.name.padEnd(16)} ${coach.email}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
