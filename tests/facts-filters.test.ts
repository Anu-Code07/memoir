/**
 * Comprehensive enum-based filter tests for Facts API (TypeScript)
 *
 * Tests all 7 factTypes across all 5 filter operations to ensure:
 * 1. No ArgumentValidationError for valid enum values
 * 2. Filters return only matching results
 * 3. Regression test for "observation" factType bug
 *
 * Comprehensive filter coverage tests
 */

import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import { Memoir } from "../src/index";

// All valid factTypes as per schema
const ALL_FACT_TYPES = [
  "preference",
  "identity",
  "knowledge",
  "relationship",
  "event",
  "observation", // This was the bug - missing in query validators
  "custom",
] as const;

describe("Facts API - Comprehensive Filter Coverage", () => {
  let memoir: Memoir;
  const TEST_MEMSPACE_ID = `filter-test-${Date.now()}`;

  beforeAll(() => {
    memoir = new Memoir({ convexUrl: process.env.CONVEX_URL! });
  });

  afterAll(async () => {
    // Cleanup test facts (best-effort - ignore errors)
    try {
      await memoir.memorySpaces.delete(TEST_MEMSPACE_ID, {
        cascade: true,
        reason: "test cleanup",
      });
    } catch (_e) {
      // Ignore cleanup errors
    }
  });

  describe.each(ALL_FACT_TYPES)("FactType: %s", (factType) => {
    it(`list() should filter by factType="${factType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-list-${factType}`;

      // Store target fact
      const targetFact = await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: factType as any,
        fact: `Test ${factType} fact for list`,
        subject: `test-subject-${factType}`,
        confidence: 85,
        sourceType: "manual",
      });

      // Store different type as noise
      if (factType !== "preference") {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "preference",
          fact: "Noise fact",
          subject: "noise-subject",
          confidence: 90,
          sourceType: "manual",
        });
      }

      // Execute: List with factType filter
      const results = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: factType as any,
      });

      // Validate
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.factType).toBe(factType);
      });

      // Verify target fact is in results
      const factIds = results.map((f: any) => f.factId);
      expect(factIds).toContain(targetFact.factId);
    });

    it(`count() should filter by factType="${factType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-count-${factType}`;

      // Store 2 facts of target type
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: factType as any,
        fact: `Test ${factType} fact 1 for count`,
        subject: `test-subject-${factType}-1`,
        confidence: 85,
        sourceType: "manual",
      });

      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: factType as any,
        fact: `Test ${factType} fact 2 for count`,
        subject: `test-subject-${factType}-2`,
        confidence: 90,
        sourceType: "manual",
      });

      // Store different type as noise
      if (factType !== "custom") {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "custom",
          fact: "Noise fact",
          subject: "noise",
          confidence: 70,
          sourceType: "manual",
        });
      }

      // Execute: Count with factType filter
      const count = await memoir.facts.count({
        memorySpaceId: spaceId,
        factType: factType as any,
      });

      // Validate
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it(`search() should filter by factType="${factType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-search-${factType}`;
      const searchTerm = "searchable";

      // Store target fact with searchable content
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: factType as any,
        fact: `${searchTerm} ${factType} fact for search`,
        subject: `test-subject-${factType}`,
        confidence: 85,
        sourceType: "manual",
      });

      // Store different type with same search term (should be filtered out)
      if (factType !== "knowledge") {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "knowledge",
          fact: `${searchTerm} noise fact`,
          subject: "noise-subject",
          confidence: 90,
          sourceType: "manual",
        });
      }

      // Execute: Search with factType filter
      const results = await memoir.facts.search(spaceId, searchTerm, {
        factType: factType as any,
      });

      // Validate
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.factType).toBe(factType);
        expect(fact.fact.toLowerCase()).toContain(searchTerm);
      });
    });

    it(`queryBySubject() should filter by factType="${factType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-subject-${factType}`;
      const subject = `query-subject-${factType}`;

      // Store target fact
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: factType as any,
        fact: `Test ${factType} fact for queryBySubject`,
        subject,
        confidence: 85,
        sourceType: "manual",
      });

      // Store same subject but different type (should be filtered out)
      if (factType !== "relationship") {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "relationship",
          fact: "Noise fact with same subject",
          subject,
          confidence: 90,
          sourceType: "manual",
        });
      }

      // Execute: Query by subject with factType filter
      const results = await memoir.facts.queryBySubject({
        memorySpaceId: spaceId,
        subject,
        factType: factType as any,
      });

      // Validate
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.factType).toBe(factType);
        expect(fact.subject).toBe(subject);
      });
    });

    it(`exportFacts() should filter by factType="${factType}"`, async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-export-${factType}`;

      // Store target fact
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: factType as any,
        fact: `Test ${factType} fact for export`,
        subject: `export-subject-${factType}`,
        confidence: 85,
        sourceType: "manual",
      });

      // Store different type as noise
      if (factType !== "event") {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "event",
          fact: "Noise fact",
          subject: "noise",
          confidence: 70,
          sourceType: "manual",
        });
      }

      // Execute: Export with factType filter (JSON format)
      const exportData = await memoir.facts.export({
        memorySpaceId: spaceId,
        format: "json",
        factType: factType as any,
      });

      // Validate
      expect(exportData).toBeTruthy();
      expect(exportData.format).toBe("json");
      expect(typeof exportData.data).toBe("string");
      expect(exportData.count).toBeGreaterThanOrEqual(1);

      // Parse JSON and validate factType
      const facts = JSON.parse(exportData.data);
      expect(facts.length).toBeGreaterThanOrEqual(1);
      facts.forEach((fact: any) => {
        expect(fact.factType).toBe(factType);
      });
    });
  });

  describe("Edge Cases", () => {
    it("list() should return empty array when no matches exist", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-empty`;

      // Store only preference facts
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "preference",
        fact: "Only preference fact",
        subject: "test",
        confidence: 85,
        sourceType: "manual",
      });

      // Query for different type
      const results = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: "observation",
      });

      // Should return empty array, not error
      expect(results).toEqual([]);
    });

    it("list() should return all matching results for a factType", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-multiple`;

      // Store 5 identity facts
      for (let i = 0; i < 5; i++) {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "identity",
          fact: `Identity fact ${i}`,
          subject: `test-${i}`,
          confidence: 80 + i,
          sourceType: "manual",
        });
      }

      // Store some noise
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "preference",
        fact: "Noise fact",
        subject: "noise",
        confidence: 90,
        sourceType: "manual",
      });

      // Query for identity
      const results = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: "identity",
      });

      // Should return all 5 identity facts
      expect(results.length).toBe(5);
      results.forEach((fact: any) => {
        expect(fact.factType).toBe("identity");
      });
    });

    it("REGRESSION: 'observation' factType should work in all operations", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-observation-regression`;

      // Store observation fact (this always worked)
      const _obsFact = await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "observation",
        fact: "User observed clicking signup button",
        subject: "user-behavior",
        confidence: 95,
        sourceType: "manual",
      });

      // These operations should all work with observation filter
      // (they would have failed before the bug fix)

      // Test list
      const listResults = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: "observation",
      });
      expect(listResults.length).toBeGreaterThanOrEqual(1);
      expect(listResults.every((f: any) => f.factType === "observation")).toBe(
        true,
      );

      // Test count
      const count = await memoir.facts.count({
        memorySpaceId: spaceId,
        factType: "observation",
      });
      expect(count).toBeGreaterThanOrEqual(1);

      // Test search
      const searchResults = await memoir.facts.search(spaceId, "clicking", {
        factType: "observation",
      });
      expect(searchResults.length).toBeGreaterThanOrEqual(1);

      // Test queryBySubject
      const subjectResults = await memoir.facts.queryBySubject({
        memorySpaceId: spaceId,
        subject: "user-behavior",
        factType: "observation",
      });
      expect(subjectResults.length).toBeGreaterThanOrEqual(1);

      // Test export
      const exportData = await memoir.facts.export({
        memorySpaceId: spaceId,
        format: "json",
        factType: "observation",
      });
      expect(exportData).toBeTruthy();
      expect(exportData.count).toBeGreaterThanOrEqual(1);
    });

    it("should combine factType filter with other filters", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-combine`;
      const targetSubject = "test-combine";
      const targetTags = ["important", "user-pref"];

      // Store target fact with all criteria
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "preference",
        fact: "User prefers dark mode",
        subject: targetSubject,
        tags: targetTags,
        confidence: 90,
        sourceType: "manual",
      });

      // Store preference with wrong subject
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "preference",
        fact: "Different subject preference",
        subject: "different-subject",
        tags: targetTags,
        confidence: 85,
        sourceType: "manual",
      });

      // Store different factType with correct subject/tags
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "identity",
        fact: "Identity with same subject",
        subject: targetSubject,
        tags: targetTags,
        confidence: 85,
        sourceType: "manual",
      });

      // Test: Combine factType + subject filters
      const results = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: "preference",
        subject: targetSubject,
      });

      // Should find facts matching BOTH filters
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.factType).toBe("preference");
        expect(fact.subject).toBe(targetSubject);
      });

      // Test: Combine factType + tags filters
      const resultsWithTags = await memoir.facts.list({
        memorySpaceId: spaceId,
        factType: "preference",
        tags: ["important"],
      });

      // Should find facts matching BOTH filters
      expect(resultsWithTags.length).toBeGreaterThanOrEqual(1);
      resultsWithTags.forEach((fact: any) => {
        expect(fact.factType).toBe("preference");
        expect(fact.tags).toContain("important");
      });
    });

    it("count() should work with and without factType filter", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-count-all`;

      // Store 3 knowledge facts
      for (let i = 0; i < 3; i++) {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "knowledge",
          fact: `Knowledge fact ${i}`,
          subject: "test",
          confidence: 85,
          sourceType: "manual",
        });
      }

      // Store 2 event facts
      for (let i = 0; i < 2; i++) {
        await memoir.facts.store({
          memorySpaceId: spaceId,
          factType: "event",
          fact: `Event fact ${i}`,
          subject: "test",
          confidence: 85,
          sourceType: "manual",
        });
      }

      // Count only knowledge facts
      const knowledgeCount = await memoir.facts.count({
        memorySpaceId: spaceId,
        factType: "knowledge",
      });
      expect(knowledgeCount).toBe(3);

      // Count all facts (no filter)
      const totalCount = await memoir.facts.count({
        memorySpaceId: spaceId,
      });
      expect(totalCount).toBeGreaterThanOrEqual(5);
    });

    it("search() should combine factType and minConfidence filters", async () => {
      const spaceId = `${TEST_MEMSPACE_ID}-search-combined`;
      const searchTerm = "combined";

      // Store high confidence preference
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "preference",
        fact: `${searchTerm} high confidence preference`,
        subject: "test",
        confidence: 95,
        sourceType: "manual",
      });

      // Store low confidence preference
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "preference",
        fact: `${searchTerm} low confidence preference`,
        subject: "test",
        confidence: 60,
        sourceType: "manual",
      });

      // Store high confidence identity (wrong type)
      await memoir.facts.store({
        memorySpaceId: spaceId,
        factType: "identity",
        fact: `${searchTerm} identity`,
        subject: "test",
        confidence: 95,
        sourceType: "manual",
      });

      // Search with both filters
      const results = await memoir.facts.search(spaceId, searchTerm, {
        factType: "preference",
        minConfidence: 90,
      });

      // Should only find high confidence preference
      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((fact: any) => {
        expect(fact.factType).toBe("preference");
        expect(fact.confidence).toBeGreaterThanOrEqual(90);
      });
    });
  });
});
