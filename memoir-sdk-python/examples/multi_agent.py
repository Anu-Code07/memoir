"""
Multi-Agent Example

Demonstrates multi-agent coordination with contexts and A2A communication.
"""

import asyncio
import os

from memoir import (
    A2ASendParams,
    ContextInput,
    Memoir,
    MemoirConfig,
)


async def main():
    """Run multi-agent coordination example."""

    print("🤝 Multi-Agent Coordination Example")
    print("=" * 50)

    # Initialize Memoir
    memoir = Memoir(
        MemoirConfig(convex_url=os.getenv("CONVEX_URL", "http://localhost:3210"))
    )

    # Scenario: Supervisor delegates to specialist agents
    print("\n📋 Scenario: Refund Request Workflow")

    # Step 1: Supervisor creates context
    print("\n1️⃣ Supervisor creates workflow context...")
    context = await memoir.contexts.create(
        ContextInput(
            purpose="Process $500 refund for defective product",
            memory_space_id="supervisor-agent-space",
            user_id="customer-123",
            data={
                "amount": 500,
                "reason": "defective product",
                "importance": 85,
                "tags": ["refund", "customer-service"],
            },
        )
    )
    print(f"   ✅ Context created: {context.id}")
    print(f"      Purpose: {context.purpose}")

    # Step 2: Supervisor delegates to finance agent via A2A
    print("\n2️⃣ Supervisor → Finance Agent (A2A)...")
    a2a_result = await memoir.a2a.send(
        A2ASendParams(
            from_agent="supervisor-agent",
            to_agent="finance-agent",
            message="Please approve $500 refund for customer-123",
            user_id="customer-123",
            context_id=context.id,
            importance=85,
            metadata={"tags": ["refund", "approval"]},
        )
    )
    print(f"   ✅ A2A message sent: {a2a_result.message_id}")
    print("      Stored in both agents' memories")

    # Step 3: Create sub-context for finance agent
    print("\n3️⃣ Finance agent creates sub-context...")
    finance_context = await memoir.contexts.create(
        ContextInput(
            purpose="Approve and process $500 refund",
            memory_space_id="finance-agent-space",
            parent_id=context.id,  # Link to parent
            user_id="customer-123",
            data={
                "amount": 500,
                "approval_required": True,
                "importance": 85,
            },
        )
    )
    print(f"   ✅ Sub-context created: {finance_context.id}")
    print(f"      Parent: {finance_context.parent_id}")
    print(f"      Depth: {finance_context.depth}")

    # Step 4: Update context status
    print("\n4️⃣ Finance agent approves...")
    updated = await memoir.contexts.update(
        finance_context.id,
        {
            "status": "completed",
            "data": {
                "approved": True,
                "approved_by": "finance-agent",
                "confirmation_number": "REF-789",
            },
        },
    )
    print(f"   ✅ Context updated to: {updated.status}")

    # Step 5: Get full context chain
    print("\n5️⃣ Retrieving full context chain...")
    chain = await memoir.contexts.get(finance_context.id, include_chain=True)

    if hasattr(chain, 'current'):
        print(f"   📍 Current: {chain.current.purpose}")
        print(f"   📍 Parent: {chain.parent.purpose if chain.parent else 'None'}")
        print(f"   📍 Root: {chain.root.purpose}")
        print(f"   📍 Depth: {chain.depth}")

    # Step 6: Check A2A conversation
    print("\n6️⃣ Checking A2A conversation...")
    a2a_convo = await memoir.a2a.get_conversation(
        "supervisor-agent", "finance-agent", limit=10
    )

    print(f"   💬 Messages exchanged: {a2a_convo.get('messageCount', 0)}")

    # Clean up
    await memoir.close()
    print("\n✅ Example complete!")


if __name__ == "__main__":
    asyncio.run(main())

