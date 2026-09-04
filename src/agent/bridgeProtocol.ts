import { SemanticErrorCode } from "../intelligence/port";

export const AGENT_PROTOCOL_VERSION = 1;
export const MAX_BRIDGE_REQUEST_BYTES = 256 * 1024;

export interface BridgeDescriptor {
  readonly protocolVersion: number;
  readonly extensionVersion: string;
  readonly workspaceId: string;
  readonly endpoint: string;
  readonly token: string;
  readonly processId: number;
  readonly createdAt: string;
}

export interface BridgeRequest {
  readonly id: string;
  readonly protocolVersion: number;
  readonly token: string;
  readonly method: string;
  readonly params: unknown;
}

export interface BridgeSuccess {
  readonly id: string;
  readonly ok: true;
  readonly result: unknown;
}

export interface BridgeFailure {
  readonly id: string;
  readonly ok: false;
  readonly error: {
    readonly code: SemanticErrorCode | "UNAUTHORIZED" | "PROTOCOL_MISMATCH" | "INVALID_REQUEST";
    readonly message: string;
    readonly retryable: boolean;
  };
}

export type BridgeResponse = BridgeSuccess | BridgeFailure;

export function isBridgeRequest(value: unknown): value is BridgeRequest {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.protocolVersion === "number" &&
    typeof item.token === "string" &&
    typeof item.method === "string" &&
    "params" in item
  );
}
