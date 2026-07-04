/**
 * Conversation Race Condition Test
 *
 * This script reproduces the CONVERSATION_ALREADY_EXISTS error
 * by calling remember() twice in parallel with the same conversation ID.
 *
 * Run with: node tests/debug/conversation-race-test.mjs
 *
 * Expected: One of the parallel calls should fail with CONVERSATION_ALREADY_EXISTS
 */

import { Memoir } from "../../dist/index.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function testConversationRace() {
  console.log("=== Conversation Race Condition Test ===\n");

  if (!process.env.CONVEX_URL) {
    console.error("ERROR: CONVEX_URL not set in environment");
    process.exit(1);
  }

  console.log("Creating Memoir instance...");
  const memoir = new Memoir({
    convexUrl: process.env.CONVEX_URL,
  });

  // Use same conversation ID for both calls to trigger race condition
  const conversationId = `test-race-${Date.now()}`;
  const memorySpaceId = `race-test-${Date.now()}`;

  console.log(`Memory Space: ${memorySpaceId}`);
  console.log(`Conversation ID: ${conversationId}`);
  console.log(
    "\nCalling remember() twice in PARALLEL with same conversation ID...\n",
  );

  const startTime = Date.now();

  try {
    // Call remember() twice in parallel with the SAME conversation ID
    // This should trigger a race condition where:
    // 1. Both calls check if conversation exists -> both get "no"
    // 2. Both calls try to create the conversation
    // 3. One succeeds, one fails with CONVERSATION_ALREADY_EXISTS

    const results = await Promise.allSettled([
      memoir.memory.remember({
        conversationId,
        memorySpaceId,
        userMessage: "Message 1 from parallel call A",
        agentResponse: "Response 1 from parallel call A",
        userId: "user-1",
        userName: "Test User",
        agentId: "agent-1",
      }),
      memoir.memory.remember({
        conversationId,
        memorySpaceId,
        userMessage: "Message 2 from parallel call B",
        agentResponse: "Response 2 from parallel call B",
        userId: "user-1",
        userName: "Test User",
        agentId: "agent-1",
      }),
    ]);

    const elapsed = Date.now() - startTime;
    console.log(`Completed in ${elapsed}ms\n`);

    // Analyze results
    let successCount = 0;
    let failCount = 0;
    let conversationExistsError = false;

    results.forEach((result, index) => {
      const callLabel = index === 0 ? "Call A" : "Call B";

      if (result.status === "fulfilled") {
        successCount++;
        console.log(`✅ ${callLabel}: Success`);
      } else {
        failCount++;
        const error = result.reason;
        console.log(`❌ ${callLabel}: Failed`);
        console.log(`   Error: ${error.message}`);

        if (error.message.includes("CONVERSATION_ALREADY_EXISTS")) {
          conversationExistsError = true;
        }
      }
    });

    console.log("\n--- Summary ---");
    console.log(`Successes: ${successCount}`);
    console.log(`Failures: ${failCount}`);

    if (conversationExistsError) {
      console.log(
        "\n🐛 BUG CONFIRMED: CONVERSATION_ALREADY_EXISTS race condition",
      );
      console.log(
        "See: dev-docs/bugs/sdk-conversation-already-exists-error.md",
      );
    } else if (successCount === 2) {
      console.log(
        "\n✅ Both calls succeeded - race condition did not occur this time",
      );
      console.log(
        "   (Try running multiple times or add artificial delay to trigger it)",
      );
    }
  } catch (error) {
    console.error("\n❌ Unexpected error:", error.message);
    console.error(error);
  } finally {
    memoir.close();
    console.log("\nTest complete.");
  }
}

// Also test sequential calls (should work fine)
async function testSequentialCalls() {
  console.log("\n=== Sequential Calls Test (Control) ===\n");

  const memoir = new Memoir({
    convexUrl: process.env.CONVEX_URL,
  });

  const conversationId = `test-seq-${Date.now()}`;
  const memorySpaceId = `seq-test-${Date.now()}`;

  console.log(`Conversation ID: ${conversationId}`);
  console.log("Calling remember() twice SEQUENTIALLY...\n");

  try {
    // First call
    await memoir.memory.remember({
      conversationId,
      memorySpaceId,
      userMessage: "First message",
      agentResponse: "First response",
      userId: "user-1",
      userName: "Test User",
      agentId: "agent-1",
    });
    console.log("✅ First call: Success");

    // Second call (same conversation)
    await memoir.memory.remember({
      conversationId,
      memorySpaceId,
      userMessage: "Second message",
      agentResponse: "Second response",
      userId: "user-1",
      userName: "Test User",
      agentId: "agent-1",
    });
    console.log("✅ Second call: Success");

    console.log("\n✅ Sequential calls work correctly (conversation reused)");
  } catch (error) {
    console.error("\n❌ Error:", error.message);
  } finally {
    memoir.close();
  }
}

// Run tests
console.log("Starting tests...\n");
await testConversationRace();
await testSequentialCalls();
