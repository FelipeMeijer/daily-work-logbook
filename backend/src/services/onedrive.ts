import { prisma } from "../lib/prisma";

const GRAPH_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const ONEDRIVE_FOLDER = "Work Logbook";

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/**
 * Exchange or refresh tokens with Microsoft identity platform.
 */
async function fetchTokens(params: Record<string, string>): Promise<TokenResponse> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    ...params,
  });

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

/**
 * Exchange an authorization code for tokens and persist the refresh token.
 */
export async function exchangeCodeForTokens(
  userId: string,
  code: string,
  redirectUri: string,
): Promise<void> {
  const tokens = await fetchTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    scope: "offline_access Files.ReadWrite Calendars.ReadWrite",
  });

  await prisma.user.update({
    where: { id: userId },
    data: { oneDriveRefreshToken: tokens.refresh_token ?? null },
  });
}

/**
 * Get a fresh access token for a user using their stored refresh token.
 * Also persists the new refresh token if Microsoft rotates it.
 */
async function getAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.oneDriveRefreshToken) {
    throw new Error("User has not connected OneDrive");
  }

  const tokens = await fetchTokens({
    grant_type: "refresh_token",
    refresh_token: user.oneDriveRefreshToken,
    scope: "offline_access Files.ReadWrite Calendars.ReadWrite",
  });

  // Persist rotated refresh token if provided
  if (tokens.refresh_token) {
    await prisma.user.update({
      where: { id: userId },
      data: { oneDriveRefreshToken: tokens.refresh_token },
    });
  }

  return tokens.access_token;
}

/**
 * Build the markdown content for a log entry.
 */
function buildMarkdown(date: string, content: string, tags: string[]): string {
  const frontmatter = [
    "---",
    `date: ${date}`,
    tags.length > 0 ? `tags: [${tags.map((t) => `"${t}"`).join(", ")}]` : "tags: []",
    "---",
    "",
  ].join("\n");

  return frontmatter + content;
}

/**
 * Upload a log entry as a .md file to /Work Logbook/YYYY-MM-DD.md in OneDrive.
 * Creates the folder if it does not exist.
 */
export async function syncEntryToOneDrive(
  userId: string,
  date: string,
  content: string,
  tags: string[],
): Promise<void> {
  const accessToken = await getAccessToken(userId);
  const markdown = buildMarkdown(date, content, tags);
  const fileName = `${date}.md`;

  // PUT to OneDrive using the path-based upload URL (creates file or overwrites)
  const uploadUrl = `${GRAPH_BASE_URL}/me/drive/root:/${ONEDRIVE_FOLDER}/${fileName}:/content`;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "text/markdown; charset=utf-8",
    },
    body: markdown,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OneDrive upload failed for ${fileName}: ${err}`);
  }
}

/**
 * Check whether a user has a connected OneDrive account.
 */
export async function isOneDriveConnected(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return !!user?.oneDriveRefreshToken;
}

/**
 * Remove the stored OneDrive refresh token, effectively disconnecting sync.
 */
export async function disconnectOneDrive(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { oneDriveRefreshToken: null },
  });
}
