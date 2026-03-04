import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleRsvp } from "../index";

// Mock global fetch to avoid real HTTP calls
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response()));
});

function mockEnv(options?: { projectId?: string }) {
  const projectId = options?.projectId ?? "proj-123";
  return {
    ROUTING_TABLE: {
      get: async (key: string) => {
        if (key === "project:minh-va-lan.elove.me") return projectId;
        return null;
      },
    },
    KV: {
      get: async (_key: string) => null,
      put: vi.fn().mockResolvedValue(undefined),
    },
    API_URL: "https://fake-api.elove.me",
    INTERNAL_KEY: "test-key",
  } as any;
}

function mockEnvWithQuota({ current, max }: { current: number; max: number }) {
  return {
    ROUTING_TABLE: {
      get: async (key: string) => {
        if (key.startsWith("project:")) return "proj-123";
        return null;
      },
    },
    KV: {
      get: async (key: string) => {
        if (key === "quota:proj-123:rsvp") return String(current);
        if (key === "quota:proj-123:rsvp:max") return String(max);
        return null;
      },
      put: vi.fn().mockResolvedValue(undefined),
    },
    API_URL: "https://fake-api.elove.me",
    INTERNAL_KEY: "test-key",
  } as any;
}

function buildRsvpRequest() {
  return new Request("https://minh-va-lan.elove.me/__rsvp", {
    method: "POST",
    body: JSON.stringify({ guestName: "Test Guest", attending: true, partySize: 1 }),
    headers: { "Content-Type": "application/json" },
  });
}

describe("RSVP Worker", () => {
  it("accepts valid RSVP submission", async () => {
    const req = new Request("https://minh-va-lan.elove.me/__rsvp", {
      method: "POST",
      body: JSON.stringify({ guestName: "Hùng", attending: true, partySize: 2 }),
      headers: { "Content-Type": "application/json" },
    });
    const response = await handleRsvp(req, mockEnv());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  it("returns 503 when RSVP over 2× quota (hard block)", async () => {
    const env = mockEnvWithQuota({ current: 200, max: 50 }); // 200 > 50*2=100
    const req = buildRsvpRequest();
    const response = await handleRsvp(req, env);
    expect(response.status).toBe(503);
  });

  it("returns X-Quota-Warning when between limit and 2× (soft quota)", async () => {
    const env = mockEnvWithQuota({ current: 60, max: 50 }); // 60 > 50 but < 100
    const req = buildRsvpRequest();
    const response = await handleRsvp(req, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Quota-Warning")).toBe("true");
  });
});
