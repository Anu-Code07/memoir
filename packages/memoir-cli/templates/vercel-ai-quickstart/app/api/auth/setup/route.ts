/**
 * Admin Setup API Route
 *
 * POST: Set up initial admin password (first-run only)
 */

import { getMemoir } from "@/lib/memoir";
import { hashPassword } from "@/lib/password";

const ADMIN_NAMESPACE = "quickstart-config";
const ADMIN_KEY = "admin_password_hash";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { password } = body;

    if (!password || typeof password !== "string") {
      return Response.json({ error: "Password is required" }, { status: 400 });
    }

    if (password.length < 4) {
      return Response.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 },
      );
    }

    const memoir = getMemoir();

    // Check if admin already exists
    const existingHash = await memoir.mutable.get(ADMIN_NAMESPACE, ADMIN_KEY);
    if (existingHash !== null) {
      return Response.json(
        { error: "Admin already configured" },
        { status: 409 },
      );
    }

    // Hash and store admin password
    const passwordHash = await hashPassword(password);
    await memoir.mutable.set(ADMIN_NAMESPACE, ADMIN_KEY, passwordHash);

    return Response.json({
      success: true,
      message: "Admin password configured successfully",
    });
  } catch (error) {
    console.error("[Admin Setup Error]", error);

    return Response.json(
      { error: "Failed to configure admin password" },
      { status: 500 },
    );
  }
}
