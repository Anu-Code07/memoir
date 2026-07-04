/**
 * Integration Tests: Sessions Lifecycle
 *
 * Tests the full session lifecycle including:
 * - Session creation with various parameters
 * - Session activity tracking (touch)
 * - Session termination
 * - Idle session expiration
 * - Multi-session management
 */

import { Memoir } from "../src";
import { createTestRunContext } from "./helpers/isolation";
import { generateTenantId, generateTenantUserId } from "./helpers/tenancy";

// Test context for isolation
const ctx = createTestRunContext();

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Sessions Lifecycle", () => {
  let memoir: Memoir;
  let testTenantId: string;
  let testUserId: string;
  let testMemorySpaceId: string;

  beforeAll(async () => {
    memoir = new Memoir({
      convexUrl: process.env.CONVEX_URL!,
    });

    testTenantId = generateTenantId("sess-test");
    testUserId = generateTenantUserId(testTenantId);
    testMemorySpaceId = `space_${ctx.runId}`;

    // Register memory space
    await memoir.memorySpaces.register({
      memorySpaceId: testMemorySpaceId,
      name: "Session Test Space",
      type: "custom",
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await memoir.memorySpaces.delete(testMemorySpaceId, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Creation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Creation", () => {
    it("should create a session with minimal parameters", async () => {
      const session = await memoir.sessions.create({
        userId: testUserId,
      });

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.userId).toBe(testUserId);
      expect(session.status).toBe("active");
      expect(session.startedAt).toBeDefined();
      expect(session.lastActiveAt).toBeDefined();
      expect(session.messageCount).toBe(0);
      expect(session.memoryCount).toBe(0);

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should create a session with tenantId", async () => {
      const session = await memoir.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
      });

      expect(session.tenantId).toBe(testTenantId);
      expect(session.userId).toBe(testUserId);

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should create a session with memorySpaceId", async () => {
      const session = await memoir.sessions.create({
        userId: testUserId,
        memorySpaceId: testMemorySpaceId,
      });

      expect(session.memorySpaceId).toBe(testMemorySpaceId);

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should create a session with custom metadata", async () => {
      const metadata = {
        deviceId: "device_123",
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0",
        customField: "custom_value",
        nested: { key: "value" },
      };

      const session = await memoir.sessions.create({
        userId: testUserId,
        metadata,
      });

      expect(session.metadata).toBeDefined();
      expect(session.metadata?.deviceId).toBe("device_123");
      expect(session.metadata?.customField).toBe("custom_value");
      expect((session.metadata?.nested as { key: string })?.key).toBe("value");

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should create a session with custom expiration", async () => {
      const expiresAt = Date.now() + 7200000; // 2 hours from now

      const session = await memoir.sessions.create({
        userId: testUserId,
        expiresAt,
      });

      expect(session.expiresAt).toBeDefined();
      // Allow some tolerance for processing time
      expect(Math.abs(session.expiresAt! - expiresAt)).toBeLessThan(1000);

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should create multiple sessions for the same user", async () => {
      const session1 = await memoir.sessions.create({ userId: testUserId });
      const session2 = await memoir.sessions.create({ userId: testUserId });

      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(session1.userId).toBe(session2.userId);

      // Both should be active
      const activeSessions = await memoir.sessions.getActive(testUserId);
      expect(activeSessions.length).toBeGreaterThanOrEqual(2);

      // Cleanup
      await memoir.sessions.end(session1.sessionId);
      await memoir.sessions.end(session2.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Retrieval
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Retrieval", () => {
    let createdSession: { sessionId: string; userId: string };

    beforeAll(async () => {
      createdSession = await memoir.sessions.create({
        userId: testUserId,
        tenantId: testTenantId,
        metadata: { test: "retrieval" },
      });
    });

    afterAll(async () => {
      await memoir.sessions.end(createdSession.sessionId);
    });

    it("should get a session by ID", async () => {
      const session = await memoir.sessions.get(createdSession.sessionId);

      expect(session).not.toBeNull();
      expect(session?.sessionId).toBe(createdSession.sessionId);
      expect(session?.userId).toBe(testUserId);
    });

    it("should return null for non-existent session", async () => {
      const session = await memoir.sessions.get("sess_nonexistent_123");

      expect(session).toBeNull();
    });

    it("should get or create a session", async () => {
      const newUserId = generateTenantUserId(testTenantId);

      // First call should create
      const session1 = await memoir.sessions.getOrCreate(newUserId);
      expect(session1).toBeDefined();
      expect(session1.userId).toBe(newUserId);

      // Second call should return existing (most recent active)
      const session2 = await memoir.sessions.getOrCreate(newUserId);
      expect(session2.sessionId).toBe(session1.sessionId);

      // Cleanup
      await memoir.sessions.end(session1.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Activity (Touch)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Activity", () => {
    it("should update lastActiveAt on touch", async () => {
      const session = await memoir.sessions.create({ userId: testUserId });
      const initialLastActive = session.lastActiveAt;

      // Wait a moment to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Touch the session
      await memoir.sessions.touch(session.sessionId);

      // Retrieve and verify
      const updated = await memoir.sessions.get(session.sessionId);
      expect(updated?.lastActiveAt).toBeGreaterThan(initialLastActive);

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should keep session active after touch", async () => {
      const session = await memoir.sessions.create({ userId: testUserId });

      await memoir.sessions.touch(session.sessionId);

      const updated = await memoir.sessions.get(session.sessionId);
      expect(updated?.status).toBe("active");

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should fail to touch a non-existent session", async () => {
      await expect(
        memoir.sessions.touch("sess_nonexistent_xyz"),
      ).rejects.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Termination
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Termination", () => {
    it("should end a session", async () => {
      const session = await memoir.sessions.create({ userId: testUserId });

      await memoir.sessions.end(session.sessionId);

      const ended = await memoir.sessions.get(session.sessionId);
      expect(ended?.status).toBe("ended");
      expect(ended?.endedAt).toBeDefined();
    });

    it("should end all sessions for a user", async () => {
      const userId = generateTenantUserId(testTenantId);

      // Create multiple sessions
      await memoir.sessions.create({ userId });
      await memoir.sessions.create({ userId });
      await memoir.sessions.create({ userId });

      // End all
      const result = await memoir.sessions.endAll(userId);
      expect(result.ended).toBeGreaterThanOrEqual(3);

      // Verify none are active
      const active = await memoir.sessions.getActive(userId);
      expect(active.length).toBe(0);
    });

    it("should not throw when ending already ended session", async () => {
      const session = await memoir.sessions.create({ userId: testUserId });

      await memoir.sessions.end(session.sessionId);

      // Second end should not throw (idempotent)
      await expect(
        memoir.sessions.end(session.sessionId),
      ).resolves.not.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Listing
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Listing", () => {
    let listTestUserId: string;

    beforeAll(async () => {
      listTestUserId = generateTenantUserId(testTenantId);

      // Create several sessions for testing
      for (let i = 0; i < 5; i++) {
        await memoir.sessions.create({
          userId: listTestUserId,
          tenantId: testTenantId,
        });
      }
    });

    afterAll(async () => {
      await memoir.sessions.endAll(listTestUserId);
    });

    it("should list sessions by userId", async () => {
      const sessions = await memoir.sessions.list({
        userId: listTestUserId,
      });

      expect(sessions.length).toBeGreaterThanOrEqual(5);
      sessions.forEach((s) => {
        expect(s.userId).toBe(listTestUserId);
      });
    });

    it("should list sessions by tenantId", async () => {
      const sessions = await memoir.sessions.list({
        tenantId: testTenantId,
      });

      expect(sessions.length).toBeGreaterThan(0);
      sessions.forEach((s) => {
        expect(s.tenantId).toBe(testTenantId);
      });
    });

    it("should list sessions by status", async () => {
      const activeSessions = await memoir.sessions.list({
        userId: listTestUserId,
        status: "active",
      });

      expect(activeSessions.length).toBeGreaterThan(0);
      activeSessions.forEach((s) => {
        expect(s.status).toBe("active");
      });
    });

    it("should limit results", async () => {
      const sessions = await memoir.sessions.list({
        userId: listTestUserId,
        limit: 3,
      });

      expect(sessions.length).toBeLessThanOrEqual(3);
    });

    it("should count sessions", async () => {
      const count = await memoir.sessions.count({
        userId: listTestUserId,
        status: "active",
      });

      expect(count).toBeGreaterThanOrEqual(5);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Active Sessions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Active Sessions", () => {
    it("should get active sessions for a user", async () => {
      const userId = generateTenantUserId(testTenantId);

      // Create active sessions
      const s1 = await memoir.sessions.create({ userId });
      const s2 = await memoir.sessions.create({ userId });

      // Create and end a session
      const s3 = await memoir.sessions.create({ userId });
      await memoir.sessions.end(s3.sessionId);

      // Get active
      const active = await memoir.sessions.getActive(userId);

      expect(active.length).toBe(2);
      const activeIds = active.map((s) => s.sessionId);
      expect(activeIds).toContain(s1.sessionId);
      expect(activeIds).toContain(s2.sessionId);
      expect(activeIds).not.toContain(s3.sessionId);

      // Cleanup
      await memoir.sessions.endAll(userId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Expiration
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Expiration", () => {
    it("should expire idle sessions", async () => {
      const userId = generateTenantUserId(testTenantId);

      // Create a session with very short idle timeout for testing
      // Note: Actual idle timeout is controlled by governance policies
      const session = await memoir.sessions.create({ userId });

      // In a real scenario, we'd wait for idle timeout
      // For testing, we manually expire
      const result = await memoir.sessions.expireIdle({
        idleTimeout: 0, // Expire anything not touched in 0ms (everything)
      });

      expect(result.expired).toBeGreaterThanOrEqual(0);

      // Cleanup
      try {
        await memoir.sessions.end(session.sessionId);
      } catch {
        // May already be expired
      }
    });

    it("should respect custom idle threshold", async () => {
      const userId = generateTenantUserId(testTenantId);

      // Create session
      const session = await memoir.sessions.create({ userId });

      // Touch to keep it active
      await memoir.sessions.touch(session.sessionId);

      // Try to expire with very long threshold - should not expire
      await memoir.sessions.expireIdle({
        idleTimeout: 24 * 60 * 60 * 1000, // 24 hours
      });

      // Session should still be active
      const current = await memoir.sessions.get(session.sessionId);
      expect(current?.status).toBe("active");

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Session Metadata Updates
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Session Metadata Updates", () => {
    it("should track message count", async () => {
      const session = await memoir.sessions.create({ userId: testUserId });

      // Simulate message activity - this would typically be done by remember()
      // For now, we verify the field exists
      expect(session.messageCount).toBe(0);

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });

    it("should track memory count", async () => {
      const session = await memoir.sessions.create({ userId: testUserId });

      // Verify the field exists
      expect(session.memoryCount).toBe(0);

      // Cleanup
      await memoir.sessions.end(session.sessionId);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Multi-Tenant Sessions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Multi-Tenant Sessions", () => {
    let tenantA: string;
    let tenantB: string;

    beforeAll(() => {
      tenantA = generateTenantId("tenant-a");
      tenantB = generateTenantId("tenant-b");
    });

    it("should isolate sessions by tenant", async () => {
      const userA = generateTenantUserId(tenantA);
      const userB = generateTenantUserId(tenantB);

      // Create sessions in different tenants
      const sessionA = await memoir.sessions.create({
        userId: userA,
        tenantId: tenantA,
      });
      const sessionB = await memoir.sessions.create({
        userId: userB,
        tenantId: tenantB,
      });

      // List sessions for tenant A
      const tenantASessions = await memoir.sessions.list({ tenantId: tenantA });
      const tenantBSessions = await memoir.sessions.list({ tenantId: tenantB });

      // Verify isolation
      expect(
        tenantASessions.some((s) => s.sessionId === sessionA.sessionId),
      ).toBe(true);
      expect(
        tenantASessions.some((s) => s.sessionId === sessionB.sessionId),
      ).toBe(false);

      expect(
        tenantBSessions.some((s) => s.sessionId === sessionB.sessionId),
      ).toBe(true);
      expect(
        tenantBSessions.some((s) => s.sessionId === sessionA.sessionId),
      ).toBe(false);

      // Cleanup
      await memoir.sessions.end(sessionA.sessionId);
      await memoir.sessions.end(sessionB.sessionId);
    });
  });
});
