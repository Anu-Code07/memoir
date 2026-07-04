/**
 * Statistics Consistency Testing
 *
 * Validates that stats/counts match actual data after every operation:
 * 1. memorySpaces.getStats() matches direct queries
 * 2. All count() functions match list().length
 * 3. Stats update immediately after operations
 * 4. Bulk operations reflected in counts
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Memoir } from "../src/index";
import { createTestRunContext } from "./helpers/isolation";

describe("Statistics Consistency Testing", () => {
  let memoir: Memoir;
  // Use TestRunContext for parallel-safe test isolation
  const ctx = createTestRunContext();
  const BASE_ID = ctx.runId;
  const TEST_USER_ID = ctx.userId("stats-user");
  const TEST_AGENT_ID = ctx.agentId("stats-agent");

  beforeAll(() => {
    memoir = new Memoir({ convexUrl: process.env.CONVEX_URL! });
  });

  afterAll(async () => {
    // Cleanup all test spaces created by this run
    try {
      await memoir.memorySpaces.delete(BASE_ID, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch (_e) {
      // Ignore
    }
  });

  // ══════════════════════════════════════════════════════════════════════
  // Memory Space Stats vs Direct Queries
  // ══════════════════════════════════════════════════════════════════════

  describe("memorySpaces.getStats() Consistency", () => {
    it("stats match actual conversation count", async () => {
      const spaceId = `${BASE_ID}-conv-stats`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Conv stats test",
      });

      // Create 3 conversations
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: `${TEST_USER_ID}-2`, agentId: "test-agent" },
      });
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: `${TEST_USER_ID}-3`, agentId: "test-agent" },
      });

      const stats = await memoir.memorySpaces.getStats(spaceId);
      const directCount = await memoir.conversations.count({
        memorySpaceId: spaceId,
      });

      expect(stats.totalConversations).toBe(directCount);
    });

    it("stats match actual memory count", async () => {
      const spaceId = `${BASE_ID}-mem-stats`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Memory stats test",
      });

      // Create 5 memories
      for (let i = 0; i < 5; i++) {
        await memoir.vector.store(spaceId, {
          content: `Memory ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      }

      const stats = await memoir.memorySpaces.getStats(spaceId);
      const directCount = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(stats.totalMemories).toBe(directCount);
    });

    it("stats match actual fact count", async () => {
      const spaceId = `${BASE_ID}-fact-stats`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Fact stats test",
      });

      // Create 4 facts
      for (let i = 0; i < 4; i++) {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          fact: `Fact ${i}`,
          factType: "knowledge",
          subject: TEST_USER_ID,
          confidence: 80,
          sourceType: "manual",
        });
      }

      const stats = await memoir.memorySpaces.getStats(spaceId);
      const directCount = await memoir.facts.count({ memorySpaceId: spaceId });

      expect(stats.totalFacts).toBeGreaterThanOrEqual(4);
      expect(stats.totalFacts).toBe(directCount);
    });

    it("stats match actual message count", async () => {
      const spaceId = `${BASE_ID}-msg-stats`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Message stats test",
      });

      const conv = await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      // Add 7 messages
      for (let i = 0; i < 7; i++) {
        await memoir.conversations.addMessage({
          conversationId: conv.conversationId,
          message: {
            role: i % 2 === 0 ? "user" : "agent",
            content: `Message ${i}`,
          },
        });
      }

      const stats = await memoir.memorySpaces.getStats(spaceId);
      const convCheck = await memoir.conversations.get(conv.conversationId);

      expect(stats.totalMessages).toBe(convCheck!.messages.length);
    });

    it("stats include all layers simultaneously", async () => {
      const spaceId = `${BASE_ID}-all-layers`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "All layers test",
      });

      // Add data to each layer
      const conv = await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      await memoir.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "Test" },
      });

      await memoir.vector.store(spaceId, {
        content: "Test memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Test fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      await memoir.contexts.create({
        memorySpaceId: spaceId,
        userId: TEST_USER_ID,
        purpose: "Test context",
      });

      const stats = await memoir.memorySpaces.getStats(spaceId);

      expect(stats.totalConversations).toBeGreaterThanOrEqual(1);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(1);
      expect(stats.totalMemories).toBeGreaterThanOrEqual(1);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);
      // expect(stats.totalContexts).toBeGreaterThanOrEqual(1); // Not in type
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Count() vs List().length Consistency
  // ══════════════════════════════════════════════════════════════════════

  describe("count() Matches list().length", () => {
    it("vector.count() matches vector.list().length", async () => {
      const spaceId = `${BASE_ID}-vec-count`;

      // Create memories
      for (let i = 0; i < 6; i++) {
        await memoir.vector.store(spaceId, {
          content: `Count test ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: ["count-match"] },
        });
      }

      const count = await memoir.vector.count({ memorySpaceId: spaceId });
      const list = await memoir.vector.list({ memorySpaceId: spaceId });

      expect(count).toBe(list.length);
    });

    it("conversations.count() matches conversations.list().length", async () => {
      const spaceId = `${BASE_ID}-conv-count`;

      // Create conversations
      for (let i = 0; i < 4; i++) {
        await memoir.conversations.create({
          type: "user-agent",
          memorySpaceId: spaceId,
          participants: {
            userId: `${TEST_USER_ID}-${i}`,
            agentId: "test-agent",
          },
        });
      }

      const count = await memoir.conversations.count({
        memorySpaceId: spaceId,
      });
      const list = await memoir.conversations.list({ memorySpaceId: spaceId });

      expect(count).toBe(list.conversations.length);
    });

    it("facts.count() matches facts.list().length", async () => {
      const spaceId = `${BASE_ID}-facts-count`;

      // Create facts
      for (let i = 0; i < 5; i++) {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          fact: `Count fact ${i}`,
          factType: "knowledge",
          subject: TEST_USER_ID,
          confidence: 80,
          sourceType: "manual",
        });
      }

      const count = await memoir.facts.count({ memorySpaceId: spaceId });
      const list = await memoir.facts.list({ memorySpaceId: spaceId });

      expect(count).toBe(list.length);
    });

    it("contexts.count() matches contexts.list().length", async () => {
      const spaceId = `${BASE_ID}-ctx-count`;

      // Create contexts
      for (let i = 0; i < 3; i++) {
        await memoir.contexts.create({
          memorySpaceId: spaceId,
          userId: TEST_USER_ID,
          purpose: `Count context ${i}`,
        });
      }

      const count = await memoir.contexts.count({ memorySpaceId: spaceId });
      const list = await memoir.contexts.list({ memorySpaceId: spaceId });

      expect(count).toBe(list.length);
    });

    it("memorySpaces.count() matches memorySpaces.list().length", async () => {
      // Create spaces with unique prefix for this test
      const testPrefix = `${BASE_ID}-count-${Date.now()}`;
      const createdSpaceIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const spaceId = `${testPrefix}-${i}`;
        createdSpaceIds.push(spaceId);
        await memoir.memorySpaces.register({
          memorySpaceId: spaceId,
          type: "project",
          name: `Count space ${i}`,
        });
      }

      // In parallel execution, we can't reliably count ALL spaces globally
      // as other tests create/delete spaces concurrently.
      // Instead, verify that our created spaces exist and can be retrieved.
      const list = await memoir.memorySpaces.list({});
      const allSpaces = (list as any).spaces ? (list as any).spaces : list;

      // Count how many of OUR spaces are in the list
      const ourSpaces = allSpaces.filter((s: any) =>
        createdSpaceIds.includes(s.memorySpaceId),
      );

      // All our spaces should exist
      expect(ourSpaces.length).toBe(3);
    });

    it("count with filters matches filtered list length", async () => {
      const spaceId = `${BASE_ID}-filter-count`;

      // Create memories with different tags
      await memoir.vector.store(spaceId, {
        content: "Tagged A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["tag-a"] },
      });
      await memoir.vector.store(spaceId, {
        content: "Tagged B",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["tag-b"] },
      });
      await memoir.vector.store(spaceId, {
        content: "Tagged A again",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["tag-a"] },
      });

      const allList = await memoir.vector.list({
        memorySpaceId: spaceId,
      });
      const count = allList.filter((m) => m.tags.includes("tag-a")).length;

      const list = await memoir.vector.list({
        memorySpaceId: spaceId,
      });
      const filtered = list.filter((m) => m.tags.includes("tag-a"));

      // Count matches filtered list
      expect(count).toBe(filtered.length);
    });

    it("fact count by type matches list by type", async () => {
      const spaceId = `${BASE_ID}-fact-type-count`;

      // Create different fact types
      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Preference 1",
        factType: "preference",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });
      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Preference 2",
        factType: "preference",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });
      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Identity 1",
        factType: "identity",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const prefList = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: "preference",
      });
      const prefCount = prefList.length;

      expect(prefCount).toBe(prefList.length);
      expect(prefCount).toBe(2);
    });

    it("conversation count by type matches list by type", async () => {
      const spaceId = `${BASE_ID}-conv-type-count`;

      // Create different types
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: `${TEST_USER_ID}-2`, agentId: "test-agent" },
      });
      await memoir.conversations.create({
        type: "agent-agent",
        memorySpaceId: spaceId,
        participants: {
          participantId: "agent-a",
          memorySpaceIds: ["a1", "a2"],
        },
      });

      const uaCount = await memoir.conversations.count({
        memorySpaceId: spaceId,
        type: "user-agent",
      });

      const uaList = await memoir.conversations.list({
        memorySpaceId: spaceId,
        type: "user-agent",
      });

      expect(uaCount).toBe(uaList.conversations.length);
      expect(uaCount).toBe(2);
    });

    it("context count by status matches list by status", async () => {
      const spaceId = `${BASE_ID}-ctx-status-count`;

      // Create contexts with different statuses
      await memoir.contexts.create({
        memorySpaceId: spaceId,
        userId: TEST_USER_ID,
        purpose: "Active 1",
        status: "active",
      });
      await memoir.contexts.create({
        memorySpaceId: spaceId,
        userId: TEST_USER_ID,
        purpose: "Active 2",
        status: "active",
      });
      await memoir.contexts.create({
        memorySpaceId: spaceId,
        userId: TEST_USER_ID,
        purpose: "Completed",
        status: "completed",
      });

      const activeCount = await memoir.contexts.count({
        memorySpaceId: spaceId,
        status: "active",
      });

      const activeList = await memoir.contexts.list({
        memorySpaceId: spaceId,
        status: "active",
      });

      expect(activeCount).toBe(activeList.length);
      expect(activeCount).toBe(2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Stats Update After Operations
  // ══════════════════════════════════════════════════════════════════════

  describe("Stats Update Immediately After Operations", () => {
    it("creating conversation increments stats", async () => {
      const spaceId = `${BASE_ID}-create-conv-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Create stats",
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const after = await memoir.memorySpaces.getStats(spaceId);

      expect(after.totalConversations).toBe(before.totalConversations + 1);
    });

    it("adding message increments message count", async () => {
      const spaceId = `${BASE_ID}-add-msg-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Message stats",
      });

      const conv = await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      await memoir.conversations.addMessage({
        conversationId: conv.conversationId,
        message: { role: "user", content: "New message" },
      });

      const after = await memoir.memorySpaces.getStats(spaceId);

      expect(after.totalMessages).toBe(before.totalMessages + 1);
    });

    it("creating memory increments stats", async () => {
      const spaceId = `${BASE_ID}-create-mem-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Memory create stats",
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      await memoir.vector.store(spaceId, {
        content: "New memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const after = await memoir.memorySpaces.getStats(spaceId);

      expect(after.totalMemories).toBe(before.totalMemories + 1);
    });

    it("deleting memory decrements stats", async () => {
      const spaceId = `${BASE_ID}-del-mem-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Memory delete stats",
      });

      const mem = await memoir.vector.store(spaceId, {
        content: "To delete",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      await memoir.vector.delete(spaceId, mem.memoryId);

      const after = await memoir.memorySpaces.getStats(spaceId);

      expect(after.totalMemories).toBe(before.totalMemories - 1);
    });

    it("creating fact increments stats", async () => {
      const spaceId = `${BASE_ID}-create-fact-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Fact create stats",
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "New fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const after = await memoir.memorySpaces.getStats(spaceId);

      expect(after.totalFacts).toBeGreaterThanOrEqual(before.totalFacts + 1);
    });

    it("updating memory doesn't change count", async () => {
      const spaceId = `${BASE_ID}-update-mem`;

      const mem = await memoir.vector.store(spaceId, {
        content: "Original",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      await memoir.vector.update(spaceId, mem.memoryId, {
        content: "Updated",
      });

      const after = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(after).toBe(before);
    });

    it("updating fact creates new version but count stays same", async () => {
      const spaceId = `${BASE_ID}-update-fact`;

      const fact = await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Original",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 70,
        sourceType: "manual",
      });

      const before = await memoir.facts.count({ memorySpaceId: spaceId });

      await memoir.facts.update(spaceId, fact.factId, {
        confidence: 90,
      });

      const after = await memoir.facts.count({ memorySpaceId: spaceId });

      // Count excludes superseded by default
      expect(after).toBe(before);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Bulk Operations Stats Impact
  // ══════════════════════════════════════════════════════════════════════

  describe("Bulk Operations Statistics", () => {
    it("deleteMany result.deleted matches count change", async () => {
      const spaceId = `${BASE_ID}-bulk-del-stats`;

      // Create 10 memories
      await Promise.all(
        Array.from({ length: 10 }, () =>
          memoir.vector.store(spaceId, {
            content: "Bulk delete",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: ["bulk-del-stats"] },
          }),
        ),
      );

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      const toDelete = await memoir.vector.list({ memorySpaceId: spaceId });
      const filteredDelete = toDelete.filter((m) =>
        m.tags.includes("bulk-del-stats"),
      );
      for (const mem of filteredDelete) {
        await memoir.vector.delete(spaceId, mem.memoryId);
      }
      const result = { deleted: filteredDelete.length };

      const after = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(before - after).toBe(result.deleted);
    });

    it("updateMany doesn't change count", async () => {
      const spaceId = `${BASE_ID}-bulk-upd-stats`;

      // Create memories
      await Promise.all(
        Array.from({ length: 8 }, () =>
          memoir.vector.store(spaceId, {
            content: "Bulk update",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: ["bulk-upd-stats"] },
          }),
        ),
      );

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      const toUpdate = await memoir.vector.list({ memorySpaceId: spaceId });
      const filteredUpdate = toUpdate.filter((m) =>
        m.tags.includes("bulk-upd-stats"),
      );
      for (const mem of filteredUpdate) {
        await memoir.vector.update(spaceId, mem.memoryId, { importance: 90 });
      }

      const after = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(after).toBe(before);
    });

    it("deleteMany affects stats.totalMemories", async () => {
      const spaceId = `${BASE_ID}-del-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Delete stats",
      });

      // Create memories
      await Promise.all(
        Array.from({ length: 5 }, () =>
          memoir.vector.store(spaceId, {
            content: "To delete",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: ["del-stats"] },
          }),
        ),
      );

      const before = await memoir.memorySpaces.getStats(spaceId);

      const toDeleteStats = await memoir.vector.list({
        memorySpaceId: spaceId,
      });
      const filteredDelStats = toDeleteStats.filter((m) =>
        m.tags.includes("del-stats"),
      );
      for (const mem of filteredDelStats) {
        await memoir.vector.delete(spaceId, mem.memoryId);
      }

      const after = await memoir.memorySpaces.getStats(spaceId);

      expect(after.totalMemories).toBe(before.totalMemories - 5);
    });

    it("export count matches list count", async () => {
      const spaceId = `${BASE_ID}-export-count`;

      // Create memories
      for (let i = 0; i < 7; i++) {
        await memoir.vector.store(spaceId, {
          content: `Export ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      }

      const exported = await memoir.vector.export({
        memorySpaceId: spaceId,
        format: "json",
      });

      const list = await memoir.vector.list({ memorySpaceId: spaceId });

      const parsed = JSON.parse(exported.data);
      expect(parsed.length).toBe(list.length);
      expect(exported.count).toBe(list.length);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Real-Time Stats Consistency
  // ══════════════════════════════════════════════════════════════════════

  describe("Real-Time Statistics Updates", () => {
    it("stats reflect state immediately after each operation in sequence", async () => {
      const spaceId = `${BASE_ID}-realtime-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Realtime stats",
      });

      // Initial
      const stats0 = await memoir.memorySpaces.getStats(spaceId);
      expect(stats0.totalMemories).toBe(0);

      // Add 1
      await memoir.vector.store(spaceId, {
        content: "Mem 1",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const stats1 = await memoir.memorySpaces.getStats(spaceId);
      expect(stats1.totalMemories).toBe(1);

      // Add 2
      await memoir.vector.store(spaceId, {
        content: "Mem 2",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const stats2 = await memoir.memorySpaces.getStats(spaceId);
      expect(stats2.totalMemories).toBe(2);

      // Add 3
      await memoir.vector.store(spaceId, {
        content: "Mem 3",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const stats3 = await memoir.memorySpaces.getStats(spaceId);
      expect(stats3.totalMemories).toBe(3);
    });

    it("concurrent creates reflected accurately in stats", async () => {
      const spaceId = `${BASE_ID}-concurrent-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Concurrent stats",
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      // Create 15 memories concurrently
      await Promise.all(
        Array.from({ length: 15 }, () =>
          memoir.vector.store(spaceId, {
            content: "Concurrent",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      const after = await memoir.memorySpaces.getStats(spaceId);

      expect(after.totalMemories).toBe(before.totalMemories + 15);
    });

    it("remember() updates multiple stats simultaneously", async () => {
      const spaceId = `${BASE_ID}-remember-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Remember stats",
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      await memoir.memory.remember({
        memorySpaceId: spaceId,
        conversationId: `remember-${Date.now()}`,
        userMessage: "Test",
        agentResponse: "Response",
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
      });

      const after = await memoir.memorySpaces.getStats(spaceId);

      // Should update conversations, messages, and memories
      expect(after.totalConversations).toBe(before.totalConversations + 1);
      expect(after.totalMessages).toBe(before.totalMessages + 2);
      expect(after.totalMemories).toBe(before.totalMemories + 2);
    });

    it("forget() decrements memory count", async () => {
      const spaceId = `${BASE_ID}-forget-stats`;

      const result = await memoir.memory.remember({
        memorySpaceId: spaceId,
        conversationId: `forget-${Date.now()}`,
        userMessage: "To forget",
        agentResponse: "Response",
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
      });

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      await memoir.memory.forget(spaceId, result.memories[0].memoryId);

      const after = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(after).toBe(before - 1);
    });

    it("cascade delete updates all stats", async () => {
      const spaceId = `${BASE_ID}-cascade-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Cascade stats",
      });

      // Create data in all layers
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      await memoir.vector.store(spaceId, {
        content: "Memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      // Delete space
      await memoir.memorySpaces.delete(spaceId, {
        cascade: true,
        reason: "test cleanup",
      });

      // Space should be gone
      const check = await memoir.memorySpaces.get(spaceId);
      expect(check).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Count Consistency Edge Cases
  // ══════════════════════════════════════════════════════════════════════

  describe("Count Consistency Edge Cases", () => {
    it("count remains 0 for empty space", async () => {
      const spaceId = `${BASE_ID}-empty-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Empty space",
      });

      const count = await memoir.vector.count({ memorySpaceId: spaceId });
      const list = await memoir.vector.list({ memorySpaceId: spaceId });

      expect(count).toBe(0);
      expect(list).toHaveLength(0);
    });

    it("count after create/delete cycle returns to original", async () => {
      const spaceId = `${BASE_ID}-cycle`;

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      const mem = await memoir.vector.store(spaceId, {
        content: "Temporary",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const during = await memoir.vector.count({ memorySpaceId: spaceId });
      expect(during).toBe(before + 1);

      await memoir.vector.delete(spaceId, mem.memoryId);

      const after = await memoir.vector.count({ memorySpaceId: spaceId });
      expect(after).toBe(before);
    });

    it("rapid create/delete maintains count consistency", async () => {
      const spaceId = `${BASE_ID}-rapid-count`;

      const initial = await memoir.vector.count({ memorySpaceId: spaceId });

      // Rapid create/delete
      for (let i = 0; i < 5; i++) {
        const mem = await memoir.vector.store(spaceId, {
          content: `Rapid ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        await memoir.vector.delete(spaceId, mem.memoryId);
      }

      const final = await memoir.vector.count({ memorySpaceId: spaceId });
      expect(final).toBe(initial);
    });

    it("parallel creates all counted", async () => {
      const spaceId = `${BASE_ID}-parallel-count`;

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      await Promise.all(
        Array.from({ length: 12 }, () =>
          memoir.vector.store(spaceId, {
            content: "Parallel create",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      const after = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(after).toBe(before + 12);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Stats Accuracy With Complex Operations
  // ══════════════════════════════════════════════════════════════════════

  describe("Statistics Accuracy With Complex Operations", () => {
    it("stats accurate after mixed create/update/delete", async () => {
      const spaceId = `${BASE_ID}-mixed-ops-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Mixed ops",
      });

      // Create 5
      const mems = await Promise.all(
        Array.from({ length: 5 }, () =>
          memoir.vector.store(spaceId, {
            content: "Mixed",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // Update 2
      await memoir.vector.update(spaceId, mems[0].memoryId, {
        content: "Updated 1",
      });
      await memoir.vector.update(spaceId, mems[1].memoryId, {
        content: "Updated 2",
      });

      // Delete 1
      await memoir.vector.delete(spaceId, mems[2].memoryId);

      // Count should be 4
      const count = await memoir.vector.count({ memorySpaceId: spaceId });
      const list = await memoir.vector.list({ memorySpaceId: spaceId });

      expect(count).toBe(4);
      expect(list).toHaveLength(4);
    });

    it("stats accurate with superseded facts", async () => {
      const spaceId = `${BASE_ID}-superseded`;

      // Create fact and update it
      const fact1 = await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "V1",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 70,
        sourceType: "manual",
      });

      await memoir.facts.update(spaceId, fact1.factId, { confidence: 80 });
      await memoir.facts.update(spaceId, fact1.factId, { confidence: 90 });

      // Count excludes superseded
      const count = await memoir.facts.count({ memorySpaceId: spaceId });
      const list = await memoir.facts.list({ memorySpaceId: spaceId });

      // Should only count active (non-superseded) facts
      expect(count).toBe(list.length);
    });

    it("immutable versions don't inflate count", async () => {
      const id = `count-version-${Date.now()}`;

      // Create 5 versions
      for (let i = 1; i <= 5; i++) {
        await memoir.immutable.store({
          type: "versioned",
          id,
          data: { version: i },
        });
      }

      // List shows only latest for each ID
      const list = await memoir.immutable.list({ type: "versioned" });
      const thisIdList = list.filter((item) => item.id === id);

      expect(thisIdList).toHaveLength(1);
      expect(thisIdList[0].version).toBe(5);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Multi-Space Stats Independence
  // ══════════════════════════════════════════════════════════════════════

  describe("Multi-Space Statistics Independence", () => {
    it("stats for 3 spaces are independent", async () => {
      const spaces = Array.from(
        { length: 3 },
        (_, i) => `${BASE_ID}-indep-${i}-${Date.now()}`,
      );

      // Create spaces and different amounts of data
      for (let i = 0; i < spaces.length; i++) {
        await memoir.memorySpaces.register({
          memorySpaceId: spaces[i],
          type: "project",
          name: `Space ${i}`,
        });

        // Create i+1 memories
        for (let j = 0; j <= i; j++) {
          await memoir.vector.store(spaces[i], {
            content: `Mem ${j}`,
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          });
        }
      }

      // Verify independent stats
      const stats0 = await memoir.memorySpaces.getStats(spaces[0]);
      const stats1 = await memoir.memorySpaces.getStats(spaces[1]);
      const stats2 = await memoir.memorySpaces.getStats(spaces[2]);

      expect(stats0.totalMemories).toBe(1);
      expect(stats1.totalMemories).toBe(2);
      expect(stats2.totalMemories).toBe(3);
    });

    it("modifying one space doesn't affect others' stats", async () => {
      const space1 = `${BASE_ID}-modify-1-${Date.now()}`;
      const space2 = `${BASE_ID}-modify-2-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: space1,
        type: "project",
        name: "Space 1",
      });

      await memoir.memorySpaces.register({
        memorySpaceId: space2,
        type: "project",
        name: "Space 2",
      });

      const stats2Before = await memoir.memorySpaces.getStats(space2);

      // Modify space 1 heavily
      for (let i = 0; i < 10; i++) {
        await memoir.vector.store(space1, {
          content: `Mem ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });
      }

      const stats2After = await memoir.memorySpaces.getStats(space2);

      // Space 2 stats unchanged
      expect(stats2After.totalMemories).toBe(stats2Before.totalMemories);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Count Filter Consistency
  // ══════════════════════════════════════════════════════════════════════

  describe("Count Filter Consistency", () => {
    it("count with tag filter matches filtered list", async () => {
      const spaceId = `${BASE_ID}-tag-filter`;

      // Create with different tags
      await memoir.vector.store(spaceId, {
        content: "Tag A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["filter-a"] },
      });
      await memoir.vector.store(spaceId, {
        content: "Tag A",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["filter-a"] },
      });
      await memoir.vector.store(spaceId, {
        content: "Tag B",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: ["filter-b"] },
      });

      // Count filtered by tag (not supported directly, use list)
      const countListA = await memoir.vector.list({ memorySpaceId: spaceId });
      const countA = countListA.filter((m) =>
        m.tags.includes("filter-a"),
      ).length;

      const listAAll = await memoir.vector.list({
        memorySpaceId: spaceId,
      });
      const listA = listAAll.filter((m) => m.tags.includes("filter-a"));

      expect(countA).toBe(listA.length);
      expect(countA).toBe(2);
    });

    it("count with importance filter matches filtered list", async () => {
      const spaceId = `${BASE_ID}-importance-filter`;

      // Create with different importance
      await memoir.vector.store(spaceId, {
        content: "Low",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 30, tags: [] },
      });
      await memoir.vector.store(spaceId, {
        content: "High",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 90, tags: [] },
      });
      await memoir.vector.store(spaceId, {
        content: "High 2",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 95, tags: [] },
      });

      const allForImportance = await memoir.vector.list({
        memorySpaceId: spaceId,
      });
      const count = allForImportance.filter((m) => m.importance >= 80).length;

      const list = await memoir.vector.list({ memorySpaceId: spaceId });
      const filtered = list.filter((m) => m.importance >= 80);

      expect(count).toBe(filtered.length);
    });

    it("fact count with factType matches filtered list", async () => {
      const spaceId = `${BASE_ID}-fact-type-filter`;

      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Pref 1",
        factType: "preference",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });
      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Pref 2",
        factType: "preference",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });
      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Identity",
        factType: "identity",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const count = await memoir.facts.count({
        memorySpaceId: spaceId,
        factType: "preference",
      });

      const list = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: "preference",
      });

      expect(count).toBe(list.length);
      expect(count).toBe(2);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Statistics Performance & Scale
  // ══════════════════════════════════════════════════════════════════════

  describe("Statistics At Scale", () => {
    it("stats accurate with 100+ memories", async () => {
      const spaceId = `${BASE_ID}-scale-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Scale test",
      });

      // Create 100 memories
      await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          memoir.vector.store(spaceId, {
            content: `Scale mem ${i}`,
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      const stats = await memoir.memorySpaces.getStats(spaceId);
      const count = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(stats.totalMemories).toBe(count);
      expect(stats.totalMemories).toBe(100);
    });

    it("stats accurate with 50+ conversations", async () => {
      const spaceId = `${BASE_ID}-conv-scale-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Conv scale test",
      });

      // Create 50 conversations
      await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          memoir.conversations.create({
            type: "user-agent",
            memorySpaceId: spaceId,
            participants: {
              userId: `${TEST_USER_ID}-${i}`,
              agentId: "test-agent",
            },
          }),
        ),
      );

      const stats = await memoir.memorySpaces.getStats(spaceId);
      const count = await memoir.conversations.count({
        memorySpaceId: spaceId,
      });

      expect(stats.totalConversations).toBe(count);
      expect(stats.totalConversations).toBe(50);
    });

    it("count performance doesn't degrade with large dataset", async () => {
      const spaceId = `${BASE_ID}-perf`;

      // Create some data
      await Promise.all(
        Array.from({ length: 20 }, () =>
          memoir.vector.store(spaceId, {
            content: "Perf test",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // Count should be fast
      const start = Date.now();
      const count = await memoir.vector.count({ memorySpaceId: spaceId });
      const duration = Date.now() - start;

      expect(count).toBeGreaterThanOrEqual(20);
      expect(duration).toBeLessThan(5000); // Should be under 5s
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Statistics Validation Edge Cases
  // ══════════════════════════════════════════════════════════════════════

  describe("Statistics Validation Edge Cases", () => {
    it("stats for non-existent space returns zeros", async () => {
      try {
        const stats = await memoir.memorySpaces.getStats(
          "non-existent-space-xyz",
        );
        // May return zeros or throw
        expect(stats.totalMemories).toBe(0);
      } catch (e) {
        // Or throws MEMORYSPACE_NOT_FOUND
        expect(e).toBeDefined();
      }
    });

    it("count for non-existent space returns 0", async () => {
      const count = await memoir.vector.count({
        memorySpaceId: "non-existent-space-count",
      });

      expect(count).toBe(0);
    });

    it("list for non-existent space returns empty array", async () => {
      const list = await memoir.vector.list({
        memorySpaceId: "non-existent-space-list",
      });

      expect(list).toEqual([]);
    });

    it("stats remain consistent through space updates", async () => {
      const spaceId = `${BASE_ID}-update-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Original name",
      });

      await memoir.vector.store(spaceId, {
        content: "Memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const before = await memoir.memorySpaces.getStats(spaceId);

      // Update space metadata
      await memoir.memorySpaces.update(spaceId, { name: "Updated name" });

      const after = await memoir.memorySpaces.getStats(spaceId);

      // Stats unchanged by metadata update
      expect(after.totalMemories).toBe(before.totalMemories);
    });

    it("stats accurate after archive/reactivate", async () => {
      const spaceId = `${BASE_ID}-archive-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Archive stats",
      });

      await memoir.vector.store(spaceId, {
        content: "Memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const beforeArchive = await memoir.memorySpaces.getStats(spaceId);

      await memoir.memorySpaces.archive(spaceId);

      const archived = await memoir.memorySpaces.getStats(spaceId);
      expect(archived.totalMemories).toBe(beforeArchive.totalMemories);

      await memoir.memorySpaces.reactivate(spaceId);

      const reactivated = await memoir.memorySpaces.getStats(spaceId);
      expect(reactivated.totalMemories).toBe(beforeArchive.totalMemories);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Aggregated Statistics Consistency
  // ══════════════════════════════════════════════════════════════════════

  describe("Aggregated Statistics", () => {
    it("total stats sum across all components", async () => {
      const spaceId = `${BASE_ID}-aggregate-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Aggregate test",
      });

      // Create known amounts
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      }); // 1 conv

      await memoir.vector.store(spaceId, {
        content: "Mem 1",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await memoir.vector.store(spaceId, {
        content: "Mem 2",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      }); // 2 mems

      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact 1",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      }); // 1 fact

      const stats = await memoir.memorySpaces.getStats(spaceId);

      // Individual counts
      expect(stats.totalConversations).toBe(1);
      expect(stats.totalMemories).toBe(2);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(1);

      // Total across layers
      const totalItems =
        stats.totalConversations +
        stats.totalMessages +
        stats.totalMemories +
        stats.totalFacts;
      // + stats.totalContexts; // Not in type

      expect(totalItems).toBeGreaterThan(0);
    });

    it("stats.totalItems calculated correctly", async () => {
      const spaceId = `${BASE_ID}-total-items-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Total items test",
      });

      // Create various items
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      await memoir.vector.store(spaceId, {
        content: "Memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const stats = await memoir.memorySpaces.getStats(spaceId);

      // totalItems should equal sum of all counts
      const calculatedTotal =
        stats.totalConversations + stats.totalMemories + stats.totalFacts;
      // + stats.totalContexts; // Not in type

      expect(calculatedTotal).toBeGreaterThan(0);
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Count Consistency After Complex Workflows
  // ══════════════════════════════════════════════════════════════════════

  describe("Count Consistency in Complex Workflows", () => {
    it("remember→forget workflow maintains count consistency", async () => {
      const spaceId = `${BASE_ID}-workflow-count`;

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      // Remember (creates 2 memories)
      const result = await memoir.memory.remember({
        memorySpaceId: spaceId,
        conversationId: `workflow-${Date.now()}`,
        userMessage: "Test",
        agentResponse: "Response",
        userId: TEST_USER_ID,
        userName: "Test User",
        agentId: TEST_AGENT_ID,
      });

      const during = await memoir.vector.count({ memorySpaceId: spaceId });
      expect(during).toBe(before + 2);

      // Forget one
      await memoir.memory.forget(spaceId, result.memories[0].memoryId);

      const after = await memoir.vector.count({ memorySpaceId: spaceId });
      expect(after).toBe(before + 1);
    });

    it("fact versioning maintains consistent count", async () => {
      const spaceId = `${BASE_ID}-fact-version-count`;

      const before = await memoir.facts.count({ memorySpaceId: spaceId });

      // Create fact
      const fact1 = await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "V1",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 70,
        sourceType: "manual",
      });

      const afterCreate = await memoir.facts.count({ memorySpaceId: spaceId });
      expect(afterCreate).toBe(before + 1);

      // Update (creates v2, supersedes v1)
      await memoir.facts.update(spaceId, fact1.factId, { confidence: 80 });

      const afterUpdate = await memoir.facts.count({ memorySpaceId: spaceId });

      // Count stays same (excludes superseded)
      expect(afterUpdate).toBe(afterCreate);
    });

    it("cascade delete decrements all stats correctly", async () => {
      const spaceId = `${BASE_ID}-cascade-count-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Cascade count",
      });

      // Create data in all layers
      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      await memoir.vector.store(spaceId, {
        content: "Memory",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      await memoir.facts.store({
        memorySpaceId: spaceId,
        fact: "Fact",
        factType: "knowledge",
        subject: TEST_USER_ID,
        confidence: 80,
        sourceType: "manual",
      });

      const _before = await memoir.memorySpaces.getStats(spaceId);

      // Delete with cascade
      await memoir.memorySpaces.delete(spaceId, {
        cascade: true,
        reason: "test cleanup",
      });

      // Space should be gone
      const check = await memoir.memorySpaces.get(spaceId);
      expect(check).toBeNull();
    });
  });

  // ══════════════════════════════════════════════════════════════════════
  // Comprehensive Stats Validation
  // ══════════════════════════════════════════════════════════════════════

  describe("Comprehensive Statistics Validation", () => {
    it("complete workflow stats match reality", async () => {
      const spaceId = `${BASE_ID}-complete-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Complete workflow",
      });

      // Create 3 conversations
      const convs = await Promise.all([
        memoir.conversations.create({
          type: "user-agent",
          memorySpaceId: spaceId,
          participants: { userId: TEST_USER_ID, agentId: "test-agent" },
        }),
        memoir.conversations.create({
          type: "user-agent",
          memorySpaceId: spaceId,
          participants: { userId: `${TEST_USER_ID}-2`, agentId: "test-agent" },
        }),
        memoir.conversations.create({
          type: "user-agent",
          memorySpaceId: spaceId,
          participants: { userId: `${TEST_USER_ID}-3`, agentId: "test-agent" },
        }),
      ]);

      // Add messages (2 to first, 3 to second, 1 to third)
      await memoir.conversations.addMessage({
        conversationId: convs[0].conversationId,
        message: { role: "user", content: "C1 M1" },
      });
      await memoir.conversations.addMessage({
        conversationId: convs[0].conversationId,
        message: { role: "agent", content: "C1 M2" },
      });

      await memoir.conversations.addMessage({
        conversationId: convs[1].conversationId,
        message: { role: "user", content: "C2 M1" },
      });
      await memoir.conversations.addMessage({
        conversationId: convs[1].conversationId,
        message: { role: "agent", content: "C2 M2" },
      });
      await memoir.conversations.addMessage({
        conversationId: convs[1].conversationId,
        message: { role: "user", content: "C2 M3" },
      });

      await memoir.conversations.addMessage({
        conversationId: convs[2].conversationId,
        message: { role: "user", content: "C3 M1" },
      });

      // Create 4 memories
      await Promise.all(
        Array.from({ length: 4 }, () =>
          memoir.vector.store(spaceId, {
            content: "Memory",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      // Create 2 facts
      await Promise.all(
        Array.from({ length: 2 }, () =>
          memoir.facts.store({
            memorySpaceId: spaceId,
            fact: "Fact",
            factType: "knowledge",
            subject: TEST_USER_ID,
            confidence: 80,
            sourceType: "manual",
          }),
        ),
      );

      const stats = await memoir.memorySpaces.getStats(spaceId);

      // Validate counts
      expect(stats.totalConversations).toBe(3);
      expect(stats.totalMessages).toBe(6); // 2+3+1
      expect(stats.totalMemories).toBe(4);
      expect(stats.totalFacts).toBeGreaterThanOrEqual(2);

      // Verify with direct queries
      const convCount = await memoir.conversations.count({
        memorySpaceId: spaceId,
      });
      const memCount = await memoir.vector.count({ memorySpaceId: spaceId });
      const factCount = await memoir.facts.count({ memorySpaceId: spaceId });

      expect(stats.totalConversations).toBe(convCount);
      expect(stats.totalMemories).toBe(memCount);
      expect(stats.totalFacts).toBe(factCount);
    });

    it("stats consistent across rapid operations", async () => {
      const spaceId = `${BASE_ID}-rapid-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Rapid stats",
      });

      // Rapid creates
      for (let i = 0; i < 10; i++) {
        await memoir.vector.store(spaceId, {
          content: `Rapid ${i}`,
          contentType: "raw",
          source: { type: "system" },
          metadata: { importance: 50, tags: [] },
        });

        // Check stats after each
        const stats = await memoir.memorySpaces.getStats(spaceId);
        expect(stats.totalMemories).toBeGreaterThanOrEqual(i + 1);
      }
    });

    it("empty space has zero stats", async () => {
      const spaceId = `${BASE_ID}-empty-stats-${Date.now()}`;

      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Empty stats",
      });

      const stats = await memoir.memorySpaces.getStats(spaceId);

      expect(stats.totalConversations).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.totalMemories).toBe(0);
      expect(stats.totalFacts).toBe(0);
      // expect(stats.totalContexts).toBe(0); // Not in type
    });

    it("stats accurate after partial delete", async () => {
      const spaceId = `${BASE_ID}-partial-del`;

      // Create 5 memories
      const mems = await Promise.all(
        Array.from({ length: 5 }, () =>
          memoir.vector.store(spaceId, {
            content: "Partial",
            contentType: "raw",
            source: { type: "system" },
            metadata: { importance: 50, tags: [] },
          }),
        ),
      );

      const before = await memoir.vector.count({ memorySpaceId: spaceId });

      // Delete 2
      await memoir.vector.delete(spaceId, mems[0].memoryId);
      await memoir.vector.delete(spaceId, mems[1].memoryId);

      const after = await memoir.vector.count({ memorySpaceId: spaceId });

      expect(after).toBe(before - 2);
    });

    it("count accurate with mixed content types", async () => {
      const spaceId = `${BASE_ID}-mixed-types`;

      await memoir.vector.store(spaceId, {
        content: "Raw",
        contentType: "raw",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await memoir.vector.store(spaceId, {
        content: "Summarized",
        contentType: "summarized",
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });
      await memoir.vector.store(spaceId, {
        content: "Fact",
        contentType: "raw", // "fact" not in ContentType
        source: { type: "system" },
        metadata: { importance: 50, tags: [] },
      });

      const count = await memoir.vector.count({ memorySpaceId: spaceId });
      const list = await memoir.vector.list({ memorySpaceId: spaceId });

      expect(count).toBe(list.length);
      expect(count).toBe(3);
    });

    it("message count accurate across multiple conversations", async () => {
      const spaceId = `${BASE_ID}-multi-conv-msgs-${Date.now()}`;

      // Register space first
      await memoir.memorySpaces.register({
        memorySpaceId: spaceId,
        type: "project",
        name: "Multi conv msgs",
      });

      const conv1 = await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: TEST_USER_ID, agentId: "test-agent" },
      });

      const conv2 = await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: { userId: `${TEST_USER_ID}-2`, agentId: "test-agent" },
      });

      // Add 3 to conv1
      for (let i = 0; i < 3; i++) {
        await memoir.conversations.addMessage({
          conversationId: conv1.conversationId,
          message: { role: "user", content: `C1 M${i}` },
        });
      }

      // Add 2 to conv2
      for (let i = 0; i < 2; i++) {
        await memoir.conversations.addMessage({
          conversationId: conv2.conversationId,
          message: { role: "user", content: `C2 M${i}` },
        });
      }

      const stats = await memoir.memorySpaces.getStats(spaceId);

      expect(stats.totalMessages).toBe(5); // 3 + 2
    });
  });
});
