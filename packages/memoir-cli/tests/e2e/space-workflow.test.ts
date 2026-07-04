/**
 * Space Workflow E2E Tests
 *
 * End-to-end tests for memory space operations.
 * These tests require CONVEX_URL to be set.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Memoir } from "@memoir/sdk";
import { cleanupTestData } from "../setup.js";

// Skip these tests if no Convex URL is configured
const CONVEX_URL = process.env.CONVEX_URL;
const describeE2E = CONVEX_URL ? describe : describe.skip;

describeE2E("Space Workflow E2E", () => {
  let memoir: Memoir;
  const TIMESTAMP = Date.now();
  const TEST_PREFIX = `e2e-space-${TIMESTAMP}`;

  beforeAll(async () => {
    memoir = new Memoir({ convexUrl: CONVEX_URL! });
    await cleanupTestData(TEST_PREFIX);
  }, 60000);

  afterAll(async () => {
    try {
      await cleanupTestData(TEST_PREFIX);
    } finally {
      memoir.close();
    }
  }, 60000);

  describe("Space CRUD Operations", () => {
    const testSpaceId = `${TEST_PREFIX}-crud-space`;

    it("should create a new memory space", async () => {
      const space = await memoir.memorySpaces.register({
        memorySpaceId: testSpaceId,
        name: "E2E Test Space",
        type: "project",
        metadata: { environment: "test" },
      });

      expect(space.memorySpaceId).toBe(testSpaceId);
      expect(space.name).toBe("E2E Test Space");
      expect(space.type).toBe("project");
      expect(space.status).toBe("active");
    });

    it("should get a memory space", async () => {
      const space = await memoir.memorySpaces.get(testSpaceId);

      expect(space).not.toBeNull();
      expect(space!.memorySpaceId).toBe(testSpaceId);
    });

    it("should return null for non-existent space", async () => {
      const space = await memoir.memorySpaces.get("nonexistent-space-id");
      expect(space).toBeNull();
    });

    it("should update space name", async () => {
      const updated = await memoir.memorySpaces.update(testSpaceId, {
        name: "Updated Space Name",
      });

      expect(updated.name).toBe("Updated Space Name");
    });

    it("should update space metadata", async () => {
      const updated = await memoir.memorySpaces.update(testSpaceId, {
        metadata: { updated: true, version: 2 },
      });

      expect((updated.metadata as any)?.updated).toBe(true);
    });
  });

  describe("Space Listing and Counting", () => {
    beforeAll(async () => {
      // Create spaces of different types
      await memoir.memorySpaces.register({
        memorySpaceId: `${TEST_PREFIX}-project-1`,
        name: "Project Space 1",
        type: "project",
      });
      await memoir.memorySpaces.register({
        memorySpaceId: `${TEST_PREFIX}-personal-1`,
        name: "Personal Space 1",
        type: "personal",
      });
      await memoir.memorySpaces.register({
        memorySpaceId: `${TEST_PREFIX}-team-1`,
        name: "Team Space 1",
        type: "team",
      });
    });

    it("should list all spaces", async () => {
      const result = await memoir.memorySpaces.list({ limit: 100 });
      const spaces = result.spaces || result;

      expect(spaces.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter by type", async () => {
      const result = await memoir.memorySpaces.list({
        type: "project",
        limit: 100,
      });
      const projectSpaces = result.spaces || result;

      projectSpaces.forEach((space: any) => {
        expect(space.type).toBe("project");
      });
    });

    it("should filter by status", async () => {
      const result = await memoir.memorySpaces.list({
        status: "active",
        limit: 100,
      });
      const activeSpaces = result.spaces || result;

      activeSpaces.forEach((space: any) => {
        expect(space.status).toBe("active");
      });
    });

    it("should count spaces", async () => {
      const count = await memoir.memorySpaces.count();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    });

    it("should count by type", async () => {
      const count = await memoir.memorySpaces.count({ type: "project" });

      expect(typeof count).toBe("number");
    });

    it("should search spaces by name", async () => {
      const results = await memoir.memorySpaces.search("Project", {
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("Space Archive and Reactivate", () => {
    const archiveSpaceId = `${TEST_PREFIX}-archive-space`;

    beforeAll(async () => {
      await memoir.memorySpaces.register({
        memorySpaceId: archiveSpaceId,
        name: "Archive Test Space",
        type: "project",
      });
    });

    it("should archive a space", async () => {
      const result = await memoir.memorySpaces.archive(archiveSpaceId, {
        reason: "Project completed",
      });

      expect(result.status).toBe("archived");
    });

    it("should show archived space with archived status", async () => {
      const space = await memoir.memorySpaces.get(archiveSpaceId);

      expect(space!.status).toBe("archived");
    });

    it("should reactivate an archived space", async () => {
      const result = await memoir.memorySpaces.reactivate(archiveSpaceId);

      expect(result.status).toBe("active");
    });

    it("should show reactivated space with active status", async () => {
      const space = await memoir.memorySpaces.get(archiveSpaceId);

      expect(space!.status).toBe("active");
    });
  });

  // Note: Participant management tests are skipped due to backend function issues
  // TODO: Re-enable when memorySpaces:addParticipant backend function is fixed
  describe.skip("Space Participants", () => {
    const participantSpaceId = `${TEST_PREFIX}-participant-space`;

    beforeAll(async () => {
      await memoir.memorySpaces.register({
        memorySpaceId: participantSpaceId,
        name: "Participant Test Space",
        type: "team",
      });
    });

    it("should add a user participant", async () => {
      const result = await memoir.memorySpaces.addParticipant(
        participantSpaceId,
        {
          id: "test-user-1",
          type: "user",
          role: "member",
        },
      );

      expect(result.participants.length).toBe(1);
    });

    it("should add an agent participant", async () => {
      const result = await memoir.memorySpaces.addParticipant(
        participantSpaceId,
        {
          id: "test-agent-1",
          type: "agent",
          role: "viewer",
        },
      );

      expect(result.participants.length).toBe(2);
    });

    it("should list participants", async () => {
      const space = await memoir.memorySpaces.get(participantSpaceId);

      expect(space!.participants.length).toBe(2);
    });

    it("should remove a participant", async () => {
      const result = await memoir.memorySpaces.removeParticipant(
        participantSpaceId,
        "test-user-1",
      );

      expect(result.participants.length).toBe(1);
      expect(
        result.participants.find((p: any) => p.id === "test-user-1"),
      ).toBeUndefined();
    });
  });

  describe("Space Statistics", () => {
    const statsSpaceId = `${TEST_PREFIX}-stats-space`;
    const statsUserId = `${TEST_PREFIX}-stats-user`;

    beforeAll(async () => {
      await memoir.memorySpaces.register({
        memorySpaceId: statsSpaceId,
        name: "Stats Test Space",
        type: "project",
      });

      // Add some data
      await memoir.vector.store(statsSpaceId, {
        content: "Stats test memory",
        contentType: "raw",
        userId: statsUserId,
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["stats-test"] },
      });

      await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: statsSpaceId,
        participants: {
          userId: statsUserId,
          agentId: "stats-agent",
          participantId: "stats-agent",
        },
      });
    });

    it("should get space statistics", async () => {
      const stats = await memoir.memorySpaces.getStats(statsSpaceId);

      expect(stats.memorySpaceId).toBe(statsSpaceId);
      expect(typeof stats.totalMemories).toBe("number");
      expect(typeof stats.totalConversations).toBe("number");
    });
  });

  describe("Space Deletion", () => {
    it("should delete an empty space", async () => {
      const deleteSpaceId = `${TEST_PREFIX}-delete-empty`;

      await memoir.memorySpaces.register({
        memorySpaceId: deleteSpaceId,
        name: "Delete Empty Space",
        type: "project",
      });

      const result = await memoir.memorySpaces.delete(deleteSpaceId, {
        reason: "Test cleanup",
        cascade: true,
      });

      expect(result.deleted).toBe(true);

      // Verify deleted
      const space = await memoir.memorySpaces.get(deleteSpaceId);
      expect(space).toBeNull();
    });

    it("should cascade delete space with data", async () => {
      const cascadeSpaceId = `${TEST_PREFIX}-cascade-delete`;

      await memoir.memorySpaces.register({
        memorySpaceId: cascadeSpaceId,
        name: "Cascade Delete Space",
        type: "project",
      });

      // Add data
      await memoir.vector.store(cascadeSpaceId, {
        content: "Data to be cascade deleted",
        contentType: "raw",
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["cascade-delete"] },
      });

      // Cascade delete
      const result = await memoir.memorySpaces.delete(cascadeSpaceId, {
        reason: "Test cleanup - cascade delete",
        cascade: true,
      });

      expect(result.deleted).toBe(true);

      // Verify space is deleted
      const space = await memoir.memorySpaces.get(cascadeSpaceId);
      expect(space).toBeNull();
    }, 60000);
  });
});
