/**
 * Memoir SDK Client
 *
 * Shared Memoir client instance for API routes.
 * Supports both unauthenticated (shared) and authenticated (per-request) clients.
 */

import { Memoir, type AuthContext } from "@memoir/sdk";

/**
 * Cached unauthenticated client (singleton for operations that don't need auth)
 */
let memoirClient: Memoir | null = null;

/**
 * Get or create an unauthenticated Memoir SDK client.
 *
 * Use this for operations that don't require user context,
 * such as system-level queries or background jobs.
 *
 * @returns Memoir client without auth context
 */
export function getMemoir(): Memoir {
  if (!memoirClient) {
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      throw new Error("CONVEX_URL environment variable is required");
    }

    memoirClient = new Memoir({
      convexUrl,
    });
  }

  return memoirClient;
}

/**
 * Create an authenticated Memoir SDK client with user context.
 *
 * Use this for all user-facing operations. The auth context is
 * automatically injected into all Memoir operations.
 *
 * @param authContext - Auth context from getMemoirAuthContext() or createMemoirAuthContextFromSession()
 * @returns Memoir client with auth context auto-injected to all operations
 *
 * @example
 * ```typescript
 * import { getMemoirAuthContext } from "@/lib/auth-memoir";
 * import { getMemoirWithAuth } from "@/lib/memoir";
 *
 * const authContext = await getMemoirAuthContext();
 * if (!authContext) {
 *   return new Response("Unauthorized", { status: 401 });
 * }
 *
 * const memoir = getMemoirWithAuth(authContext);
 * // All operations auto-scoped to the authenticated user
 * await memoir.memory.remember({ ... });
 * ```
 */
export function getMemoirWithAuth(authContext: AuthContext): Memoir {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    throw new Error("CONVEX_URL environment variable is required");
  }

  return new Memoir({
    convexUrl,
    auth: authContext,
  });
}

/**
 * Get the memory space ID for the chat SDK.
 * Uses MEMORY_SPACE_ID env var or defaults to 'chat-sdk-demo'.
 */
export function getMemorySpaceId(): string {
  return process.env.MEMORY_SPACE_ID || "chat-sdk-demo";
}

/**
 * Get the agent/assistant ID for the chat SDK.
 * Uses AGENT_ID env var or defaults to 'chat-assistant'.
 */
export function getAgentId(): string {
  return process.env.AGENT_ID || "chat-assistant";
}
