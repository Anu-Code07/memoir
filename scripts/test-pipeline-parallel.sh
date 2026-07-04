#!/bin/bash
set -e

# Advanced Local Pipeline Test Script  
# Compatible with macOS default bash (3.2+)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          ADVANCED LOCAL PIPELINE SIMULATOR                     ║"
echo "║   Runs parallel Python + TypeScript test suites               ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load .env.local
if [ -f ".env.local" ]; then
    while IFS='=' read -r key value; do
        if [[ $key =~ ^[A-Z_]+ ]]; then
            value=$(echo "$value" | sed 's/#.*$//' | xargs)
            export "$key=$value"
        fi
    done < .env.local
fi

# Check for local Convex
if [ -z "$LOCAL_CONVEX_URL" ]; then
    echo -e "${RED}✗ LOCAL_CONVEX_URL not set${NC}"
    exit 1
fi

PYTHON_PARALLEL=${1:-5}
TS_PARALLEL=${2:-3}
RUN_PACKAGES=${3:-true}  # Third arg: include package tests (default: true)
TOTAL_JOBS=$((PYTHON_PARALLEL + TS_PARALLEL))

if [ "$RUN_PACKAGES" == "true" ]; then
    TOTAL_JOBS=$((TOTAL_JOBS + 2))  # +2 for Vercel AI Provider + CLI
fi

echo -e "${CYAN}🔍 Config: $TOTAL_JOBS jobs ($TS_PARALLEL TS + $PYTHON_PARALLEL Python"
if [ "$RUN_PACKAGES" == "true" ]; then
    echo -e "             + 1 Vercel AI Provider + 1 CLI)${NC}"
else
    echo -e ")${NC}"
fi
echo ""

# Purge
echo -e "${CYAN}🧹 Purging database...${NC}"
npx tsx scripts/cleanup-test-data.ts $LOCAL_CONVEX_URL 2>&1 | grep -E "✅|TOTAL"
echo ""

# Launch tests
LOGS_DIR=$(mktemp -d)
echo -e "${CYAN}📦 Launching TypeScript SDK ($TS_PARALLEL runs)...${NC}"

for i in $(seq 1 $TS_PARALLEL); do
    (CONVEX_TEST_MODE=local npm test > "$LOGS_DIR/ts-$i.log" 2>&1; echo $? > "$LOGS_DIR/ts-$i.exit") &
    echo "   Run $i (PID: $!)"
done

echo ""
echo -e "${CYAN}🐍 Launching Python SDK ($PYTHON_PARALLEL runs)...${NC}"

for i in $(seq 1 $PYTHON_PARALLEL); do
    (cd memoir-sdk-python && CONVEX_URL=$LOCAL_CONVEX_URL CONVEX_TEST_MODE=local pytest tests/ -q > "$LOGS_DIR/python-$i.log" 2>&1; echo $? > "$LOGS_DIR/python-$i.exit") &
    echo "   Run $i (PID: $!)"
done

# Package tests (run once each in parallel with SDK tests)
if [ "$RUN_PACKAGES" == "true" ]; then
    echo ""
    echo -e "${CYAN}⚡ Launching Vercel AI Provider tests...${NC}"
    (
        npm run build > /dev/null 2>&1
        cd packages/vercel-ai-provider
        npm install > /dev/null 2>&1
        npm test > "$LOGS_DIR/vercel-ai.log" 2>&1
        echo $? > "$LOGS_DIR/vercel-ai.exit"
    ) &
    echo "   Started (PID: $!)"

    echo ""
    echo -e "${CYAN}🔧 Launching CLI tests (⚠ hits DB - may conflict!)...${NC}"
    (
        npm run build > /dev/null 2>&1
        cd packages/memoir-cli
        npm install > /dev/null 2>&1
        npm run test:unit > "$LOGS_DIR/cli-unit.tmp" 2>&1
        CONVEX_URL=$LOCAL_CONVEX_URL npm run test:integration >> "$LOGS_DIR/cli.log" 2>&1
        cat "$LOGS_DIR/cli-unit.tmp" >> "$LOGS_DIR/cli.log"
        echo $? > "$LOGS_DIR/cli.exit"
    ) &
    echo "   Started (PID: $!)"
fi

echo ""
echo -e "${CYAN}⏳ Waiting for completion...${NC}"

# Wait for all background jobs
wait

# Check results
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}RESULTS${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

ALL_PASSED=true

echo -e "${CYAN}TypeScript SDK:${NC}"
for i in $(seq 1 $TS_PARALLEL); do
    exit_code=$(cat "$LOGS_DIR/ts-$i.exit" 2>/dev/null || echo 1)
    if [ $exit_code -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Run $i"
    else
        echo -e "   ${RED}✗${NC} Run $i"
        ALL_PASSED=false
    fi
done

echo ""
echo -e "${CYAN}Python SDK:${NC}"
for i in $(seq 1 $PYTHON_PARALLEL); do
    exit_code=$(cat "$LOGS_DIR/python-$i.exit" 2>/dev/null || echo 1)
    if [ $exit_code -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Run $i"
    else
        echo -e "   ${RED}✗${NC} Run $i"
        ALL_PASSED=false
    fi
done

# Package tests results
if [ "$RUN_PACKAGES" == "true" ]; then
    echo ""
    echo -e "${CYAN}Package Tests:${NC}"
    
    # Vercel AI Provider
    exit_code=$(cat "$LOGS_DIR/vercel-ai.exit" 2>/dev/null || echo 1)
    if [ $exit_code -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Vercel AI Provider"
    else
        echo -e "   ${RED}✗${NC} Vercel AI Provider"
        ALL_PASSED=false
    fi
    
    # CLI
    exit_code=$(cat "$LOGS_DIR/cli.exit" 2>/dev/null || echo 1)
    if [ $exit_code -eq 0 ]; then
        echo -e "   ${GREEN}✓${NC} Memoir CLI"
    else
        echo -e "   ${RED}✗${NC} Memoir CLI (may have DB conflicts)"
        ALL_PASSED=false
    fi
fi

echo ""

if [ "$ALL_PASSED" = "true" ]; then
    echo -e "${GREEN}✅ ALL $TOTAL_JOBS PARALLEL TESTS PASSED${NC}"
    echo "   Logs: $LOGS_DIR"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED${NC}"
    echo "   Check logs: $LOGS_DIR"
    echo ""
    echo "   Usage: ./scripts/test-pipeline-parallel.sh [PYTHON_RUNS] [TS_RUNS] [RUN_PACKAGES]"
    echo "   Example: ./scripts/test-pipeline-parallel.sh 3 2 false  # Skip package tests"
    exit 1
fi
