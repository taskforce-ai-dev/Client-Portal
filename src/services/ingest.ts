import { AgentStatus, AgentType, Channel, KnowledgeBaseType, TranscriptSentiment, TranscriptSpeaker } from "@prisma/client";

import { prisma } from "../lib/prisma.js";
import { createPrefixedId, toDateOrNull } from "../lib/utils.js";
import { dispatchAgentEvent } from "./webhooks.js";

export interface AgentWebhookPayload {
  id?: string;
  eventType: string;
  occurredAt?: string;
  summary?: string;
  severity?: string;
  channel?: "voice" | "whatsapp";
  dispatchWebhooks?: boolean;
  contact?: string;
  agent?: {
    id?: string;
    name?: string;
    type?: "sales" | "support" | "booking" | "coldcall";
    status?: "live" | "paused" | "idle";
    personality?: string;
    language?: string;
    greeting?: string;
  };
  call?: {
    id?: string;
    direction?: string;
    status?: string;
    outcome?: string;
    contact?: string;
    startedAt?: string;
    endedAt?: string;
    durationSec?: number;
    responseTimeMs?: number;
    sentimentScore?: number;
    resolution?: string;
    followUpRequired?: boolean;
    metadata?: Record<string, unknown>;
  };
  message?: {
    id?: string;
    direction?: string;
    status?: string;
    body?: string;
    contact?: string;
    occurredAt?: string;
    threadId?: string;
    metadata?: Record<string, unknown>;
  };
  transcript?: {
    id?: string;
    startedAt?: string;
    endedAt?: string;
    durationSec?: number;
    outcome?: string;
    sentiment?: "pos" | "neu" | "neg";
    responseTimeMs?: number;
    sentimentScore?: number;
    resolution?: string;
    followUpRequired?: boolean;
    summary?: string;
    chapters?: string[];
    thread?: Array<{
      speaker?: "agent" | "user" | "system";
      who?: "agent" | "user" | "system";
      timestampOffsetSec?: number;
      text: string;
    }>;
  };
  knowledgeBase?: {
    id?: string;
    action?: "create" | "update" | "delete";
    title?: string;
    type?: "faq" | "script" | "product_info" | "objection_handling" | "pricing";
    content?: string;
    tags?: string[];
    attachToAgent?: boolean;
  };
}

async function ensureAgent(payload: AgentWebhookPayload["agent"], channel?: AgentWebhookPayload["channel"]) {
  if (!payload?.id && !payload?.name) {
    return null;
  }

  const existing = payload.id
    ? await prisma.agent.findUnique({ where: { id: payload.id } })
    : await prisma.agent.findUnique({ where: { name: payload.name! } });

  const agent =
    existing ??
    (await prisma.agent.create({
      data: {
        id: payload.id ?? createPrefixedId("agt"),
        name: payload.name ?? "Unnamed Agent",
        type: (payload.type ?? "sales") as AgentType,
        status: (payload.status ?? "live") as AgentStatus,
        personality: payload.personality,
        language: payload.language,
        greeting: payload.greeting,
      },
    }));

  await prisma.agent.update({
    where: { id: agent.id },
    data: {
      type: (payload.type ?? agent.type) as AgentType,
      status: (payload.status ?? agent.status) as AgentStatus,
      personality: payload.personality ?? agent.personality,
      language: payload.language ?? agent.language,
      greeting: payload.greeting ?? agent.greeting,
    },
  });

  if (channel) {
    await prisma.agentChannel.upsert({
      where: {
        agentId_channel: {
          agentId: agent.id,
          channel: channel as Channel,
        },
      },
      update: {},
      create: {
        agentId: agent.id,
        channel: channel as Channel,
      },
    });
  }

  return prisma.agent.findUniqueOrThrow({
    where: { id: agent.id },
  });
}

