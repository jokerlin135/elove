export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  }
};

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;

  // 1. KV lookup
  let r2Prefix = await env.ROUTING_TABLE.get(hostname);

  // 2. Custom domain fallback
  if (!r2Prefix) {
    const slug = await env.DNS_MAP.get(hostname);
    if (slug) r2Prefix = await env.ROUTING_TABLE.get(`${slug}.elove.me`);
  }

  if (!r2Prefix) return new Response("Site not found", { status: 404 });

  // 3. Map path to file (with path traversal protection)
  const rawPath = url.pathname === "/" ? "index.html" : `${url.pathname.slice(1)}.html`;
  if (rawPath.includes("..") || rawPath.includes("//")) {
    return new Response("Forbidden", { status: 403 });
  }
  const r2Key = `${r2Prefix}${rawPath}`;

  // 4. Fetch from R2
  const object = await env.R2.get(r2Key);
  if (!object) return new Response("Page not found", { status: 404 });

  const body = await object.arrayBuffer();
  const contentType = rawPath.endsWith(".html") ? "text/html" : "application/octet-stream";
  const cacheControl = rawPath.endsWith(".html") ? "public, max-age=300" : "public, max-age=31536000, immutable";

  // 5. Watermark injection (free plan)
  const plan = await env.ROUTING_TABLE.get(`plan:${hostname}`);
  if (plan === "free" && contentType === "text/html") {
    const html = new TextDecoder().decode(body);
    const badge = `<a class="elove-badge" href="https://elove.me?ref=badge" target="_blank" rel="noopener">Made with ELove</a>`;
    const injected = html.replace("</body>", `${badge}\n</body>`);
    return new Response(injected, {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": cacheControl }
    });
  }

  return new Response(body, {
    headers: { "Content-Type": `${contentType}; charset=utf-8`, "Cache-Control": cacheControl }
  });
}

interface Env {
  ROUTING_TABLE: KVNamespace;
  DNS_MAP: KVNamespace;
  R2: R2Bucket;
}
