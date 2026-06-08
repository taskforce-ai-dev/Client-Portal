import { config } from "dotenv";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";

config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  DATABASE_URL: z.string().min(1).default("file:./dev.db"),
  DASHBOARD_HTML_PATH: z.string().min(1).default("./Aether AI Agent Dashboard.html"),
  WORKSPACE_NAME: z.string().min(1).default("Acme Corp"),
  WORKSPACE_TIMEZONE: z.string().min(1).default("Asia/Colombo (UTC+05:30)"),
  WORKSPACE_DEFAULT_LANGUAGE: z.string().min(1).default("English (US)"),
  BILLING_CURRENCY: z.string().min(1).default("USD"),
  BILLING_PLAN_NAME: z.string().min(1).default("Scale"),
  BILLING_PLAN_FEE: z.string().min(1).default("899.00"),
  BILLING_MONTHLY_BUDGET: z.string().min(1).default("9500.00"),
  BILLING_VOICE_AGENT_RATE_PER_MINUTE: z.string().min(1).default("0.42"),
  BILLING_AI_AGENT_RATE_PER_MINUTE: z.string().min(1).default("0.50"),
  BILLING_CALL_RATE_PER_MINUTE: z.string().min(1).default("0.08"),
  BILLING_WHATSAPP_MESSAGE_RATE: z.string().min(1).default("0.02"),
  BILLING_TRANSCRIPT_RATE_PER_MINUTE: z.string().min(1).default("0.03"),
  BILLING_KB_DOCUMENT_MONTHLY_RATE: z.string().min(1).default("2.50"),
  BILLING_KB_UPDATE_RATE: z.string().min(1).default("0.15"),
  ANALYTICS_REVENUE_PER_CONVERSION: z.string().min(1).default("249.00"),
  INBOUND_WEBHOOK_SECRET: z.string().optional().transform((value) => value?.trim() || undefined),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
});

function parseMoneyToCents(value: string, key: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid money value for ${key}: "${value}"`);
  }

  return Math.round(parsed * 100);
}

function resolveDashboardPath(input: string): string {
  return isAbsolute(input) ? input : resolve(process.cwd(), input);
}

function normalizeDatabaseUrl(input: string): string {
  if (!input.startsWith("file:")) {
    return input;
  }

  const filePath = input.slice("file:".length);
  if (!filePath) {
    return input;
  }

  const toFileUrlPath = (value: string) => value.replace(/\\/g, "/");

  if (isAbsolute(filePath) || /^[A-Za-z]:[\\/]/.test(filePath)) {
    return `file:${toFileUrlPath(filePath)}`;
  }

  return `file:${toFileUrlPath(resolve(process.cwd(), filePath))}`;
}

const rawEnv = envSchema.parse(process.env);
const databaseUrl = normalizeDatabaseUrl(rawEnv.DATABASE_URL);
process.env.DATABASE_URL = databaseUrl;

export const env = {
  port: rawEnv.PORT,
  host: rawEnv.HOST,
  databaseUrl,
  dashboardHtmlPath: resolveDashboardPath(rawEnv.DASHBOARD_HTML_PATH),
  workspace: {
    name: rawEnv.WORKSPACE_NAME,
    timezone: rawEnv.WORKSPACE_TIMEZONE,
    defaultLanguage: rawEnv.WORKSPACE_DEFAULT_LANGUAGE,
  },
  billing: {
    currency: rawEnv.BILLING_CURRENCY,
    planName: rawEnv.BILLING_PLAN_NAME,
    planFeeCents: parseMoneyToCents(rawEnv.BILLING_PLAN_FEE, "BILLING_PLAN_FEE"),
    monthlyBudgetCents: parseMoneyToCents(rawEnv.BILLING_MONTHLY_BUDGET, "BILLING_MONTHLY_BUDGET"),
    voiceAgentRateCentsPerMinute: parseMoneyToCents(
      rawEnv.BILLING_VOICE_AGENT_RATE_PER_MINUTE,
      "BILLING_VOICE_AGENT_RATE_PER_MINUTE",
    ),
    aiAgentRateCentsPerMinute: parseMoneyToCents(
      rawEnv.BILLING_AI_AGENT_RATE_PER_MINUTE,
      "BILLING_AI_AGENT_RATE_PER_MINUTE",
    ),
    callRateCentsPerMinute: parseMoneyToCents(
      rawEnv.BILLING_CALL_RATE_PER_MINUTE,
      "BILLING_CALL_RATE_PER_MINUTE",
    ),
    whatsappMessageRateCents: parseMoneyToCents(
      rawEnv.BILLING_WHATSAPP_MESSAGE_RATE,
      "BILLING_WHATSAPP_MESSAGE_RATE",
    ),
    transcriptRateCentsPerMinute: parseMoneyToCents(
      rawEnv.BILLING_TRANSCRIPT_RATE_PER_MINUTE,
      "BILLING_TRANSCRIPT_RATE_PER_MINUTE",
    ),
    kbDocumentMonthlyRateCents: parseMoneyToCents(
      rawEnv.BILLING_KB_DOCUMENT_MONTHLY_RATE,
      "BILLING_KB_DOCUMENT_MONTHLY_RATE",
    ),
    kbUpdateRateCents: parseMoneyToCents(
      rawEnv.BILLING_KB_UPDATE_RATE,
      "BILLING_KB_UPDATE_RATE",
    ),
  },
  analytics: {
    revenuePerConversionCents: parseMoneyToCents(
      rawEnv.ANALYTICS_REVENUE_PER_CONVERSION,
      "ANALYTICS_REVENUE_PER_CONVERSION",
    ),
  },
  inboundWebhookSecret: rawEnv.INBOUND_WEBHOOK_SECRET,
  anthropicApiKey: rawEnv.ANTHROPIC_API_KEY,
  anthropicModel: rawEnv.ANTHROPIC_MODEL,
} as const;
