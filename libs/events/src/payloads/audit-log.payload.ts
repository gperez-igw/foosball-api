export interface AuditLogPayload {
  entityType: string;
  entityId: number;
  action: string;
  actorId: number;
  beforeData: Record<string, unknown>;
  afterData: Record<string, unknown>;
  reason: string | null;
}
