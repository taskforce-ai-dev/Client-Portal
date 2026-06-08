import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import Anthropic from "@anthropic-ai/sdk";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type {
  AdminRole,
  AnnouncementAudience,
  AnnouncementSeverity,
  NotificationEventType,
  SupportTicketPriority,
  SupportTicketStatus,
  WorkspaceStatus,
} from "@prisma/client";
import { SessionSubject } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";

import { env } from "./lib/env.js";
import { prisma } from "./lib/prisma.js";
import {
  ADMIN_COOKIE,
  PORTAL_COOKIE,
  cookieOptions,
  createSession,
  loadAdminFromSession,
  loadTeamMemberFromSession,
  revokeSession,
  verifyPassword,
} from "./lib/auth.js";
import { createPrefixedId, DEFAULT_WORKSPACE_ID } from "./lib/utils.js";
import {
  getAgents,
  getAnalytics,
  getBilling,
  getKnowledgeBase,
  getKnowledgeBaseDocument,
  getOverview,
  getSettings,
  getTranscript,
  getTranscripts,
  updateNotificationRule,
  updateWorkspace,
} from "./services/dashboard.js";
import { ingestAgentWebhook } from "./services/ingest.js";
import { sendTestWebhook } from "./services/webhooks.js";
import {
  createClient,
  createPlan,
  deactivateAdmin,
  deleteClient,
  deletePlan,
  getAuditLog,
  getClient,
  getGlobalMetrics,
  getSupportTicket,
  impersonateClient,
  inviteAdmin,
  listAdmins,
  listAnnouncements,
  listClients,
  listPlans,
  listSupportTickets,
  publishAnnouncement,
  replyToTicket,
  retractAnnouncement,
  setClientStatus,
  updateAdmin,
  updateClient,
  updatePlan,
  updateTicket,
} from "./services/admin.js";
import {
  acknowledgeAnnouncement,
  createApiKey,
  getClientSupportTicket,
  getPortalAccount,
  getPortalUsage,
  listAnnouncementsForWorkspace,
  listApiKeys,
  listClientSupportTickets,
  listWorkspaces,
  openSupportTicket,
  replyAsClient,
  revokeApiKey,
} from "./services/portal.js";
import { getAetherBundle, getSentinelBundle } from "./services/bundle-shims.js";

const agentTypeSchema = Type.Union([
  Type.Literal("sales"),
  Type.Literal("support"),
  Type.Literal("booking"),
  Type.Literal("coldcall"),
]);

const agentStatusSchema = Type.Union([
  Type.Literal("live"),
  Type.Literal("paused"),
  Type.Literal("idle"),
]);

const channelSchema = Type.Union([Type.Literal("voice"), Type.Literal("whatsapp")]);

const knowledgeBaseTypeSchema = Type.Union([
  Type.Literal("faq"),
  Type.Literal("script"),
  Type.Literal("product_info"),
  Type.Literal("objection_handling"),
  Type.Literal("pricing"),
]);

const notificationEventSchema = Type.Union([
  Type.Literal("call_completed"),
  Type.Literal("agent_error"),
  Type.Literal("spend_threshold"),
]);

const workspaceStatusSchema = Type.Union([
  Type.Literal("trial"),
  Type.Literal("active"),
  Type.Literal("suspended"),
  Type.Literal("archived"),
]);

const adminRoleSchema = Type.Union([
  Type.Literal("super_admin"),
  Type.Literal("support"),
  Type.Literal("billing"),
  Type.Literal("read_only"),
]);

const announcementSeveritySchema = Type.Union([
  Type.Literal("info"),
  Type.Literal("warning"),
  Type.Literal("critical"),
]);

const announcementAudienceSchema = Type.Union([
  Type.Literal("all"),
  Type.Literal("trial"),
  Type.Literal("active"),
  Type.Literal("suspended"),
  Type.Literal("custom"),
]);

const ticketStatusSchema = Type.Union([
  Type.Literal("open"),
  Type.Literal("pending"),
  Type.Literal("resolved"),
  Type.Literal("closed"),
]);

const ticketPrioritySchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("normal"),
  Type.Literal("high"),
  Type.Literal("urgent"),
]);

const app = Fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>();

await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(cookie, {
  hook: "onRequest",
});

await app.register(swagger, {
  openapi: {
    info: {
      title: "Aether Agent Management API",
      version: "2.0.0",
      description:
        "Multi-tenant agent management platform. Client portal endpoints (`/api/*`, `/api/portal/*`) and Super Admin endpoints (`/api/admin/*`) drive the two UIs at `/portal` and `/admin`. Inbound webhooks under `/api/webhooks/*`.",
    },
    tags: [
      { name: "System", description: "Health, landing pages, and static assets." },
      { name: "Dashboard", description: "Single-workspace dashboard data (Overview, Analytics)." },
      { name: "Agents", description: "Per-agent CRUD and lifecycle." },
      { name: "Knowledge Base", description: "Knowledge documents and tags." },
      { name: "Transcripts", description: "Conversation transcripts." },
      { name: "Billing", description: "Plan, budget, usage, and invoices." },
      { name: "Settings", description: "Workspace, notifications, team, and webhook config." },
      { name: "Webhooks", description: "Outbound endpoints and inbound webhook ingest." },
      { name: "Admin / Metrics", description: "Cross-tenant global metrics." },
      { name: "Admin / Clients", description: "Manage all client workspaces." },
      { name: "Admin / Plans", description: "Manage subscription plans." },
      { name: "Admin / Users", description: "Manage admin operators." },
      { name: "Admin / Audit", description: "Admin action audit log." },
      { name: "Admin / Announcements", description: "Publish platform-wide announcements." },
      { name: "Admin / Support", description: "Triage and respond to client support tickets." },
      { name: "Portal / Account", description: "Currently signed-in workspace details." },
      { name: "Portal / API Keys", description: "Workspace-scoped API key CRUD." },
      { name: "Portal / Support", description: "Client-side support ticket flows." },
      { name: "Portal / Announcements", description: "Read and acknowledge platform announcements." },
    ],
  },
});

await app.register(swaggerUi, {
  routePrefix: "/docs",
});

// ------------------------------------------------------------------
// Static HTML pages
// ------------------------------------------------------------------

async function serveFile(path: string) {
  return readFile(path, "utf8");
}

const ROOT = process.cwd();

// Unpacked Aether & Sentinel artifact bundles. These preserve the original
// designed look and feel; their mock-data layer is patched to fetch live data
// from /api/portal/aether-bundle and /api/admin/sentinel-bundle respectively.
const portalBundleDir = resolve(ROOT, "ui-bundles/portal");
const adminBundleDir = resolve(ROOT, "ui-bundles/admin");
// Lightweight alternates (vanilla HTML/JS dashboards) — also wired to the API.
const clientPortalHtmlPath = resolve(ROOT, "src/ui/client-portal.html");
const superAdminHtmlPath = resolve(ROOT, "src/ui/super-admin.html");
const landingHtmlPath = resolve(ROOT, "src/ui/landing.html");
const previewPortalHtmlPath = env.dashboardHtmlPath;
const previewAdminHtmlPath = resolve(ROOT, "Sentinel Super Admin Console.html");

// Serve each unpacked bundle as a static directory. The bundle's index.html
// references siblings by relative name (asset_xxx.js, asset_xxx.bin), so we
// mount the directory under /portal/ and /admin/ — that way `/portal/` returns
// index.html and `/portal/asset_xxx.js` resolves correctly relative to it.
await app.register(fastifyStatic, {
  root: portalBundleDir,
  prefix: "/portal/",
  decorateReply: false,
  index: ["index.html"],
  redirect: true,
});
await app.register(fastifyStatic, {
  root: adminBundleDir,
  prefix: "/admin/",
  decorateReply: false,
  index: ["index.html"],
  redirect: true,
});

// ------------------------------------------------------------------
// Authentication
// ------------------------------------------------------------------

