import type { EventLogFilter, EventLogRetentionMetadata } from "../domain/event-log-query";
import type { EventEnvelope } from "../../kernel/events/contracts";

export const EVENT_LOG_EXPORT_SCHEMA_VERSION = 1;

export interface EventLogExportSnapshot {
  readonly schemaVersion: typeof EVENT_LOG_EXPORT_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly filter: EventLogFilter;
  readonly retention: EventLogRetentionMetadata;
  readonly events: readonly EventEnvelope[];
}

export function exportEventLogSnapshot(events: readonly EventEnvelope[], retention: EventLogRetentionMetadata, filter: EventLogFilter = {}, exportedAt = new Date().toISOString()): string {
  const snapshot: EventLogExportSnapshot = {
    schemaVersion: EVENT_LOG_EXPORT_SCHEMA_VERSION,
    exportedAt,
    filter: { ...filter },
    retention: { ...retention },
    events: events.slice(),
  };
  return JSON.stringify(snapshot);
}
