/**
 * Unit Tests for lib/auth-memoir.ts
 *
 * Tests the Auth.js to Memoir auth context bridge:
 * - getMemoirAuthContext
 * - createMemoirAuthContextFromSession
 * - getUserIdFromSession
 * - isAuthenticated
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/app/(auth)/auth";
import type { AuthSession } from "@/lib/auth-memoir";

// Mock the createAuthContext function from SDK
vi.mock("@getmemoir/sdk", () => ({
  createAuthContext: vi.fn((input) => ({
    ...input,
    _type: "AuthContext",
  })),
}));

// auth is already mocked in setup.ts, but we need to type it properly
const mockAuth = auth as ReturnType<typeof vi.fn>;

describe("lib/auth-memoir", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMemoirAuthContext", () => {
    it("returns AuthContext when session has valid user", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: "test@example.com",
          name: "Test User",
          type: "regular",
        },
        expires: "2025-12-31T23:59:59.999Z",
      });

      const { getMemoirAuthContext } = await import("@/lib/auth-memoir");

      const result = await getMemoirAuthContext();

      expect(result).toBeDefined();
      expect(result?.userId).toBe("user-123");
      expect(result?.authProvider).toBe("nextauth");
      expect(result?.authMethod).toBe("session");
      expect(result?.metadata).toEqual({
        email: "test@example.com",
        name: "Test User",
        userType: "regular",
      });
    });

    it("returns null when session is null", async () => {
      mockAuth.mockResolvedValue(null);

      const { getMemoirAuthContext } = await import("@/lib/auth-memoir");

      const result = await getMemoirAuthContext();

      expect(result).toBeNull();
    });

    it("returns null when session has no user", async () => {
      mockAuth.mockResolvedValue({
        expires: "2025-12-31T23:59:59.999Z",
      });

      const { getMemoirAuthContext } = await import("@/lib/auth-memoir");

      const result = await getMemoirAuthContext();

      expect(result).toBeNull();
    });

    it("returns null when user has no id", async () => {
      mockAuth.mockResolvedValue({
        user: {
          email: "test@example.com",
          name: "Test User",
        },
        expires: "2025-12-31T23:59:59.999Z",
      });

      const { getMemoirAuthContext } = await import("@/lib/auth-memoir");

      const result = await getMemoirAuthContext();

      expect(result).toBeNull();
    });

    it("handles null email and name in metadata", async () => {
      mockAuth.mockResolvedValue({
        user: {
          id: "user-123",
          email: null,
          name: null,
        },
      });

      const { getMemoirAuthContext } = await import("@/lib/auth-memoir");

      const result = await getMemoirAuthContext();

      expect(result).toBeDefined();
      expect(result?.metadata?.email).toBeUndefined();
      expect(result?.metadata?.name).toBeUndefined();
    });
  });

  describe("createMemoirAuthContextFromSession", () => {
    it("creates AuthContext from valid session", async () => {
      const session: AuthSession = {
        user: {
          id: "user-456",
          email: "session@example.com",
          name: "Session User",
          type: "premium",
        },
      };

      const { createMemoirAuthContextFromSession } = await import(
        "@/lib/auth-memoir"
      );

      const result = createMemoirAuthContextFromSession(session);

      expect(result).toBeDefined();
      expect(result?.userId).toBe("user-456");
      expect(result?.authProvider).toBe("nextauth");
      expect(result?.metadata?.userType).toBe("premium");
    });

    it("returns null for null session", async () => {
      const { createMemoirAuthContextFromSession } = await import(
        "@/lib/auth-memoir"
      );

      const result = createMemoirAuthContextFromSession(null);

      expect(result).toBeNull();
    });

    it("returns null when session user has no id", async () => {
      const session: AuthSession = {
        user: {
          email: "no-id@example.com",
        },
      };

      const { createMemoirAuthContextFromSession } = await import(
        "@/lib/auth-memoir"
      );

      const result = createMemoirAuthContextFromSession(session);

      expect(result).toBeNull();
    });

    it("returns null when session has empty user object", async () => {
      const session: AuthSession = {
        user: {},
      };

      const { createMemoirAuthContextFromSession } = await import(
        "@/lib/auth-memoir"
      );

      const result = createMemoirAuthContextFromSession(session);

      expect(result).toBeNull();
    });
  });

  describe("getUserIdFromSession", () => {
    it("returns user id when session has valid user", async () => {
      const session: AuthSession = {
        user: { id: "user-789" },
      };

      const { getUserIdFromSession } = await import("@/lib/auth-memoir");

      expect(getUserIdFromSession(session)).toBe("user-789");
    });

    it("returns 'anonymous' as default when session is null", async () => {
      const { getUserIdFromSession } = await import("@/lib/auth-memoir");

      expect(getUserIdFromSession(null)).toBe("anonymous");
    });

    it("returns custom fallback when provided", async () => {
      const { getUserIdFromSession } = await import("@/lib/auth-memoir");

      expect(getUserIdFromSession(null, "guest-user")).toBe("guest-user");
    });

    it("returns fallback when user has no id", async () => {
      const session: AuthSession = {
        user: { email: "no-id@example.com" },
      };

      const { getUserIdFromSession } = await import("@/lib/auth-memoir");

      expect(getUserIdFromSession(session, "fallback-id")).toBe("fallback-id");
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when session has user with id", async () => {
      const session: AuthSession = {
        user: { id: "user-123" },
      };

      const { isAuthenticated } = await import("@/lib/auth-memoir");

      expect(isAuthenticated(session)).toBe(true);
    });

    it("returns false for null session", async () => {
      const { isAuthenticated } = await import("@/lib/auth-memoir");

      expect(isAuthenticated(null)).toBe(false);
    });

    it("returns false when session has no user", async () => {
      const session: AuthSession = {};

      const { isAuthenticated } = await import("@/lib/auth-memoir");

      expect(isAuthenticated(session)).toBe(false);
    });

    it("returns false when user has no id", async () => {
      const session: AuthSession = {
        user: { email: "no-id@example.com" },
      };

      const { isAuthenticated } = await import("@/lib/auth-memoir");

      expect(isAuthenticated(session)).toBe(false);
    });

    it("returns false when user id is empty string", async () => {
      const session: AuthSession = {
        user: { id: "" },
      };

      const { isAuthenticated } = await import("@/lib/auth-memoir");

      // Empty string is falsy
      expect(isAuthenticated(session)).toBe(false);
    });
  });
});