// Public routes never gated by the auth preHandler — login endpoints,
// the inbound webhook, health, landing, login HTML, and OpenAPI docs.
const PUBLIC_PREFIXES = [
  "/api/auth/",
  "/api/webhooks/agent-events",
  "/health",
  "/docs",
  "/favicon",
];
const PUBLIC_EXACT = new Set([
  "/",
  "/admin/login",
  "/portal/login",
  "/admin/login/",
  "/portal/login/",
  "/portal-classic",
  "/admin-classic",
  "/preview/portal",
  "/preview/admin",
  "/dashboard",
  "/portal",
  "/admin",
]);

function isHtmlRequest(accept: string | undefined): boolean {
  return typeof accept === "string" && accept.includes("text/html");
}

// Auth gate. Runs for every request. Decorates request with adminContext /
// portalContext when a valid session is present, and rejects unauthenticated
// requests to protected URLs. HTML requests under /admin/ or /portal/ are
// redirected to the login page; API requests get a JSON 401.
app.addHook("preHandler", async (request, reply) => {
  const url = request.url.split("?")[0];

  if (PUBLIC_PREFIXES.some((p) => url.startsWith(p)) || PUBLIC_EXACT.has(url)) {
    return;
  }

  const adminCookie = request.cookies?.[ADMIN_COOKIE];
  const portalCookie = request.cookies?.[PORTAL_COOKIE];

  const admin = await loadAdminFromSession(adminCookie);
  if (admin) {
    request.adminContext = {
      adminId: admin.admin.id,
      role: admin.admin.role,
    };
  }

  const portal = await loadTeamMemberFromSession(portalCookie);
  if (portal) {
    request.portalContext = {
      teamMemberId: portal.member.id,
      workspaceId: portal.member.workspaceId,
      role: portal.member.role,
    };
  }

  const wantsHtml = isHtmlRequest(request.headers.accept as string | undefined);

  // /admin/* (static bundle pages) → require admin session, redirect to login
  if (url.startsWith("/admin/") && !admin) {
    if (wantsHtml) {
      reply.redirect(`/admin/login?next=${encodeURIComponent(request.url)}`, 302);
      return reply;
    }
    reply.code(401).send({ message: "Admin authentication required" });
    return reply;
  }

  // /portal/* (static bundle pages) → require portal session OR admin
  if (url.startsWith("/portal/") && !portal && !admin) {
    if (wantsHtml) {
      reply.redirect(`/portal/login?next=${encodeURIComponent(request.url)}`, 302);
      return reply;
    }
    reply.code(401).send({ message: "Portal authentication required" });
    return reply;
  }

  // /api/admin/* → require admin session
  if (url.startsWith("/api/admin/") && !admin) {
    reply.code(401).send({ message: "Admin authentication required" });
    return reply;
  }

  // /api/portal/* → require portal session OR admin
  if (url.startsWith("/api/portal/") && !portal && !admin) {
    reply.code(401).send({ message: "Portal authentication required" });
    return reply;
  }

  // All other /api/* (legacy workspace-scoped routes) → require portal or admin
  if (url.startsWith("/api/") && !portal && !admin) {
    reply.code(401).send({ message: "Authentication required" });
    return reply;
  }
});

// Login pages (HTML). These are explicit routes registered BEFORE
// @fastify/static would otherwise return 404 under /admin/ and /portal/.
const adminLoginHtmlPath = resolve(ROOT, "src/ui/admin-login.html");
const portalLoginHtmlPath = resolve(ROOT, "src/ui/portal-login.html");

app.get("/admin/login", { schema: { tags: ["System"], summary: "Admin sign-in page" } }, async (_req, reply) => {
  reply.type("text/html; charset=utf-8");
  return serveFile(adminLoginHtmlPath);
});

app.get("/portal/login", { schema: { tags: ["System"], summary: "Portal sign-in page" } }, async (_req, reply) => {
  reply.type("text/html; charset=utf-8");
  return serveFile(portalLoginHtmlPath);
});

// Admin auth API
const loginBody = Type.Object({
  email: Type.String({ format: "email", minLength: 1 }),
  password: Type.String({ minLength: 1 }),
});

app.post(
  "/api/auth/admin/login",
  { schema: { tags: ["System"], summary: "Sign in as a Sentinel admin", body: loginBody } },
  async (request, reply) => {
    const { email, password } = request.body as Static<typeof loginBody>;
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !admin.isActive) {
      reply.code(401);
      return { message: "Invalid email or password" };
    }
    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) {
      reply.code(401);
      return { message: "Invalid email or password" };
    }
    const sessionId = await createSession({
      subjectType: SessionSubject.admin,
      subjectId: admin.id,
      userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
      ipAddress: request.ip ?? null,
    });
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    reply.setCookie(ADMIN_COOKIE, sessionId, cookieOptions());
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    };
  },
);

app.post(
  "/api/auth/admin/logout",
  { schema: { tags: ["System"], summary: "Sign out of Sentinel admin" } },
  async (request, reply) => {
    await revokeSession(request.cookies?.[ADMIN_COOKIE]);
    reply.clearCookie(ADMIN_COOKIE, { path: "/" });
    return { ok: true };
  },
);

app.get(
  "/api/auth/admin/me",
  { schema: { tags: ["System"], summary: "Currently signed-in admin" } },
  async (request, reply) => {
    const ctx = request.adminContext;
    if (!ctx?.adminId) {
      reply.code(401);
      return { message: "Not signed in" };
    }
    const admin = await prisma.adminUser.findUnique({ where: { id: ctx.adminId } });
    if (!admin) {
      reply.code(401);
      return { message: "Not signed in" };
    }
    return {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      initials: admin.initials,
      color: admin.color,
    };
  },
);

// Portal auth API
app.post(
  "/api/auth/portal/login",
  { schema: { tags: ["System"], summary: "Sign in to the client portal", body: loginBody } },
  async (request, reply) => {
    const { email, password } = request.body as Static<typeof loginBody>;
    const member = await prisma.teamMember.findUnique({ where: { email: email.toLowerCase() } });
    if (!member) {
      reply.code(401);
      return { message: "Invalid email or password" };
    }
    const ok = await verifyPassword(password, member.passwordHash);
    if (!ok) {
      reply.code(401);
      return { message: "Invalid email or password" };
    }
    const sessionId = await createSession({
      subjectType: SessionSubject.team,
      subjectId: member.id,
      workspaceId: member.workspaceId,
      userAgent: (request.headers["user-agent"] as string | undefined) ?? null,
      ipAddress: request.ip ?? null,
    });
    await prisma.teamMember.update({ where: { id: member.id }, data: { lastLoginAt: new Date() } });
    reply.setCookie(PORTAL_COOKIE, sessionId, cookieOptions());
    return {
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      workspaceId: member.workspaceId,
    };
  },
);

app.post(
  "/api/auth/portal/logout",
  { schema: { tags: ["System"], summary: "Sign out of the client portal" } },
  async (request, reply) => {
    await revokeSession(request.cookies?.[PORTAL_COOKIE]);
    reply.clearCookie(PORTAL_COOKIE, { path: "/" });
    return { ok: true };
  },
);

app.get(
  "/api/auth/portal/me",
  { schema: { tags: ["System"], summary: "Currently signed-in portal user" } },
  async (request, reply) => {
    const ctx = request.portalContext;
    if (!ctx?.teamMemberId) {
      reply.code(401);
      return { message: "Not signed in" };
    }
    const member = await prisma.teamMember.findUnique({
      where: { id: ctx.teamMemberId },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (!member) {
      reply.code(401);
      return { message: "Not signed in" };
    }
    return {
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      initials: member.initials,
      color: member.color,
      workspace: member.workspace,
    };
  },
);

app.get(
  "/health",
  {
    schema: { tags: ["System"], summary: "Health check" },
  },
  async () => ({ status: "ok", now: new Date().toISOString() }),
);

app.get(
  "/",
  {
    schema: { tags: ["System"], summary: "Landing page (chooser between portal and admin)" },
  },
  async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return serveFile(landingHtmlPath);
  },
);

// /portal/ and /admin/ are served by @fastify/static above (the original
// Aether & Sentinel bundles). Without a trailing slash the static prefix
// doesn't match, so redirect explicitly so bare /portal and /admin work.
app.get(
  "/portal",
  { schema: { tags: ["System"], summary: "Redirect to /portal/" } },
  async (_request, reply) => reply.redirect("/portal/", 308),
);
app.get(
  "/admin",
  { schema: { tags: ["System"], summary: "Redirect to /admin/" } },
  async (_request, reply) => reply.redirect("/admin/", 308),
);

// The vanilla-HTML alternates are exposed at /portal-classic and
// /admin-classic in case you want the lighter UI.
app.get(
  "/portal-classic",
  { schema: { tags: ["System"], summary: "Vanilla-HTML client portal (alternate)" } },
  async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return serveFile(clientPortalHtmlPath);
  },
);

