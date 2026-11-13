import type { ReactNode } from "react";

import { findStage, titleCase, type Tone } from "../lib/constants";

export function Badge({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot ? <span className="badge__dot" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const stage = findStage(status);
  return (
    <Badge tone={stage.tone} dot>
      {stage.label}
    </Badge>
  );
}

export function PlainBadge({ value }: { value: string | null | undefined }) {
  return <Badge tone="neutral">{value ? titleCase(value) : "—"}</Badge>;
}

export function ScoreBadge({ score }: { score: number }) {
  const tone: Tone = score >= 75 ? "success" : score >= 45 ? "warning" : score > 0 ? "danger" : "neutral";
  return <Badge tone={tone}>{score}</Badge>;
}
