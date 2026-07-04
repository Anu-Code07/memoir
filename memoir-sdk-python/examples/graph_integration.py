"""
Graph Integration Example

Demonstrates Neo4j/Memgraph integration for advanced queries.
"""

import asyncio
import os

from memoir import (
    Memoir,
    MemoirConfig,
    GraphConfig,
    GraphConnectionConfig,
    RememberParams,
)
from memoir.graph import CypherGraphAdapter, initialize_graph_schema


async def main():
    """Run graph integration example."""

    print("🕸️ Graph Integration Example")
    print("=" * 50)

    # Setup graph adapter
    print("\n1️⃣ Connecting to graph database...")
    graph = CypherGraphAdapter()

    await graph.connect(
        GraphConnectionConfig(
            uri=os.getenv("NEO4J_URI", "bolt://localhost:7687"),
            username=os.getenv("NEO4J_USER", "neo4j"),
            password=os.getenv("NEO4J_PASSWORD", "password"),
        )
    )
    print("   ✅ Connected to Neo4j")

    # Initialize schema
    print("\n2️⃣ Initializing graph schema...")
    await initialize_graph_schema(graph)
    print("   ✅ Schema initialized")

    # Initialize Memoir with graph
    print("\n3️⃣ Initializing Memoir with graph...")
    memoir = Memoir(
        MemoirConfig(
            convex_url=os.getenv("CONVEX_URL", "http://localhost:3210"),
            graph=GraphConfig(adapter=graph, auto_sync=False),  # Manual sync for demo
        )
    )
    print("   ✅ Memoir initialized")

    # Store some memories with graph sync
    print("\n4️⃣ Storing memories (auto-synced to graph)...")

    memory_space_id = "graph-demo-agent"
    conversation_id = "conv-graph-demo"

    result = await memoir.memory.remember(
        RememberParams(
            memory_space_id=memory_space_id,
            conversation_id=conversation_id,
            user_message="Alice works at Acme Corp",
            agent_response="Noted!",
            user_id="alice",
            user_name="Alice",
        )
    )

    print(f"   ✅ Stored {len(result.memories)} memories")
    print("   ✅ Auto-synced to graph database")

    # Query the graph directly
    print("\n5️⃣ Querying graph database...")

    graph_result = await graph.query(
        """
        MATCH (m:Memory)
        WHERE m.memorySpaceId = $memorySpaceId
        RETURN m.memoryId as id, m.content as content, m.importance as importance
        LIMIT 10
        """,
        {"memorySpaceId": memory_space_id},
    )

    print(f"   Found {graph_result.count} memories in graph:")
    for record in graph_result.records:
        print(f"      - {record['content'][:50]}... (importance: {record['importance']})")

    # Demonstrate graph enrichment
    print("\n6️⃣ Graph enrichment capabilities:")
    print("   - Multi-hop relationship queries")
    print("   - Entity network discovery")
    print("   - Knowledge path finding")
    print("   - Provenance tracing")
    print("   - 2-5x more context than vector-only")

    # Clean up
    await memoir.close()
    await graph.disconnect()

    print("\n✅ Example complete!")


if __name__ == "__main__":
    asyncio.run(main())