app.get(
  "/admin-classic",
  { schema: { tags: ["System"], summary: "Vanilla-HTML super admin (alternate)" } },
  async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return serveFile(superAdminHtmlPath);
  },
);

app.get(
  "/preview/portal",
  {
    schema: { tags: ["System"], summary: "Original Aether dashboard bundle (read-only preview)" },
  },
  async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return serveFile(previewPortalHtmlPath);
  },
);

app.get(
  "/preview/admin",
  {
    schema: { tags: ["System"], summary: "Original Sentinel admin bundle (read-only preview)" },
  },
  async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return serveFile(previewAdminHtmlPath);
  },
);

app.get(
  "/dashboard",
  {
    schema: { tags: ["System"], summary: "Legacy alias for /preview/portal" },
  },
  async (_request, reply) => {
    reply.type("text/html; charset=utf-8");
    return serveFile(previewPortalHtmlPath);
  },
);

// ------------------------------------------------------------------
// Single-workspace dashboard data (legacy + portal default)
// ------------------------------------------------------------------

app.get(
  "/api/overview",
  { schema: { tags: ["Dashboard"], summary: "Overview page data" } },
  async () => getOverview(),
);

app.get(
  "/api/analytics",
  { schema: { tags: ["Dashboard"], summary: "Analytics page data" } },
  async () => getAnalytics(),
);

app.get(
  "/api/billing",
  { schema: { tags: ["Billing"], summary: "Billing page data" } },
  async () => getBilling(),
);

app.get(
  "/api/agents",
  { schema: { tags: ["Agents"], summary: "List agents with computed dashboard metrics" } },
  async () => getAgents(),
);

const createAgentBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  type: agentTypeSchema,
  status: Type.Optional(agentStatusSchema),
  channels: Type.Array(channelSchema, { minItems: 1 }),
  personality: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  greeting: Type.Optional(Type.String()),
  avatarShape: Type.Optional(Type.String()),
  rating: Type.Optional(Type.Number()),
  knowledgeBaseIds: Type.Optional(Type.Array(Type.String())),
  workspaceId: Type.Optional(Type.String()),
});

type CreateAgentBody = Static<typeof createAgentBody>;

app.post(
  "/api/agents",
  {
    schema: {
      tags: ["Agents"],
      summary: "Create an agent",
      body: createAgentBody,
    },
  },
  async (request, reply) => {
    const body = request.body as CreateAgentBody;
    const agentId = createPrefixedId("agt");

    await prisma.agent.create({
      data: {
        id: agentId,
        workspaceId: body.workspaceId ?? DEFAULT_WORKSPACE_ID,
        name: body.name,
        type: body.type,
        status: body.status ?? "idle",
        personality: body.personality,
        language: body.language,
        greeting: body.greeting,
        avatarShape: body.avatarShape,
        rating: body.rating,
        channels: { create: body.channels.map((channel) => ({ channel })) },
        knowledgeBaseLinks:
          body.knowledgeBaseIds && body.knowledgeBaseIds.length > 0
            ? { create: body.knowledgeBaseIds.map((knowledgeBaseId) => ({ knowledgeBaseId })) }
            : undefined,
      },
    });

    reply.code(201);
    return prisma.agent.findUniqueOrThrow({
      where: { id: agentId },
      include: { channels: true, knowledgeBaseLinks: true },
    });
  },
);

const updateAgentBody = Type.Partial(createAgentBody);
type UpdateAgentBody = Static<typeof updateAgentBody>;

app.patch(
  "/api/agents/:agentId",
  {
    schema: {
      tags: ["Agents"],
      summary: "Update an agent",
      params: Type.Object({ agentId: Type.String() }),
      body: updateAgentBody,
    },
  },
  async (request) => {
    const { agentId } = request.params;
    const body = request.body as UpdateAgentBody;

    await prisma.$transaction(async (tx) => {
      await tx.agent.update({
        where: { id: agentId },
        data: {
          name: body.name,
          type: body.type,
          status: body.status,
          personality: body.personality,
          language: body.language,
          greeting: body.greeting,
          avatarShape: body.avatarShape,
          rating: body.rating,
          workspaceId: body.workspaceId,
        },
      });

      if (body.channels) {
        await tx.agentChannel.deleteMany({ where: { agentId } });
        await tx.agentChannel.createMany({
          data: body.channels.map((channel) => ({ agentId, channel })),
        });
      }

      if (body.knowledgeBaseIds) {
        await tx.agentKnowledgeBase.deleteMany({ where: { agentId } });
        if (body.knowledgeBaseIds.length > 0) {
          await tx.agentKnowledgeBase.createMany({
            data: body.knowledgeBaseIds.map((knowledgeBaseId) => ({ agentId, knowledgeBaseId })),
          });
        }
      }
    });

    return prisma.agent.findUniqueOrThrow({
      where: { id: agentId },
      include: { channels: true, knowledgeBaseLinks: true },
    });
  },
);

app.post(
  "/api/agents/:agentId/toggle",
  {
    schema: {
      tags: ["Agents"],
      summary: "Toggle or set agent status",
      params: Type.Object({ agentId: Type.String() }),
      body: Type.Optional(Type.Object({ status: Type.Optional(agentStatusSchema) })),
    },
  },
  async (request) => {
    const { agentId } = request.params;
    const current = await prisma.agent.findUniqueOrThrow({ where: { id: agentId } });
    const requestedStatus = request.body?.status;
    const nextStatus =
      requestedStatus ??
      (current.status === "live" ? "paused" : current.status === "paused" ? "live" : "live");

    return prisma.agent.update({ where: { id: agentId }, data: { status: nextStatus } });
  },
);

app.delete(
  "/api/agents/:agentId",
  {
    schema: {
      tags: ["Agents"],
      summary: "Delete an agent",
      params: Type.Object({ agentId: Type.String() }),
    },
  },
  async (request, reply) => {
    await prisma.agent.delete({ where: { id: request.params.agentId } });
    reply.code(204);
    return null;
  },
);

app.get(
  "/api/knowledge-base",
  {
    schema: {
      tags: ["Knowledge Base"],
      summary: "List knowledge-base entries",
      querystring: Type.Object({
        search: Type.Optional(Type.String()),
        type: Type.Optional(Type.String()),
      }),
    },
  },
  async (request) => getKnowledgeBase(request.query.search, request.query.type),
);

const knowledgeBaseBody = Type.Object({
  title: Type.String({ minLength: 1 }),
  type: knowledgeBaseTypeSchema,
  content: Type.String(),
  tags: Type.Array(Type.String(), { default: [] }),
  agentIds: Type.Optional(Type.Array(Type.String())),
  workspaceId: Type.Optional(Type.String()),
});

type KnowledgeBaseBody = Static<typeof knowledgeBaseBody>;

app.post(
  "/api/knowledge-base",
  {
    schema: {
      tags: ["Knowledge Base"],
      summary: "Create a knowledge-base entry",
      body: knowledgeBaseBody,
    },
  },
  async (request, reply) => {
    const body = request.body as KnowledgeBaseBody;
    const documentId = createPrefixedId("kb");

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeBaseDocument.create({
        data: {
          id: documentId,
          workspaceId: body.workspaceId ?? DEFAULT_WORKSPACE_ID,
          title: body.title,
          type: body.type,
          content: body.content,
          tags: { create: body.tags.map((value) => ({ value })) },
        },
      });

      if (body.agentIds?.length) {
        await tx.agentKnowledgeBase.createMany({
          data: body.agentIds.map((agentId) => ({ agentId, knowledgeBaseId: documentId })),
        });
      }
    });

    reply.code(201);
    return getKnowledgeBaseDocument(documentId);
  },
);

