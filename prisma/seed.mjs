// Seed the Sentinel admin database with starter data.
// Run after `prisma db push`:  DATABASE_URL=... node prisma/seed.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = {
    growth: await prisma.plan.upsert({
      where: { slug: "growth" }, update: {},
      create: { name: "Growth", slug: "growth", monthlyFeeCents: 199000, voiceCostPerMinute: 0.1, aiCostPerMessage: 0.002, callCostPerMinute: 0.12 },
    }),
    scale: await prisma.plan.upsert({
      where: { slug: "scale" }, update: {},
      create: { name: "Scale", slug: "scale", monthlyFeeCents: 148000, voiceCostPerMinute: 0.12, aiCostPerMessage: 0.003, callCostPerMinute: 0.14 },
    }),
    starter: await prisma.plan.upsert({
      where: { slug: "starter" }, update: {},
      create: { name: "Starter", slug: "starter", monthlyFeeCents: 97600, voiceCostPerMinute: 0.09, aiCostPerMessage: 0.002, callCostPerMinute: 0.1 },
    }),
    trial: await prisma.plan.upsert({
      where: { slug: "trial" }, update: {},
      create: { name: "Trial", slug: "trial", monthlyFeeCents: 0, isPublic: false },
    }),
  };

  const clientsSeed = [
    { company: "Tree House Chalets", contact: "Chrys Fernando", email: "hello@treehousechalets.com", country: "LK", phone: "+94 71 707 3529", timezone: "Asia/Colombo", status: "active", planId: plans.growth.id, agents: 1, paidInvoices: 3 },
    { company: "Winrich Hotel", contact: "Ops Team", email: "ops@winrich.com", country: "LK", timezone: "Asia/Colombo", status: "active", planId: plans.scale.id, agents: 2, paidInvoices: 3 },
    { company: "Flico", contact: "Flico Team", email: "team@flico.io", country: "US", timezone: "UTC", status: "active", planId: plans.starter.id, agents: 1, paidInvoices: 3 },
    { company: "Aether Labs", contact: "Founder", email: "founder@aether.ai", country: "US", timezone: "UTC", status: "trial", planId: plans.trial.id, agents: 1, paidInvoices: 0 },
    { company: "Northwind Co", contact: "Admin", email: "admin@northwind.co", country: "GB", timezone: "Europe/London", status: "blocked", planId: plans.growth.id, agents: 0, paidInvoices: 1 },
  ];

  for (const c of clientsSeed) {
    const client = await prisma.client.upsert({
      where: { email: c.email }, update: { company: c.company, status: c.status, planId: c.planId },
      create: { company: c.company, contact: c.contact, email: c.email, country: c.country, phone: c.phone ?? null, timezone: c.timezone, status: c.status, planId: c.planId },
    });
    // reset child rows for idempotency
    await prisma.agent.deleteMany({ where: { clientId: client.id } });
    await prisma.invoice.deleteMany({ where: { clientId: client.id } });
    for (let i = 0; i < c.agents; i++) {
      await prisma.agent.create({ data: { clientId: client.id, name: `Agent ${i + 1}`, role: "Booking Agent", status: "live" } });
    }
    const plan = Object.values(plans).find((p) => p.id === c.planId);
    for (let i = 0; i < c.paidInvoices; i++) {
      await prisma.invoice.create({
        data: { clientId: client.id, amountCents: plan?.monthlyFeeCents ?? 0, status: "paid", issuedAt: new Date(Date.now() - i * 30 * 86400000) },
      });
    }
  }

  await prisma.adminUser.upsert({
    where: { email: "maya@taskforceai.tech" }, update: {},
    create: { name: "Maya Reyes", email: "maya@taskforceai.tech", role: "super_admin", lastLoginAt: new Date() },
  });
  await prisma.adminUser.upsert({
    where: { email: "chrys@taskforceai.tech" }, update: {},
    create: { name: "Chrys Fernando", email: "chrys@taskforceai.tech", role: "super_admin", lastLoginAt: new Date() },
  });

  await prisma.auditLog.deleteMany({});
  await prisma.auditLog.createMany({
    data: [
      { adminName: "Maya Reyes", action: "agent.create", type: "agent", target: "Tree House Chalets", summary: "Added Chanya to Tree House Chalets" },
      { adminName: "Chrys Fernando", action: "client.activate", type: "client", target: "Winrich Hotel", summary: "Moved to Scale plan" },
      { adminName: "Maya Reyes", action: "payment.received", type: "billing", target: "Tree House Chalets", summary: "$1,990 received" },
    ],
  });

  console.log("Seed complete:", await prisma.client.count(), "clients,", await prisma.adminUser.count(), "admins");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
