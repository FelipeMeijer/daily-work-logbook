import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../middleware/auth";
import {
  exchangeCodeForTokens,
  isOneDriveConnected,
  disconnectOneDrive,
} from "../services/onedrive";

interface JwtPayload {
  userId: string;
  email: string;
}

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

function getRedirectUri(): string {
  return `${process.env.APP_URL}/onedrive/callback`;
}

function getAuthUrl(state: string): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID is not set");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: "offline_access Files.ReadWrite Calendars.ReadWrite",
    state,
    response_mode: "query",
  });

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

export default async function oneDriveRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /onedrive/status — check if current user has OneDrive connected
   */
  fastify.get(
    "/onedrive/status",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;
      const connected = await isOneDriveConnected(userId);
      return reply.send({ connected });
    },
  );

  /**
   * GET /onedrive/auth — redirect user to Microsoft OAuth consent page
   * The JWT is passed as `state` so we can identify the user in the callback.
   */
  fastify.get(
    "/onedrive/auth",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;
      // Use userId as state (simple; for production, use a signed nonce)
      const authUrl = getAuthUrl(userId);
      return reply.redirect(authUrl);
    },
  );

  /**
   * GET /onedrive/callback — Microsoft redirects here after user consent
   */
  fastify.get<{ Querystring: CallbackQuery }>(
    "/onedrive/callback",
    async (request, reply) => {
      const { code, state, error, error_description } = request.query;

      if (error || !code || !state) {
        const msg = error_description ?? error ?? "Authorization failed";
        return reply
          .status(400)
          .send(`<h2>OneDrive connection failed</h2><p>${msg}</p><p>You can close this window.</p>`);
      }

      try {
        const userId = state; // state carries userId
        await exchangeCodeForTokens(userId, code, getRedirectUri());
        return reply
          .type("text/html")
          .send("<h2>OneDrive connected!</h2><p>You can close this window and return to the app.</p>");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return reply
          .status(500)
          .send(`<h2>Connection error</h2><p>${msg}</p>`);
      }
    },
  );

  /**
   * DELETE /onedrive/disconnect — remove stored refresh token
   */
  fastify.delete(
    "/onedrive/disconnect",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;
      await disconnectOneDrive(userId);
      return reply.send({ message: "OneDrive disconnected" });
    },
  );
}
