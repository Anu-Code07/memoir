"""
Clear Graph Databases

Utility script to clear both Neo4j and Memgraph test databases.
Validates that databases are actually empty after clearing.

Usage:
    python tests/graph/clear_databases.py
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from memoir.graph.adapters.cypher import CypherGraphAdapter
from memoir.types import GraphConnectionConfig

# Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")

MEMGRAPH_URI = os.getenv("MEMGRAPH_URI", "bolt://localhost:7688")
MEMGRAPH_USER = os.getenv("MEMGRAPH_USER", "")
MEMGRAPH_PASSWORD = os.getenv("MEMGRAPH_PASSWORD", "")


async def clear_neo4j():
    """Clear Neo4j database and validate"""
    print("🗑️  Clearing Neo4j database...")

    adapter = CypherGraphAdapter()
    await adapter.connect(
        GraphConnectionConfig(uri=NEO4J_URI, username=NEO4J_USER, password=NEO4J_PASSWORD)
    )

    # Delete all nodes and relationships
    await adapter.query("MATCH (n) DETACH DELETE n")

    # CRITICAL: Validate database is empty
    result = await adapter.query("MATCH (n) RETURN count(n) as nodeCount")
    node_count = result.records[0]["nodeCount"]

    await adapter.disconnect()

    if node_count == 0:
        print("   ✅ Neo4j cleared successfully (0 nodes)")
    else:
        print(f"   ❌ Neo4j NOT empty ({node_count} nodes remaining)")
        return False

    return True


async def clear_memgraph():
    """Clear Memgraph database and validate"""
    print("🗑️  Clearing Memgraph database...")

    adapter = CypherGraphAdapter()
    await adapter.connect(
        GraphConnectionConfig(uri=MEMGRAPH_URI, username=MEMGRAPH_USER, password=MEMGRAPH_PASSWORD)
    )

    # Delete all nodes and relationships
    await adapter.query("MATCH (n) DETACH DELETE n")

    # CRITICAL: Validate database is empty
    result = await adapter.query("MATCH (n) RETURN count(n) as nodeCount")
    node_count = result.records[0]["nodeCount"]

    await adapter.disconnect()

    if node_count == 0:
        print("   ✅ Memgraph cleared successfully (0 nodes)")
    else:
        print(f"   ❌ Memgraph NOT empty ({node_count} nodes remaining)")
        return False

    return True


async def main():
    """Main function"""
    print("=" * 70)
    print("CLEARING GRAPH DATABASES")
    print("=" * 70)
    print()

    neo4j_success = await clear_neo4j()
    memgraph_success = await clear_memgraph()

    print()
    print("=" * 70)

    if neo4j_success and memgraph_success:
        print("✅ ALL DATABASES CLEARED SUCCESSFULLY")
    else:
        print("❌ SOME DATABASES FAILED TO CLEAR")
        sys.exit(1)

    print("=" * 70)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