app.get(
  "/api/knowledge-base/:knowledgeBaseId",
  {
    schema: {
      tags: ["Knowledge Base"],
      summary: "Get a knowledge-base entry",
      params: Type.Object({ knowledgeBaseId: Type.String() }),
    },
  },
  async (request) => getKnowledgeBaseDocument(request.params.knowledgeBaseId),
);

app.put(
  "/api/knowledge-base/:knowledgeBaseId",
  {
    schema: {
      tags: ["Knowledge Base"],
      summary: "Update a knowledge-base entry",
      params: Type.Object({ knowledgeBaseId: Type.String() }),
      body: knowledgeBaseBody,
    },
  },
  async (request) => {
    const { knowledgeBaseId } = request.params;
    const body = request.body as KnowledgeBaseBody;

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeBaseDocument.update({
        where: { id: knowledgeBaseId },
        data: {
          title: body.title,
          type: body.type,
          content: body.content,
          workspaceId: body.workspaceId ?? undefined,
        },
      });

      await tx.knowledgeBaseTag.deleteMany({ where: { knowledgeBaseId } });
      if (body.tags.length) {
        await tx.knowledgeBaseTag.createMany({
          data: body.tags.map((value) => ({ knowledgeBaseId, value })),
        });
      }

      if (body.agentIds) {
        await tx.agentKnowledgeBase.deleteMany({ where: { knowledgeBaseId } });
        if (body.agentIds.length) {
          await tx.agentKnowledgeBase.createMany({
            data: body.agentIds.map((agentId) => ({ agentId, knowledgeBaseId })),
          });
        }
      }
    });

    return getKnowledgeBaseDocument(knowledgeBaseId);
  },
);

app.delete(
  "/api/knowledge-base/:knowledgeBaseId",
  {
    schema: {
      tags: ["Knowledge Base"],
      summary: "Delete a knowledge-base entry",
      params: Type.Object({ knowledgeBaseId: Type.String() }),
    },
  },
  async (request, reply) => {
    await prisma.knowledgeBaseDocument.delete({
      where: { id: request.params.knowledgeBaseId },
    });
    reply.code(204);
    return null;
  },
);

app.get(
  "/api/transcripts",
  {
    schema: {
      tags: ["Transcripts"],
      summary: "List transcript summaries",
      querystring: Type.Object({
        agentId: Type.Optional(Type.String()),
        channel: Type.Optional(channelSchema),
        outcome: Type.Optional(Type.String()),
        search: Type.Optional(Type.String()),
      }),
    },
  },
  async (request) =>
    getTranscripts({
      agentId: request.query.agentId,
      channel: request.query.channel,
      outcome: request.query.outcome,
      search: request.query.search,
    }),
);

app.get(
  "/api/transcripts/:transcriptId",
  {
    schema: {
      tags: ["Transcripts"],
      summary: "Get a single transcript with its full thread",
      params: Type.Object({ transcriptId: Type.String() }),
    },
  },
  async (request) => getTranscript(request.params.transcriptId),
);

app.get(
  "/api/settings",
  { schema: { tags: ["Settings"], summary: "Get workspace, notification, team, and webhook settings" } },
  async () => getSettings(),
);

const workspaceUpdateBody = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1 })),
  timezone: Type.Optional(Type.String({ minLength: 1 })),
  defaultLanguage: Type.Optional(Type.String({ minLength: 1 })),
  retentionDays: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Null()])),
});

app.patch(
  "/api/settings/workspace",
  {
    schema: {
      tags: ["Settings"],
      summary: "Update workspace settings",
      body: workspaceUpdateBody,
    },
  },
  async (request) => updateWorkspace(request.body),
);

app.put(
  "/api/settings/notifications/:eventType",
  {
    schema: {
      tags: ["Settings"],
      summary: "Update a notification rule",
      params: Type.Object({ eventType: notificationEventSchema }),
      body: Type.Object({
        emailEnabled: Type.Boolean(),
        webhookEnabled: Type.Boolean(),
      }),
    },
  },
  async (request) =>
    updateNotificationRule({
      eventType: request.params.eventType as NotificationEventType,
      emailEnabled: request.body.emailEnabled,
      webhookEnabled: request.body.webhookEnabled,
    }),
);

const teamMemberBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  email: Type.String({ format: "email" }),
  role: Type.Union([Type.Literal("owner"), Type.Literal("admin"), Type.Literal("viewer")]),
  initials: Type.String({ minLength: 1 }),
  color: Type.String({ minLength: 1 }),
  workspaceId: Type.Optional(Type.String()),
});

app.post(
  "/api/team",
  { schema: { tags: ["Settings"], summary: "Invite or add a team member", body: teamMemberBody } },
  async (request, reply) => {
    const { workspaceId, ...rest } = request.body;
    const teamMember = await prisma.teamMember.create({
      data: {
        id: createPrefixedId("team"),
        workspaceId: workspaceId ?? DEFAULT_WORKSPACE_ID,
        ...rest,
      },
    });
    reply.code(201);
    return teamMember;
  },
);

app.delete(
  "/api/team/:memberId",
  {
    schema: {
      tags: ["Settings"],
      summary: "Remove a team member",
      params: Type.Object({ memberId: Type.String() }),
    },
  },
  async (request, reply) => {
    await prisma.teamMember.delete({ where: { id: request.params.memberId } });
    reply.code(204);
    return null;
  },
);

const webhookEndpointBody = Type.Object({
  url: Type.String({ format: "uri" }),
  secret: Type.Optional(Type.String()),
  status: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  events: Type.Array(Type.String(), { minItems: 1 }),
  workspaceId: Type.Optional(Type.String()),
});

type WebhookEndpointBody = Static<typeof webhookEndpointBody>;

app.post(
  "/api/webhooks/endpoints",
  {
    schema: {
      tags: ["Webhooks"],
      summary: "Create an outbound webhook endpoint",
      body: webhookEndpointBody,
    },
  },
  async (request, reply) => {
    const body = request.body as WebhookEndpointBody;
    const endpointId = createPrefixedId("wh");

    await prisma.webhookEndpoint.create({
      data: {
        id: endpointId,
        workspaceId: body.workspaceId ?? DEFAULT_WORKSPACE_ID,
        url: body.url,
        secret: body.secret,
        status: body.status ?? "active",
        description: body.description,
        events: { create: body.events.map((eventType) => ({ eventType })) },
      },
    });

    reply.code(201);
    return prisma.webhookEndpoint.findUniqueOrThrow({
      where: { id: endpointId },
      include: { events: true },
    });
  },
);

app.patch(
  "/api/webhooks/endpoints/:endpointId",
  {
    schema: {
      tags: ["Webhooks"],
      summary: "Update an outbound webhook endpoint",
      params: Type.Object({ endpointId: Type.String() }),
      body: Type.Partial(webhookEndpointBody),
    },
  },
  async (request) => {
    const { endpointId } = request.params;
    const body = request.body as Partial<WebhookEndpointBody>;

    await prisma.$transaction(async (tx) => {
      await tx.webhookEndpoint.update({
        where: { id: endpointId },
        data: {
          url: body.url,
          secret: body.secret,
          status: body.status,
          description: body.description,
        },
      });

      if (body.events) {
        await tx.webhookEndpointEvent.deleteMany({ where: { endpointId } });
        await tx.webhookEndpointEvent.createMany({
          data: body.events.map((eventType) => ({ endpointId, eventType })),
        });
      }
    });

    return prisma.webhookEndpoint.findUniqueOrThrow({
      where: { id: endpointId },
      include: { events: true },
    });
  },
);

