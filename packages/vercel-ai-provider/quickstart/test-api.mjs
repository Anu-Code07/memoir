#!/usr/bin/env node
/**
 * Programmatic API Route Tests
 * Tests both v5 and v6 routes for memory functionality
 */

const BASE_URL = process.env.QUICKSTART_URL || "http://localhost:3000";

// Test configuration
const TEST_USER_ID = `test-user-${Date.now()}`;
const TEST_MEMORY_SPACE_ID = "quickstart-demo";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testRoute(routePath, routeName) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing ${routeName} (${routePath})`);
  console.log("=".repeat(60));

  const conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Test 1: Send a message with a fact
  console.log("\n📤 Test 1: Sending message with a fact...");
  const message1 = {
    id: `msg-${Date.now()}-1`,
    role: "user",
    content: `My favorite programming language is TypeScript and I work at a company called TechCorp.`,
    createdAt: new Date().toISOString(),
  };

  try {
    const response1 = await fetch(`${BASE_URL}${routePath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [message1],
        userId: TEST_USER_ID,
        memorySpaceId: TEST_MEMORY_SPACE_ID,
        conversationId,
      }),
    });

    if (!response1.ok) {
      const errorText = await response1.text();
      console.log(`❌ Request failed with status ${response1.status}`);
      console.log(`   Error: ${errorText.slice(0, 500)}`);
      return {
        success: false,
        route: routeName,
        error: `HTTP ${response1.status}`,
      };
    }

    // Read streaming response
    const reader = response1.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";
    let chunks = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullResponse += chunk;
      chunks++;
    }

    console.log(
      `✅ Response received (${chunks} chunks, ${fullResponse.length} bytes)`,
    );

    // Check for layer observer data
    const hasLayerData =
      fullResponse.includes("FACTS_LAYER") ||
      fullResponse.includes("MEMORY_LAYER") ||
      fullResponse.includes("layerId");
    console.log(
      `   Layer observer data: ${hasLayerData ? "✅ Present" : "❌ Missing"}`,
    );

    // Check for text content
    const hasTextContent =
      fullResponse.includes('"type":"text"') ||
      fullResponse.includes("text-delta");
    console.log(
      `   Text content: ${hasTextContent ? "✅ Present" : "❌ Missing"}`,
    );
  } catch (error) {
    console.log(`❌ Request error: ${error.message}`);
    return { success: false, route: routeName, error: error.message };
  }

  // Wait for async processing (fact extraction, etc.)
  console.log("\n⏳ Waiting for memory processing...");
  await sleep(3000);

  // Test 2: Check if facts were stored
  console.log("\n🔍 Test 2: Checking stored facts...");
  try {
    const factsResponse = await fetch(
      `${BASE_URL}/api/facts?userId=${TEST_USER_ID}&memorySpaceId=${TEST_MEMORY_SPACE_ID}`,
      { method: "GET" },
    );

    if (factsResponse.ok) {
      const factsData = await factsResponse.json();
      const facts = factsData.facts || factsData || [];
      console.log(
        `✅ Facts API returned: ${Array.isArray(facts) ? facts.length : "unknown"} facts`,
      );

      if (Array.isArray(facts) && facts.length > 0) {
        console.log("   Sample facts:");
        facts.slice(0, 3).forEach((fact, i) => {
          const content =
            fact.content || fact.text || JSON.stringify(fact).slice(0, 100);
          console.log(`     ${i + 1}. ${content.slice(0, 80)}...`);
        });
      }
    } else {
      console.log(`⚠️ Facts API returned ${factsResponse.status}`);
    }
  } catch (error) {
    console.log(`⚠️ Could not check facts: ${error.message}`);
  }

  // Test 3: Send follow-up message and verify recall
  console.log("\n📤 Test 3: Sending follow-up to test recall...");
  const message2 = {
    id: `msg-${Date.now()}-2`,
    role: "user",
    content: "What programming language do I prefer?",
    createdAt: new Date().toISOString(),
  };

  // Include previous assistant response for context
  const message1Response = {
    id: `msg-${Date.now()}-1r`,
    role: "assistant",
    content:
      "Great! TypeScript is a fantastic choice for type-safe development.",
    createdAt: new Date().toISOString(),
  };

  try {
    const response2 = await fetch(`${BASE_URL}${routePath}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [message1, message1Response, message2],
        userId: TEST_USER_ID,
        memorySpaceId: TEST_MEMORY_SPACE_ID,
        conversationId,
      }),
    });

    if (!response2.ok) {
      console.log(
        `❌ Follow-up request failed with status ${response2.status}`,
      );
      return {
        success: false,
        route: routeName,
        error: `Follow-up HTTP ${response2.status}`,
      };
    }

    const reader = response2.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fullResponse += decoder.decode(value, { stream: true });
    }

    // Check if TypeScript was mentioned in the response (recall working)
    const mentionsTypeScript = fullResponse
      .toLowerCase()
      .includes("typescript");
    console.log(`✅ Response received`);
    console.log(
      `   Recalls TypeScript preference: ${mentionsTypeScript ? "✅ Yes" : "❌ No"}`,
    );

    return {
      success: true,
      route: routeName,
      recallWorks: mentionsTypeScript,
    };
  } catch (error) {
    console.log(`❌ Follow-up request error: ${error.message}`);
    return { success: false, route: routeName, error: error.message };
  }
}

async function testConversationAPI() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Testing Conversation API");
  console.log("=".repeat(60));

  try {
    const response = await fetch(
      `${BASE_URL}/api/conversations?userId=${TEST_USER_ID}&memorySpaceId=${TEST_MEMORY_SPACE_ID}`,
      { method: "GET" },
    );

    if (response.ok) {
      const data = await response.json();
      const conversations = data.conversations || data || [];
      console.log(
        `✅ Conversations API works: ${Array.isArray(conversations) ? conversations.length : "unknown"} conversations`,
      );
      return true;
    } else {
      console.log(`❌ Conversations API returned ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Conversations API error: ${error.message}`);
    return false;
  }
}

async function checkServerHealth() {
  console.log("🏥 Checking server health...");
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      console.log("✅ Server is healthy");
      return true;
    } else {
      console.log(`❌ Health check failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Server not reachable: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log("🧪 Memoir API Route Tests");
  console.log(`📍 Testing server at: ${BASE_URL}`);
  console.log(`👤 Test user: ${TEST_USER_ID}`);
  console.log(`📦 Memory space: ${TEST_MEMORY_SPACE_ID}`);

  // Check server health first
  const healthy = await checkServerHealth();
  if (!healthy) {
    console.log(
      "\n❌ Server is not running. Please start the quickstart first:",
    );
    console.log("   cd packages/vercel-ai-provider/quickstart && npm run dev");
    process.exit(1);
  }

  const results = [];

  // Test conversation API
  await testConversationAPI();

  // Test v5 route
  const v5Result = await testRoute("/api/chat", "V5 Route");
  results.push(v5Result);

  // Test v6 route
  const v6Result = await testRoute("/api/chat-v6", "V6 Route");
  results.push(v6Result);

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 Test Summary");
  console.log("=".repeat(60));

  let allPassed = true;
  for (const result of results) {
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    const recall =
      result.recallWorks !== undefined
        ? result.recallWorks
          ? " (recall ✅)"
          : " (recall ❌)"
        : "";
    const error = result.error ? ` - ${result.error}` : "";
    console.log(`${status} ${result.route}${recall}${error}`);
    if (!result.success) allPassed = false;
  }

  console.log("");
  process.exit(allPassed ? 0 : 1);
}

main().catch((error) => {
  console.error("Test runner error:", error);
  process.exit(1);
});
