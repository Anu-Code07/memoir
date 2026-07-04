#!/usr/bin/env node

/**
 * Memoir CLI Preuninstall Script
 *
 * Removes shell completion configuration when the CLI is uninstalled.
 * Cleans up ~/.memoir/completions/ and removes source lines from shell RC files.
 *
 * This script runs before `npm uninstall -g @getmemoir/cli`
 */

import { existsSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const home = homedir();

// Marker comments for identifying our additions
const MARKER_START = '# >>> memoir completion >>>';
const MARKER_END = '# <<< memoir completion <<<';

/**
 * Get the target directory for completion scripts (~/.memoir/completions/)
 */
function getTargetDir() {
  return join(home, '.memoir', 'completions');
}

/**
 * Get shell RC file paths to clean up
 */
function getShellRcPaths() {
  return [
    join(home, '.zshrc'),
    join(home, '.bashrc'),
    join(home, '.bash_profile'),
    join(home, '.config', 'fish', 'config.fish'),
  ];
}

/**
 * Remove completion block from a shell RC file
 */
function removeCompletionFromRc(rcPath) {
  if (!existsSync(rcPath)) {
    return;
  }

  const content = readFileSync(rcPath, 'utf-8');

  // Check if our completion setup exists
  if (!content.includes(MARKER_START)) {
    return;
  }

  // Remove the completion block (including markers and content between them)
  const regex = new RegExp(
    `\\n?${escapeRegex(MARKER_START)}[\\s\\S]*?${escapeRegex(MARKER_END)}\\n?`,
    'g'
  );

  const newContent = content.replace(regex, '\n');

  // Write cleaned content back
  writeFileSync(rcPath, newContent, 'utf-8');
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove completion scripts directory
 */
function removeCompletionsDir() {
  const targetDir = getTargetDir();
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  // Also remove parent .memoir directory if empty
  const memoirDir = join(home, '.memoir');
  if (existsSync(memoirDir)) {
    try {
      const files = readdirSync(memoirDir);
      if (files.length === 0) {
        rmSync(memoirDir, { recursive: true, force: true });
      }
    } catch {
      // Directory not empty or other error, leave it
    }
  }
}

/**
 * Main uninstall function
 */
function main() {
  // Skip if running in CI
  if (process.env.CI || process.env.MEMOIR_SKIP_COMPLETION) {
    return;
  }

  try {
    // Remove completion setup from all shell RC files
    const rcPaths = getShellRcPaths();
    for (const rcPath of rcPaths) {
      removeCompletionFromRc(rcPath);
    }

    // Remove completion scripts directory
    removeCompletionsDir();
  } catch {
    // Silently fail - cleanup is not critical
  }
}

main();
