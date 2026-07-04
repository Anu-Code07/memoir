/**
 * Manually verify data in both databases
 */

import { CypherGraphAdapter } from "../../src/graph";

async function verify() {
  console.log(
    "╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║          MANUAL DATA VERIFICATION                            ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n",
  );

  // Verify Neo4j
  console.log("🔷 Neo4j (bolt://localhost:7687):");
  const neo4j = new CypherGraphAdapter();
  await neo4j.connect({
    uri: "bolt://localhost:7687",
    username: "neo4j",
    password: "memoir-dev-password",
  });

  const neo4jNodes = await neo4j.countNodes();
  const neo4jEdges = await neo4j.countEdges();
  const neo4jMemories = await neo4j.countNodes("Memory");
  const neo4jConvs = await neo4j.countNodes("Conversation");
  const neo4jUsers = await neo4j.countNodes("User");

  console.log(`   Total Nodes: ${neo4jNodes}`);
  console.log(`   - Memory: ${neo4jMemories}`);
  console.log(`   - Conversation: ${neo4jConvs}`);
  console.log(`   - User: ${neo4jUsers}`);
  console.log(`   Total Relationships: ${neo4jEdges}`);

  if (neo4jNodes > 0) {
    console.log("   ✅ DATA EXISTS IN NEO4J");

    // Get sample memory
    const memories = await neo4j.findNodes("Memory", {}, 1);
    if (memories.length > 0) {
      console.log(
        `   Sample Memory: "${(memories[0].properties.content as string).substring(0, 50)}..."`,
      );
    }
  } else {
    console.log("   ❌ NEO4J IS EMPTY");
  }

  await neo4j.disconnect();

  // Verify Memgraph
  console.log("\n🔶 Memgraph (bolt://localhost:7688):");
  const memgraph = new CypherGraphAdapter();
  await memgraph.connect({
    uri: "bolt://localhost:7688",
    username: "memgraph",
    password: "memoir-dev-password",
  });

  const memgraphNodes = await memgraph.countNodes();
  const memgraphEdges = await memgraph.countEdges();
  const memgraphMemories = await memgraph.countNodes("Memory");
  const memgraphConvs = await memgraph.countNodes("Conversation");
  const memgraphUsers = await memgraph.countNodes("User");

  console.log(`   Total Nodes: ${memgraphNodes}`);
  console.log(`   - Memory: ${memgraphMemories}`);
  console.log(`   - Conversation: ${memgraphConvs}`);
  console.log(`   - User: ${memgraphUsers}`);
  console.log(`   Total Relationships: ${memgraphEdges}`);

  if (memgraphNodes > 0) {
    console.log("   ✅ DATA EXISTS IN MEMGRAPH");

    // Get sample memory
    const memories = await memgraph.findNodes("Memory", {}, 1);
    if (memories.length > 0) {
      console.log(
        `   Sample Memory: "${(memories[0].properties.content as string).substring(0, 50)}..."`,
      );
    }
  } else {
    console.log("   ❌ MEMGRAPH IS EMPTY");
  }

  await memgraph.disconnect();

  console.log(
    "\n╔═══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║                    VERIFICATION COMPLETE                     ║",
  );
  console.log(
    "╚═══════════════════════════════════════════════════════════════╝\n",
  );

  if (neo4jNodes > 0 && neo4jEdges > 0) {
    console.log("✅ Neo4j: Ready to view at http://localhost:7474");
    console.log("   Query: MATCH (n)-[r]->(m) RETURN n, r, m;");
  }

  if (memgraphNodes > 0 && memgraphEdges > 0) {
    console.log("✅ Memgraph: Ready to view at http://localhost:3001");
    console.log("   Query: MATCH (n)-[r]->(m) RETURN n, r, m;");
  }

  console.log("");
}

verify().catch(console.error);
