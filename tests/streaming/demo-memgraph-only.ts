/**
 * Memgraph-Only Demo - Creates data with relationships
 *
 * Run with: npx tsx tests/streaming/demo-memgraph-only.ts
 */

import { CypherGraphAdapter } from "../../src/graph";

async function main() {
  console.log("🔶 Creating demo data in Memgraph with relationships...\n");

  const adapter = new CypherGraphAdapter();
  await adapter.connect({
    uri: "bolt://localhost:7688",
    username: "memgraph",
    password: "memoir-dev-password",
  });

  console.log("✅ Connected to Memgraph\n");

  // Clear existing data
  await adapter.clearDatabase();
  console.log("🧹 Cleared database\n");

  // Create User node
  const userId = await adapter.createNode({
    label: "User",
    properties: {
      userId: "demo-user-1",
      name: "Demo User",
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created User node:", userId);

  // Create Conversation node
  const convId = await adapter.createNode({
    label: "Conversation",
    properties: {
      conversationId: "demo-conv-1",
      memorySpaceId: "demo-space",
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created Conversation node:", convId);

  // Create Memory nodes
  const memory1Id = await adapter.createNode({
    label: "Memory",
    properties: {
      memoryId: "mem-1",
      content: "Hello from Memgraph!",
      importance: 80,
      tags: ["demo", "streaming"],
      chunkCount: 3,
      streamCompleteTime: Date.now(),
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created Memory node 1:", memory1Id);

  const memory2Id = await adapter.createNode({
    label: "Memory",
    properties: {
      memoryId: "mem-2",
      content: "This demonstrates graph relationships",
      importance: 90,
      tags: ["demo", "relationships"],
      chunkCount: 5,
      streamCompleteTime: Date.now(),
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created Memory node 2:", memory2Id);

  // Create relationships (edges)
  const edge1 = await adapter.createEdge({
    from: memory1Id,
    to: convId,
    type: "PART_OF",
    properties: {
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created PART_OF relationship:", edge1);

  const edge2 = await adapter.createEdge({
    from: memory2Id,
    to: convId,
    type: "PART_OF",
    properties: {
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created PART_OF relationship:", edge2);

  const edge3 = await adapter.createEdge({
    from: convId,
    to: userId,
    type: "BELONGS_TO",
    properties: {
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created BELONGS_TO relationship:", edge3);

  const edge4 = await adapter.createEdge({
    from: memory1Id,
    to: memory2Id,
    type: "RELATED_TO",
    properties: {
      similarity: 0.85,
      createdAt: Date.now(),
    },
  });
  console.log("✅ Created RELATED_TO relationship:", edge4);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✨ Demo data created in Memgraph!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📊 Summary:");
  console.log("   Nodes: 4 (1 User, 1 Conversation, 2 Memory)");
  console.log("   Relationships: 4");
  console.log("     • 2 × PART_OF (Memory → Conversation)");
  console.log("     • 1 × BELONGS_TO (Conversation → User)");
  console.log("     • 1 × RELATED_TO (Memory → Memory)\n");

  console.log("🔶 View in Memgraph Lab: http://localhost:3001\n");
  console.log("Try these queries:\n");

  console.log("1. View everything (nodes + relationships):");
  console.log("   MATCH (n)-[r]->(m) RETURN n, r, m;\n");

  console.log("2. View Memory → Conversation connections:");
  console.log("   MATCH (mem:Memory)-[r:PART_OF]->(conv:Conversation)");
  console.log("   RETURN mem, r, conv;\n");

  console.log("3. View full path from Memory to User:");
  console.log("   MATCH path = (mem:Memory)-[*]->(u:User)");
  console.log("   RETURN path;\n");

  console.log("4. Count relationships:");
  console.log("   MATCH ()-[r]->()");
  console.log("   RETURN type(r) as type, COUNT(r) as count;\n");

  await adapter.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exit(1);
});
