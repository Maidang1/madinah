import { describe, expect, test } from "vite-plus/test";
import wireFixture from "../shared/assistant-discovery-wire.json";
import type {
  AgentCapabilities,
  AgentDiscovery,
  AgentDiscoveryResponse,
  AgentRegistrationSnapshot,
  AgentSource,
  AgentStatus,
  CapabilitySupport,
} from "../src/platform/tauri/assistant";

function oneOf<T extends string>(value: string, allowed: readonly T[]): T {
  expect(allowed).toContain(value);
  return value as T;
}

function capabilities(
  raw: (typeof wireFixture.discoveryResponse.agents)[number]["capabilities"],
): AgentCapabilities {
  const support = (value: string) =>
    oneOf<CapabilitySupport>(value, ["protocol-baseline", "advertised"]);
  return {
    streamedText: support(raw.streamedText),
    sessionCreate: support(raw.sessionCreate),
    sessionRestore: support(raw.sessionRestore),
    cancellation: support(raw.cancellation),
    workspaceCwd: support(raw.workspaceCwd),
    permissionRequests: support(raw.permissionRequests),
  };
}

function discovery(raw: (typeof wireFixture.discoveryResponse.agents)[number]): AgentDiscovery {
  return {
    id: raw.id,
    name: raw.name,
    source: oneOf<AgentSource>(raw.source, ["built-in", "custom"]),
    command: raw.command,
    args: raw.args,
    setupUrl: raw.setupUrl,
    capabilities: capabilities(raw.capabilities),
    status: oneOf<AgentStatus>(raw.status, [
      "compatible",
      "missing",
      "authentication-required",
      "incompatible",
      "handshake-failed",
    ]),
    message: raw.message,
    missingCapabilities: raw.missingCapabilities,
    agentInfo: raw.agentInfo ? { name: raw.agentInfo.name, version: raw.agentInfo.version } : null,
    authMethods: raw.authMethods.map((method) => ({
      id: method.id,
      name: method.name,
      description: method.description,
    })),
  };
}

describe("Assistant serialized wire contract", () => {
  test("the shared raw fixture reconstructs exactly through the TypeScript mirror", () => {
    const rawDiscovery = wireFixture.discoveryResponse;
    const typedDiscovery: AgentDiscoveryResponse = {
      workspaceRoot: rawDiscovery.workspaceRoot,
      registrationRevision: rawDiscovery.registrationRevision,
      registrationError: rawDiscovery.registrationError,
      agents: rawDiscovery.agents.map(discovery),
    };
    const rawRegistration = wireFixture.registrationSnapshot;
    const typedRegistration: AgentRegistrationSnapshot = {
      version: rawRegistration.version,
      revision: rawRegistration.revision,
      registrations: rawRegistration.registrations.map((registration) => ({
        id: registration.id,
        command: registration.command,
        args: registration.args,
      })),
    };

    expect(typedDiscovery).toEqual(rawDiscovery);
    expect(typedRegistration).toEqual(rawRegistration);
  });
});
