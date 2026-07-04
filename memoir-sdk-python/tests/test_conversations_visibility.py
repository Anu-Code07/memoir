"""
Tests for Conversations Visibility (Shareable Chats Phase 1)

Tests visibility field on create, check_access(), and set_visibility().

PARALLEL-SAFE: Uses TestRunContext for isolated test data.
"""

import pytest

from memoir import (
    ConversationParticipants,
    CreateConversationInput,
)
from memoir.types import (
    CheckAccessInput,
    SetVisibilityInput,
)
from memoir.conversations.validators import ConversationValidationError


@pytest.mark.asyncio
async def test_create_conversation_default_visibility(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test creating a conversation with default visibility (undefined/private)."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-vis-1"
            ),
        )
    )

    assert conversation is not None
    # Visibility should be None (defaults to 'private')
    assert conversation.visibility is None


@pytest.mark.asyncio
async def test_create_conversation_private_visibility(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test creating a conversation with explicit private visibility."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-vis-2"
            ),
            visibility="private",
        )
    )

    assert conversation.visibility == "private"


@pytest.mark.asyncio
async def test_create_conversation_space_visibility(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test creating a conversation with space visibility."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-vis-3"
            ),
            visibility="space",
        )
    )

    assert conversation.visibility == "space"


@pytest.mark.asyncio
async def test_create_conversation_public_visibility(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test creating a conversation with public visibility."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-vis-4"
            ),
            visibility="public",
        )
    )

    assert conversation.visibility == "public"


@pytest.mark.asyncio
async def test_create_conversation_invalid_visibility(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test that invalid visibility value is rejected."""
    with pytest.raises(ConversationValidationError) as exc_info:
        await memoir_client.conversations.create(
            CreateConversationInput(
                memory_space_id=test_memory_space_id,
                type="user-agent",
                participants=ConversationParticipants(
                    user_id=test_user_id, agent_id="test-agent-vis-5"
                ),
                visibility="invalid-value",  # type: ignore
            )
        )

    assert "Invalid visibility" in str(exc_info.value)


@pytest.mark.asyncio
async def test_check_access_owner(memoir_client, test_memory_space_id, test_user_id):
    """Test check_access returns full access for owner."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-access-1"
            ),
            visibility="private",
        )
    )

    access = await memoir_client.conversations.check_access(
        CheckAccessInput(
            conversation_id=conversation.conversation_id,
            user_id=test_user_id,
        )
    )

    assert access.can_view is True
    assert access.can_edit is True
    assert access.reason == "OWNER"
    assert access.visibility == "private"


@pytest.mark.asyncio
async def test_check_access_private_non_owner(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test check_access returns no access for private conversation (non-owner)."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-access-2"
            ),
            visibility="private",
        )
    )

    # Check access as a different user
    access = await memoir_client.conversations.check_access(
        CheckAccessInput(
            conversation_id=conversation.conversation_id,
            user_id="different-user-id",
        )
    )

    assert access.can_view is False
    assert access.can_edit is False
    assert access.reason == "PRIVATE_VISIBILITY"


@pytest.mark.asyncio
async def test_check_access_public_non_owner(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test check_access returns view access for public conversation (non-owner)."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-access-3"
            ),
            visibility="public",
        )
    )

    # Check access as a different user
    access = await memoir_client.conversations.check_access(
        CheckAccessInput(
            conversation_id=conversation.conversation_id,
            user_id="different-user-id",
        )
    )

    assert access.can_view is True
    assert access.can_edit is False
    assert access.reason == "PUBLIC_VISIBILITY"
    assert access.visibility == "public"


@pytest.mark.asyncio
async def test_check_access_space_same_space(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test check_access returns view access for space visibility (same space)."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-access-4"
            ),
            visibility="space",
        )
    )

    # Check access as space member
    access = await memoir_client.conversations.check_access(
        CheckAccessInput(
            conversation_id=conversation.conversation_id,
            user_id="space-member-user",
            memory_space_id=test_memory_space_id,
        )
    )

    assert access.can_view is True
    assert access.can_edit is False
    assert access.reason == "SPACE_MEMBER"
    assert access.visibility == "space"


