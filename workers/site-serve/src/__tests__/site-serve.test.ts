import { describe, it, expect } from "vitest";
import { handleRequest } from "../index";

function mockEnv(routingTable: Record<string, string>, planOverrides?: { plan: string }) {
  const kvData: Record<string, string> = { ...routingTable };

  // Add plan data for free sites
  if (planOverrides?.plan === "free") {
    const hostname = Object.keys(routingTable)[0];
    if (hostname) kvData[`plan:${hostname}`] = "free";
  }

  return {
    ROUTING_TABLE: {
      get: async (key: string) => kvData[key] ?? null,
    },
    DNS_MAP: {
      get: async (_key: string) => null,
    },
    R2: {
      get: async (_key: string) => ({
        arrayBuffer: async () => new TextEncoder().encode("<html><body>Hello</body></html>").buffer,
      }),
    },
  } as any;
}

describe("site-serve Worker", () => {
  it("serves index.html for root path", async () => {
    const req = new Request("https://minh-va-lan.elove.me/");
    const env = mockEnv({ "minh-va-lan.elove.me": "published/p1/v3/" });
    const response = await handleRequest(req, env);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  it("returns 404 for unknown slug", async () => {
    const req = new Request("https://unknown.elove.me/");
    const response = await handleRequest(req, mockEnv({}));
    expect(response.status).toBe(404);
  });

  it("injects branding badge for free plan sites", async () => {
    const req = new Request("https://free-site.elove.me/");
    const env = mockEnv({ "free-site.elove.me": "published/p2/v1/" }, { plan: "free" });
    const response = await handleRequest(req, env);
    const html = await response.text();
    expect(html).toContain("elove-badge");
  });
});
