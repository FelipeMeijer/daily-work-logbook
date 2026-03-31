import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { format } from "date-fns";

interface JwtPayload {
  userId: string;
  email: string;
}

interface DateParams {
  date: string;
}

export default async function checkinRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/checkin",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date();

      const checkIn = await prisma.checkIn.upsert({
        where: { userId_date: { userId, date: today } },
        update: { startTime: now },
        create: { userId, date: today, startTime: now },
      });

      return reply.send(checkIn);
    }
  );

  fastify.post(
    "/checkout",
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;
      const today = format(new Date(), "yyyy-MM-dd");
      const now = new Date();

      const checkIn = await prisma.checkIn.upsert({
        where: { userId_date: { userId, date: today } },
        update: { endTime: now },
        create: { userId, date: today, endTime: now },
      });

      return reply.send(checkIn);
    }
  );

  fastify.get<{ Params: DateParams }>(
    "/checkin/:date",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { date } = request.params;

      const checkIn = await prisma.checkIn.findUnique({
        where: { userId_date: { userId, date } },
      });

      if (!checkIn) {
        return reply.send({ userId, date, startTime: null, endTime: null });
      }

      return reply.send(checkIn);
    }
  );
}
