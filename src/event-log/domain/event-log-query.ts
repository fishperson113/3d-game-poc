import type { EventEnvelope } from "../../kernel/events/contracts";
import { eventError, type EventInfrastructureError } from "../../kernel/events/event-errors";
import { matchesEventPattern } from "../../kernel/events/namespaced-event-bus";

export type EventSeverity = EventEnvelope["severity"];
export type TagMatchMode = "any" | "all";

export interface EventLogFilter {
  readonly namespace?: string;
  readonly severities?: readonly EventSeverity[];
  readonly tags?: readonly string[];
  readonly tagMode?: TagMatchMode;
  readonly observedFrom?: string;
  readonly observedTo?: string;
  readonly correlationId?: string;
  readonly afterSequence?: number;
  readonly limit?: number;
}

export interface EventLogRetentionMetadata {
  readonly capacity: number;
  readonly retainedCount: number;
  readonly evictedCount: number;
  readonly oldestSequence?: number;
  readonly newestSequence?: number;
}

export interface EventLogQueryResult {
  readonly events: readonly EventEnvelope[];
  readonly matchedCount: number;
  readonly totalRetained: number;
  readonly evictedCount: number;
  readonly historyCutBeforeSequence?: number;
  readonly truncatedByLimit: boolean;
}

export interface EventLogQuerySource {
  query(filter?: EventLogFilter): EventLogQueryResult;
  getRetentionMetadata(): EventLogRetentionMetadata;
  snapshot(): readonly EventEnvelope[];
}

const severities = new Set<EventSeverity>(["debug", "info", "warn", "error"]);

export function validateEventLogFilter(filter: EventLogFilter): { ok: true } | { ok: false; error: EventInfrastructureError } {
  const namespace: unknown = filter.namespace;
  if (namespace !== undefined && (typeof namespace !== "string" || !validPattern(namespace))) {
    return { ok: false, error: eventError("event.filter.invalid", "namespace must be an event type or namespace wildcard.", "$filter.namespace") };
  }
  const severityValues: unknown = filter.severities;
  if (severityValues !== undefined && (!Array.isArray(severityValues) || severityValues.some((severity) => !isSeverity(severity)))) {
    return { ok: false, error: eventError("event.filter.invalid", "severities contains an unknown value.", "$filter.severities") };
  }
  const tagValues: unknown = filter.tags;
  if (tagValues !== undefined && (!Array.isArray(tagValues) || tagValues.some((tag) => typeof tag !== "string" || tag.length === 0))) {
    return { ok: false, error: eventError("event.filter.invalid", "tags must contain non-empty strings.", "$filter.tags") };
  }
  const tagMode: unknown = filter.tagMode;
  if (tagMode !== undefined && tagMode !== "any" && tagMode !== "all") {
    return { ok: false, error: eventError("event.filter.invalid", "tagMode must be `any` or `all`.", "$filter.tagMode") };
  }
  for (const key of ["observedFrom", "observedTo"] as const) {
    const timestamp: unknown = filter[key];
    if (timestamp !== undefined && (typeof timestamp !== "string" || Number.isNaN(Date.parse(timestamp)))) {
      return { ok: false, error: eventError("event.filter.invalid", `${key} must be an ISO date string.`, `$filter.${key}`) };
    }
  }
  if (filter.observedFrom !== undefined && filter.observedTo !== undefined && Date.parse(filter.observedFrom) > Date.parse(filter.observedTo)) {
    return { ok: false, error: eventError("event.filter.invalid", "observedFrom cannot be after observedTo.", "$filter") };
  }
  if (filter.afterSequence !== undefined && (!Number.isSafeInteger(filter.afterSequence) || filter.afterSequence < 0)) {
    return { ok: false, error: eventError("event.filter.invalid", "afterSequence must be a non-negative safe integer.", "$filter.afterSequence") };
  }
  if (filter.correlationId !== undefined && (typeof filter.correlationId !== "string" || filter.correlationId.length === 0)) {
    return { ok: false, error: eventError("event.filter.invalid", "correlationId must be a non-empty string.", "$filter.correlationId") };
  }
  if (filter.limit !== undefined && (!Number.isSafeInteger(filter.limit) || filter.limit < 1)) {
    return { ok: false, error: eventError("event.filter.invalid", "limit must be a positive safe integer.", "$filter.limit") };
  }
  return { ok: true };
}

function validPattern(pattern: string): boolean {
  if (pattern === "*") return true;
  if (pattern.length === 0) return false;
  if (pattern.endsWith(".*")) {
    const namespace = pattern.slice(0, -2);
    return namespace.length > 0 && namespace.split(".").every((part) => part.length > 0 && !part.includes("*"));
  }
  return !pattern.includes("*") && pattern.split(".").every((part) => part.length > 0);
}

function isSeverity(value: unknown): value is EventSeverity {
  return typeof value === "string" && severities.has(value as EventSeverity);
}

export function filterEvents(events: readonly EventEnvelope[], filter: EventLogFilter = {}): { ok: true; value: EventLogQueryResult } | { ok: false; error: EventInfrastructureError } {
  const validation = validateEventLogFilter(filter);
  if (!validation.ok) return validation;
  const matched: EventEnvelope[] = [];
  for (const event of events) {
    if (filter.namespace !== undefined && !matchesEventPattern(filter.namespace, event.type)) continue;
    if (filter.severities !== undefined && !filter.severities.includes(event.severity)) continue;
    if (filter.correlationId !== undefined && event.correlationId !== filter.correlationId) continue;
    if (filter.observedFrom !== undefined && Date.parse(event.observedAt) < Date.parse(filter.observedFrom)) continue;
    if (filter.observedTo !== undefined && Date.parse(event.observedAt) > Date.parse(filter.observedTo)) continue;
    if (filter.afterSequence !== undefined && event.sequence <= filter.afterSequence) continue;
    if (filter.tags !== undefined && filter.tags.length > 0) {
      const eventTags = new Set(event.tags ?? []);
      const tagMatches = filter.tags.filter((tag) => eventTags.has(tag)).length;
      if (filter.tagMode === "all" ? tagMatches !== filter.tags.length : tagMatches === 0) continue;
    }
    matched.push(event);
  }
  const limited = filter.limit === undefined ? matched : matched.slice(0, filter.limit);
  return {
    ok: true,
    value: {
      events: Object.freeze(limited.slice()),
      matchedCount: matched.length,
      totalRetained: events.length,
      evictedCount: 0,
      truncatedByLimit: limited.length < matched.length,
    },
  };
}
