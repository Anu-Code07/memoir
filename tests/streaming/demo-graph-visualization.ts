/**
 * Graph Visualization Demo
 *
 * This script creates streaming memories with progressive graph sync ENABLED
 * and LEAVES THE DATA in both Neo4j and Memgraph for you to explore in the UIs.
 *
 * Run with: npx tsx tests/streaming/demo-graph-visualization.ts
 *
 * Then open:
 * - Memgraph Lab: http://localhost:3001
 * - Neo4j Browser: http://localhost:7474
 */

import { Memoir } from "../../src";
import { CypherGraphAdapter } from "../../src/graph";

async function main() {
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   Graph Visualization Demo - Progressive Streaming           ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n",
  );

  // Initialize Memoir with graph adapters
  console.log("📊 Initializing Memoir with graph databases...\n");

  // Neo4j instance
  const neo4jAdapter = new CypherGraphAdapter();
  await neo4jAdapter.connect({
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "memoir-dev-password",
  });

  const memoirNeo4j = new Memoir({
    convexUrl: process.env.CONVEX_URL || "http://127.0.0.1:3210",
    graph: {
      adapter: neo4jAdapter,
    },
  });

  // Memgraph instance
  const memgraphAdapter = new CypherGraphAdapter();
  await memgraphAdapter.connect({
    uri: "bolt://localhost:7688",
    username: "memgraph",
    password: "memoir-dev-password",
  });

  const memoirMemgraph = new Memoir({
    convexUrl: process.env.CONVEX_URL || "http://127.0.0.1:3210",
    graph: {
      adapter: memgraphAdapter,
    },
  });

  console.log("✅ Connected to both graph databases\n");

  // Demo 1: Simple streaming with graph sync
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Demo 1: Simple Streaming with Graph Sync (Neo4j)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  async function* simpleStream() {
    yield "Hello ";
    yield "from ";
    yield "streaming ";
    yield "with ";
    yield "graph ";
    yield "sync!";
  }

  const result1 = await memoirNeo4j.memory.rememberStream(
    {
      memorySpaceId: "demo-neo4j-space",
      conversationId: `demo-neo4j-${Date.now()}`,
      userMessage: "Say hello with graph sync",
      responseStream: simpleStream(),
      userId: "demo-user-neo4j",
      userName: "Neo4j Demo User",
      importance: 80,
      tags: ["demo", "neo4j", "streaming"],
    },
    {
      progressiveGraphSync: true,
      graphSyncInterval: 500,
    },
  );

  console.log(`✅ Neo4j: Created ${result1.memories.length} memories`);
  console.log(`   Conversation: ${result1.conversation.conversationId}`);
  console.log(`   Response: "${result1.fullResponse}"`);
  console.log(
    `   Metrics: ${result1.streamMetrics.totalChunks} chunks in ${result1.streamMetrics.streamDurationMs}ms\n`,
  );

  // Demo 2: Streaming with Memgraph
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Demo 2: Streaming with Progressive Updates (Memgraph)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  let chunkCount = 0;
  async function* progressiveStream() {
    for (let i = 0; i < 8; i++) {
      yield `Chunk ${i}: This is a longer piece of content to demonstrate progressive streaming. `;
      await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate slow stream
    }
  }

  const result2 = await memoirMemgraph.memory.rememberStream(
    {
      memorySpaceId: "demo-memgraph-space",
      conversationId: `demo-memgraph-${Date.now()}`,
      userMessage: "Tell me about progressive streaming",
      responseStream: progressiveStream(),
      userId: "demo-user-memgraph",
      userName: "Memgraph Demo User",
      importance: 90,
      tags: ["demo", "memgraph", "progressive"],
    },
    {
      progressiveGraphSync: true,
      graphSyncInterval: 200, // Sync every 200ms
      hooks: {
        onChunk: (event) => {
          chunkCount++;
          console.log(
            `   📦 Chunk ${event.chunkNumber}: ${event.chunk.substring(0, 40)}...`,
          );
        },
      },
    },
  );

  console.log(`\n✅ Memgraph: Created ${result2.memories.length} memories`);
  console.log(`   Chunks processed: ${chunkCount}`);
  console.log(
    `   Graph sync events: ${result2.progressiveProcessing?.graphSyncEvents?.length || 0}\n`,
  );

  // Demo 3: Multiple conversations for relationship visualization
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Demo 3: Multiple Conversations (Both Databases)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Create multiple conversations in Neo4j
  for (let i = 0; i < 3; i++) {
    async function* multiStream() {
      yield `Response for conversation ${i + 1}`;
    }

    await memoirNeo4j.memory.rememberStream(
      {
        memorySpaceId: "demo-neo4j-space",
        conversationId: `demo-multi-${i}-${Date.now()}`,
        userMessage: `Question ${i + 1}`,
        responseStream: multiStream(),
        userId: "demo-user-neo4j",
        userName: "Neo4j Demo User",
        importance: 70 + i * 10,
        tags: ["demo", "multi", `conversation-${i}`],
      },
      {
        progressiveGraphSync: true,
      },
    );
    console.log(`   ✅ Neo4j conversation ${i + 1} created`);
  }

  // Create multiple conversations in Memgraph
  for (let i = 0; i < 3; i++) {
    async function* multiStream() {
      yield `Memgraph response ${i + 1}`;
    }

    await memoirMemgraph.memory.rememberStream(
      {
        memorySpaceId: "demo-memgraph-space",
        conversationId: `demo-memgraph-multi-${i}-${Date.now()}`,
        userMessage: `Memgraph question ${i + 1}`,
        responseStream: multiStream(),
        userId: "demo-user-memgraph",
        userName: "Memgraph Demo User",
        importance: 75 + i * 5,
        tags: ["demo", "memgraph", `conv-${i}`],
      },
      {
        progressiveGraphSync: true,
      },
    );
    console.log(`   ✅ Memgraph conversation ${i + 1} created`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("                    DATA CREATED!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📊 Open the Graph UIs to visualize:\n");

  console.log("🔷 Neo4j Browser: http://localhost:7474");
  console.log("   Login: neo4j / memoir-dev-password");
  console.log("   Try these queries:");
  console.log("   ");
  console.log("   // View all demo memories");
  console.log("   MATCH (n:Memory)");
  console.log("   WHERE 'demo' IN n.tags");
  console.log("   RETURN n");
  console.log("   LIMIT 20;");
  console.log("");
  console.log("   // View streaming metadata");
  console.log("   MATCH (n:Memory)");
  console.log("   WHERE n.streamCompleteTime IS NOT NULL");
  console.log(
    "   RETURN n.memoryId, n.chunkCount, n.estimatedTokens, n.importance",
  );
  console.log("   ORDER BY n.streamCompleteTime DESC;");
  console.log("");
  console.log("   // View memory space relationships");
  console.log("   MATCH (n:Memory)");
  console.log("   WHERE n.memorySpaceId STARTS WITH 'demo-neo4j'");
  console.log(
    "   RETURN n.memorySpaceId, COUNT(n) as memoryCount, AVG(n.importance) as avgImportance",
  );
  console.log("   GROUP BY n.memorySpaceId;\n");

  console.log("🔶 Memgraph Lab: http://localhost:3001");
  console.log("   (Auto-connects to Memgraph)");
  console.log("   Try these queries:");
  console.log("   ");
  console.log("   // View all demo memories");
  console.log("   MATCH (n:Memory)");
  console.log("   WHERE 'demo' IN n.tags");
  console.log("   RETURN n");
  console.log("   LIMIT 20;");
  console.log("");
  console.log("   // View progressive streaming data");
  console.log("   MATCH (n:Memory)");
  console.log("   WHERE n.memorySpaceId = 'demo-memgraph-space'");
  console.log("   RETURN n.memoryId, n.importance, n.tags, n.createdAt");
  console.log("   ORDER BY n.createdAt DESC;\n");

  console.log("💡 Tips:");
  console.log("   - Click on nodes to see all properties");
  console.log(
    "   - Look for 'isStreaming', 'streamCompleteTime', 'chunkCount' properties",
  );
  console.log("   - Data persists until you clear it manually");
  console.log("   - Run this script multiple times to add more data\n");

  console.log("🧹 To clear all demo data:");
  console.log(
    "   Neo4j: MATCH (n:Memory) WHERE 'demo' IN n.tags DETACH DELETE n;",
  );
  console.log(
    "   Memgraph: MATCH (n:Memory) WHERE 'demo' IN n.tags DETACH DELETE n;\n",
  );

  // Disconnect but don't clear
  await neo4jAdapter.disconnect();
  await memgraphAdapter.disconnect();

  console.log("✅ Demo complete! Data is ready to explore in the UIs.");
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Demo failed:", error);
  process.exit(1);
});
