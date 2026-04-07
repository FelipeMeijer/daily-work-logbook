import { prisma } from "../lib/prisma";

const GRAPH_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export interface OutlookEvent {
  id: string;
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay: boolean;
  bodyPreview: string;
}

async function fetchTokens(params: Record<string, string>): Promise<TokenResponse> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params });

  const res = await fetch(GRAPH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token request failed: ${err}`);
  }

  return res.json() as Promise<TokenResponse>;
}

async function getAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.oneDriveRefreshToken) {
    throw new Error("User has not connected Microsoft account");
  }

  const tokens = await fetchTokens({
    grant_type: "refresh_token",
    refresh_token: user.oneDriveRefreshToken,
    scope: "offline_access Files.ReadWrite Calendars.ReadWrite",
  });

  if (tokens.refresh_token) {
    await prisma.user.update({
      where: { id: userId },
      data: { oneDriveRefreshToken: tokens.refresh_token },
    });
  }

  return tokens.access_token;
}

/**
 * Fetch calendar events for a date range (ISO strings).
 */
export async function getCalendarEvents(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<OutlookEvent[]> {
  const accessToken = await getAccessToken(userId);

  const params = new URLSearchParams({
    startDateTime: `${startDate}T00:00:00`,
    endDateTime: `${endDate}T23:59:59`,
    $orderby: "start/dateTime",
    $select: "id,subject,start,end,isAllDay,bodyPreview",
    $top: "100",
  });

  const res = await fetch(`${GRAPH_BASE_URL}/me/calendarView?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch calendar events: ${err}`);
  }

  const data = await res.json() as { value: OutlookEvent[] };
  return data.value;
}

/**
 * Create a calendar event.
 */
export async function createCalendarEvent(
  userId: string,
  subject: string,
  start: string, // ISO datetime
  end: string,   // ISO datetime
  timeZone = "UTC",
): Promise<OutlookEvent> {
  const accessToken = await getAccessToken(userId);

  const body = {
    subject,
    start: { dateTime: start, timeZone },
    end: { dateTime: end, timeZone },
  };

  const res = await fetch(`${GRAPH_BASE_URL}/me/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create calendar event: ${err}`);
  }

  return res.json() as Promise<OutlookEvent>;
}

/**
 * Delete a calendar event.
 */
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  const accessToken = await getAccessToken(userId);

  const res = await fetch(`${GRAPH_BASE_URL}/me/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete calendar event: ${err}`);
  }
}
