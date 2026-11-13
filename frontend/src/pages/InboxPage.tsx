import { useEffect, useMemo, useRef, useState } from "react";

import { Badge, PlainBadge, ScoreBadge, StatusBadge } from "../components/Badge";
import { EmptyState } from "../components/EmptyState";
import { Icon } from "../components/Icon";
import { ErrorMessage, Loading } from "../components/Status";
import { text } from "../format";
import { useApi } from "../hooks/useApi";
import {
  budgetRange,
  formatClockTime,
  formatDay,
  formatRelativeTime,
  initials,
  titleCase,
  CONVERSATION_STATUSES,
} from "../lib/constants";
import {
  addLocalActivity,
  addLocalMessage,
  getLocalMessages,
  isAiPaused,
  setAiPaused,
} from "../lib/storage";
import { useToast } from "../lib/toast";
import { navigate } from "../router";
import type {
  Conversation,
  ConversationDetail,
  Lead,
  ListResponse,
  Message,
  MessageTemplate,
} from "../types";

function renderTemplate(content: string, lead: Lead | null | undefined): string {
  return content
    .replaceAll("{{name}}", lead?.name ?? "there")
    .replaceAll("{{phone}}", lead?.phone ?? "")
    .replaceAll("{{city}}", lead?.preferred_city ?? "your city")
    .replaceAll("{{budget}}", lead ? budgetRange(lead.budget_min, lead.budget_max) : "");
}

function ConversationRow({
  conversation,
  lead,
  lastMessage,
  active,
}: {
  conversation: Conversation;
  lead: Lead | undefined;
  lastMessage: Message | undefined;
  active: boolean;
}) {
  return (
    <button
      type="button"
      className={`conversation-row ${active ? "conversation-row--active" : ""}`}
      onClick={() => navigate(`/inbox/${conversation.id}`)}
    >
      <span className="avatar">{initials(lead?.name, lead?.phone?.slice(-2) ?? "WA")}</span>
      <span className="conversation-row__body">
        <span className="conversation-row__top">
          <strong>{lead?.name ?? lead?.phone ?? "Unknown lead"}</strong>
          <small>{formatRelativeTime(conversation.last_message_at ?? conversation.started_at)}</small>
        </span>
        <span className="conversation-row__preview">
          {lastMessage ? (
            <>
              {lastMessage.direction === "outbound" ? "You: " : ""}
              {lastMessage.body}
            </>
          ) : (
            "No messages yet"
          )}
        </span>
        <span className="conversation-row__meta">
          <PlainBadge value={conversation.channel} />
          <PlainBadge value={conversation.status} />
        </span>
      </span>
    </button>
  );
}

