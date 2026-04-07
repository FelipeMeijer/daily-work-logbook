import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { requireAuth } from "../middleware/auth";
import {
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
} from "../services/outlook-calendar";

interface JwtPayload {
  userId: string;
  email: string;
}

interface CalendarQuery {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

interface CreateEventBody {
  subject: string;
  start: string;   // ISO datetime
  end: string;     // ISO datetime
  timeZone?: string;
}

interface EventParams {
  id: string;
}

export default async function calendarRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD
   */
  fastify.get<{ Querystring: CalendarQuery }>(
    "/calendar/events",
    { preHandler: requireAuth },
    async (request: FastifyRequest<{ Querystring: CalendarQuery }>, reply: FastifyReply) => {
      const { userId } = request.user as JwtPayload;
      const { start, end } = request.query;

      if (!start || !end) {
        return reply.status(400).send({ error: "start and end query params are required (YYYY-MM-DD)" });
      }

      try {
        const events = await getCalendarEvents(userId, start, end);
        return reply.send(events);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("not connected")) {
          return reply.status(400).send({ error: "Microsoft account not connected" });
        }
        fastify.log.error({ err }, "Failed to fetch calendar events");
        return reply.status(502).send({ error: "Failed to fetch calendar events" });
      }
    }
  );

  /**
   * POST /calendar/events
   */
  fastify.post<{ Body: CreateEventBody }>(
    "/calendar/events",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { subject, start, end, timeZone } = request.body;

      if (!subject || !start || !end) {
        return reply.status(400).send({ error: "subject, start, and end are required" });
      }

      try {
        const event = await createCalendarEvent(userId, subject, start, end, timeZone);
        return reply.status(201).send(event);
      } catch (err) {
        fastify.log.error({ err }, "Failed to create calendar event");
        return reply.status(502).send({ error: "Failed to create calendar event" });
      }
    }
  );

  /**
   * DELETE /calendar/events/:id
   */
  fastify.delete<{ Params: EventParams }>(
    "/calendar/events/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { userId } = request.user as JwtPayload;
      const { id } = request.params;

      try {
        await deleteCalendarEvent(userId, id);
        return reply.status(204).send();
      } catch (err) {
        fastify.log.error({ err }, "Failed to delete calendar event");
        return reply.status(502).send({ error: "Failed to delete calendar event" });
      }
    }
  );
}
