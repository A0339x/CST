import { prisma } from '../index.js';

const GHL_API_KEY = process.env.GHL_API_KEY || '';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';
const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';

interface GHLContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  timezone?: string;
  dateAdded?: string;
  lastActivity?: string;
}

interface GHLAppointment {
  id: string;
  contactId: string;
  calendarId: string;
  startTime: string;
  endTime: string;
  status: string;
  title?: string;
}

interface SyncResult {
  contactsFound: number;
  clientsUpdated: number;
  appointmentsSynced: number;
  errors: string[];
}

/**
 * Fetch contacts from Go High Level
 */
async function fetchGHLContacts(): Promise<GHLContact[]> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.warn('GHL not configured');
    return [];
  }

  try {
    const response = await fetch(`${GHL_BASE_URL}/contacts/?locationId=${GHL_LOCATION_ID}`, {
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GHL API error: ${response.status}`);
    }

    const data = await response.json();
    return data.contacts || [];
  } catch (error: any) {
    console.error('Failed to fetch GHL contacts:', error);
    throw error;
  }
}

/**
 * Fetch appointments for a contact from Go High Level
 */
async function fetchGHLAppointments(contactId: string): Promise<GHLAppointment[]> {
  if (!GHL_API_KEY) {
    return [];
  }

  try {
    const response = await fetch(
      `${GHL_BASE_URL}/contacts/${contactId}/appointments`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.appointments || [];
  } catch (error) {
    console.error(`Failed to fetch appointments for contact ${contactId}:`, error);
    return [];
  }
}

/**
 * Sync contacts and appointments from Go High Level
 */
export async function syncFromGHL(): Promise<SyncResult> {
  const result: SyncResult = {
    contactsFound: 0,
    clientsUpdated: 0,
    appointmentsSynced: 0,
    errors: [],
  };

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    result.errors.push('GHL API not configured. Set GHL_API_KEY and GHL_LOCATION_ID.');
    return result;
  }

  try {
    // Fetch all contacts from GHL
    const contacts = await fetchGHLContacts();
    result.contactsFound = contacts.length;

    // Get all clients from database
    const clients = await prisma.client.findMany({
      where: { isDeleted: false },
      select: { id: true, email: true, ghlContactId: true },
    });

    // Create email lookup map
    const clientsByEmail = new Map(
      clients.map((c) => [c.email.toLowerCase(), c])
    );

    // Process each GHL contact
    for (const contact of contacts) {
      if (!contact.email) continue;

      const email = contact.email.toLowerCase();
      const client = clientsByEmail.get(email);

      if (!client) continue; // No matching client in our system

      try {
        // Fetch appointments for this contact
        const appointments = await fetchGHLAppointments(contact.id);

        // Upsert each appointment into the database
        for (const appt of appointments) {
          await prisma.appointment.upsert({
            where: { ghlAppointmentId: appt.id },
            update: {
              title: appt.title || '',
              status: appt.status,
              startTime: new Date(appt.startTime),
              endTime: new Date(appt.endTime),
              calendarId: appt.calendarId || null,
            },
            create: {
              ghlAppointmentId: appt.id,
              clientId: client.id,
              title: appt.title || '',
              status: appt.status,
              startTime: new Date(appt.startTime),
              endTime: new Date(appt.endTime),
              calendarId: appt.calendarId || null,
            },
          });
          result.appointmentsSynced++;
        }

        // Find the most recent completed appointment for lastContactDate
        const completedAppointments = appointments
          .filter((a) => a.status === 'confirmed' || a.status === 'completed')
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

        const lastAppointment = completedAppointments[0];

        // Update client with GHL data
        const updateData: any = {
          ghlContactId: contact.id,
        };

        if (lastAppointment) {
          updateData.lastContactDate = new Date(lastAppointment.startTime);
        }

        if (contact.timezone) {
          updateData.timezone = contact.timezone;
        }

        await prisma.client.update({
          where: { id: client.id },
          data: updateData,
        });

        result.clientsUpdated++;
      } catch (error: any) {
        result.errors.push(`Error syncing ${email}: ${error.message}`);
      }
    }

    return result;
  } catch (error: any) {
    result.errors.push(`Sync failed: ${error.message}`);
    return result;
  }
}

/**
 * Get GHL contact by email
 */
export async function getGHLContactByEmail(email: string): Promise<GHLContact | null> {
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return null;
  }

  try {
    const response = await fetch(
      `${GHL_BASE_URL}/contacts/lookup?email=${encodeURIComponent(email)}&locationId=${GHL_LOCATION_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.contacts?.[0] || null;
  } catch (error) {
    console.error('Failed to lookup GHL contact:', error);
    return null;
  }
}

/**
 * Sync a single client with GHL
 */
export async function syncClientWithGHL(clientId: string): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { email: true },
  });

  if (!client) {
    return false;
  }

  const contact = await getGHLContactByEmail(client.email);

  if (!contact) {
    return false;
  }

  const appointments = await fetchGHLAppointments(contact.id);

  // Upsert each appointment
  for (const appt of appointments) {
    await prisma.appointment.upsert({
      where: { ghlAppointmentId: appt.id },
      update: {
        title: appt.title || '',
        status: appt.status,
        startTime: new Date(appt.startTime),
        endTime: new Date(appt.endTime),
        calendarId: appt.calendarId || null,
      },
      create: {
        ghlAppointmentId: appt.id,
        clientId,
        title: appt.title || '',
        status: appt.status,
        startTime: new Date(appt.startTime),
        endTime: new Date(appt.endTime),
        calendarId: appt.calendarId || null,
      },
    });
  }

  const lastAppointment = appointments
    .filter((a) => a.status === 'confirmed' || a.status === 'completed')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];

  await prisma.client.update({
    where: { id: clientId },
    data: {
      ghlContactId: contact.id,
      lastContactDate: lastAppointment ? new Date(lastAppointment.startTime) : undefined,
      timezone: contact.timezone || undefined,
    },
  });

  return true;
}
