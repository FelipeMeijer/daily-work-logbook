import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { format } from "date-fns";

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
}

interface ExpoPushResponse {
  data: Array<{ status: string; id?: string; message?: string; details?: unknown }>;
}

async function sendExpoPushNotification(messages: ExpoPushMessage[]): Promise<ExpoPushResponse> {
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    throw new Error(`Expo push API responded with status ${response.status}`);
  }

  return response.json() as Promise<ExpoPushResponse>;
}

export default async function cronRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/cron/remind",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const cronSecret = process.env.CRON_SECRET;
      const providedSecret = request.headers["x-cron-secret"];

      if (!cronSecret || providedSecret !== cronSecret) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const today = format(new Date(), "yyyy-MM-dd");

      // Get all users who have a pushToken set
      const usersWithTokens = await prisma.user.findMany({
        where: {
          pushToken: { not: null },
        },
        select: {
          id: true,
          pushToken: true,
          entries: {
            where: { date: today },
            select: { content: true },
          },
        },
      });

      // Filter to users who have no entry today or have an empty entry
      const usersToRemind = usersWithTokens.filter((user) => {
        const todayEntry = user.entries[0];
        return !todayEntry || todayEntry.content.trim().length === 0;
      });

      if (usersToRemind.length === 0) {
        return reply.send({ sent: 0, message: "No reminders needed" });
      }

      const messages: ExpoPushMessage[] = usersToRemind
        .filter((u): u is typeof u & { pushToken: string } => u.pushToken !== null)
        .map((user) => ({
          to: user.pushToken,
          title: "Work Logbook",
          body: "Write down what you did today.",
        }));

      // Send in batches of 100 (Expo limit)
      const batchSize = 100;
      let totalSent = 0;

      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        try {
          await sendExpoPushNotification(batch);
          totalSent += batch.length;
        } catch (err) {
          fastify.log.error({ err }, `Failed to send push notification batch starting at index ${i}`);
        }
      }

      return reply.send({ sent: totalSent });
    }
  );
}
