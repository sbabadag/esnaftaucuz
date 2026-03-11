const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const DEFAULT_TIMEOUT = 10000;

interface RestOptions {
  timeout?: number;
  single?: boolean;
}

export async function restQuery(
  table: string,
  params: Record<string, string> = {},
  options: RestOptions = {}
): Promise<any> {
  const { timeout = DEFAULT_TIMEOUT, single = false } = options;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);

  const qs = new URLSearchParams(params).toString();
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs ? `?${qs}` : ''}`;

  try {
    const resp = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
        ...(single ? { Accept: 'application/vnd.pgrst.object+json' } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`REST ${resp.status}: ${body.slice(0, 200)}`);
    }
    return resp.json();
  } catch (err: any) {
    clearTimeout(tid);
    if (err?.name === 'AbortError') {
      throw new Error(`REST timeout (${timeout}ms) for ${table}`);
    }
    throw err;
  }
}

export async function restRpc(
  fnName: string,
  body: Record<string, any> = {},
  timeout = DEFAULT_TIMEOUT
): Promise<any> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);
  const url = `${SUPABASE_URL}/rest/v1/rpc/${fnName}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`RPC ${resp.status}: ${text.slice(0, 200)}`);
    }
    return resp.json();
  } catch (err: any) {
    clearTimeout(tid);
    if (err?.name === 'AbortError') {
      throw new Error(`RPC timeout (${timeout}ms) for ${fnName}`);
    }
    throw err;
  }
}

export async function restEdgeFunction(
  fnName: string,
  body: Record<string, any> = {},
  timeout = DEFAULT_TIMEOUT
): Promise<any> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeout);
  const url = `${SUPABASE_URL}/functions/v1/${fnName}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Edge fn ${resp.status}: ${text.slice(0, 200)}`);
    }
    return resp.json();
  } catch (err: any) {
    clearTimeout(tid);
    if (err?.name === 'AbortError') {
      throw new Error(`Edge fn timeout (${timeout}ms) for ${fnName}`);
    }
    throw err;
  }
}
