import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { syncEntryToOneDrive, isOneDriveConnected } from "../services/onedrive";

interface JwtPayload {
  userId: string;
  email: string;
}

interface DateParams {
  date: string;
}

interface EntryBody {
  content: string;
  tags?: string[];
}

interface EntriesQuery {
  search?: string;
  tag?: string;
  page?: string;
  limit?: string;
}

export default async function entriesRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: DateParams }>(
    "/entries/:date",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { date } = request.params;

      const entry = await prisma.logEntry.findUnique({
        where: { userId_date: { userId, date } },
      });

      if (!entry) {
        return reply.send({ date, content: "", tags: [] });
      }

      return reply.send(entry);
    }
  );

  fastify.put<{ Params: DateParams; Body: EntryBody }>(
    "/entries/:date",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { date } = request.params;
      const { content, tags = [] } = request.body;

      const entry = await prisma.logEntry.upsert({
        where: { userId_date: { userId, date } },
        update: { content, tags },
        create: { userId, date, content, tags },
      });

      // Fire-and-forget OneDrive sync (does not block the response)
      isOneDriveConnected(userId).then((connected) => {
        if (connected) {
          syncEntryToOneDrive(userId, date, content, tags).catch((err) => {
            fastify.log.error({ err }, "OneDrive sync failed for entry %s", date);
          });
        }
      });

      return reply.send(entry);
    }
  );

  fastify.get<{ Querystring: EntriesQuery }>(
    "/entries",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const {
        search,
        tag,
        page: pageStr = "1",
        limit: limitStr = "20",
      } = request.query;

      const page = Math.max(1, parseInt(pageStr, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(limitStr, 10) || 20));
      const skip = (page - 1) * limit;

      const where: {
        userId: string;
        content?: { contains: string; mode: "insensitive" };
        tags?: { has: string };
      } = { userId };

      if (search) {
        where.content = { contains: search, mode: "insensitive" };
      }

      if (tag) {
        where.tags = { has: tag };
      }

      const [entries, total] = await Promise.all([
        prisma.logEntry.findMany({
          where,
          orderBy: { date: "desc" },
          skip,
          take: limit,
        }),
        prisma.logEntry.count({ where }),
      ]);

      return reply.send({
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  );
}