function ConversationThread({
  conversationId,
  leadMap,
  bump,
}: {
  conversationId: string;
  leadMap: Map<string, Lead>;
  bump: () => void;
}) {
  const { toast } = useToast();
  const { data, loading, error, reload } = useApi<ConversationDetail>(
    `/api/conversations/${conversationId}`,
  );
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>(() =>
    getLocalMessages(conversationId),
  );
  const [paused, setPaused] = useState(() => isAiPaused(conversationId));
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [showContact, setShowContact] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const templatesApi = useApi<ListResponse<MessageTemplate>>("/api/message-templates", {
    is_active: "true",
    limit: 50,
  });

  useEffect(() => {
    setLocalMessages(getLocalMessages(conversationId));
    setPaused(isAiPaused(conversationId));
    setDraft("");
    setTemplatesOpen(false);
  }, [conversationId]);

  const messages = useMemo(() => {
    const server = data?.messages ?? [];
    return [...server, ...localMessages].sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
    );
  }, [data, localMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, conversationId]);

  const lead = data?.leads ?? leadMap.get(data?.lead_id ?? "");
  const effectivePaused = paused;

  const send = () => {
    if (!draft.trim() || !data) {
      return;
    }
    addLocalMessage(conversationId, data.lead_id, draft.trim());
    setLocalMessages(getLocalMessages(conversationId));
    setDraft("");
    setTemplatesOpen(false);
    bump();
    toast("Message queued locally. Connect the send API/n8n workflow to deliver it.", "warning");
  };

  const toggleAi = (nextPaused: boolean) => {
    setAiPaused(conversationId, nextPaused);
    setPaused(nextPaused);
    if (data) {
      addLocalActivity(
        data.lead_id,
        nextPaused ? "handoff" : "status_changed",
        nextPaused ? "AI paused and conversation handed to a human agent." : "AI resumed for this conversation.",
      );
    }
    toast(nextPaused ? "AI paused. You have taken over this chat." : "AI resumed for this chat.", "success");
  };

  if (loading) {
    return <Loading label="Loading conversation..." />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={() => void reload()} />;
  }
  if (!data) {
    return <EmptyState icon="inbox" title="Conversation not found" />;
  }

  let lastDay = "";

  return (
    <div className="chat">
      <header className="chat__header">
        <div className="chat__identity">
          <span className="avatar avatar--md">{initials(lead?.name, lead?.phone?.slice(-2) ?? "WA")}</span>
          <div>
            <strong>{lead?.name ?? lead?.phone ?? "Unknown lead"}</strong>
            <small>{lead?.phone ?? "No phone on file"}</small>
          </div>
        </div>
        <div className="chat__badges">
          <PlainBadge value={data.channel} />
          <PlainBadge value={data.status} />
          <Badge tone={effectivePaused ? "warning" : "success"} dot>
            {effectivePaused ? "AI paused" : "AI active"}
          </Badge>
        </div>
        <div className="chat__actions">
          <button
            type="button"
            className="button button--sm"
            onClick={() => toggleAi(!effectivePaused)}
          >
            <Icon name={effectivePaused ? "play" : "pause"} size={14} />
            {effectivePaused ? "Resume AI" : "Take over"}
          </button>
          {lead ? (
            <button type="button" className="icon-button" onClick={() => navigate(`/leads/${lead.id}`)} aria-label="Open lead">
              <Icon name="external" size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className="icon-button"
            onClick={() => setShowContact((current) => !current)}
            aria-label="Toggle contact panel"
            aria-pressed={showContact}
          >
            <Icon name="user" size={16} />
          </button>
        </div>
      </header>

      <div className="chat__body">
        <div className="chat__thread">
          {messages.length === 0 ? (
            <EmptyState
              icon="message"
              title="No messages in this conversation"
              description="Send the first message using a template or free text."
            />
          ) : (
            messages.map((message) => {
              const day = formatDay(message.created_at);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={message.id}>
                  {showDay ? <div className="day-divider">{day}</div> : null}
                  <div
                    className={`bubble-row ${message.direction === "outbound" ? "bubble-row--outbound" : ""}`}
                  >
                    <div className={`bubble bubble--${message.sender} ${message.id.startsWith("message-") ? "bubble--local" : ""}`}>
                      <p>{message.body}</p>
                      <span>
                        {titleCase(message.sender)} · {formatClockTime(message.created_at)}
                        {message.id.startsWith("message-") ? " · local" : ""}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {showContact ? (
          <aside className="chat__contact">
            {lead ? (
              <>
                <div className="contact-card">
                  <span className="avatar avatar--lg">{initials(lead.name, lead.phone.slice(-2))}</span>
                  <strong>{lead.name ?? lead.phone}</strong>
                  <small>{lead.phone}</small>
                  <div className="contact-card__badges">
                    <StatusBadge status={lead.status} />
                    <ScoreBadge score={lead.qualification_score} />
                  </div>
                </div>
                <dl className="info-list">
                  <div>
                    <dt>Budget</dt>
                    <dd>{budgetRange(lead.budget_min, lead.budget_max)}</dd>
                  </div>
                  <div>
                    <dt>City</dt>
                    <dd>{text(lead.preferred_city)}</dd>
                  </div>
                  <div>
                    <dt>Property type</dt>
                    <dd>{text(lead.property_type)}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{titleCase(lead.source)}</dd>
                  </div>
                  <div>
                    <dt>Next follow-up</dt>
                    <dd>{formatRelativeTime(lead.next_follow_up_at)}</dd>
                  </div>
                  <div>
                    <dt>Last contacted</dt>
                    <dd>{formatRelativeTime(lead.last_contacted_at)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className="button button--block"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  View full lead
                </button>
              </>
            ) : (
              <p className="muted">Lead details unavailable.</p>
            )}
            <div className="contact-card__meta">
              <span>Started {formatRelativeTime(data.started_at)}</span>
              <span>Last message {formatRelativeTime(data.last_message_at)}</span>
            </div>
          </aside>
        ) : null}
      </div>

      <footer className="composer">
        <div className="composer__tools">
          <button
            type="button"
            className="button button--sm button--ghost"
            onClick={() => setTemplatesOpen((current) => !current)}
          >
            <Icon name="template" size={14} /> Templates
          </button>
          <button
            type="button"
            className="button button--sm button--ghost"
            onClick={() => toast("Attachments will upload through the media API when connected.", "warning")}
          >
            <Icon name="plus" size={14} /> Attach
          </button>
          <span className="composer__hint">Enter to send · Shift+Enter for a new line</span>
        </div>

        {templatesOpen ? (
          <div className="template-picker">
            {templatesApi.loading ? <p className="muted">Loading templates...</p> : null}
            {(templatesApi.data?.data ?? []).length === 0 && !templatesApi.loading ? (
              <p className="muted">No active templates.</p>
            ) : null}
            {(templatesApi.data?.data ?? []).map((template) => (
              <button
                key={template.id}
                type="button"
                className="template-option"
                onClick={() => {
                  setDraft(renderTemplate(template.content, lead));
                  setTemplatesOpen(false);
                }}
              >
                <strong>{template.name}</strong>
                <small>{template.content}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="composer__box">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            placeholder={`Reply to ${lead?.name ?? "lead"}...`}
            rows={2}
          />
          <button type="button" className="button button--primary" onClick={send} disabled={!draft.trim()}>
            <Icon name="send" size={15} /> Send
          </button>
        </div>
        <p className="composer__note">
          {effectivePaused
            ? "AI is paused — messages from this chat need a human reply."
            : "AI is handling this conversation. Sending a message will not automatically pause it."}
        </p>
      </footer>
    </div>
  );
}

export function InboxPage({ id }: { id?: string }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [version, setVersion] = useState(0);

  const conversationsApi = useApi<ListResponse<Conversation>>("/api/conversations", {
    status,
    limit: 100,
    order: "last_message_at.desc",
  });
  const leadsApi = useApi<ListResponse<Lead>>("/api/leads", { limit: 200 });
  const messagesApi = useApi<ListResponse<Message>>("/api/messages", {
    limit: 200,
    order: "created_at.desc",
  });

  const leadMap = useMemo(() => {
    const map = new Map<string, Lead>();
    for (const lead of leadsApi.data?.data ?? []) {
      map.set(lead.id, lead);
    }
    return map;
  }, [leadsApi.data]);

  const lastMessages = useMemo(() => {
    const map = new Map<string, Message>();
    for (const message of messagesApi.data?.data ?? []) {
      if (!map.has(message.conversation_id)) {
        map.set(message.conversation_id, message);
      }
    }
    for (const conversation of conversationsApi.data?.data ?? []) {
      const local = getLocalMessages(conversation.id);
      const lastLocal = local[local.length - 1];
      const existing = map.get(conversation.id);
      if (
        lastLocal &&
        (!existing ||
          new Date(lastLocal.created_at).getTime() > new Date(existing.created_at).getTime())
      ) {
        map.set(conversation.id, lastLocal);
      }
    }
    return map;
  }, [messagesApi.data, conversationsApi.data, version]);

  const conversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (conversationsApi.data?.data ?? []).filter((conversation) => {
      if (!term) {
        return true;
      }
      const lead = leadMap.get(conversation.lead_id);
      const haystack = `${lead?.name ?? ""} ${lead?.phone ?? ""} ${lead?.email ?? ""}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [conversationsApi.data, leadMap, search, version]);

  const query = new URLSearchParams(window.location.search);
  const leadFilter = query.get("lead");
  const selectedId =
    id ??
    (leadFilter
      ? conversations.find((conversation) => conversation.lead_id === leadFilter)?.id
      : undefined) ??
    conversations[0]?.id;

  const openCount = (conversationsApi.data?.data ?? []).filter(
    (conversation) => conversation.status === "open",
  ).length;
  const handedOffCount = (conversationsApi.data?.data ?? []).filter(
    (conversation) => conversation.status === "handed_off",
  ).length;

  return (
    <div className="inbox">
      <aside className="inbox-list">
        <header className="inbox-list__header">
          <div>
            <h1>Inbox</h1>
            <p>{openCount} open · {handedOffCount} handed off</p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              void conversationsApi.reload();
              void messagesApi.reload();
              void leadsApi.reload();
              setVersion((current) => current + 1);
            }}
            aria-label="Refresh inbox"
          >
            <Icon name="refresh" size={16} />
          </button>
        </header>

        <div className="inbox-list__filters">
          <span className="input-with-icon">
            <Icon name="search" size={15} />
            <input
              placeholder="Search conversations"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {CONVERSATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {titleCase(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="inbox-list__scroll">
          {conversationsApi.loading ? <Loading label="Loading conversations..." /> : null}
          {conversationsApi.error ? (
            <ErrorMessage message={conversationsApi.error} onRetry={() => void conversationsApi.reload()} />
          ) : null}
          {!conversationsApi.loading && !conversationsApi.error && conversations.length === 0 ? (
            <EmptyState icon="inbox" title="No conversations" description="Connect WhatsApp to start receiving leads." />
          ) : null}
          {conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              lead={leadMap.get(conversation.lead_id)}
              lastMessage={lastMessages.get(conversation.id)}
              active={selectedId === conversation.id}
            />
          ))}
        </div>
      </aside>

      <section className="inbox-main">
        {selectedId ? (
          <ConversationThread
            key={selectedId}
            conversationId={selectedId}
            leadMap={leadMap}
            bump={() => setVersion((current) => current + 1)}
          />
        ) : (
          <EmptyState
            icon="inbox"
            title="Select a conversation"
            description="Choose a thread from the list to view messages and reply."
          />
        )}
      </section>
    </div>
  );
}
