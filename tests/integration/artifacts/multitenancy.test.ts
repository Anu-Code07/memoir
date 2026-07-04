/**
 * Artifacts API - Multi-tenancy Integration Tests
 *
 * Tests tenant isolation for artifacts:
 * - Artifact isolation between tenants
 * - Cross-tenant access prevention
 * - Global artifacts (no tenant) behavior
 * - List isolation by tenant
 *
 * PARALLEL-SAFE: Uses TestRunContext for isolated test data
 *
 * Test IDs: INT-MT-001, INT-MT-002
 */

import { Memoir } from "../../../src";
import { createNamedTestRunContext } from "../../helpers/isolation";
import {
  generateTenantId,
  generateTenantUserId,
  generateTenantMemorySpaceId,
  createTenantAuthContext,
  TenantTestContext,
} from "../../helpers/tenancy";

// Skip tests if no Convex URL configured
const describeWithConvex = process.env.CONVEX_URL ? describe : describe.skip;

describeWithConvex("Artifacts Multi-tenancy Integration", () => {
  // Create unique test run context for parallel-safe execution
  const ctx = createNamedTestRunContext("artifacts-multitenancy");
  const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";

  // Tenant contexts
  let tenantA: TenantTestContext;
  let tenantB: TenantTestContext;
  let globalMemoir: Memoir; // No tenant context

  // Track created spaces for cleanup
  const createdSpaces: Array<{ spaceId: string; memoir: Memoir }> = [];

  // Helper to setup tenant test context
  const setupTenantContext = async (name: string): Promise<TenantTestContext> => {
    const tenantId = generateTenantId(`${ctx.runId}-${name}`);
    const userId = generateTenantUserId(tenantId);
    const memorySpaceId = generateTenantMemorySpaceId(tenantId);
    const authContext = createTenantAuthContext(tenantId, userId);

    const memoir = new Memoir({
      convexUrl: CONVEX_URL,
      auth: authContext,
    });

    // Register memory space for this tenant
    await memoir.memorySpaces.register({
      memorySpaceId,
      name: `${name} Test Space`,
      type: "project",
    });

    createdSpaces.push({ spaceId: memorySpaceId, memoir });

    return {
      tenantId,
      userId,
      memorySpaceId,
      memoir,
      authContext,
    };
  };

  beforeAll(async () => {
    console.log(`\n🧪 Artifacts Multi-tenancy Integration Tests - Run ID: ${ctx.runId}\n`);

    // Setup two separate tenant contexts
    tenantA = await setupTenantContext("tenant-a");
    tenantB = await setupTenantContext("tenant-b");

    // Setup global context (no tenant)
    globalMemoir = new Memoir({ convexUrl: CONVEX_URL });

    console.log(`   Tenant A: ${tenantA.tenantId}`);
    console.log(`   Tenant B: ${tenantB.tenantId}`);
    console.log("✅ Multi-tenant test isolation setup complete\n");
  });

  afterAll(async () => {
    console.log(`\n🧹 Cleaning up test run ${ctx.runId}...`);

    // Cleanup all memory spaces
    for (const { spaceId, memoir } of createdSpaces) {
      try {
        await memoir.memorySpaces.delete(spaceId, {
          cascade: true,
          reason: "Test cleanup",
        });
      } catch {
        // Ignore cleanup errors
      }
    }

    // Close all clients
    tenantA.memoir.close();
    tenantB.memoir.close();
    globalMemoir.close();

    console.log(`✅ Test run ${ctx.runId} cleanup complete\n`);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-MT-001: Tenant Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-MT-001: Tenant isolation", () => {
    it("should prevent Tenant B from accessing Tenant A artifacts", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Tenant A secret data - should not be visible to Tenant B",
        title: "Confidential Document",
      });

      expect(artifact.artifactId).toBeDefined();

      // Tenant B cannot get it
      const result = await tenantB.memoir.artifacts.get(artifact.artifactId);
      expect(result).toBeNull();
    });

    it("should prevent Tenant B from updating Tenant A artifacts", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Original content",
        title: "Update Prevention Test",
      });

      // Tenant B cannot update it
      await expect(
        tenantB.memoir.artifacts.update(artifact.artifactId, "Hacked content!"),
      ).rejects.toThrow();

      // Verify content is unchanged
      const original = await tenantA.memoir.artifacts.get(artifact.artifactId);
      expect(original?.content).toBe("Original content");
    });

    it("should prevent Tenant B from deleting Tenant A artifacts", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Important document",
        title: "Delete Prevention Test",
      });

      // Tenant B cannot delete it
      await expect(tenantB.memoir.artifacts.delete(artifact.artifactId)).rejects.toThrow();

      // Verify artifact still exists for Tenant A
      const stillExists = await tenantA.memoir.artifacts.get(artifact.artifactId);
      expect(stillExists).not.toBeNull();
      expect(stillExists?.content).toBe("Important document");
    });

    it("should isolate list results by tenant", async () => {
      // Use unique marker to identify test artifacts
      const testMarker = `list-isolation-${ctx.runId}`;
      
      // Both tenants create artifacts in their own spaces
      const _artA1 = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: `Tenant A artifact 1 - ${testMarker}`,
        title: "Tenant A Artifact 1",
      });

      const _artA2 = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: `Tenant A artifact 2 - ${testMarker}`,
        title: "Tenant A Artifact 2",
      });

      const _artB1 = await tenantB.memoir.artifacts.create({
        memorySpaceId: tenantB.memorySpaceId,
        kind: "text",
        content: `Tenant B artifact 1 - ${testMarker}`,
        title: "Tenant B Artifact 1",
      });

      // Tenant A only sees their own (filter by test marker to avoid stale data)
      const listA = await tenantA.memoir.artifacts.list({
        memorySpaceId: tenantA.memorySpaceId,
      });

      // Check that we can find our test artifacts
      const testArtifactsA = listA.filter((a) => a.content?.includes(testMarker));
      expect(testArtifactsA.length).toBe(2);
      expect(testArtifactsA.every((a) => a.content?.includes("Tenant A"))).toBe(true);
      
      // Among test artifacts, ensure no Tenant B artifacts appear
      expect(testArtifactsA.some((a) => a.content?.includes("Tenant B"))).toBe(false);

      // Tenant B only sees their own
      const listB = await tenantB.memoir.artifacts.list({
        memorySpaceId: tenantB.memorySpaceId,
      });

      // Check that we can find our test artifact
      const testArtifactsB = listB.filter((a) => a.content?.includes(testMarker));
      expect(testArtifactsB.length).toBe(1);
      expect(testArtifactsB.every((a) => a.content?.includes("Tenant B"))).toBe(true);
      
      // Among test artifacts, ensure no Tenant A artifacts appear
      expect(testArtifactsB.some((a) => a.content?.includes("Tenant A"))).toBe(false);
    });

    it("should isolate count by tenant", async () => {
      // Create specific artifacts for counting
      const spaceIdA = `${ctx.runId}-count-space-a`;
      const spaceIdB = `${ctx.runId}-count-space-b`;

      await tenantA.memoir.memorySpaces.register({
        memorySpaceId: spaceIdA,
        name: "Count Test A",
        type: "project",
      });
      createdSpaces.push({ spaceId: spaceIdA, memoir: tenantA.memoir });

      await tenantB.memoir.memorySpaces.register({
        memorySpaceId: spaceIdB,
        name: "Count Test B",
        type: "project",
      });
      createdSpaces.push({ spaceId: spaceIdB, memoir: tenantB.memoir });

      // Create 3 artifacts for A, 1 for B
      for (let i = 0; i < 3; i++) {
        await tenantA.memoir.artifacts.create({
          memorySpaceId: spaceIdA,
          kind: "text",
          content: `A count test ${i}`,
          title: `Count Test A-${i}`,
        });
      }

      await tenantB.memoir.artifacts.create({
        memorySpaceId: spaceIdB,
        kind: "text",
        content: "B count test",
        title: "Count Test B",
      });

      const countA = await tenantA.memoir.artifacts.count({ memorySpaceId: spaceIdA });
      const countB = await tenantB.memoir.artifacts.count({ memorySpaceId: spaceIdB });

      expect(countA).toBe(3);
      expect(countB).toBe(1);
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // INT-MT-002: Global Artifacts (No Tenant) Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("INT-MT-002: Global artifacts isolation", () => {
    let globalSpaceId: string;

    beforeAll(async () => {
      // Register a global memory space (no tenant)
      globalSpaceId = `${ctx.runId}-global-space`;
      await globalMemoir.memorySpaces.register({
        memorySpaceId: globalSpaceId,
        name: "Global Test Space",
        type: "project",
      });
      createdSpaces.push({ spaceId: globalSpaceId, memoir: globalMemoir });
    });

    it("should create global artifacts without tenant context", async () => {
      const artifact = await globalMemoir.artifacts.create({
        memorySpaceId: globalSpaceId,
        kind: "text",
        content: "Global content - no tenant",
        title: "Global Artifact Test",
      });

      expect(artifact.artifactId).toBeDefined();

      // Should be accessible without tenant
      const retrieved = await globalMemoir.artifacts.get(artifact.artifactId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.content).toBe("Global content - no tenant");
    });

    it("should isolate global artifacts from tenant artifacts", async () => {
      // Create global artifact
      const globalArtifact = await globalMemoir.artifacts.create({
        memorySpaceId: globalSpaceId,
        kind: "text",
        content: "Global artifact content",
        title: "Global Isolation Test",
      });

      // Accessible without tenant
      const result = await globalMemoir.artifacts.get(globalArtifact.artifactId);
      expect(result).not.toBeNull();
      expect(result?.content).toBe("Global artifact content");

      // NOT accessible when querying with tenantId
      // Tenant A should not see global artifacts
      const tenantAResult = await tenantA.memoir.artifacts.get(globalArtifact.artifactId);
      expect(tenantAResult).toBeNull();

      // Tenant B should not see global artifacts
      const tenantBResult = await tenantB.memoir.artifacts.get(globalArtifact.artifactId);
      expect(tenantBResult).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Streaming Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Streaming operations tenant isolation", () => {
    it("should prevent Tenant B from streaming to Tenant A artifact", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "",
        title: "Streaming Isolation Test",
        streamingState: "draft",
      });

      // Tenant A starts streaming
      const { sessionId } = await tenantA.memoir.artifacts.startStreaming({
        artifactId: artifact.artifactId,
      });

      // Tenant B cannot append to it (even with session ID)
      await expect(
        tenantB.memoir.artifacts.appendContent({
          artifactId: artifact.artifactId,
          sessionId,
          chunk: "Malicious content",
        }),
      ).rejects.toThrow();

      // Tenant B cannot finalize it
      await expect(
        tenantB.memoir.artifacts.finalizeStreaming({
          artifactId: artifact.artifactId,
          sessionId,
        }),
      ).rejects.toThrow();

      // Cleanup - Tenant A finalizes
      await tenantA.memoir.artifacts.cancelStreaming({
        artifactId: artifact.artifactId,
        sessionId,
      });
    });

    it("should prevent Tenant B from starting streaming on Tenant A artifact", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "",
        title: "Start Streaming Prevention Test",
        streamingState: "draft",
      });

      // Tenant B cannot start streaming
      await expect(
        tenantB.memoir.artifacts.startStreaming({
          artifactId: artifact.artifactId,
        }),
      ).rejects.toThrow();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Version History Isolation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Version history tenant isolation", () => {
    it("should prevent Tenant B from viewing Tenant A version history", async () => {
      // Tenant A creates and updates artifact
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "v1 - secret",
        title: "History Isolation Test",
      });

      await tenantA.memoir.artifacts.update(artifact.artifactId, "v2 - also secret");

      // Tenant A can see history
      const historyA = await tenantA.memoir.artifacts.getHistory(artifact.artifactId);
      expect(historyA.length).toBe(2);

      // Tenant B gets empty history (artifact not accessible to them)
      // This behavior prevents tenant B from learning whether the artifact exists
      const historyB = await tenantB.memoir.artifacts.getHistory(artifact.artifactId);
      expect(historyB).toEqual([]);
    });

    it("should prevent Tenant B from undo/redo on Tenant A artifacts", async () => {
      // Tenant A creates and updates
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "v1",
        title: "Undo Redo Isolation Test",
      });

      await tenantA.memoir.artifacts.update(artifact.artifactId, "v2");

      // Tenant B cannot undo
      await expect(tenantB.memoir.artifacts.undo(artifact.artifactId)).rejects.toThrow();

      // Tenant A can undo
      await tenantA.memoir.artifacts.undo(artifact.artifactId);

      // Tenant B cannot redo
      await expect(tenantB.memoir.artifacts.redo(artifact.artifactId)).rejects.toThrow();
    });

    it("should prevent Tenant B from getting specific version of Tenant A artifact", async () => {
      // Tenant A creates artifact
      const artifact = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "Secret version 1",
        title: "Version Isolation Test",
      });

      // Tenant A can get version
      const v1A = await tenantA.memoir.artifacts.getVersion(artifact.artifactId, 1);
      expect(v1A?.content).toBe("Secret version 1");

      // Tenant B cannot get version
      const v1B = await tenantB.memoir.artifacts.getVersion(artifact.artifactId, 1);
      expect(v1B).toBeNull();
    });
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Concurrent Multi-Tenant Operations
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  describe("Concurrent multi-tenant operations", () => {
    it("should handle concurrent artifact creation from multiple tenants", async () => {
      // Both tenants create artifacts simultaneously
      const [artifactA, artifactB] = await Promise.all([
        tenantA.memoir.artifacts.create({
          memorySpaceId: tenantA.memorySpaceId,
          kind: "text",
          content: "Concurrent A",
          title: "Concurrent A Test",
        }),
        tenantB.memoir.artifacts.create({
          memorySpaceId: tenantB.memorySpaceId,
          kind: "text",
          content: "Concurrent B",
          title: "Concurrent B Test",
        }),
      ]);

      expect(artifactA.artifactId).not.toBe(artifactB.artifactId);

      // Each tenant can only see their own
      const resultA = await tenantA.memoir.artifacts.get(artifactA.artifactId);
      expect(resultA?.content).toBe("Concurrent A");

      const resultB = await tenantB.memoir.artifacts.get(artifactB.artifactId);
      expect(resultB?.content).toBe("Concurrent B");

      // Cross-access fails
      const crossA = await tenantA.memoir.artifacts.get(artifactB.artifactId);
      expect(crossA).toBeNull();

      const crossB = await tenantB.memoir.artifacts.get(artifactA.artifactId);
      expect(crossB).toBeNull();
    });

    it("should handle concurrent updates from multiple tenants on their own artifacts", async () => {
      // Each tenant creates their artifact
      const artifactA = await tenantA.memoir.artifacts.create({
        memorySpaceId: tenantA.memorySpaceId,
        kind: "text",
        content: "A initial",
        title: "Concurrent Update A",
      });

      const artifactB = await tenantB.memoir.artifacts.create({
        memorySpaceId: tenantB.memorySpaceId,
        kind: "text",
        content: "B initial",
        title: "Concurrent Update B",
      });

      // Concurrent updates
      await Promise.all([
        tenantA.memoir.artifacts.update(artifactA.artifactId, "A updated"),
        tenantB.memoir.artifacts.update(artifactB.artifactId, "B updated"),
      ]);

      // Verify both updates succeeded
      const finalA = await tenantA.memoir.artifacts.get(artifactA.artifactId);
      expect(finalA?.content).toBe("A updated");

      const finalB = await tenantB.memoir.artifacts.get(artifactB.artifactId);
      expect(finalB?.content).toBe("B updated");
    });
  });
});