async function upsertCall(agentId: string, workspaceId: string | null, payload: NonNullable<AgentWebhookPayload["call"]>, fallbackOccurredAt: Date) {
  const startedAt = toDateOrNull(payload.startedAt) ?? fallbackOccurredAt;
  const endedAt = toDateOrNull(payload.endedAt);
  const callId = payload.id ?? createPrefixedId("call");

  return prisma.call.upsert({
    where: { id: callId },
    update: {
      direction: payload.direction,
      status: payload.status ?? "completed",
      outcome: payload.outcome,
      contact: payload.contact ?? "unknown",
      startedAt,
      endedAt,
      durationSec: payload.durationSec ?? 0,
      responseTimeMs: payload.responseTimeMs,
      sentimentScore: payload.sentimentScore,
      resolution: payload.resolution,
      followUpRequired: payload.followUpRequired ?? false,
      metadataJson: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    },
    create: {
      id: callId,
      agentId,
      workspaceId: workspaceId ?? undefined,
      direction: payload.direction,
      status: payload.status ?? "completed",
      outcome: payload.outcome,
      contact: payload.contact ?? "unknown",
      startedAt,
      endedAt,
      durationSec: payload.durationSec ?? 0,
      responseTimeMs: payload.responseTimeMs,
      sentimentScore: payload.sentimentScore,
      resolution: payload.resolution,
      followUpRequired: payload.followUpRequired ?? false,
      metadataJson: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    },
  });
}

async function upsertTranscript(
  agentId: string,
  workspaceId: string | null,
  channel: NonNullable<AgentWebhookPayload["channel"]>,
  payload: NonNullable<AgentWebhookPayload["transcript"]>,
  fallbackOccurredAt: Date,
  callId?: string,
) {
  const transcriptId = payload.id ?? createPrefixedId("tx");
  const startedAt = toDateOrNull(payload.startedAt) ?? fallbackOccurredAt;
  const endedAt = toDateOrNull(payload.endedAt);

  await prisma.transcript.upsert({
    where: { id: transcriptId },
    update: {
      agentId,
      channel: channel as Channel,
      contact: "unknown",
      callId,
      startedAt,
      endedAt,
      durationSec: payload.durationSec ?? 0,
      outcome: payload.outcome,
      sentiment: (payload.sentiment ?? "neu") as TranscriptSentiment,
      responseTimeMs: payload.responseTimeMs,
      sentimentScore: payload.sentimentScore,
      resolution: payload.resolution,
      followUpRequired: payload.followUpRequired ?? false,
      summary: payload.summary,
      rawPayloadJson: JSON.stringify(payload),
    },
    create: {
      id: transcriptId,
      agentId,
      workspaceId: workspaceId ?? undefined,
      channel: channel as Channel,
      contact: "unknown",
      callId,
      startedAt,
      endedAt,
      durationSec: payload.durationSec ?? 0,
      outcome: payload.outcome,
      sentiment: (payload.sentiment ?? "neu") as TranscriptSentiment,
      responseTimeMs: payload.responseTimeMs,
      sentimentScore: payload.sentimentScore,
      resolution: payload.resolution,
      followUpRequired: payload.followUpRequired ?? false,
      summary: payload.summary,
      rawPayloadJson: JSON.stringify(payload),
    },
  });

  await prisma.transcriptChapter.deleteMany({ where: { transcriptId } });
  await prisma.transcriptEntry.deleteMany({ where: { transcriptId } });

  if (payload.chapters?.length) {
    await prisma.transcriptChapter.createMany({
      data: payload.chapters.map((label, index) => ({
        transcriptId,
        label,
        sortOrder: index,
      })),
    });
  }

  if (payload.thread?.length) {
    await prisma.transcriptEntry.createMany({
      data: payload.thread.map((entry, index) => ({
        transcriptId,
        speaker: (entry.speaker ?? entry.who ?? "user") as TranscriptSpeaker,
        timestampOffsetSec: entry.timestampOffsetSec ?? 0,
        text: entry.text,
        sortOrder: index,
      })),
    });
  }

  return prisma.transcript.findUniqueOrThrow({ where: { id: transcriptId } });
}

async function upsertMessageEvent(
  agentId: string,
  workspaceId: string | null,
  payload: NonNullable<AgentWebhookPayload["message"]>,
  fallbackOccurredAt: Date,
  transcriptId?: string,
) {
  const occurredAt = toDateOrNull(payload.occurredAt) ?? fallbackOccurredAt;
  const messageId = payload.id ?? createPrefixedId("msg");

  return prisma.messageEvent.upsert({
    where: { id: messageId },
    update: {
      agentId,
      transcriptId,
      direction: payload.direction ?? "outbound",
      status: payload.status ?? "sent",
      contact: payload.contact ?? "unknown",
      body: payload.body ?? "",
      occurredAt,
      threadId: payload.threadId,
      metadataJson: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    },
    create: {
      id: messageId,
      agentId,
      workspaceId: workspaceId ?? undefined,
      transcriptId,
      direction: payload.direction ?? "outbound",
      status: payload.status ?? "sent",
      contact: payload.contact ?? "unknown",
      body: payload.body ?? "",
      occurredAt,
      threadId: payload.threadId,
      metadataJson: payload.metadata ? JSON.stringify(payload.metadata) : undefined,
    },
  });
}

