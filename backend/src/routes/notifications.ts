import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

interface JwtPayload {
  userId: string;
  email: string;
}

interface RegisterPushBody {
  pushToken: string;
}

export default async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: RegisterPushBody }>(
    "/notifications/register",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { pushToken } = request.body;

      if (!pushToken || typeof pushToken !== "string" || pushToken.trim().length === 0) {
        return reply.status(400).send({ error: "pushToken is required" });
      }

      const user = await prisma.user.update({
        where: { id: userId },
        data: { pushToken: pushToken.trim() },
        select: { id: true, email: true, pushToken: true },
      });

      return reply.send({ message: "Push token registered", user });
    }
  );
}
