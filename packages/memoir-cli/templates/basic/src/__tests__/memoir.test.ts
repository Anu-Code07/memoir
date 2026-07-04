/**
 * Unit tests for memoir.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the display module before importing memoir
vi.mock("../display.js", () => ({
  printLayerUpdate: vi.fn(),
  // Phase-aware print functions (v0.35.1+)
  printRecallStart: vi.fn(),
  printRecallComplete: vi.fn(),
  printRememberStart: vi.fn(),
  printRememberComplete: vi.fn(),
  // Legacy (deprecated)
  printOrchestrationStart: vi.fn(),
}));

describe("memoir", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("CONFIG", () => {
    it("uses default values when environment variables are not set", async () => {
      delete process.env.MEMORY_SPACE_ID;
      delete process.env.USER_ID;
      delete process.env.USER_NAME;
      delete process.env.AGENT_ID;
      delete process.env.AGENT_NAME;
      delete process.env.MEMOIR_FACT_EXTRACTION;
      delete process.env.MEMOIR_GRAPH_SYNC;
      delete process.env.DEBUG;

      const { CONFIG } = await import("../memoir.js");

      expect(CONFIG.memorySpaceId).toBe("basic-demo");
      expect(CONFIG.userId).toBe("demo-user");
      expect(CONFIG.userName).toBe("Demo User");
      expect(CONFIG.agentId).toBe("basic-assistant");
      expect(CONFIG.agentName).toBe("Memoir CLI Assistant");
      expect(CONFIG.enableFactExtraction).toBe(true);
      expect(CONFIG.enableGraphMemory).toBe(false);
      expect(CONFIG.debug).toBe(false);
    });

    it("uses environment variables when set", async () => {
      process.env.MEMORY_SPACE_ID = "custom-space";
      process.env.USER_ID = "custom-user";
      process.env.USER_NAME = "Custom User";
      process.env.AGENT_ID = "custom-agent";
      process.env.AGENT_NAME = "Custom Agent";
      process.env.MEMOIR_FACT_EXTRACTION = "false";
      process.env.MEMOIR_GRAPH_SYNC = "true";
      process.env.DEBUG = "true";

      const { CONFIG } = await import("../memoir.js");

      expect(CONFIG.memorySpaceId).toBe("custom-space");
      expect(CONFIG.userId).toBe("custom-user");
      expect(CONFIG.userName).toBe("Custom User");
      expect(CONFIG.agentId).toBe("custom-agent");
      expect(CONFIG.agentName).toBe("Custom Agent");
      expect(CONFIG.enableFactExtraction).toBe(false);
      expect(CONFIG.enableGraphMemory).toBe(true);
      expect(CONFIG.debug).toBe(true);
    });
  });

  describe("getMemoir", () => {
    it("throws error when CONVEX_URL is not set", async () => {
      delete process.env.CONVEX_URL;

      const { getMemoir } = await import("../memoir.js");

      expect(() => getMemoir()).toThrow("CONVEX_URL environment variable is required");
    });

    it("creates Memoir client when CONVEX_URL is set", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";

      // Mock Memoir SDK
      vi.doMock("@memoir/sdk", () => ({
        Memoir: vi.fn().mockImplementation(() => ({
          memory: {},
          close: vi.fn(),
        })),
      }));

      const { getMemoir } = await import("../memoir.js");
      const memoir = getMemoir();

      expect(memoir).toBeDefined();
      expect(memoir.memory).toBeDefined();
    });

    it("returns same instance on subsequent calls (singleton)", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";

      vi.doMock("@memoir/sdk", () => ({
        Memoir: vi.fn().mockImplementation(() => ({
          memory: {},
          close: vi.fn(),
        })),
      }));

      const { getMemoir } = await import("../memoir.js");

      const instance1 = getMemoir();
      const instance2 = getMemoir();

      expect(instance1).toBe(instance2);
    });
  });

  describe("closeMemoir", () => {
    it("closes the client and resets singleton", async () => {
      process.env.CONVEX_URL = "https://test.convex.cloud";

      const closeMock = vi.fn();
      vi.doMock("@memoir/sdk", () => ({
        Memoir: vi.fn().mockImplementation(() => ({
          memory: {},
          close: closeMock,
        })),
      }));

      const { getMemoir, closeMemoir } = await import("../memoir.js");

      getMemoir(); // Create instance
      closeMemoir();

      expect(closeMock).toHaveBeenCalled();
    });

    it("does nothing when no client exists", async () => {
      const { closeMemoir } = await import("../memoir.js");

      // Should not throw
      expect(() => closeMemoir()).not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase-Aware Observers (v0.35.1+)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("createRecallObserver", () => {
    it("returns an observer with recall phase methods", async () => {
      const { createRecallObserver } = await import("../memoir.js");

      const observer = createRecallObserver();

      expect(observer).toHaveProperty("onRecallStart");
      expect(observer).toHaveProperty("onLayerUpdate");
      expect(observer).toHaveProperty("onRecallComplete");
      expect(typeof observer.onRecallStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onRecallComplete).toBe("function");
    });

    it("calls printRecallStart on recall start", async () => {
      const { printRecallStart } = await import("../display.js");
      const { createRecallObserver } = await import("../memoir.js");

      const observer = createRecallObserver();
      observer.onRecallStart?.("test-id");

      expect(printRecallStart).toHaveBeenCalledWith("test-id");
    });

    it("calls printLayerUpdate on layer update", async () => {
      const { printLayerUpdate } = await import("../display.js");
      const { createRecallObserver } = await import("../memoir.js");

      const observer = createRecallObserver();
      const event = {
        layer: "vector" as const,
        status: "complete" as const,
        timestamp: Date.now(),
        latencyMs: 100,
        phase: "recall" as const,
      };
      observer.onLayerUpdate?.(event);

      expect(printLayerUpdate).toHaveBeenCalledWith(event);
    });
  });

  describe("createRememberObserver", () => {
    it("returns an observer with remember phase methods", async () => {
      const { createRememberObserver } = await import("../memoir.js");

      const observer = createRememberObserver();

      expect(observer).toHaveProperty("onRememberStart");
      expect(observer).toHaveProperty("onLayerUpdate");
      expect(observer).toHaveProperty("onRememberComplete");
      expect(typeof observer.onRememberStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onRememberComplete).toBe("function");
    });

    it("calls printRememberStart on remember start", async () => {
      const { printRememberStart } = await import("../display.js");
      const { createRememberObserver } = await import("../memoir.js");

      const observer = createRememberObserver();
      observer.onRememberStart?.("test-id");

      expect(printRememberStart).toHaveBeenCalledWith("test-id");
    });

    it("calls printLayerUpdate on layer update", async () => {
      const { printLayerUpdate } = await import("../display.js");
      const { createRememberObserver } = await import("../memoir.js");

      const observer = createRememberObserver();
      const event = {
        layer: "facts" as const,
        status: "complete" as const,
        timestamp: Date.now(),
        latencyMs: 100,
        phase: "remember" as const,
      };
      observer.onLayerUpdate?.(event);

      expect(printLayerUpdate).toHaveBeenCalledWith(event);
    });
  });

  describe("createLayerObserver (legacy)", () => {
    it("returns an observer with remember phase methods for backward compatibility", async () => {
      const { createLayerObserver } = await import("../memoir.js");

      const observer = createLayerObserver();

      expect(observer).toHaveProperty("onRememberStart");
      expect(observer).toHaveProperty("onLayerUpdate");
      expect(observer).toHaveProperty("onRememberComplete");
      expect(typeof observer.onRememberStart).toBe("function");
      expect(typeof observer.onLayerUpdate).toBe("function");
      expect(typeof observer.onRememberComplete).toBe("function");
    });
  });

  describe("getEmbeddingProvider", () => {
    it("returns undefined when OPENAI_API_KEY is not set", async () => {
      delete process.env.OPENAI_API_KEY;

      const { getEmbeddingProvider } = await import("../memoir.js");
      const provider = await getEmbeddingProvider();

      expect(provider).toBeUndefined();
    });

    it("returns embedding function when OPENAI_API_KEY is set", async () => {
      process.env.OPENAI_API_KEY = "sk-test-key";

      // Mock OpenAI
      vi.doMock("openai", () => ({
        default: vi.fn().mockImplementation(() => ({
          embeddings: {
            create: vi.fn().mockResolvedValue({
              data: [{ embedding: new Array(1536).fill(0.1) }],
            }),
          },
        })),
      }));

      const { getEmbeddingProvider } = await import("../memoir.js");
      const provider = await getEmbeddingProvider();

      expect(provider).toBeDefined();
      expect(typeof provider).toBe("function");
    });
  });

  describe("buildRememberParams", () => {
    it("builds params with CONFIG values", async () => {
      delete process.env.OPENAI_API_KEY;

      const { buildRememberParams, CONFIG } = await import("../memoir.js");

      const params = await buildRememberParams({
        userMessage: "Hello",
        agentResponse: "Hi there",
        conversationId: "conv-123",
      });

      expect(params.memorySpaceId).toBe(CONFIG.memorySpaceId);
      expect(params.userId).toBe(CONFIG.userId);
      expect(params.userName).toBe(CONFIG.userName);
      expect(params.agentId).toBe(CONFIG.agentId);
      expect(params.userMessage).toBe("Hello");
      expect(params.agentResponse).toBe("Hi there");
      expect(params.conversationId).toBe("conv-123");
    });

    it("includes belief revision when fact extraction is enabled", async () => {
      delete process.env.OPENAI_API_KEY;
      process.env.MEMOIR_FACT_EXTRACTION = "true";

      const { buildRememberParams } = await import("../memoir.js");

      const params = await buildRememberParams({
        userMessage: "Hello",
        agentResponse: "Hi",
        conversationId: "conv-123",
      });

      expect(params.extractFacts).toBe(true);
      expect(params.beliefRevision).toEqual({
        enabled: true,
        slotMatching: true,
        llmResolution: false, // No OpenAI key
      });
    });
  });
});
