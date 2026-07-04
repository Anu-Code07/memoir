"""
Tests for Conversation Snapshots (Shareable Chats Phase 3)

Tests snapshot(), get_snapshot(), list_snapshots(), delete_snapshot(),
and PII redaction.

PARALLEL-SAFE: Uses TestRunContext for isolated test data.
"""

import pytest

from memoir import (
    ConversationParticipants,
    CreateConversationInput,
)
from memoir.types import CreateSnapshotInput, AddMessageInput


@pytest.mark.asyncio
async def test_snapshot_basic(memoir_client, test_memory_space_id, test_user_id):
    """Test creating a basic snapshot."""
    conv = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-snap-1"
            ),
        )
    )

    # Add messages
    await memoir_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="Hello, this is a test message",
        )
    )
    await memoir_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="agent",
            content="Hello! I received your message.",
        )
    )

    # Create snapshot
    result = await memoir_client.conversations.snapshot(
        CreateSnapshotInput(conversation_id=conv.conversation_id)
    )

    assert result.snapshot_id.startswith("snap-")
    assert result.snapshot.conversation_id == conv.conversation_id
    assert result.snapshot.status == "active"
    assert result.snapshot.message_count == 2


@pytest.mark.asyncio
async def test_snapshot_with_pii_redaction(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test creating a snapshot with PII redaction."""
    conv = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-snap-2"
            ),
        )
    )

    # Add message with PII
    await memoir_client.conversations.add_message(
        AddMessageInput(
            conversation_id=conv.conversation_id,
            role="user",
            content="My email is test@example.com and phone is 555-123-4567",
        )
    )

    # Create snapshot with PII redaction
    result = await memoir_client.conversations.snapshot(
        CreateSnapshotInput(
            conversation_id=conv.conversation_id,
            redact_pii=True,
        )
    )

    # Check that PII was redacted
    redaction = result.snapshot.redaction
    if isinstance(redaction, dict):
        assert redaction["pii_redacted"] is True
    else:
        assert redaction.pii_redacted is True

    # Check message content
    messages = result.snapshot.messages
    if messages:
        content = messages[0].content if hasattr(messages[0], 'content') else messages[0]["content"]
        assert "[EMAIL]" in content
        assert "[PHONE]" in content
        assert "test@example.com" not in content


@pytest.mark.asyncio
async def test_snapshot_preserves_metadata(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test that snapshot preserves conversation metadata."""
    conv = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-snap-3"
            ),
        )
    )

    result = await memoir_client.conversations.snapshot(
        CreateSnapshotInput(conversation_id=conv.conversation_id)
    )

    assert result.snapshot.conversation_type == "user-agent"
    assert result.snapshot.memory_space_id == test_memory_space_id
    assert result.snapshot.created_by is not None
    assert result.snapshot.snapshot_of > 0


@pytest.mark.asyncio
async def test_get_snapshot(memoir_client, test_memory_space_id, test_user_id):
    """Test retrieving a snapshot by ID."""
    conv = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-snap-4"
            ),
        )
    )

    created = await memoir_client.conversations.snapshot(
        CreateSnapshotInput(conversation_id=conv.conversation_id)
    )

    retrieved = await memoir_client.conversations.get_snapshot(created.snapshot_id)

    assert retrieved is not None
    assert retrieved.snapshot_id == created.snapshot_id
    assert retrieved.conversation_id == conv.conversation_id


@pytest.mark.asyncio
async def test_get_snapshot_not_found(memoir_client):
    """Test retrieving a non-existent snapshot."""
    result = await memoir_client.conversations.get_snapshot("snap-nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_list_snapshots(memoir_client, test_memory_space_id, test_user_id):
    """Test listing snapshots for a conversation."""
    conv = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-snap-5"
            ),
        )
    )

    # Create multiple snapshots
    await memoir_client.conversations.snapshot(
        CreateSnapshotInput(conversation_id=conv.conversation_id)
    )
    await memoir_client.conversations.snapshot(
        CreateSnapshotInput(conversation_id=conv.conversation_id)
    )

    snapshots = await memoir_client.conversations.list_snapshots(
        conv.conversation_id
    )

    assert len(snapshots) >= 2
    assert all(s.conversation_id == conv.conversation_id for s in snapshots)


@pytest.mark.asyncio
async def test_delete_snapshot(memoir_client, test_memory_space_id, test_user_id):
    """Test deleting a snapshot."""
    conv = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-snap-6"
            ),
        )
    )

    created = await memoir_client.conversations.snapshot(
        CreateSnapshotInput(conversation_id=conv.conversation_id)
    )

    result = await memoir_client.conversations.delete_snapshot(created.snapshot_id)

    assert result["deleted"] is True


@pytest.mark.asyncio
async def test_deleted_snapshot_not_returned(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test that deleted snapshot is not returned by get."""
    conv = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-snap-7"
            ),
        )
    )

    created = await memoir_client.conversations.snapshot(
        CreateSnapshotInput(conversation_id=conv.conversation_id)
    )

    # Delete it
    await memoir_client.conversations.delete_snapshot(created.snapshot_id)

    # Should return None for deleted snapshot
    retrieved = await memoir_client.conversations.get_snapshot(created.snapshot_id)
    assert retrieved is None
