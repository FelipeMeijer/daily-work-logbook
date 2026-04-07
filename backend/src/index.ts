import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";

import authRoutes from "./routes/auth";
import entriesRoutes from "./routes/entries";
import checkinRoutes from "./routes/checkin";
import actionItemsRoutes from "./routes/actionItems";
import notificationsRoutes from "./routes/notifications";
import exportRoutes from "./routes/export";
import cronRoutes from "./routes/cron";
import oneDriveRoutes from "./routes/onedrive";
import dispatchRoutes from "./routes/dispatch";
import calendarRoutes from "./routes/calendar";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
  },
});

async function bootstrap(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  console.log(`Starting server on ${host}:${port}`);
  console.log(`NODE_ENV=${process.env.NODE_ENV}`);
  console.log(`DATABASE_URL set: ${!!process.env.DATABASE_URL}`);
  console.log(`JWT_SECRET set: ${!!process.env.JWT_SECRET}`);

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required. Set it in Railway variables.");
  }

  await fastify.register(jwt, {
    secret: jwtSecret,
  });

  // Health check — registered before other routes so it always works
  fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Register routes
  await fastify.register(authRoutes);
  await fastify.register(entriesRoutes);
  await fastify.register(checkinRoutes);
  await fastify.register(actionItemsRoutes);
  await fastify.register(notificationsRoutes);
  await fastify.register(exportRoutes);
  await fastify.register(cronRoutes);
  await fastify.register(oneDriveRoutes);
  await fastify.register(dispatchRoutes);
  await fastify.register(calendarRoutes);

  await fastify.listen({ port, host });
  console.log(`Server listening on ${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
