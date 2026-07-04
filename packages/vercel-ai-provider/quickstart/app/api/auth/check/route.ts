/**
 * Auth Check API Route
 *
 * GET: Check if admin has been set up (first-run detection)
 */

import { getMemoir } from "@/lib/memoir";

const ADMIN_NAMESPACE = "quickstart-config";
const ADMIN_KEY = "admin_password_hash";

export async function GET() {
  try {
    const memoir = getMemoir();

    // Check if admin password hash exists in mutable store
    const adminHash = await memoir.mutable.get(ADMIN_NAMESPACE, ADMIN_KEY);

    return Response.json({
      isSetup: adminHash !== null,
    });
  } catch (error) {
    console.error("[Auth Check Error]", error);

    return Response.json(
      { error: "Failed to check admin setup status" },
      { status: 500 },
    );
  }
}
