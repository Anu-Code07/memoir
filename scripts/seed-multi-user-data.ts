#!/usr/bin/env tsx
/**
 * Seed script for multi-user chatbot scenario
 * Creates a single memory space with 5 users, each having 20 memories
 *
 * Simulates: A chatbot using Memoir with multiple users
 */

import { Memoir } from "../src/index";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load environment
dotenv.config({ path: resolve(process.cwd(), ".env.local"), override: true });

const convexUrl =
  process.argv[2] || process.env.LOCAL_CONVEX_URL || process.env.CONVEX_URL;

if (!convexUrl) {
  console.error("❌ No Convex URL provided");
  console.error("Usage: tsx scripts/seed-multi-user-data.ts [convex-url]");
  console.error("Or set LOCAL_CONVEX_URL or CONVEX_URL in .env.local");
  process.exit(1);
}

console.log(`\n🌱 Seeding multi-user chatbot data to: ${convexUrl}\n`);

// Use Memoir.create() for auto-configuration of graph database from env vars
// (MEMOIR_GRAPH_SYNC=true + NEO4J_URI enables automatic graph sync)
let memoir: Memoir;

// Sample memory content for realistic simulation
const memoryTemplates = [
  "My name is {name}",
  "I work as a {job}",
  "My favorite color is {color}",
  "I live in {city}",
  "My email is {email}",
  "I prefer {preference} mode for the UI",
  "My phone number is {phone}",
  "I'm interested in {interest}",
  "My birthday is on {birthday}",
  "I speak {language}",
  "My timezone is {timezone}",
  "I usually work {schedule}",
  "My company is {company}",
  "I have a pet {pet}",
  "My favorite food is {food}",
  "I exercise by {exercise}",
  "My hobby is {hobby}",
  "I commute by {transport}",
  "My goal is to {goal}",
  "I'm learning {learning}",
];

const userData = [
  {
    userId: "user-alice-001",
    name: "Alice Johnson",
    job: "Software Engineer",
    color: "blue",
    city: "San Francisco",
    email: "alice@example.com",
    preference: "dark",
    phone: "+1-555-0101",
    interest: "machine learning",
    birthday: "March 15",
    language: "English and Spanish",
    timezone: "PST",
    schedule: "9-5 with flexible hours",
    company: "TechCorp",
    pet: "golden retriever named Max",
    food: "sushi",
    exercise: "running in the mornings",
    hobby: "photography",
    transport: "bike",
    goal: "build scalable AI systems",
    learning: "reinforcement learning",
  },
  {
    userId: "user-bob-002",
    name: "Bob Smith",
    job: "Product Manager",
    color: "green",
    city: "New York",
    email: "bob@example.com",
    preference: "light",
    phone: "+1-555-0102",
    interest: "product strategy",
    birthday: "July 22",
    language: "English",
    timezone: "EST",
    schedule: "flexible, often late nights",
    company: "StartupXYZ",
    pet: "cat named Whiskers",
    food: "pizza",
    exercise: "going to the gym",
    hobby: "chess",
    transport: "subway",
    goal: "launch a successful SaaS product",
    learning: "data analytics",
  },
  {
    userId: "user-carol-003",
    name: "Carol Davis",
    job: "UX Designer",
    color: "purple",
    city: "Austin",
    email: "carol@example.com",
    preference: "auto",
    phone: "+1-555-0103",
    interest: "user experience design",
    birthday: "November 8",
    language: "English and French",
    timezone: "CST",
    schedule: "10-6 with creative breaks",
    company: "DesignHub",
    pet: "parrot named Rio",
    food: "tacos",
    exercise: "yoga classes",
    hobby: "painting",
    transport: "car",
    goal: "create delightful user experiences",
    learning: "motion design",
  },
  {
    userId: "user-david-004",
    name: "David Chen",
    job: "Data Scientist",
    color: "red",
    city: "Seattle",
    email: "david@example.com",
    preference: "dark",
    phone: "+1-555-0104",
    interest: "deep learning",
    birthday: "January 30",
    language: "English and Mandarin",
    timezone: "PST",
    schedule: "flexible remote schedule",
    company: "DataLabs",
    pet: "beagle named Charlie",
    food: "ramen",
    exercise: "swimming",
    hobby: "building mechanical keyboards",
    transport: "electric scooter",
    goal: "advance AI research",
    learning: "transformer architectures",
  },
  {
    userId: "user-emma-005",
    name: "Emma Wilson",
    job: "Marketing Manager",
    color: "orange",
    city: "Boston",
    email: "emma@example.com",
    preference: "light",
    phone: "+1-555-0105",
    interest: "content marketing",
    birthday: "September 12",
    language: "English",
    timezone: "EST",
    schedule: "8-4 early bird schedule",
    company: "GrowthCo",
    pet: "rabbit named Snowball",
    food: "pasta",
    exercise: "dancing",
    hobby: "reading mystery novels",
    transport: "walking",
    goal: "grow organic user acquisition",
    learning: "SEO optimization",
  },
];

