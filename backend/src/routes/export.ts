import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import archiver from "archiver";

interface JwtPayload {
  userId: string;
  email: string;
}

interface ExportQuery {
  from?: string;
  to?: string;
}

export default async function exportRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: ExportQuery }>(
    "/export",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { from, to } = request.query;

      const where: {
        userId: string;
        date?: { gte?: string; lte?: string };
      } = { userId };

      if (from || to) {
        where.date = {};
        if (from) where.date.gte = from;
        if (to) where.date.lte = to;
      }

      const entries = await prisma.logEntry.findMany({
        where,
        orderBy: { date: "asc" },
      });

      if (entries.length === 0) {
        return reply.status(404).send({ error: "No entries found in the given range" });
      }

      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        const archive = archiver("zip", { zlib: { level: 9 } });

        archive.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        archive.on("end", () => {
          resolve();
        });

        archive.on("error", (err: Error) => {
          reject(err);
        });

        for (const entry of entries) {
          const tagsLine =
            entry.tags.length > 0
              ? `tags: [${entry.tags.map((t) => `"${t}"`).join(", ")}]`
              : "tags: []";

          const markdown = `---\ndate: ${entry.date}\n${tagsLine}\n---\n\n${entry.content}\n`;
          const buffer = Buffer.from(markdown, "utf-8");

          archive.append(buffer, { name: `${entry.date}.md` });
        }

        archive.finalize();
      });

      const zipBuffer = Buffer.concat(chunks);
      const filename = `logbook-export${from ? `-from-${from}` : ""}${to ? `-to-${to}` : ""}.zip`;

      reply
        .header("Content-Type", "application/zip")
        .header("Content-Disposition", `attachment; filename="${filename}"`)
        .header("Content-Length", zipBuffer.length)
        .send(zipBuffer);
    }
  );
}
