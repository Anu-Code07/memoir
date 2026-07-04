"""
Simple Chatbot Example

Demonstrates basic Memoir usage for a simple chatbot with memory.
"""

import asyncio
import os

from memoir import (
    Memoir,
    MemoirConfig,
    RememberParams,
    SearchOptions,
)


async def main():
    """Run simple chatbot example."""

    # Initialize Memoir
    memoir = Memoir(
        MemoirConfig(convex_url=os.getenv("CONVEX_URL", "http://localhost:3210"))
    )

    # Conversation details
    memory_space_id = "chatbot-agent"
    user_id = "user-alice"
    conversation_id = "conv-alice-session-1"

    print("🤖 Simple Chatbot with Memory")
    print("=" * 50)

    # Simulate conversation
    exchanges = [
        ("What's my name?", "I don't know yet. What's your name?"),
        ("My name is Alice", "Nice to meet you, Alice!"),
        ("I prefer dark mode", "Got it! I'll remember you prefer dark mode."),
        ("What theme do I prefer?", "You prefer dark mode!"),
    ]

    for user_msg, bot_response in exchanges:
        print(f"\n👤 User: {user_msg}")

        # Before responding, search memory for context
        context_memories = await memoir.memory.search(
            memory_space_id,
            user_msg,
            SearchOptions(user_id=user_id, limit=5),
        )

        if context_memories:
            print(f"   💭 Found {len(context_memories)} relevant memories")

        print(f"🤖 Bot: {bot_response}")

        # Remember this exchange
        result = await memoir.memory.remember(
            RememberParams(
                memory_space_id=memory_space_id,
                conversation_id=conversation_id,
                user_message=user_msg,
                agent_response=bot_response,
                user_id=user_id,
                user_name="Alice",
                importance=70,
                tags=["conversation"],
            )
        )

        print(f"   ✅ Remembered (stored {len(result.memories)} memories)")

    # Show memory statistics
    print("\n" + "=" * 50)
    print("📊 Memory Statistics:")
    total = await memoir.memory.count(memory_space_id, user_id=user_id)
    print(f"   Total memories: {total}")

    # Search all memories
    all_memories = await memoir.memory.search(
        memory_space_id, "*", SearchOptions(user_id=user_id, limit=100)
    )
    print(f"   Searchable memories: {len(all_memories)}")

    # Clean up
    await memoir.close()
    print("\n✅ Example complete!")


if __name__ == "__main__":
    asyncio.run(main())

