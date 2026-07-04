/**
 * Memoir SDK Client
 *
 * Shared Memoir client instance for API routes.
 */

import { Memoir } from "@getmemoir/sdk";

let memoirClient: Memoir | null = null;

/**
 * Get or create a Memoir SDK client
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