app.delete(
  "/api/webhooks/endpoints/:endpointId",
  {
    schema: {
      tags: ["Webhooks"],
      summary: "Delete an outbound webhook endpoint",
      params: Type.Object({ endpointId: Type.String() }),
    },
  },
  async (request, reply) => {
    await prisma.webhookEndpoint.delete({ where: { id: request.params.endpointId } });
    reply.code(204);
    return null;
  },
);

app.post(
  "/api/webhooks/endpoints/:endpointId/test",
  {
    schema: {
      tags: ["Webhooks"],
      summary: "Send a test event to an outbound webhook endpoint",
      params: Type.Object({ endpointId: Type.String() }),
    },
  },
  async (request) => sendTestWebhook(prisma, request.params.endpointId),
);

// ------------------------------------------------------------------
// Super Admin endpoints (cross-tenant)
// ------------------------------------------------------------------

function adminId(request: { adminContext?: { adminId: string } }): string | undefined {
  return request.adminContext?.adminId;
}

app.get(
  "/api/admin/metrics",
  { schema: { tags: ["Admin / Metrics"], summary: "Platform-wide metrics across all clients" } },
  async () => getGlobalMetrics(),
);

app.get(
  "/api/admin/sentinel-bundle",
  {
    schema: {
      tags: ["Admin / Metrics"],
      summary:
        "Live-data bundle in the exact shape the Sentinel admin UI expects. Consumed synchronously by the unpacked bundle's mock-data shim.",
    },
  },
  async () => getSentinelBundle(),
);

app.get(
  "/api/admin/clients",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "List all client workspaces with usage and counts",
      querystring: Type.Object({
        status: Type.Optional(workspaceStatusSchema),
        search: Type.Optional(Type.String()),
      }),
    },
  },
  async (request) =>
    listClients({
      status: request.query.status as WorkspaceStatus | undefined,
      search: request.query.search,
    }),
);

const createClientBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  contactName: Type.Optional(Type.String()),
  contactEmail: Type.Optional(Type.String()),
  contactPhone: Type.Optional(Type.String()),
  timezone: Type.Optional(Type.String()),
  defaultLanguage: Type.Optional(Type.String()),
  planId: Type.Optional(Type.String()),
  status: Type.Optional(workspaceStatusSchema),
  monthlyBudgetCents: Type.Optional(Type.Integer({ minimum: 0 })),
  trialEndsAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

app.post(
  "/api/admin/clients",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Provision a new client workspace",
      body: createClientBody,
    },
  },
  async (request, reply) => {
    const body = request.body as Static<typeof createClientBody>;
    const workspace = await createClient({
      ...body,
      status: body.status as WorkspaceStatus | undefined,
    }, adminId(request));
    reply.code(201);
    return workspace;
  },
);

app.get(
  "/api/admin/clients/:workspaceId",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Get a client workspace with team, tickets, and api keys",
      params: Type.Object({ workspaceId: Type.String() }),
    },
  },
  async (request) => getClient(request.params.workspaceId),
);

app.patch(
  "/api/admin/clients/:workspaceId",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Update a client workspace (rename, contact, plan, budget, timezone)",
      params: Type.Object({ workspaceId: Type.String() }),
      body: Type.Partial(
        Type.Object({
          name: Type.String(),
          contactName: Type.String(),
          contactEmail: Type.String(),
          contactPhone: Type.String(),
          timezone: Type.String(),
          defaultLanguage: Type.String(),
          retentionDays: Type.Union([Type.Integer(), Type.Null()]),
          planId: Type.Union([Type.String(), Type.Null()]),
          monthlyBudgetCents: Type.Integer({ minimum: 0 }),
        }),
      ),
    },
  },
  async (request) => updateClient(request.params.workspaceId, request.body, adminId(request)),
);

app.post(
  "/api/admin/clients/:workspaceId/suspend",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Suspend a client (block portal access and pause agents)",
      params: Type.Object({ workspaceId: Type.String() }),
      body: Type.Object({ reason: Type.Optional(Type.String()) }),
    },
  },
  async (request) =>
    setClientStatus(
      request.params.workspaceId,
      "suspended" as WorkspaceStatus,
      request.body.reason,
      adminId(request),
    ),
);

app.post(
  "/api/admin/clients/:workspaceId/activate",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Re-activate a client",
      params: Type.Object({ workspaceId: Type.String() }),
    },
  },
  async (request) =>
    setClientStatus(request.params.workspaceId, "active" as WorkspaceStatus, undefined, adminId(request)),
);

app.post(
  "/api/admin/clients/:workspaceId/archive",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Archive a client (soft delete)",
      params: Type.Object({ workspaceId: Type.String() }),
    },
  },
  async (request) =>
    setClientStatus(request.params.workspaceId, "archived" as WorkspaceStatus, undefined, adminId(request)),
);

app.post(
  "/api/admin/clients/:workspaceId/impersonate",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Mint a short-lived impersonation token to open the client portal in support mode",
      params: Type.Object({ workspaceId: Type.String() }),
    },
  },
  async (request) => impersonateClient(request.params.workspaceId, adminId(request)),
);

app.delete(
  "/api/admin/clients/:workspaceId",
  {
    schema: {
      tags: ["Admin / Clients"],
      summary: "Permanently delete a client workspace (and cascade its data)",
      params: Type.Object({ workspaceId: Type.String() }),
    },
  },
  async (request, reply) => {
    await deleteClient(request.params.workspaceId, adminId(request));
    reply.code(204);
    return null;
  },
);

// ----- Plans
app.get("/api/admin/plans", { schema: { tags: ["Admin / Plans"], summary: "List plans" } }, async () => listPlans());

const planBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  monthlyFeeCents: Type.Integer({ minimum: 0 }),
  includedVoiceMinutes: Type.Optional(Type.Integer({ minimum: 0 })),
  includedAiMinutes: Type.Optional(Type.Integer({ minimum: 0 })),
  includedMessages: Type.Optional(Type.Integer({ minimum: 0 })),
  maxAgents: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  maxKnowledgeDocuments: Type.Optional(Type.Union([Type.Integer({ minimum: 0 }), Type.Null()])),
  isPublic: Type.Optional(Type.Boolean()),
  isDefault: Type.Optional(Type.Boolean()),
});

app.post(
  "/api/admin/plans",
  { schema: { tags: ["Admin / Plans"], summary: "Create a plan", body: planBody } },
  async (request, reply) => {
    const plan = await createPlan(request.body as Static<typeof planBody>, adminId(request));
    reply.code(201);
    return plan;
  },
);

app.patch(
  "/api/admin/plans/:planId",
  {
    schema: {
      tags: ["Admin / Plans"],
      summary: "Update a plan",
      params: Type.Object({ planId: Type.String() }),
      body: Type.Partial(planBody),
    },
  },
  async (request) => updatePlan(request.params.planId, request.body, adminId(request)),
);

app.delete(
  "/api/admin/plans/:planId",
  {
    schema: {
      tags: ["Admin / Plans"],
      summary: "Delete a plan",
      params: Type.Object({ planId: Type.String() }),
    },
  },
  async (request, reply) => {
    await deletePlan(request.params.planId, adminId(request));
    reply.code(204);
    return null;
  },
);

// ----- Admin users
app.get(
  "/api/admin/admins",
  { schema: { tags: ["Admin / Users"], summary: "List admin operators" } },
  async () => listAdmins(),
);

const inviteAdminBody = Type.Object({
  email: Type.String({ format: "email" }),
  name: Type.String({ minLength: 1 }),
  role: adminRoleSchema,
  initials: Type.String({ minLength: 1, maxLength: 4 }),
  color: Type.Optional(Type.String()),
});

app.post(
  "/api/admin/admins",
  { schema: { tags: ["Admin / Users"], summary: "Invite a new admin operator", body: inviteAdminBody } },
  async (request, reply) => {
    const body = request.body as Static<typeof inviteAdminBody>;
    const admin = await inviteAdmin({ ...body, role: body.role as AdminRole }, adminId(request));
    reply.code(201);
    return admin;
  },
);

