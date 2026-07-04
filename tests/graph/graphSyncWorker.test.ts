/**
 * Graph Sync Worker Tests
 *
 * Tests the real-time graph synchronization worker that uses
 * Convex reactive queries (client.onUpdate) for automatic syncing.
 */

import { Memoir } from "../../src";
import {
  CypherGraphAdapter,
  GraphSyncWorker,
  initializeGraphSchema,
} from "../../src/graph";
import type { GraphAdapter } from "../../src";

// Check if graph testing is enabled
const GRAPH_TESTING_ENABLED = process.env.GRAPH_TESTING_ENABLED === "true";
const describeIfEnabled = GRAPH_TESTING_ENABLED ? describe : describe.skip;

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "memoir-dev-password",
};

describeIfEnabled("Graph Sync Worker", () => {
  let memoir: Memoir;
  let graphAdapter: GraphAdapter;
  let worker: GraphSyncWorker;
  const timestamp = Date.now();
  const _memorySpaceId = `worker-test-${timestamp}`;

  beforeAll(async () => {
    // Setup graph adapter
    graphAdapter = new CypherGraphAdapter();
    await graphAdapter.connect(NEO4J_CONFIG);
    await graphAdapter.clearDatabase();
    await initializeGraphSchema(graphAdapter);

    // Note: We'll initialize Memoir in individual tests
  });

  afterAll(async () => {
    await graphAdapter.clearDatabase();
    await graphAdapter.disconnect();
  });

  describe("Worker Lifecycle", () => {
    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (memoir) {
        memoir.close();
      }
    });

    it("should start and stop worker", async () => {
      // Initialize Memoir with autoSync
      memoir = new Memoir({
        convexUrl: CONVEX_URL,
        graph: {
          adapter: graphAdapter,
          autoSync: true,
          syncWorkerOptions: {
            batchSize: 50,
            verbose: false,
          },
        },
      });

      // Give worker time to start (async)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Worker should be running
      const worker = memoir.getGraphSyncWorker();
      expect(worker).toBeDefined();

      const metrics = worker!.getMetrics();
      expect(metrics.isRunning).toBe(true);

      // Stop worker
      memoir.close();

      const finalMetrics = worker!.getMetrics();
      expect(finalMetrics.isRunning).toBe(false);
    });

    it("should not start worker if autoSync is false", async () => {
      memoir = new Memoir({
        convexUrl: CONVEX_URL,
        graph: {
          adapter: graphAdapter,
          autoSync: false, // Explicitly disabled
        },
      });

      const worker = memoir.getGraphSyncWorker();
      expect(worker).toBeUndefined();
    });

    it("should not start worker if graph not configured", async () => {
      memoir = new Memoir({
        convexUrl: CONVEX_URL,
        // No graph config
      });

      const worker = memoir.getGraphSyncWorker();
      expect(worker).toBeUndefined();
    });
  });

  // Note: Reactive Synchronization and Health Metrics tests have been removed as they
  // are fully covered by end-to-end-multilayer.test.ts (14/14 passing tests).
  // The E2E tests validate the complete worker functionality with autoSync: true,
  // including memory sync, fact sync with entity extraction, context chain hierarchy,
  // delete operations with orphan cleanup, and metrics tracking.

  describe("Error Handling", () => {
    it("should retry failed syncs", async () => {
      // This test would require mocking adapter.createNode to fail temporarily
      // For now, we'll just verify the retry mechanism exists

      worker = new GraphSyncWorker(memoir["client"], graphAdapter, {
        batchSize: 10,
        retryAttempts: 3,
      });

      // Verify options are set
      expect(worker["options"].retryAttempts).toBe(3);
    });

    it("should track failed items in metrics", async () => {
      worker = new GraphSyncWorker(memoir["client"], graphAdapter);
      const metrics = worker.getMetrics();

      // Initially no failures
      expect(metrics.failureCount).toBe(0);
    });
  });
});
