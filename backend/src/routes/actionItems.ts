import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

interface JwtPayload {
  userId: string;
  email: string;
}

interface CreateActionItemBody {
  text: string;
}

interface UpdateActionItemBody {
  completed?: boolean;
  text?: string;
}

interface ActionItemParams {
  id: string;
}

export default async function actionItemsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/action-items",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;

      const items = await prisma.actionItem.findMany({
        where: { userId },
        orderBy: [
          { completed: "asc" },
          { createdAt: "desc" },
        ],
      });

      return reply.send(items);
    }
  );

  fastify.post<{ Body: CreateActionItemBody }>(
    "/action-items",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { text } = request.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return reply.status(400).send({ error: "Text is required" });
      }

      const item = await prisma.actionItem.create({
        data: { userId, text: text.trim() },
      });

      return reply.status(201).send(item);
    }
  );

  fastify.patch<{ Params: ActionItemParams; Body: UpdateActionItemBody }>(
    "/action-items/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;
      const { completed, text } = request.body;

      const existing = await prisma.actionItem.findUnique({ where: { id } });

      if (!existing || existing.userId !== userId) {
        return reply.status(404).send({ error: "Action item not found" });
      }

      const updateData: { completed?: boolean; text?: string } = {};
      if (typeof completed === "boolean") updateData.completed = completed;
      if (typeof text === "string" && text.trim().length > 0) updateData.text = text.trim();

      const item = await prisma.actionItem.update({
        where: { id },
        data: updateData,
      });

      return reply.send(item);
    }
  );

  fastify.delete<{ Params: ActionItemParams }>(
    "/action-items/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      const existing = await prisma.actionItem.findUnique({ where: { id } });

      if (!existing || existing.userId !== userId) {
        return reply.status(404).send({ error: "Action item not found" });
      }

      await prisma.actionItem.delete({ where: { id } });

      return reply.status(204).send();
    }
  );
}