async function seedData() {
  try {
    // Initialize Memoir with auto-configuration (graph sync from env vars)
    memoir = await Memoir.create({ convexUrl });

    const graphWorker = memoir.getGraphSyncWorker();
    if (graphWorker) {
      console.log("📊 Graph sync enabled (auto-configured from environment)\n");
    } else {
      console.log(
        "⚠️  Graph sync not enabled (set MEMOIR_GRAPH_SYNC=true and NEO4J_URI)\n",
      );
    }

    console.log("🌱 Starting multi-user data seeding...\n");

    // Create a single memory space for the chatbot
    const memorySpaceId = "chatbot-space-multiuser";
    const agentId = "chatbot-assistant-001";

    console.log(`📦 Memory Space: ${memorySpaceId}`);
    console.log(`🤖 Agent: ${agentId}`);

    // Pre-register memory space and agent to avoid race conditions in parallel memory creation
    console.log(`🔧 Pre-registering shared resources...`);
    try {
      await memoir.memorySpaces.register({
        memorySpaceId,
        type: "custom",
        name: "Multi-User Chatbot Space",
      });
      console.log(`   ✅ Memory space registered`);
    } catch (e: any) {
      if (!e.message?.includes("ALREADY_EXISTS")) {
        console.error(`   ⚠️  Failed to register memory space: ${e.message}`);
      } else {
        console.log(`   ℹ️  Memory space already exists`);
      }
    }

    try {
      await memoir.agents.register({
        id: agentId, // Client API uses 'id', not 'agentId'
        name: "Chatbot Assistant",
        description: "Multi-user chatbot assistant",
      });
      console.log(`   ✅ Agent registered\n`);
    } catch (e: any) {
      if (!e.message?.includes("ALREADY_REGISTERED")) {
        console.error(`   ⚠️  Failed to register agent: ${e.message}`);
      } else {
        console.log(`   ℹ️  Agent already exists\n`);
      }
    }

    let totalMemories = 0;

    // For each user, create 20 memories
    for (const user of userData) {
      console.log(`👤 Processing user: ${user.name} (${user.userId})`);

      // Create a conversation for this user
      const conversation = await memoir.conversations.create({
        type: "user-agent",
        memorySpaceId: memorySpaceId,
        participants: {
          userId: user.userId,
          participantId: agentId,
        },
      });

      console.log(`   📋 Created conversation: ${conversation.conversationId}`);

      // Create 20 memories for this user in parallel
      const memoryPromises = [];
      for (let i = 0; i < 20; i++) {
        const template = memoryTemplates[i];
        const userMessage = template.replace(
          /\{(\w+)\}/g,
          (_, key) => user[key as keyof typeof user] || key,
        );

        const agentResponse = `Got it! I've noted that ${userMessage.toLowerCase()}.`;

        const memoryPromise = memoir.memory
          .remember({
            memorySpaceId: memorySpaceId,
            conversationId: conversation.conversationId,
            userMessage: userMessage,
            agentResponse: agentResponse,
            userId: user.userId,
            userName: user.name,
            agentId: agentId, // Required for user-agent conversations
            importance: 50 + Math.floor(Math.random() * 30), // Random importance 50-80
          })
          .then(() => {
            totalMemories++;
          })
          .catch((e: any) => {
            console.error(`      ⚠️  Failed to create memory: ${e.message}`);
          });

        memoryPromises.push(memoryPromise);
      }

      // Wait for all memories to be created in parallel
      await Promise.all(memoryPromises);

      console.log(`   ✅ Created 20 memories for ${user.name}\n`);
    }

    console.log(`${"=".repeat(60)}`);
    console.log("✅ SEEDING COMPLETE!");
    console.log(`${"=".repeat(60)}`);
    console.log(`📊 Summary:`);
    console.log(`   Memory Space:          ${memorySpaceId}`);
    console.log(`   Users:                 ${userData.length}`);
    console.log(`   Conversations:         ${userData.length}`);
    console.log(`   Total Memories:        ${totalMemories}`);
    console.log(`   Memories per User:     ${totalMemories / userData.length}`);
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    memoir.close();
  }
}

seedData().then(() => process.exit(0));