@pytest.mark.asyncio
async def test_check_access_space_different_space(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test check_access returns no access for space visibility (different space)."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-access-5"
            ),
            visibility="space",
        )
    )

    # Check access from different space
    access = await memoir_client.conversations.check_access(
        CheckAccessInput(
            conversation_id=conversation.conversation_id,
            user_id="other-space-user",
            memory_space_id="different-space-id",
        )
    )

    assert access.can_view is False
    assert access.can_edit is False
    assert access.reason == "NOT_IN_MEMORY_SPACE"


@pytest.mark.asyncio
async def test_check_access_not_found(memoir_client):
    """Test check_access returns not found for non-existent conversation."""
    access = await memoir_client.conversations.check_access(
        CheckAccessInput(
            conversation_id="conv-nonexistent-12345",
            user_id="any-user",
        )
    )

    assert access.can_view is False
    assert access.can_edit is False
    assert access.reason == "CONVERSATION_NOT_FOUND"
    assert access.visibility is None


@pytest.mark.asyncio
async def test_set_visibility_private_to_public(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test changing visibility from private to public."""
    # Create with private visibility
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-setvis-1"
            ),
            visibility="private",
        )
    )

    assert conversation.visibility == "private"

    # Change to public
    updated = await memoir_client.conversations.set_visibility(
        SetVisibilityInput(
            conversation_id=conversation.conversation_id,
            visibility="public",
        )
    )

    assert updated.visibility == "public"
    assert updated.conversation_id == conversation.conversation_id


@pytest.mark.asyncio
async def test_set_visibility_public_to_space(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test changing visibility from public to space."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-setvis-2"
            ),
            visibility="public",
        )
    )

    updated = await memoir_client.conversations.set_visibility(
        SetVisibilityInput(
            conversation_id=conversation.conversation_id,
            visibility="space",
        )
    )

    assert updated.visibility == "space"


@pytest.mark.asyncio
async def test_set_visibility_space_to_private(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test changing visibility from space to private."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-setvis-3"
            ),
            visibility="space",
        )
    )

    updated = await memoir_client.conversations.set_visibility(
        SetVisibilityInput(
            conversation_id=conversation.conversation_id,
            visibility="private",
        )
    )

    assert updated.visibility == "private"


@pytest.mark.asyncio
async def test_set_visibility_invalid_value(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test that invalid visibility value is rejected by set_visibility."""
    conversation = await memoir_client.conversations.create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-setvis-4"
            ),
        )
    )

    with pytest.raises(ConversationValidationError) as exc_info:
        await memoir_client.conversations.set_visibility(
            SetVisibilityInput(
                conversation_id=conversation.conversation_id,
                visibility="invalid",  # type: ignore
            )
        )

    assert "Invalid visibility" in str(exc_info.value)


@pytest.mark.asyncio
async def test_get_or_create_with_visibility(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test get_or_create creates new conversation with visibility."""
    conversation = await memoir_client.conversations.get_or_create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-getorcreate-1"
            ),
            visibility="public",
        )
    )

    assert conversation.visibility == "public"
    assert conversation.conversation_id.startswith("conv-")


@pytest.mark.asyncio
async def test_get_or_create_returns_existing_ignores_visibility(
    memoir_client, test_memory_space_id, test_user_id
):
    """Test get_or_create returns existing conversation (ignores new visibility)."""
    # Create first with private
    first = await memoir_client.conversations.get_or_create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-getorcreate-2"
            ),
            visibility="private",
        )
    )

    assert first.visibility == "private"

    # Try to "create" again with public (should return existing)
    second = await memoir_client.conversations.get_or_create(
        CreateConversationInput(
            memory_space_id=test_memory_space_id,
            type="user-agent",
            participants=ConversationParticipants(
                user_id=test_user_id, agent_id="test-agent-getorcreate-2"
            ),
            visibility="public",  # This should be ignored
        )
    )

    # Should return the same conversation with original visibility
    assert second.conversation_id == first.conversation_id
    assert second.visibility == "private"
