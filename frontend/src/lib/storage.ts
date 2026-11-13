import type { Message } from "../types";

const PREFIX = "salesautomata";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(`${PREFIX}:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(`${PREFIX}:${key}`, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode. Local preview still works.
  }
}

export interface LocalActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  created_by: string;
  created_at: string;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getLocalLeadStatus(leadId: string): string | null {
  const map = read<Record<string, string>>("lead-status", {});
  return map[leadId] ?? null;
}

export function getLocalLeadStatuses(): Record<string, string> {
  return read<Record<string, string>>("lead-status", {});
}

export function setLocalLeadStatus(leadId: string, status: string): void {
  const map = read<Record<string, string>>("lead-status", {});
  map[leadId] = status;
  write("lead-status", map);
}

export function getLocalActivities(leadId: string): LocalActivity[] {
  const map = read<Record<string, LocalActivity[]>>("lead-activities", {});
  return map[leadId] ?? [];
}

export function addLocalActivity(
  leadId: string,
  activityType: string,
  description: string,
  createdBy = "You",
): LocalActivity {
  const map = read<Record<string, LocalActivity[]>>("lead-activities", {});
  const activity: LocalActivity = {
    id: makeId("activity"),
    lead_id: leadId,
    activity_type: activityType,
    description,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };
  map[leadId] = [activity, ...(map[leadId] ?? [])];
  write("lead-activities", map);
  return activity;
}

export function getLocalMessages(conversationId: string): Message[] {
  const map = read<Record<string, Message[]>>("messages", {});
  return map[conversationId] ?? [];
}

export function addLocalMessage(
  conversationId: string,
  leadId: string,
  body: string,
  sender = "agent",
): Message {
  const map = read<Record<string, Message[]>>("messages", {});
  const message: Message = {
    id: makeId("message"),
    conversation_id: conversationId,
    lead_id: leadId,
    direction: "outbound",
    sender,
    body,
    message_type: "text",
    whatsapp_message_id: null,
    created_at: new Date().toISOString(),
  };
  map[conversationId] = [...(map[conversationId] ?? []), message];
  write("messages", map);
  return message;
}

export function isAiPaused(conversationId: string): boolean {
  const map = read<Record<string, boolean>>("ai-paused", {});
  return Boolean(map[conversationId]);
}

export function setAiPaused(conversationId: string, paused: boolean): void {
  const map = read<Record<string, boolean>>("ai-paused", {});
  map[conversationId] = paused;
  write("ai-paused", map);
}
