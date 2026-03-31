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

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? { target: "pino-pretty" }
        : undefined,
  },
});

async function bootstrap(): Promise<void> {
  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register JWT
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET environment variable is required");
  }

  await fastify.register(jwt, {
    secret: jwtSecret,
  });

  // Health check
  fastify.get("/health", async () => {
    return { status: "ok" };
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

  const port = parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "0.0.0.0";

  await fastify.listen({ port, host });
  fastify.log.info(`Server listening on ${host}:${port}`);
}

bootstrap().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
