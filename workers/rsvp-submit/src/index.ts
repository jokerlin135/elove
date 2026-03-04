export interface RsvpPayload {
  guestName: string;
  attending: boolean;
  partySize?: number;
  email?: string;
  dietaryNotes?: string;
}

export interface Env {
  ROUTING_TABLE: KVNamespace;
  KV: KVNamespace;
  API_URL: string;
  INTERNAL_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    return handleRsvp(request, env);
  },
};

export async function handleRsvp(request: Request, env: Env): Promise<Response> {
  const hostname = new URL(request.url).hostname;
  const projectId = await env.ROUTING_TABLE.get(`project:${hostname}`);
  if (!projectId) {
    return new Response("Not found", { status: 404 });
  }

  const body = (await request.json()) as RsvpPayload;
  const { guestName, attending, partySize = 1, email, dietaryNotes } = body;

  if (!guestName || attending === undefined) {
    return Response.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  // Quota check (soft quota per AD-01)
  const quotaKey = `quota:${projectId}:rsvp`;
  const current = parseInt((await env.KV.get(quotaKey)) ?? "0");
  const max = parseInt((await env.KV.get(`quota:${projectId}:rsvp:max`)) ?? "50");

  if (current >= max * 2) {
    return Response.json({ error: "RSVP tạm thời không khả dụng" }, { status: 503 });
  }

  const isOverQuota = current >= max;

  // Insert to DB via internal API
  await fetch(`${env.API_URL}/internal/rsvp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": env.INTERNAL_KEY,
    },
    body: JSON.stringify({
      projectId,
      guestName,
      email,
      attending,
      partySize,
      dietaryNotes,
      isOverQuota,
    }),
  });

  // Increment quota counter
  await env.KV.put(quotaKey, String(current + partySize), {
    expirationTtl: 86400 * 365,
  });

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (isOverQuota) {
    headers["X-Quota-Warning"] = "true";
  }

  return new Response(
    JSON.stringify({ success: true, message: "Cảm ơn bạn đã xác nhận!" }),
    {
      status: 200,
      headers,
    }
  );
}
