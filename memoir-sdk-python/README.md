# Memoir Python SDK

> **Native Python SDK for AI agent memory, powered by Convex**

[![License: FSL-1.1-Apache-2.0](https://img.shields.io/badge/License-FSL--1.1--Apache--2.0-blue.svg)](https://fsl.software/)
[![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)](https://www.python.org/)
[![Convex](https://img.shields.io/badge/Powered%20by-Convex-purple.svg)](https://convex.dev)

## 🚀 Quick Start

### Installation

```bash
# Basic installation
pip install memoir

# With graph database support
pip install "memoir[graph]"

# With A2A communication support
pip install "memoir[a2a]"

# With all optional dependencies
pip install "memoir[all]"

# Development installation
pip install "memoir[dev]"
```

**Install from source:**

```bash
git clone https://github.com/Anu-Code07/memoir.git
cd Project-Memoir/memoir-sdk-python
pip install -e ".[dev]"
```

### Your First Memory

```python
import asyncio
from memoir import Memoir, MemoirConfig, RememberParams

async def main():
    # Initialize Memoir
    memoir = Memoir(MemoirConfig(
        convex_url="https://your-deployment.convex.cloud"
    ))

    # Remember a conversation
    result = await memoir.memory.remember(
        RememberParams(
            memory_space_id="my-agent",
            conversation_id="conv-1",
            user_message="I prefer dark mode",
            agent_response="Got it! I'll remember that.",
            user_id="user-123",
            user_name="User"
        )
    )

    # Search your memories
    results = await memoir.memory.search(
        "my-agent",
        "what are the user's preferences?"
    )

    for memory in results:
        print(f"Found: {memory.content}")

    # Clean up
    await memoir.close()

# Run
asyncio.run(main())
```

## ✨ Features

The Python SDK provides 100% API compatibility with the TypeScript SDK:

- 🧠 **Flexible Memory** - Remember anything without hardcoded schemas
- 🔒 **Memory Space Isolation** - Flexible boundaries (per user, team, or project)
- ♾️ **Long-term Persistence** - Memories last forever with automatic indexing
- ⏱️ **Automatic Versioning** - Updates preserve history, never lose data
- 🗄️ **ACID + Vector Hybrid** - Immutable conversation source + fast searchable index
- 🔍 **Semantic Search** - AI-powered retrieval with embeddings
- 🔗 **Context Chains** - Hierarchical context sharing across agents
- 👥 **User Profiles** - Rich user context with GDPR cascade deletion
- 📊 **Facts Layer** - Extract structured knowledge for 60-90% storage savings
- 🕸️ **Graph Integration** - Optional Neo4j/Memgraph support
- 🤝 **A2A Communication** - Agent-to-agent messaging helpers
- 📈 **Access Analytics** - Built-in statistics and insights
- 🛡️ **Governance Policies** - Centralized data retention, purging, and compliance (GDPR, HIPAA, SOC2, FINRA)
- 🔒 **Resilience Layer** - Rate limiting, circuit breaker, priority queue for overload protection

## ✨ What's New in v0.16.0

### Resilience Layer - Production-Ready Overload Protection

**NEW: Built-in protection against server overload during extreme traffic bursts:**

```python
from memoir import Memoir, MemoirConfig
from memoir.resilience import ResiliencePresets

# Default - enabled with balanced settings (no config needed!)
memoir = Memoir(MemoirConfig(convex_url=os.getenv("CONVEX_URL")))

# Or use a preset for your use case
realtime_memoir = Memoir(MemoirConfig(
    convex_url=os.getenv("CONVEX_URL"),
    resilience=ResiliencePresets.real_time_agent,  # Low latency
))

# Monitor health
print(memoir.is_healthy())  # False if circuit is open
print(memoir.get_resilience_metrics())  # Full metrics

# Graceful shutdown
await memoir.shutdown(timeout_s=30.0)  # Wait for pending ops
```

**Features:**

- ⚡ **Token Bucket Rate Limiter** - Smooths bursty traffic
- 🚦 **Concurrency Limiter** - Controls parallel requests
- 🎯 **Priority Queue** - Critical ops get priority
- 🔌 **Circuit Breaker** - Fails fast when backend is unhealthy

---

## 🏗️ Architecture

Memoir uses a 4-layer architecture:

```
Layer 1: ACID Stores (Source of Truth)
├── 1a: Conversations (memory-space-scoped)
├── 1b: Immutable (truly shared - KB, policies)
└── 1c: Mutable (truly shared - config, inventory)

Layer 2: Vector Index (memory-space-scoped, searchable)
└── Embedded memories for semantic search

Layer 3: Facts Store (memory-space-scoped, versioned)
└── LLM-extracted facts, 60-90% token savings

Layer 4: Convenience APIs (wrapper over L1-3)
└── Primary developer interface
```

## 📖 Usage Examples

### Basic Memory Operations

```python
from memoir import Memoir, MemoirConfig, RememberParams, SearchOptions

# Initialize
memoir = Memoir(MemoirConfig(convex_url=os.getenv("CONVEX_URL")))

# Remember
result = await memoir.memory.remember(
    RememberParams(
        memory_space_id="agent-1",
        conversation_id="conv-123",
        user_message="My password is Blue123",
        agent_response="I'll remember that securely!",
        user_id="user-123",
        user_name="Alex",
        importance=100,
        tags=["password", "security"]
    )
)

# Search
memories = await memoir.memory.search(
    "agent-1",
    "user password",
    SearchOptions(
        user_id="user-123",
        min_importance=70,
        limit=10
    )
)

# Update
await memoir.memory.update(
    "agent-1",
    memory_id,
    {"content": "Password updated", "importance": 100}
)

# Delete
await memoir.memory.delete("agent-1", memory_id)
```

### User Profiles & GDPR

```python
from memoir import DeleteUserOptions

# Create/update user profile
user = await memoir.users.update(
    "user-123",
    {
        "displayName": "Alex Johnson",
        "email": "alex@example.com",
        "preferences": {"theme": "dark"}
    }
)

# GDPR cascade deletion (deletes across ALL layers)
result = await memoir.users.delete(
    "user-123",
    DeleteUserOptions(cascade=True, verify=True)
)

print(f"Deleted {result.total_deleted} records")
print(f"Layers affected: {', '.join(result.deleted_layers)}")
```

### Graph Integration

```python
from memoir import MemoirConfig, GraphConfig, GraphConnectionConfig
from memoir.graph import CypherGraphAdapter, initialize_graph_schema

# Setup graph adapter
graph = CypherGraphAdapter()
await graph.connect(
    GraphConnectionConfig(
        uri="bolt://localhost:7687",
        username="neo4j",
        password="password"
    )
)

# Initialize schema
await initialize_graph_schema(graph)

# Initialize Memoir with graph
memoir = Memoir(
    MemoirConfig(
        convex_url=os.getenv("CONVEX_URL"),
        graph=GraphConfig(adapter=graph, auto_sync=True)
    )
)

# Use normally - auto-syncs to graph!
await memoir.memory.remember(params)
```

### Multi-Agent Coordination

```python
from memoir import ContextInput, A2ASendParams

# Create workflow context
context = await memoir.contexts.create(
    ContextInput(
        purpose="Process refund request",
        memory_space_id="supervisor-space",
        user_id="user-123",
        data={"amount": 500, "importance": 85}
    )
)

# Send A2A message
await memoir.a2a.send(
    A2ASendParams(
        from_agent="supervisor-agent",
        to_agent="finance-agent",
        message="Please approve $500 refund",
        user_id="user-123",
        context_id=context.id,
        importance=85
    )
)
```

## 🔄 Migration from TypeScript

The Python SDK maintains API compatibility with the TypeScript SDK. Here's how to translate:

**TypeScript:**

```typescript
const memoir = new Memoir({ convexUrl: process.env.CONVEX_URL });

const result = await memoir.memory.remember({
  memorySpaceId: "agent-1",
  conversationId: "conv-123",
  userMessage: "I prefer dark mode",
  agentResponse: "Got it!",
  userId: "user-123",
  userName: "Alex",
  importance: 70,
  tags: ["preferences"],
});
```

**Python:**

```python
memoir = Memoir(MemoirConfig(convex_url=os.getenv("CONVEX_URL")))

result = await memoir.memory.remember(
    RememberParams(
        memory_space_id="agent-1",
        conversation_id="conv-123",
        user_message="I prefer dark mode",
        agent_response="Got it!",
        user_id="user-123",
        user_name="Alex",
        importance=70,
        tags=["preferences"]
    )
)
```

**Key Differences:**

- camelCase → snake_case for parameters and methods
- Objects → dataclasses or named parameters
- Same structure, same capabilities, native Python

## 📚 API Reference

All TypeScript APIs are available in Python:

| API Module               | Description                        | Methods     |
| ------------------------ | ---------------------------------- | ----------- |
| `memoir.memory.*`        | Layer 4: Memory convenience API    | 14 methods  |
| `memoir.conversations.*` | Layer 1a: ACID conversations       | 13 methods  |
| `memoir.immutable.*`     | Layer 1b: Shared immutable data    | 9 methods   |
| `memoir.mutable.*`       | Layer 1c: Shared mutable data      | 12 methods  |
| `memoir.vector.*`        | Layer 2: Vector index              | 13 methods  |
| `memoir.facts.*`         | Layer 3: Facts store               | 10 methods  |
| `memoir.contexts.*`      | Coordination: Context chains       | 17 methods  |
| `memoir.users.*`         | Coordination: User profiles + GDPR | 11 methods  |
| `memoir.agents.*`        | Coordination: Agent registry       | 8 methods   |
| `memoir.memory_spaces.*` | Coordination: Memory spaces        | 9 methods   |
| `memoir.a2a.*`           | Helpers: A2A communication         | 4 methods   |
| `memoir.graph.*`         | Graph database integration         | ~20 methods |

**Total: ~140 methods** - Full feature parity with TypeScript SDK!

## 🧪 Testing

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run with coverage
pytest --cov=memoir --cov-report=html

# Run specific test
pytest tests/test_memory.py -v
```

## 📖 Documentation

### Quick Links

- **[START HERE](./START_HERE.md)** - Navigation guide for all documentation
- **[Developer Guide](./docs/guides/developer-guide.md)** - Comprehensive Python guide
- **[Migration Guide](./docs/guides/migration-guide.md)** - TypeScript to Python migration
- **[Testing Guide](../dev-docs/python-sdk-testing.md)** - How to test the SDK
- **[Examples](./examples/)** - 4 working applications

### Shared Documentation

- **[API Reference](../Documentation/03-api-reference/01-overview.md)** - Complete API documentation
- **[Core Features](../Documentation/02-core-features/)** - Feature guides
- **[Architecture](../Documentation/04-architecture/)** - System architecture
- **[Advanced Topics](../Documentation/07-advanced-topics/)** - Graph DB, facts, etc.

## 🔒 Requirements

- **Python 3.12 or 3.13** (tested on both versions)
- **Convex backend** running (local, cloud, or self-hosted)
  - Use existing `.env.local` configuration
  - LOCAL: `npm run dev:local` from project root
  - MANAGED: Already running at https://expert-buffalo-268.convex.cloud

**Optional:**

- Neo4j or Memgraph (for graph integration)
- Redis (for A2A pub/sub)

## 🧪 Testing

The Python SDK has **full dual-testing infrastructure** (identical to TypeScript SDK):

### Quick Test Commands (mirrors TypeScript SDK)

```bash
# Auto-detect and run appropriate suite(s) - like "npm test"
make test

# Run LOCAL tests only - like "npm run test:local"
make test-local

# Run MANAGED tests only - like "npm run test:managed"
make test-managed

# Explicitly run BOTH suites - like "npm run test:both"
make test-both
```

### Alternative: Direct Script Usage

```bash
# Auto-detect (runs BOTH if both configs present)
python scripts/run-python-tests.py

# Explicit modes
python scripts/run-python-tests.py --mode=local
python scripts/run-python-tests.py --mode=managed
python scripts/run-python-tests.py --mode=both
```

### Raw pytest (single suite only)

```bash
# Runs one suite based on auto-detection (defaults to LOCAL if both present)
pytest tests/ -v

# With explicit mode
CONVEX_TEST_MODE=local pytest tests/ -v
CONVEX_TEST_MODE=managed pytest tests/ -v
```

### Test Coverage

- **579 tests** covering all APIs (includes 5 OpenAI tests that skip in CI)
- **73% code coverage** (actively increasing)
- **100% pass rate** on both local and managed environments
- OpenAI tests run locally with OPENAI_API_KEY, skip in CI (too expensive)

### Test Environments

| Environment | Features                  | Speed      | Use Case        |
| ----------- | ------------------------- | ---------- | --------------- |
| **LOCAL**   | ✅ ACID, ❌ Vector search | ⚡ 2-3 min | Fast iteration  |
| **MANAGED** | ✅ ACID, ✅ Vector search | 🌐 15 min  | Full validation |

**Note:** Both SDKs now include 5 OpenAI integration tests (skipped without OPENAI_API_KEY).

## 🤝 Contributing

We welcome contributions! The Python SDK follows the same architecture as the TypeScript SDK.

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## 📄 License

FSL-1.1-Apache-2.0 - Same as the TypeScript SDK

- See [LICENSE.md](../LICENSE.md) for full details
- Each version becomes Apache 2.0 licensed two years after release

## 🙏 Acknowledgments

- [Convex](https://convex.dev) - The reactive backend platform
- TypeScript SDK - This Python port maintains full compatibility
- The open source AI community

## 📮 Support

- 📧 Email: support@memoir.dev
- 💬 Discussions: [GitHub Discussions](https://github.com/Anu-Code07/memoir/discussions)
- 🐛 Issues: [GitHub Issues](https://github.com/Anu-Code07/memoir/issues)
- 📖 Docs: [Documentation](../Documentation/00-README.md)

---

**Built with ❤️ for the AI agent community**

Copyright 2025 Anurag Singh / Anu-Code07
