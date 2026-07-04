/**
 * Unit Tests for lib/memoir.ts
 *
 * Tests the Memoir SDK client helpers: getMemoir, getMemoirWithAuth,
 * getMemorySpaceId, and getAgentId.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockAuthContext } from "../helpers/mock-memoir";

// Mock the Memoir SDK before importing the module under test
vi.mock("@memoir/sdk", () => ({
  Memoir: vi.fn().mockImplementation((config) => ({
    _config: config,
    conversations: {},
    artifacts: {},
    memory: {},
  })),
}));

describe("lib/memoir", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original env
    originalEnv = { ...process.env };

    // Clear module cache to reset singleton
    vi.resetModules();
  });

  afterEach(() => {
    // Restore environment
    process.env = originalEnv;
  });

  describe("getMemoir", () => {
    it("creates a Memoir client with convexUrl from environment", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getMemoir } = await import("@/lib/memoir");

      const client = getMemoir();

      expect(client).toBeDefined();
      expect(client._config).toEqual({
        convexUrl: "https://test-convex.cloud",
      });
    });

    it("returns singleton instance on subsequent calls", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getMemoir } = await import("@/lib/memoir");

      const instance1 = getMemoir();
      const instance2 = getMemoir();

      expect(instance1).toBe(instance2);
    });

    it("throws error when CONVEX_URL is not set", async () => {
      delete process.env.CONVEX_URL;

      const { getMemoir } = await import("@/lib/memoir");

      expect(() => getMemoir()).toThrow(
        "CONVEX_URL environment variable is required",
      );
    });
  });

  describe("getMemoirWithAuth", () => {
    it("creates authenticated Memoir client with auth context", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getMemoirWithAuth } = await import("@/lib/memoir");
      const authContext = createMockAuthContext({ userId: "user-456" });

      const client = getMemoirWithAuth(authContext);

      expect(client).toBeDefined();
      expect(client._config).toEqual({
        convexUrl: "https://test-convex.cloud",
        auth: authContext,
      });
    });

    it("creates new instance each call (not singleton)", async () => {
      process.env.CONVEX_URL = "https://test-convex.cloud";

      const { getMemoirWithAuth } = await import("@/lib/memoir");
      const authContext1 = createMockAuthContext({ userId: "user-1" });
      const authContext2 = createMockAuthContext({ userId: "user-2" });

      const instance1 = getMemoirWithAuth(authContext1);
      const instance2 = getMemoirWithAuth(authContext2);

      // Each call creates a new instance for different auth contexts
      expect(instance1._config.auth.userId).toBe("user-1");
      expect(instance2._config.auth.userId).toBe("user-2");
    });

    it("throws error when CONVEX_URL is not set", async () => {
      delete process.env.CONVEX_URL;

      const { getMemoirWithAuth } = await import("@/lib/memoir");
      const authContext = createMockAuthContext();

      expect(() => getMemoirWithAuth(authContext)).toThrow(
        "CONVEX_URL environment variable is required",
      );
    });
  });

  describe("getMemorySpaceId", () => {
    it("returns MEMORY_SPACE_ID from environment when set", async () => {
      process.env.MEMORY_SPACE_ID = "custom-memory-space";

      const { getMemorySpaceId } = await import("@/lib/memoir");

      expect(getMemorySpaceId()).toBe("custom-memory-space");
    });

    it("returns default 'chat-sdk-demo' when env not set", async () => {
      delete process.env.MEMORY_SPACE_ID;

      const { getMemorySpaceId } = await import("@/lib/memoir");

      expect(getMemorySpaceId()).toBe("chat-sdk-demo");
    });

    it("returns default when env is empty string", async () => {
      process.env.MEMORY_SPACE_ID = "";

      const { getMemorySpaceId } = await import("@/lib/memoir");

      // Empty string is falsy, so default is returned
      expect(getMemorySpaceId()).toBe("chat-sdk-demo");
    });
  });

  describe("getAgentId", () => {
    it("returns AGENT_ID from environment when set", async () => {
      process.env.AGENT_ID = "custom-agent-id";

      const { getAgentId } = await import("@/lib/memoir");

      expect(getAgentId()).toBe("custom-agent-id");
    });

    it("returns default 'chat-assistant' when env not set", async () => {
      delete process.env.AGENT_ID;

      const { getAgentId } = await import("@/lib/memoir");

      expect(getAgentId()).toBe("chat-assistant");
    });

    it("returns default when env is empty string", async () => {
      process.env.AGENT_ID = "";

      const { getAgentId } = await import("@/lib/memoir");

      // Empty string is falsy, so default is returned
      expect(getAgentId()).toBe("chat-assistant");
    });
  });
});
