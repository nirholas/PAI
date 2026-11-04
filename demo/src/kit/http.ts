export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const json = (data: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'cache-control': 'no-store', 'content-type': 'application/json; charset=utf-8', ...init.headers },
  });

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON');
  }
}

export function str(v: unknown, field: string, max = 2000): string {
  if (typeof v !== 'string' || !v.trim()) throw new HttpError(400, `${field} is required`);
  if (v.length > max) throw new HttpError(400, `${field} is too long (max ${max} characters)`);
  return v.trim();
}

export type Handler<E> = (
  req: Request,
  env: E,
  ctx: ExecutionContext,
  params: Record<string, string>,
) => Promise<Response> | Response;

interface Route<E> {
  handler: Handler<E>;
  keys: string[];
  method: string;
  re: RegExp;
}

export class Router<E> {
  private routes: Route<E>[] = [];

  on(method: string, path: string, handler: Handler<E>): this {
    const keys: string[] = [];
    const pattern = path.replace(/:(\w+)/g, (_, k: string) => {
      keys.push(k);
      return '([^/]+)';
    });
    this.routes.push({ handler, keys, method, re: new RegExp(`^${pattern}/?$`) });
    return this;
  }

  get(path: string, h: Handler<E>) { return this.on('GET', path, h); }
  post(path: string, h: Handler<E>) { return this.on('POST', path, h); }
  put(path: string, h: Handler<E>) { return this.on('PUT', path, h); }
  delete(path: string, h: Handler<E>) { return this.on('DELETE', path, h); }
  all(path: string, h: Handler<E>) { return this.on('*', path, h); }

  async handle(req: Request, env: E, ctx: ExecutionContext): Promise<Response | null> {
    const { pathname } = new URL(req.url);
    let pathMatched = false;
    for (const r of this.routes) {
      const m = r.re.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== '*' && r.method !== req.method && !(r.method === 'GET' && req.method === 'HEAD')) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      try {
        return await r.handler(req, env, ctx, params);
      } catch (error) {
        if (error instanceof HttpError) return json({ error: error.message }, { status: error.status });
        console.error('unhandled', pathname, error);
        return json({ error: 'Internal error' }, { status: 500 });
      }
    }
    if (pathMatched) return json({ error: 'Method not allowed' }, { status: 405 });
    return null;
  }
}