async function upsertKnowledgeBase(agentId: string | null, payload: NonNullable<AgentWebhookPayload["knowledgeBase"]>) {
  if (payload.action === "delete" && payload.id) {
    await prisma.knowledgeBaseDocument.delete({ where: { id: payload.id } });
    return null;
  }

  const knowledgeBaseId = payload.id ?? createPrefixedId("kb");
  const knowledgeBase = await prisma.knowledgeBaseDocument.upsert({
    where: { id: knowledgeBaseId },
    update: {
      title: payload.title ?? "Untitled KB Entry",
      type: (payload.type ?? "faq") as KnowledgeBaseType,
      content: payload.content ?? "",
      lastWebhookAt: new Date(),
    },
    create: {
      id: knowledgeBaseId,
      title: payload.title ?? "Untitled KB Entry",
      type: (payload.type ?? "faq") as KnowledgeBaseType,
      content: payload.content ?? "",
      lastWebhookAt: new Date(),
    },
  });

  await prisma.knowledgeBaseTag.deleteMany({ where: { knowledgeBaseId } });

  if (payload.tags?.length) {
    await prisma.knowledgeBaseTag.createMany({
      data: payload.tags.map((value) => ({
        knowledgeBaseId,
        value,
      })),
    });
  }

  if (agentId && payload.attachToAgent !== false) {
    await prisma.agentKnowledgeBase.upsert({
      where: {
        agentId_knowledgeBaseId: {
          agentId,
          knowledgeBaseId,
        },
      },
      update: {},
      create: {
        agentId,
        knowledgeBaseId,
      },
    });
  }

  return knowledgeBase;
}

function inferSeverity(eventType: string, provided?: string): string {
  if (provided) {
    return provided;
  }

  if (eventType.includes("failed") || eventType.includes("error")) {
    return "error";
  }

  if (eventType.includes("alert") || eventType.includes("escalated")) {
    return "warning";
  }

  if (eventType.includes("completed") || eventType.includes("converted") || eventType.includes("booked")) {
    return "success";
  }

  return "info";
}

export async function ingestAgentWebhook(payload: AgentWebhookPayload) {
  const occurredAt = toDateOrNull(payload.occurredAt) ?? new Date();
  const agent = await ensureAgent(payload.agent, payload.channel);

  const workspaceId = agent?.workspaceId ?? null;

  const call = agent && payload.call ? await upsertCall(agent.id, workspaceId, payload.call, occurredAt) : null;
  const transcript =
    agent && payload.channel && payload.transcript
      ? await upsertTranscript(agent.id, workspaceId, payload.channel, payload.transcript, occurredAt, call?.id)
      : null;
  const message =
    agent && payload.message
      ? await upsertMessageEvent(agent.id, workspaceId, payload.message, occurredAt, transcript?.id)
      : null;
  const knowledgeBase = payload.knowledgeBase ? await upsertKnowledgeBase(agent?.id ?? null, payload.knowledgeBase) : null;

  const agentEvent = await prisma.agentEvent.create({
    data: {
      id: payload.id ?? createPrefixedId("evt"),
      eventType: payload.eventType,
      summary:
        payload.summary ??
        payload.message?.body ??
        payload.knowledgeBase?.title ??
        payload.call?.outcome ??
        payload.transcript?.summary ??
        `Processed ${payload.eventType}`,
      severity: inferSeverity(payload.eventType, payload.severity),
      workspaceId: workspaceId ?? undefined,
      agentId: agent?.id,
      callId: call?.id,
      messageEventId: message?.id,
      transcriptId: transcript?.id,
      knowledgeBaseId: knowledgeBase?.id,
      payloadJson: JSON.stringify(payload),
      occurredAt,
    },
  });

  const dispatchedCount =
    payload.dispatchWebhooks === false ? 0 : await dispatchAgentEvent(prisma, agentEvent);

  return {
    eventId: agentEvent.id,
    dispatchedCount,
    agentId: agent?.id ?? null,
    callId: call?.id ?? null,
    transcriptId: transcript?.id ?? null,
    messageId: message?.id ?? null,
    knowledgeBaseId: knowledgeBase?.id ?? null,
  };
}
