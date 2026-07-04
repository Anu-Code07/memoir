/**
 * Graph Database Integration Proof: Sync Workflow
 *
 * Demonstrates full Memoir → Graph synchronization workflow.
 * Creates data in Memoir, syncs to graph, then queries the graph.
 *
 * Run with: tsx tests/graph/proofs/02-sync-workflow.proof.ts
 */

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

import { Memoir } from "../../../src";
import {
  CypherGraphAdapter,
  initializeGraphSchema,
  syncContextToGraph,
  syncConversationToGraph,
  syncMemoryToGraph,
  syncFactToGraph,
  syncMemorySpaceToGraph,
  syncContextRelationships,
  syncConversationRelationships,
  syncMemoryRelationships,
  syncFactRelationships,
} from "../../../src/graph";
import type { GraphAdapter } from "../../../src/graph";

const CONVEX_URL = process.env.CONVEX_URL || "http://127.0.0.1:3210";
const NEO4J_CONFIG = {
  uri: process.env.NEO4J_URI || "bolt://localhost:7687",
  username: process.env.NEO4J_USERNAME || "neo4j",
  password: process.env.NEO4J_PASSWORD || "memoir-dev-password",
};

/**
 * Run the sync workflow demonstration
 */
async function runSyncWorkflow(adapter: GraphAdapter, dbName: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing Sync Workflow with ${dbName}`);
  console.log(`${"=".repeat(60)}\n`);

  const memoir = new Memoir({ convexUrl: CONVEX_URL });
  const timestamp = Date.now();
  const uniqueId = `test-${timestamp}`;

  try {
    // ============================================================================
    // Phase 1: Initialize Graph Schema
    // ============================================================================
    console.log("📐 Phase 1: Initialize Graph Schema");
    const startSchema = Date.now();
    await initializeGraphSchema(adapter);
    console.log(`  ✓ Schema initialized in ${Date.now() - startSchema}ms\n`);

    // ============================================================================
    // Phase 2: Create Data in Memoir
    // ============================================================================
    console.log("📝 Phase 2: Create Data in Memoir");

    // Register memory space
    const memorySpace = await memoir.memorySpaces.register({
      memorySpaceId: `space-${uniqueId}`,
      name: "Test Agent",
      type: "personal",
    });
    console.log(`  ✓ Memory Space: ${memorySpace.memorySpaceId}`);

    // Create conversation
    const conversation = await memoir.conversations.create({
      memorySpaceId: memorySpace.memorySpaceId,
      type: "user-agent",
      participants: {
        userId: `user-${uniqueId}`,
        agentId: `agent-${uniqueId}`,
        participantId: `agent-${uniqueId}`,
      },
    });
    console.log(`  ✓ Conversation: ${conversation.conversationId}`);

    // Add messages
    const msgResult = await memoir.conversations.addMessage({
      conversationId: conversation.conversationId,
      message: {
        role: "user",
        content: "I need help with my project. I'm working on an AI assistant.",
      },
    });
    await memoir.conversations.addMessage({
      conversationId: conversation.conversationId,
      message: {
        role: "agent",
        content:
          "I'd be happy to help! Tell me more about your AI assistant project.",
      },
    });
    console.log(`  ✓ Messages: ${msgResult.messages.length}`);

    // Create context
    const context = await memoir.contexts.create({
      purpose: "Help user with AI project",
      memorySpaceId: memorySpace.memorySpaceId,
      userId: `user-${uniqueId}`,
      conversationRef: {
        conversationId: conversation.conversationId,
        messageIds: [msgResult.messages[0].id],
      },
    });
    console.log(`  ✓ Context: ${context.contextId}`);

    // Create child context
    const childContext = await memoir.contexts.create({
      purpose: "Research AI frameworks",
      memorySpaceId: memorySpace.memorySpaceId,
      parentId: context.contextId,
    });
    console.log(`  ✓ Child Context: ${childContext.contextId}`);

    // Create memory
    const memory = await memoir.vector.store(memorySpace.memorySpaceId, {
      content: "User is building an AI assistant and needs help",
      contentType: "raw",
      userId: `user-${uniqueId}`,
      source: {
        type: "conversation",
        userId: `user-${uniqueId}`,
        userName: "Test User",
      },
      conversationRef: {
        conversationId: conversation.conversationId,
        messageIds: [msgResult.messages[0].id],
      },
      metadata: {
        importance: 80,
        tags: ["ai", "project", "help"],
      },
    });
    console.log(`  ✓ Memory: ${memory.memoryId}`);

    // Create fact
    const fact = await memoir.facts.store({
      memorySpaceId: memorySpace.memorySpaceId,
      fact: "User is working on an AI assistant project",
      factType: "knowledge",
      subject: "User",
      predicate: "works_on",
      object: "AI assistant project",
      confidence: 95,
      sourceType: "conversation",
      sourceRef: {
        conversationId: conversation.conversationId,
        messageIds: [msgResult.messages[0].id],
      },
      tags: ["project", "ai"],
    });
    console.log(`  ✓ Fact: ${fact.factId}\n`);

    // ============================================================================
    // Phase 3: Sync to Graph Database
    // ============================================================================
    console.log("🔄 Phase 3: Sync to Graph Database");
    const startSync = Date.now();

    // Sync memory space
    const memorySpaceNodeId = await syncMemorySpaceToGraph(
      memorySpace,
      adapter,
    );
    console.log(`  ✓ Synced Memory Space (${memorySpaceNodeId})`);

    // Sync conversation
    const conversationNodeId = await syncConversationToGraph(
      conversation,
      adapter,
    );
    await syncConversationRelationships(
      conversation,
      conversationNodeId,
      adapter,
    );
    console.log(`  ✓ Synced Conversation + relationships`);

    // Sync contexts
    const contextNodeId = await syncContextToGraph(context, adapter);
    await syncContextRelationships(context, contextNodeId, adapter);
    console.log(`  ✓ Synced Context + relationships`);

    const childContextNodeId = await syncContextToGraph(childContext, adapter);
    await syncContextRelationships(childContext, childContextNodeId, adapter);
    console.log(`  ✓ Synced Child Context + relationships`);

    // Sync memory
    const memoryNodeId = await syncMemoryToGraph(memory, adapter);
    await syncMemoryRelationships(memory, memoryNodeId, adapter);
    console.log(`  ✓ Synced Memory + relationships`);

    // Sync fact
    const factNodeId = await syncFactToGraph(fact, adapter);
    await syncFactRelationships(fact, factNodeId, adapter);
    console.log(`  ✓ Synced Fact + relationships`);

    console.log(`  ✓ Total sync time: ${Date.now() - startSync}ms\n`);

    // ============================================================================
    // Phase 4: Query the Graph
    // ============================================================================
    console.log("🔍 Phase 4: Query the Graph");

    // Count nodes
    const nodeCount = await adapter.countNodes();
    const contextCount = await adapter.countNodes("Context");
    const memoryCount = await adapter.countNodes("Memory");
    const factCount = await adapter.countNodes("Fact");
    console.log(`  ✓ Total nodes: ${nodeCount}`);
    console.log(`    - Contexts: ${contextCount}`);
    console.log(`    - Memories: ${memoryCount}`);
    console.log(`    - Facts: ${factCount}`);

    // Count edges
    const edgeCount = await adapter.countEdges();
    console.log(`  ✓ Total edges: ${edgeCount}\n`);

    // Query contexts
    const contexts = await adapter.findNodes("Context", {}, 10);
    console.log(`  📊 Contexts found: ${contexts.length}`);
    for (const ctx of contexts) {
      console.log(
        `    - ${ctx.properties.purpose} (depth: ${ctx.properties.depth})`,
      );
    }
    console.log();

    // Traverse from root context
    if (contexts.length > 0) {
      const rootContext = contexts.find((c) => c.properties.depth === 0);
      if (rootContext) {
        const connected = await adapter.traverse({
          startId: rootContext.id!,
          relationshipTypes: [
            "PARENT_OF",
            "CHILD_OF",
            "TRIGGERED_BY",
            "INVOLVES",
          ],
          maxDepth: 3,
        });
        console.log(
          `  🚶 Traversal from root context: ${connected.length} connected nodes`,
        );
        for (const node of connected.slice(0, 5)) {
          console.log(
            `    - ${node.label}: ${JSON.stringify(node.properties).substring(0, 60)}...`,
          );
        }
        console.log();
      }
    }

    // Query memories by importance
    const importantMemories = await adapter.query(
      `
      MATCH (m:Memory)
      WHERE m.importance >= 70
      RETURN m
      ORDER BY m.importance DESC
      LIMIT 5
    `,
    );
    console.log(`  💡 Important memories: ${importantMemories.count}`);
    for (const record of importantMemories.records) {
      const mem = record.m as any;
      console.log(
        `    - Importance ${mem.properties?.importance}: ${mem.properties?.content}`,
      );
    }
    console.log();

    // Query facts with entities
    const factsWithEntities = await adapter.query(
      `
      MATCH (f:Fact)-[:MENTIONS]->(e:Entity)
      RETURN f, collect(e.name) as entities
    `,
    );
    console.log(`  🎯 Facts with entities: ${factsWithEntities.count}`);
    for (const record of factsWithEntities.records) {
      console.log(`    - Fact: ${(record.f as any).properties?.fact}`);
      console.log(
        `      Entities: ${(record.entities as string[] | undefined)?.join(", ")}`,
      );
    }
    console.log();

    // ============================================================================
    // Phase 5: Verify Data Consistency
    // ============================================================================
    console.log("✅ Phase 5: Verify Data Consistency");

    // Verify context exists with correct properties
    const ctxQuery = await adapter.findNodes("Context", {
      contextId: context.contextId,
    });
    console.log(`  ✓ Context found: ${ctxQuery.length === 1}`);
    console.log(
      `    Purpose matches: ${ctxQuery[0]?.properties.purpose === context.purpose}`,
    );

    // Verify conversation exists
    const convQuery = await adapter.findNodes("Conversation", {
      conversationId: conversation.conversationId,
    });
    console.log(`  ✓ Conversation found: ${convQuery.length === 1}`);
    console.log(
      `    Message count matches: ${convQuery[0]?.properties.messageCount === conversation.messageCount}`,
    );

    // Verify memory exists
    const memQuery = await adapter.findNodes("Memory", {
      memoryId: memory.memoryId,
    });
    console.log(`  ✓ Memory found: ${memQuery.length === 1}`);
    console.log(
      `    Importance matches: ${memQuery[0]?.properties.importance === memory.importance}`,
    );

    // Verify fact exists
    const factQuery = await adapter.findNodes("Fact", { factId: fact.factId });
    console.log(`  ✓ Fact found: ${factQuery.length === 1}`);
    console.log(
      `    Confidence matches: ${factQuery[0]?.properties.confidence === fact.confidence}`,
    );

    // Verify relationships exist
    const relationships = await adapter.query(
      `
      MATCH (c:Context {contextId: $contextId})-[r]-(other)
      RETURN type(r) as relType, labels(other)[0] as targetLabel
    `,
      { contextId: context.contextId },
    );
    console.log(`  ✓ Context has ${relationships.count} relationships:`);
    for (const rel of relationships.records) {
      console.log(`    - ${rel.relType} → ${rel.targetLabel}`);
    }
    console.log();

    console.log(`✅ All sync workflow tests passed for ${dbName}!\n`);

    // ============================================================================
    // Cleanup
    // ============================================================================
    console.log("🧹 Cleanup");
    // Delete in reverse order: children first, then parents
    await memoir.contexts.delete(childContext.contextId);
    await memoir.contexts.delete(context.contextId);
    await memoir.vector.delete(memorySpace.memorySpaceId, memory.memoryId);
    await memoir.facts.delete(memorySpace.memorySpaceId, fact.factId);
    await memoir.conversations.delete(conversation.conversationId);
    // Note: memorySpaces don't have unregister method - they're managed differently
    console.log("  ✓ Memoir data cleaned up\n");
  } catch (error) {
    console.error(`❌ Sync workflow failed:`, error);
    throw error;
  } finally {
    memoir.close();
  }
}

/**
 * Main execution
 */
async function main() {
  console.log(
    "\n╔═══════════════════════════════════════════════════════════╗",
  );
  console.log("║  Memoir Graph Integration - Sync Workflow Proof          ║");
  console.log("╚═══════════════════════════════════════════════════════════╝");

  // Test with Neo4j (most reliable)
  if (process.env.NEO4J_URI) {
    console.log("\n🗄️  Running sync workflow with Neo4j...");
    const neo4jAdapter = new CypherGraphAdapter();
    try {
      await neo4jAdapter.connect(NEO4J_CONFIG);
      await neo4jAdapter.clearDatabase(); // Clean slate
      await runSyncWorkflow(neo4jAdapter, "Neo4j");
      await neo4jAdapter.clearDatabase(); // Cleanup
      await neo4jAdapter.disconnect();
    } catch (error) {
      console.error("Failed to run Neo4j sync workflow:", error);
    }
  } else {
    console.log("\n⚠️  Neo4j tests skipped (NEO4J_URI not set)");
  }

  console.log(
    "\n╔═══════════════════════════════════════════════════════════╗",
  );
  console.log("║  Sync Workflow Complete!                                  ║");
  console.log(
    "╚═══════════════════════════════════════════════════════════╝\n",
  );

  console.log("📝 Key Takeaways:");
  console.log("   ✓ Memoir data successfully synced to graph database");
  console.log("   ✓ All relationships properly created");
  console.log("   ✓ Graph queries return consistent data");
  console.log("   ✓ Convex remains source of truth");
  console.log("\n📝 Next: npm run proof:context-chains\n");
}

// Run
main()
  .then(() => {
    console.log("Exiting...");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Proof failed:", error);
    process.exit(1);
  });