app.patch(
  "/api/admin/admins/:adminUserId",
  {
    schema: {
      tags: ["Admin / Users"],
      summary: "Update an admin (role, name, color, active flag)",
      params: Type.Object({ adminUserId: Type.String() }),
      body: Type.Partial(
        Type.Object({
          name: Type.String(),
          role: adminRoleSchema,
          isActive: Type.Boolean(),
          color: Type.String(),
        }),
      ),
    },
  },
  async (request) =>
    updateAdmin(
      request.params.adminUserId,
      {
        ...request.body,
        role: request.body.role as AdminRole | undefined,
      },
      adminId(request),
    ),
);

app.delete(
  "/api/admin/admins/:adminUserId",
  {
    schema: {
      tags: ["Admin / Users"],
      summary: "Deactivate an admin operator",
      params: Type.Object({ adminUserId: Type.String() }),
    },
  },
  async (request) => deactivateAdmin(request.params.adminUserId, adminId(request)),
);

// ----- Audit log
app.get(
  "/api/admin/audit",
  {
    schema: {
      tags: ["Admin / Audit"],
      summary: "List recent admin actions",
      querystring: Type.Object({
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 500 })),
      }),
    },
  },
  async (request) => getAuditLog(request.query.limit ?? 100),
);

// ----- Announcements
app.get(
  "/api/admin/announcements",
  { schema: { tags: ["Admin / Announcements"], summary: "List published announcements with acknowledgement counts" } },
  async () => listAnnouncements(),
);

const announcementBody = Type.Object({
  title: Type.String({ minLength: 1 }),
  body: Type.String({ minLength: 1 }),
  severity: Type.Optional(announcementSeveritySchema),
  audience: Type.Optional(announcementAudienceSchema),
  workspaceIds: Type.Optional(Type.Array(Type.String())),
  expiresAt: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

app.post(
  "/api/admin/announcements",
  {
    schema: {
      tags: ["Admin / Announcements"],
      summary: "Publish a new announcement to all or a subset of clients",
      body: announcementBody,
    },
  },
  async (request, reply) => {
    const body = request.body as Static<typeof announcementBody>;
    const announcement = await publishAnnouncement(
      {
        ...body,
        severity: body.severity as AnnouncementSeverity | undefined,
        audience: body.audience as AnnouncementAudience | undefined,
      },
      adminId(request),
    );
    reply.code(201);
    return announcement;
  },
);

app.delete(
  "/api/admin/announcements/:announcementId",
  {
    schema: {
      tags: ["Admin / Announcements"],
      summary: "Retract a published announcement",
      params: Type.Object({ announcementId: Type.String() }),
    },
  },
  async (request, reply) => {
    await retractAnnouncement(request.params.announcementId, adminId(request));
    reply.code(204);
    return null;
  },
);

// ----- Support (admin view)
app.get(
  "/api/admin/support/tickets",
  {
    schema: {
      tags: ["Admin / Support"],
      summary: "List support tickets across all clients",
      querystring: Type.Object({
        workspaceId: Type.Optional(Type.String()),
        status: Type.Optional(ticketStatusSchema),
      }),
    },
  },
  async (request) =>
    listSupportTickets({
      workspaceId: request.query.workspaceId,
      status: request.query.status as SupportTicketStatus | undefined,
    }),
);

app.get(
  "/api/admin/support/tickets/:ticketId",
  {
    schema: {
      tags: ["Admin / Support"],
      summary: "Get a single support ticket with messages",
      params: Type.Object({ ticketId: Type.String() }),
    },
  },
  async (request) => getSupportTicket(request.params.ticketId),
);

app.patch(
  "/api/admin/support/tickets/:ticketId",
  {
    schema: {
      tags: ["Admin / Support"],
      summary: "Update a ticket (status, priority, assignee)",
      params: Type.Object({ ticketId: Type.String() }),
      body: Type.Object({
        status: Type.Optional(ticketStatusSchema),
        priority: Type.Optional(ticketPrioritySchema),
        assignedTo: Type.Optional(Type.Union([Type.String(), Type.Null()])),
      }),
    },
  },
  async (request) =>
    updateTicket(
      request.params.ticketId,
      {
        status: request.body.status as SupportTicketStatus | undefined,
        priority: request.body.priority as SupportTicketPriority | undefined,
        assignedTo: request.body.assignedTo ?? undefined,
      },
      adminId(request),
    ),
);

app.post(
  "/api/admin/support/tickets/:ticketId/reply",
  {
    schema: {
      tags: ["Admin / Support"],
      summary: "Reply to a support ticket as an admin",
      params: Type.Object({ ticketId: Type.String() }),
      body: Type.Object({
        author: Type.String({ minLength: 1 }),
        body: Type.String({ minLength: 1 }),
      }),
    },
  },
  async (request, reply) => {
    const message = await replyToTicket(request.params.ticketId, request.body, adminId(request));
    reply.code(201);
    return message;
  },
);

// ------------------------------------------------------------------
// Admin — Agent KB target config + KB document + structuring/publish
// ------------------------------------------------------------------

const KB_STRUCTURE_SYSTEM_PROMPT = `You are a knowledge base structuring engine for AI voice agents. Transform raw business information into a retrieval-optimized KB document.

FORMATTING RULES — non-negotiable:
- Blank line between every paragraph and every section header
- Every paragraph is 300–500 characters, self-contained — no cross-references to other sections
- Repeat the entity name (business name, product name, policy name) explicitly in every paragraph — no pronouns, no "it"/"they"
- State all prices, hours, policies, and facts inline in the paragraph where they appear
- Adapt the section structure to the business vertical — do not force a hotel template onto a retail document

HOTEL-STYLE EXAMPLE:
TREEHOUSE CHALETS — COMPLETE KNOWLEDGE BASE

1. PROPERTY OVERVIEW
Treehouse Chalets is a boutique eco-resort in Ella, Sri Lanka. Treehouse Chalets features 12 individually designed treehouse units surrounded by tea plantation views and tropical forest. Treehouse Chalets provides air conditioning, private bathrooms, and daily housekeeping in all units.

2. ROOM TYPES
Forest Escape Suite at Treehouse Chalets accommodates 2 guests and includes a private deck, king bed, and en-suite bathroom. Forest Escape Suite rates at Treehouse Chalets start at LKR 26,290 per night during off-peak periods (May–November 2026).

RETAIL-STYLE EXAMPLE:
## About FLiCo
FLiCo is a leading electronics retailer in Sri Lanka specializing in home appliances, consumer electronics, and IT products. FLiCo operates showrooms across Colombo, Kandy, and Galle. FLiCo offers delivery, installation, and 12-month after-sales service on all products.

### KONKA Single Door Refrigerators
1. **KONKA 92L Single Door Mini Fridge (KRF-92S)** — LKR 49,900
   The KONKA KRF-92S is a compact 92-litre direct-cool refrigerator suitable for bedrooms and offices. The KONKA KRF-92S has adjustable shelves and a vegetable crisper. FLiCo offers free delivery on the KONKA KRF-92S within Colombo.

Return ONLY a JSON object (no markdown fences, no commentary) with this exact shape:
{"structuredContent":"<full formatted KB document>","businessType":"<detected vertical e.g. hotel, electronics_retail, insurance, restaurant>","sections":["<name>"],"warnings":["<any concern>"]}`;

const kbTargetBody = Type.Object({
  baseUrl: Type.String({ minLength: 1 }),
  secret: Type.String({ minLength: 1 }),
  filename: Type.Optional(Type.String()),
});

app.get(
  "/api/admin/agents/:agentId/kb-target",
  {
    schema: {
      tags: ["Admin / Knowledge Base"],
      summary: "Get VPS target config for an agent's KB reload endpoint",
      params: Type.Object({ agentId: Type.String() }),
    },
  },
  async (request) => {
    const target = await prisma.agentKbTarget.findUnique({ where: { agentId: request.params.agentId } });
    return target ?? null;
  },
);

app.put(
  "/api/admin/agents/:agentId/kb-target",
  {
    schema: {
      tags: ["Admin / Knowledge Base"],
      summary: "Create or update VPS target config for an agent's KB reload endpoint",
      params: Type.Object({ agentId: Type.String() }),
      body: kbTargetBody,
    },
  },
  async (request) => {
    const { agentId } = request.params;
    const body = request.body as Static<typeof kbTargetBody>;
    return prisma.agentKbTarget.upsert({
      where: { agentId },
      create: { agentId, ...body, filename: body.filename ?? "knowledge.txt" },
      update: { ...body, updatedAt: new Date() },
    });
  },
);

app.get(
  "/api/admin/agents/:agentId/kb-document",
  {
    schema: {
      tags: ["Admin / Knowledge Base"],
      summary: "Get the current structured KB document stored for an agent",
      params: Type.Object({ agentId: Type.String() }),
    },
  },
  async (request) => {
    const doc = await prisma.agentKbDocument.findUnique({
      where: { agentId: request.params.agentId },
      include: { snapshots: { orderBy: { createdAt: "desc" }, take: 5 } },
    });
    return doc ?? null;
  },
);

const structureKbBody = Type.Object({
  agentId: Type.String({ minLength: 1 }),
  rawText: Type.String({ minLength: 1 }),
  mode: Type.Union([Type.Literal("merge"), Type.Literal("replace")]),
  businessType: Type.Optional(Type.String()),
  businessDescription: Type.Optional(Type.String()),
});

app.post(
  "/api/admin/knowledge-base/structure",
  {
    schema: {
      tags: ["Admin / Knowledge Base"],
      summary: "Structure raw text into a retrieval-optimized KB document (preview only — does not persist or publish)",
      body: structureKbBody,
    },
  },
  async (request, reply) => {
    if (!env.anthropicApiKey) {
      reply.code(501).send({ message: "ANTHROPIC_API_KEY is not configured on this server" });
      return;
    }

    const { agentId, rawText, mode, businessType, businessDescription } = request.body as Static<typeof structureKbBody>;

    let existingContent: string | null = null;
    if (mode === "merge") {
      const doc = await prisma.agentKbDocument.findUnique({ where: { agentId } });
      existingContent = doc?.content ?? null;
    }

    const hints: string[] = [];
    if (businessType) hints.push(`Business type: ${businessType}`);
    if (businessDescription) hints.push(`Business description: ${businessDescription}`);
    const hintBlock = hints.length ? hints.join("\n") + "\n\n" : "";

    const userMessage =
      mode === "merge" && existingContent
        ? `${hintBlock}EXISTING KNOWLEDGE BASE:\n${existingContent}\n\nNEW INFORMATION TO INTEGRATE:\n${rawText}\n\nIntegrate the new information: update changed facts, add new sections as needed, preserve sections not mentioned in the new input, and deduplicate. Return the complete updated document.`
        : `${hintBlock}Structure this raw business information into a retrieval-optimized knowledge base document:\n\n${rawText}`;

    const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });
    let result: { structuredContent: string; businessType: string; sections: string[]; warnings: string[] };
    try {
      const response = await anthropic.messages.create({
        model: env.anthropicModel,
        max_tokens: 8192,
        system: KB_STRUCTURE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const text = response.content[0]?.type === "text" ? response.content[0].text : "";
      result = JSON.parse(text);
    } catch (err) {
      const msg = err instanceof SyntaxError ? "Claude returned non-JSON output — retry or check the input" : String(err);
      reply.code(502).send({ message: `Structuring failed: ${msg}` });
      return;
    }

    return result;
  },
);

const publishKbBody = Type.Object({
  agentId: Type.String({ minLength: 1 }),
  content: Type.String({ minLength: 1 }),
  businessType: Type.Optional(Type.String()),
});

app.post(
  "/api/admin/knowledge-base/publish",
  {
    schema: {
      tags: ["Admin / Knowledge Base"],
      summary: "Snapshot the current KB, persist the new content, then POST it live to the agent's /kb-reload endpoint",
      body: publishKbBody,
    },
  },
  async (request, reply) => {
    const { agentId, content, businessType } = request.body as Static<typeof publishKbBody>;

    const target = await prisma.agentKbTarget.findUnique({ where: { agentId } });
    if (!target) {
      reply.code(422).send({ message: "No VPS target configured for this agent. Create one via PUT /api/admin/agents/:agentId/kb-target first." });
      return;
    }

    // Snapshot + persist inside a transaction so the dashboard is always the source of truth
    const existing = await prisma.agentKbDocument.findUnique({ where: { agentId } });
    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.agentKbSnapshot.create({
          data: { agentKbDocumentId: existing.id, content: existing.content, reason: "pre-publish" },
        });
        await tx.agentKbDocument.update({
          where: { agentId },
          data: { content, businessType: businessType ?? undefined, updatedAt: new Date() },
        });
      } else {
        await tx.agentKbDocument.create({
          data: { agentId, content, businessType: businessType ?? undefined },
        });
      }
      if (businessType) {
        await tx.agent.update({ where: { id: agentId }, data: { businessType } });
      }
    });

    // Push live to VPS agent
    let agentResult: unknown;
    try {
      const vpsRes = await fetch(`${target.baseUrl}/kb-reload`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-KB-Secret": target.secret },
        body: JSON.stringify({ content, filename: target.filename }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!vpsRes.ok) {
        const errBody = await vpsRes.text();
        reply.code(502).send({ message: `Agent /kb-reload returned HTTP ${vpsRes.status}: ${errBody}` });
        return;
      }
      agentResult = await vpsRes.json();
    } catch (err) {
      reply.code(502).send({ message: `Could not reach agent at ${target.baseUrl}: ${String(err)}` });
      return;
    }

    return { ok: true, agentResult };
  },
);

