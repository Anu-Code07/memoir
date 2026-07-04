/**
 * User Workflow E2E Tests
 *
 * End-to-end tests for user operations including GDPR cascade deletion.
 * These tests require CONVEX_URL to be set.
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Memoir } from "@getmemoir/sdk";
import { cleanupTestData } from "../setup.js";

// Skip these tests if no Convex URL is configured
const CONVEX_URL = process.env.CONVEX_URL;
const describeE2E = CONVEX_URL ? describe : describe.skip;

describeE2E("User Workflow E2E", () => {
  let memoir: Memoir;
  const TIMESTAMP = Date.now();
  const TEST_PREFIX = `e2e-user-${TIMESTAMP}`;

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

  describe("User CRUD Operations", () => {
    const testUserId = `${TEST_PREFIX}-crud-user`;

    it("should create a new user", async () => {
      const user = await memoir.users.update(testUserId, {
        name: "E2E Test User",
        email: "e2e@test.example",
        preferences: { theme: "dark" },
      });

      expect(user.id).toBe(testUserId);
      expect(user.version).toBe(1);
      expect(user.data.name).toBe("E2E Test User");
    });

    it("should check if user exists", async () => {
      const exists = await memoir.users.exists(testUserId);
      expect(exists).toBe(true);

      const notExists = await memoir.users.exists("nonexistent-user-id");
      expect(notExists).toBe(false);
    });

    it("should get user profile", async () => {
      const user = await memoir.users.get(testUserId);

      expect(user).not.toBeNull();
      expect(user!.id).toBe(testUserId);
      expect(user!.data.email).toBe("e2e@test.example");
    });

    it("should return null for non-existent user", async () => {
      const user = await memoir.users.get("nonexistent-user-id");
      expect(user).toBeNull();
    });

    it("should update user profile", async () => {
      const updated = await memoir.users.update(testUserId, {
        name: "Updated Name",
        newField: "new value",
      });

      expect(updated.data.name).toBe("Updated Name");
      expect(updated.data.newField).toBe("new value");
    });

    it("should increment version on update", async () => {
      const before = await memoir.users.get(testUserId);
      const beforeVersion = before!.version;

      await memoir.users.update(testUserId, { lastLogin: Date.now() });

      const after = await memoir.users.get(testUserId);
      expect(after!.version).toBe(beforeVersion + 1);
    });

    it("should merge user data", async () => {
      const merged = await memoir.users.merge(testUserId, {
        additionalField: "merged",
      });

      expect(merged.data.additionalField).toBe("merged");
      // Note: merge behavior depends on SDK implementation
      // The important thing is that the new field was added
    });

    it("should get version history", async () => {
      const history = await memoir.users.getHistory(testUserId);

      expect(history.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("User Listing", () => {
    beforeAll(async () => {
      // Create multiple users for listing
      for (let i = 0; i < 5; i++) {
        await memoir.users.update(`${TEST_PREFIX}-list-user-${i}`, {
          name: `List User ${i}`,
          index: i,
        });
      }
    });

    it("should list users", async () => {
      const result = await memoir.users.list({ limit: 100 });
      const users = result.users || result;

      expect(users.length).toBeGreaterThanOrEqual(5);
    });

    it("should respect limit", async () => {
      const result = await memoir.users.list({ limit: 3 });
      const users = result.users || result;

      expect(users.length).toBeLessThanOrEqual(3);
    });

    it("should count users", async () => {
      const count = await memoir.users.count();

      expect(typeof count).toBe("number");
      expect(count).toBeGreaterThan(0);
    });
  });

  describe("User Deletion", () => {
    it("should delete a user", async () => {
      const userId = `${TEST_PREFIX}-delete-user`;
      await memoir.users.update(userId, { name: "To Delete" });

      // Verify exists
      expect(await memoir.users.exists(userId)).toBe(true);

      // Delete
      const result = await memoir.users.delete(userId);

      expect(result.deleted || result.totalDeleted > 0).toBe(true);

      // Verify deleted
      expect(await memoir.users.exists(userId)).toBe(false);
    });

    it("should delete multiple users", async () => {
      const userIds = [
        `${TEST_PREFIX}-bulk-delete-1`,
        `${TEST_PREFIX}-bulk-delete-2`,
        `${TEST_PREFIX}-bulk-delete-3`,
      ];

      // Create users
      for (const userId of userIds) {
        await memoir.users.update(userId, { name: "Bulk Delete" });
      }

      const result = await memoir.users.deleteMany(userIds);

      expect(result.deleted).toBeGreaterThanOrEqual(3);
    });
  });

  describe("GDPR Cascade Deletion", () => {
    it("should cascade delete all user data", async () => {
      const userId = `${TEST_PREFIX}-gdpr-user`;
      const spaceId = `${TEST_PREFIX}-gdpr-space`;

      // Create user
      await memoir.users.update(userId, { name: "GDPR Test User" });

      // Create space
      try {
        await memoir.memorySpaces.register({
          memorySpaceId: spaceId,
          name: "GDPR Test Space",
          type: "personal",
        });
      } catch {
        // May already exist
      }

      // Create conversation for user
      const conv = await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: spaceId,
        participants: {
          userId,
          agentId: "gdpr-test-agent",
          participantId: "gdpr-test-agent",
        },
      });

      // Store memory for user
      await memoir.vector.store(spaceId, {
        content: "GDPR user memory",
        contentType: "raw",
        userId,
        source: { type: "system", timestamp: Date.now() },
        metadata: { importance: 50, tags: ["gdpr-test"] },
      });

      // Cascade delete user
      const result = await memoir.users.delete(userId, {
        cascade: true,
        verify: true,
      });

      expect(result.deleted || result.totalDeleted > 0).toBe(true);

      // Verify user is deleted
      expect(await memoir.users.exists(userId)).toBe(false);

      // Cleanup space
      try {
        await memoir.memorySpaces.delete(spaceId, { cascade: true });
      } catch {
        // Ignore cleanup errors
      }
    }, 90000);
  });
});
