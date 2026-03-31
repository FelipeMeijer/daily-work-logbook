import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import crypto from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface MagicLinkBody {
  email: string;
}

interface VerifyBody {
  token: string;
}

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post(
    "/auth/magic-link",
    async (
      request: FastifyRequest<{ Body: MagicLinkBody }>,
      reply: FastifyReply
    ) => {
      const { email } = request.body;

      if (!email || typeof email !== "string") {
        return reply.status(400).send({ error: "Valid email is required" });
      }

      const normalizedEmail = email.trim().toLowerCase();

      let user = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (!user) {
        user = await prisma.user.create({
          data: { email: normalizedEmail },
        });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.magicLink.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      const magicLinkUrl = `${appUrl}?token=${token}`;
      const fromEmail = process.env.FROM_EMAIL ?? "noreply@yourdomain.com";

      await resend.emails.send({
        from: fromEmail,
        to: normalizedEmail,
        subject: "Your Daily Work Logbook login link",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Sign in to Daily Work Logbook</h2>
            <p>Click the link below to sign in. This link will expire in 15 minutes.</p>
            <a
              href="${magicLinkUrl}"
              style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;"
            >
              Sign In
            </a>
            <p style="margin-top:24px;color:#6B7280;font-size:14px;">
              If you did not request this email, you can safely ignore it.
            </p>
          </div>
        `,
      });

      return reply.send({ message: "Check your email" });
    }
  );

  fastify.post(
    "/auth/verify",
    async (
      request: FastifyRequest<{ Body: VerifyBody }>,
      reply: FastifyReply
    ) => {
      const { token } = request.body;

      if (!token || typeof token !== "string") {
        return reply.status(400).send({ error: "Token is required" });
      }

      const magicLink = await prisma.magicLink.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!magicLink) {
        return reply.status(400).send({ error: "Invalid token" });
      }

      if (magicLink.used) {
        return reply.status(400).send({ error: "Token has already been used" });
      }

      if (new Date() > magicLink.expiresAt) {
        return reply.status(400).send({ error: "Token has expired" });
      }

      await prisma.magicLink.update({
        where: { id: magicLink.id },
        data: { used: true },
      });

      const jwt = fastify.jwt.sign(
        { userId: magicLink.user.id, email: magicLink.user.email },
        { expiresIn: "30d" }
      );

      return reply.send({ token: jwt, user: { id: magicLink.user.id, email: magicLink.user.email, name: magicLink.user.name } });
    }
  );
}