// ------------------------------------------------------------------
// Client Portal endpoints
// ------------------------------------------------------------------

function workspaceIdFromRequest(request: {
  portalContext?: { workspaceId: string };
  adminContext?: { impersonateWorkspaceId?: string };
}): string {
  if (request.portalContext?.workspaceId) {
    return request.portalContext.workspaceId;
  }
  if (request.adminContext?.impersonateWorkspaceId) {
    return request.adminContext.impersonateWorkspaceId;
  }
  return DEFAULT_WORKSPACE_ID;
}

app.get(
  "/api/portal/workspaces",
  { schema: { tags: ["Portal / Account"], summary: "List workspaces available for portal switcher" } },
  async () => listWorkspaces(),
);

app.get(
  "/api/portal/aether-bundle",
  {
    schema: {
      tags: ["Portal / Account"],
      summary:
        "Live-data bundle in the exact shape the Aether client portal UI expects. Consumed synchronously by the unpacked bundle's mock-data shim.",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
    },
  },
  async (request) => getAetherBundle(workspaceIdFromRequest(request)),
);

app.get(
  "/api/portal/account",
  {
    schema: {
      tags: ["Portal / Account"],
      summary: "Current workspace profile and plan",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
    },
  },
  async (request) => getPortalAccount(workspaceIdFromRequest(request)),
);

app.patch(
  "/api/portal/account",
  {
    schema: {
      tags: ["Portal / Account"],
      summary: "Update workspace profile fields",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
      body: Type.Partial(
        Type.Object({
          name: Type.String(),
          contactName: Type.String(),
          contactEmail: Type.String(),
          contactPhone: Type.String(),
          timezone: Type.String(),
          defaultLanguage: Type.String(),
          retentionDays: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
          monthlyBudgetCents: Type.Integer({ minimum: 0 }),
        }),
      ),
    },
  },
  async (request) => updateClient(workspaceIdFromRequest(request), request.body, undefined),
);

app.get(
  "/api/portal/usage",
  {
    schema: {
      tags: ["Portal / Account"],
      summary: "Detailed month-to-date usage and budget consumption",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
    },
  },
  async (request) => getPortalUsage(workspaceIdFromRequest(request)),
);

app.get(
  "/api/portal/api-keys",
  {
    schema: {
      tags: ["Portal / API Keys"],
      summary: "List active API keys for the workspace",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
    },
  },
  async (request) => listApiKeys(workspaceIdFromRequest(request)),
);

