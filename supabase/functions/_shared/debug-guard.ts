import { jsonResponse } from './cors.ts';

/**
 * Fail-closed guard for debug Edge Functions.
 * Requires DEBUG_FUNCTION_SECRET env and matching x-debug-secret header.
 */
export function assertDebugAccess(req: Request): Response | null {
  const expected = String(Deno.env.get('DEBUG_FUNCTION_SECRET') || '').trim();
  if (!expected) {
    return jsonResponse(403, {
      error: 'Debug endpoints disabled',
      hint: 'Set DEBUG_FUNCTION_SECRET in Edge Function secrets to enable',
    });
  }
  const provided = String(req.headers.get('x-debug-secret') || '').trim();
  if (!provided || provided !== expected) {
    return jsonResponse(403, { error: 'Forbidden' });
  }
  return null;
}
