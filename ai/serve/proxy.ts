// Token gate in front of Ollama, for when Suu runs on a laptop and the website reaches it through a tunnel.
// Only the two endpoints the app uses pass (POST /api/chat, GET /api/version), only with the bearer token,
// and only to the configured model. Everything else (pull, delete, create, other models) is refused.
// Run: OLLAMA_TOKEN=… bun ai/serve/proxy.ts   (ai/serve/start.sh does this for you)

export type ProxyConfig = {
  token: string;
  /** Local Ollama, e.g. http://127.0.0.1:11434 */
  target: string;
  /** The only model name allowed in /api/chat, e.g. "suu". */
  model: string;
  /** Biggest request body accepted, in bytes. */
  maxBody?: number;
};

/** Constant-time string compare, so the token can't be guessed byte by byte from response times. */
export function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

const json = (status: number, body: unknown) => Response.json(body, { status });

export function makeHandler(cfg: ProxyConfig, fetchImpl: typeof fetch = fetch) {
  const target = cfg.target.replace(/\/$/, '');
  const maxBody = cfg.maxBody ?? 64_000;
  return async (req: Request): Promise<Response> => {
    const { pathname } = new URL(req.url);
    const route = `${req.method} ${pathname}`;
    if (route !== 'POST /api/chat' && route !== 'GET /api/version') return json(404, { error: 'not_found' });

    const auth = req.headers.get('authorization') ?? '';
    if (!cfg.token || !sameSecret(auth, `Bearer ${cfg.token}`)) return json(401, { error: 'unauthorized' });

    if (route === 'GET /api/version') {
      const res = await fetchImpl(`${target}/api/version`).catch(() => null);
      return res
        ? new Response(res.body, { status: res.status, headers: res.headers })
        : json(502, { error: 'down' });
    }

    const body = await req.text();
    if (body.length > maxBody) return json(413, { error: 'too_large' });
    let parsed: { model?: unknown; stream?: unknown };
    try {
      parsed = JSON.parse(body);
    } catch {
      return json(400, { error: 'bad_json' });
    }
    if (parsed.model !== cfg.model) return json(403, { error: 'model_not_allowed' });
    // Ollama refuses requests whose Host isn't local, so the gate sends a fresh request to the local address.
    const res = await fetchImpl(`${target}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }).catch(() => null);
    if (!res) return json(502, { error: 'down' });
    return new Response(res.body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  };
}

if (import.meta.main) {
  const token = process.env.OLLAMA_TOKEN ?? '';
  if (token.length < 16) {
    console.error('OLLAMA_TOKEN хоосон эсвэл хэт богино (16+ тэмдэгт). ai/serve/start.sh-ээр ажиллуул.');
    process.exit(1);
  }
  const port = Number(process.env.SUU_PROXY_PORT ?? 11435);
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port,
    fetch: makeHandler({
      token,
      target: process.env.OLLAMA_LOCAL ?? 'http://127.0.0.1:11434',
      model: process.env.OLLAMA_MODEL ?? 'suu',
    }),
  });
  console.log(`Suu gate: http://127.0.0.1:${server.port} → Ollama (POST /api/chat, GET /api/version)`);
}