app.post(
  "/api/portal/api-keys",
  {
    schema: {
      tags: ["Portal / API Keys"],
      summary: "Create a new API key. Secret returned only once.",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
      body: Type.Object({
        label: Type.String({ minLength: 1 }),
        scopes: Type.Optional(Type.Array(Type.String())),
      }),
    },
  },
  async (request, reply) => {
    const key = await createApiKey(workspaceIdFromRequest(request), request.body);
    reply.code(201);
    return key;
  },
);

app.delete(
  "/api/portal/api-keys/:keyId",
  {
    schema: {
      tags: ["Portal / API Keys"],
      summary: "Revoke an API key",
      params: Type.Object({ keyId: Type.String() }),
    },
  },
  async (request) => revokeApiKey(request.params.keyId),
);

app.get(
  "/api/portal/support/tickets",
  {
    schema: {
      tags: ["Portal / Support"],
      summary: "List client's support tickets",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
    },
  },
  async (request) => listClientSupportTickets(workspaceIdFromRequest(request)),
);

app.post(
  "/api/portal/support/tickets",
  {
    schema: {
      tags: ["Portal / Support"],
      summary: "Open a new support ticket",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
      body: Type.Object({
        subject: Type.String({ minLength: 1 }),
        body: Type.String({ minLength: 1 }),
        priority: Type.Optional(ticketPrioritySchema),
        openedBy: Type.Optional(Type.String()),
      }),
    },
  },
  async (request, reply) => {
    const ticket = await openSupportTicket(workspaceIdFromRequest(request), {
      ...request.body,
      priority: request.body.priority as SupportTicketPriority | undefined,
    });
    reply.code(201);
    return ticket;
  },
);

app.get(
  "/api/portal/support/tickets/:ticketId",
  {
    schema: {
      tags: ["Portal / Support"],
      summary: "Get the client's view of a ticket and its message thread",
      params: Type.Object({ ticketId: Type.String() }),
    },
  },
  async (request) => getClientSupportTicket(request.params.ticketId),
);

app.post(
  "/api/portal/support/tickets/:ticketId/reply",
  {
    schema: {
      tags: ["Portal / Support"],
      summary: "Reply to a ticket as the client",
      params: Type.Object({ ticketId: Type.String() }),
      body: Type.Object({
        author: Type.String({ minLength: 1 }),
        body: Type.String({ minLength: 1 }),
      }),
    },
  },
  async (request, reply) => {
    const result = await replyAsClient(request.params.ticketId, request.body);
    reply.code(201);
    return result;
  },
);

app.get(
  "/api/portal/announcements",
  {
    schema: {
      tags: ["Portal / Announcements"],
      summary: "Announcements visible to this workspace",
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
    },
  },
  async (request) => listAnnouncementsForWorkspace(workspaceIdFromRequest(request)),
);

app.post(
  "/api/portal/announcements/:announcementId/ack",
  {
    schema: {
      tags: ["Portal / Announcements"],
      summary: "Mark an announcement as acknowledged",
      params: Type.Object({ announcementId: Type.String() }),
      querystring: Type.Object({ workspaceId: Type.Optional(Type.String()) }),
    },
  },
  async (request) =>
    acknowledgeAnnouncement(workspaceIdFromRequest(request), request.params.announcementId),
);

// ------------------------------------------------------------------
// Inbound webhook (unchanged behavior)
// ------------------------------------------------------------------

const inboundWebhookBody = Type.Object({
  id: Type.Optional(Type.String()),
  eventType: Type.String({ minLength: 1 }),
  occurredAt: Type.Optional(Type.String()),
  summary: Type.Optional(Type.String()),
  severity: Type.Optional(Type.String()),
  channel: Type.Optional(channelSchema),
  dispatchWebhooks: Type.Optional(Type.Boolean()),
  contact: Type.Optional(Type.String()),
  agent: Type.Optional(
    Type.Object({
      id: Type.Optional(Type.String()),
      name: Type.Optional(Type.String()),
      type: Type.Optional(agentTypeSchema),
      status: Type.Optional(agentStatusSchema),
      personality: Type.Optional(Type.String()),
      language: Type.Optional(Type.String()),
      greeting: Type.Optional(Type.String()),
    }),
  ),
  call: Type.Optional(
    Type.Object({
      id: Type.Optional(Type.String()),
      direction: Type.Optional(Type.String()),
      status: Type.Optional(Type.String()),
      outcome: Type.Optional(Type.String()),
      contact: Type.Optional(Type.String()),
      startedAt: Type.Optional(Type.String()),
      endedAt: Type.Optional(Type.String()),
      durationSec: Type.Optional(Type.Number()),
      responseTimeMs: Type.Optional(Type.Number()),
      sentimentScore: Type.Optional(Type.Number()),
      resolution: Type.Optional(Type.String()),
      followUpRequired: Type.Optional(Type.Boolean()),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
    }),
  ),
  message: Type.Optional(
    Type.Object({
      id: Type.Optional(Type.String()),
      direction: Type.Optional(Type.String()),
      status: Type.Optional(Type.String()),
      body: Type.Optional(Type.String()),
      contact: Type.Optional(Type.String()),
      occurredAt: Type.Optional(Type.String()),
      threadId: Type.Optional(Type.String()),
      metadata: Type.Optional(Type.Record(Type.String(), Type.Any())),
    }),
  ),
  transcript: Type.Optional(
    Type.Object({
      id: Type.Optional(Type.String()),
      startedAt: Type.Optional(Type.String()),
      endedAt: Type.Optional(Type.String()),
      durationSec: Type.Optional(Type.Number()),
      outcome: Type.Optional(Type.String()),
      sentiment: Type.Optional(
        Type.Union([Type.Literal("pos"), Type.Literal("neu"), Type.Literal("neg")]),
      ),
      responseTimeMs: Type.Optional(Type.Number()),
      sentimentScore: Type.Optional(Type.Number()),
      resolution: Type.Optional(Type.String()),
      followUpRequired: Type.Optional(Type.Boolean()),
      summary: Type.Optional(Type.String()),
      chapters: Type.Optional(Type.Array(Type.String())),
      thread: Type.Optional(
        Type.Array(
          Type.Object({
            speaker: Type.Optional(
              Type.Union([Type.Literal("agent"), Type.Literal("user"), Type.Literal("system")]),
            ),
            who: Type.Optional(
              Type.Union([Type.Literal("agent"), Type.Literal("user"), Type.Literal("system")]),
            ),
            timestampOffsetSec: Type.Optional(Type.Number()),
            text: Type.String(),
          }),
        ),
      ),
    }),
  ),
  knowledgeBase: Type.Optional(
    Type.Object({
      id: Type.Optional(Type.String()),
      action: Type.Optional(
        Type.Union([Type.Literal("create"), Type.Literal("update"), Type.Literal("delete")]),
      ),
      title: Type.Optional(Type.String()),
      type: Type.Optional(knowledgeBaseTypeSchema),
      content: Type.Optional(Type.String()),
      tags: Type.Optional(Type.Array(Type.String())),
      attachToAgent: Type.Optional(Type.Boolean()),
    }),
  ),
});

app.post(
  "/api/webhooks/agent-events",
  {
    schema: {
      tags: ["Webhooks"],
      summary:
        "Inbound webhook for agent activity: calls, transcripts, messages, and knowledge-base changes",
      body: inboundWebhookBody,
    },
  },
  async (request) => {
    if (env.inboundWebhookSecret) {
      const provided = request.headers["x-aether-secret"];
      if (provided !== env.inboundWebhookSecret) {
        replyUnauthorized();
      }
    }

    return ingestAgentWebhook(request.body);
  },
);

function replyUnauthorized(): never {
  const error = new Error("Invalid x-aether-secret header.");
  (error as Error & { statusCode?: number }).statusCode = 401;
  throw error;
}

app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
  app.log.error(error);
  reply.status(error.statusCode ?? 500).send({ message: error.message });
});

await prisma.$connect();

app.addHook("onClose", async () => {
  await prisma.$disconnect();
});

await app.listen({ port: env.port, host: env.host });
