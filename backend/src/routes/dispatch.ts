import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { syncEntryToOneDrive, isOneDriveConnected } from "../services/onedrive";
import { format } from "date-fns";

interface DispatchBody {
  content: string;
  tags?: string[];
  date?: string; // YYYY-MM-DD, defaults to today
  append?: boolean; // if true, append to existing entry instead of overwrite
}

function requireApiKey(apiKey: string | undefined): boolean {
  const expected = process.env.DISPATCH_API_KEY;
  if (!expected) return false;
  return apiKey === expected;
}

export default async function dispatchRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /dispatch — Create or append to a log entry from an external source (e.g. Claude Code).
   * Auth: Bearer token using DISPATCH_API_KEY env var.
   * The dispatch key is shared across all users; the target user is determined by
   * DISPATCH_USER_EMAIL env var.
   */
  fastify.post<{ Body: DispatchBody }>(
    "/dispatch",
    async (request, reply) => {
      // API key auth
      const authHeader = request.headers.authorization ?? "";
      const apiKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

      if (!requireApiKey(apiKey)) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      // Look up target user
      const targetEmail = process.env.DISPATCH_USER_EMAIL;
      if (!targetEmail) {
        return reply.status(500).send({ error: "DISPATCH_USER_EMAIL is not configured" });
      }

      const user = await prisma.user.findUnique({ where: { email: targetEmail } });
      if (!user) {
        return reply.status(404).send({ error: `User ${targetEmail} not found` });
      }

      const { content, tags = [], date, append = true } = request.body;

      if (!content?.trim()) {
        return reply.status(400).send({ error: "content is required" });
      }

      const targetDate = date ?? format(new Date(), "yyyy-MM-dd");

      // Upsert: if append=true and existing entry exists, append content
      let finalContent = content;
      if (append) {
        const existing = await prisma.logEntry.findUnique({
          where: { userId_date: { userId: user.id, date: targetDate } },
        });
        if (existing?.content) {
          finalContent = existing.content.trimEnd() + "\n\n" + content;
        }
      }

      const entry = await prisma.logEntry.upsert({
        where: { userId_date: { userId: user.id, date: targetDate } },
        update: { content: finalContent, tags },
        create: { userId: user.id, date: targetDate, content: finalContent, tags },
      });

      // Fire-and-forget OneDrive sync
      isOneDriveConnected(user.id).then((connected) => {
        if (connected) {
          syncEntryToOneDrive(user.id, targetDate, finalContent, tags).catch((err) => {
            fastify.log.error({ err }, "OneDrive sync failed after dispatch");
          });
        }
      });

      return reply.status(200).send({ ok: true, entry });
    }
  );
}
