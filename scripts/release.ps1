# Quick Release Script for Memoir SDK
# Usage: .\scripts\release.ps1 [version]
# Example: .\scripts\release.ps1 0.2.0

param(
    [string]$Version = ""
)

# Get version from package.json if not provided
if ($Version -eq "") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    $Version = $packageJson.version
    Write-Host "Using version from package.json: $Version" -ForegroundColor Cyan
}

Write-Host "`n🚀 Starting release process for v$Version...`n" -ForegroundColor Green

# Step 1: Run tests
Write-Host "📋 Step 1: Running tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tests failed! Fix errors before releasing." -ForegroundColor Red
    exit 1
}
Write-Host "✅ All tests passed!`n" -ForegroundColor Green

# Step 2: Build
Write-Host "📦 Step 2: Building package..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build successful!`n" -ForegroundColor Green

# Step 3: Verify package
Write-Host "🔍 Step 3: Verifying package contents..." -ForegroundColor Yellow
npm pack --dry-run
Write-Host ""

# Step 4: Confirm
$confirm = Read-Host "Ready to publish v$Version? (y/n)"
if ($confirm -ne "y") {
    Write-Host "❌ Release cancelled" -ForegroundColor Red
    exit 0
}

# Step 5: Git commit and tag
Write-Host "`n📝 Step 5: Committing and tagging..." -ForegroundColor Yellow
git add package.json CHANGELOG.md src/ convex-dev/ tests/
git commit -m "chore: release v$Version"
git push origin main
git tag -a "v$Version" -m "Release v$Version"
git push origin "v$Version"
Write-Host "✅ Git tagged and pushed!`n" -ForegroundColor Green

# Step 6: Publish to npm
Write-Host "📤 Step 6: Publishing to npm..." -ForegroundColor Yellow
npm publish --access public
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ npm publish failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Published to npm!`n" -ForegroundColor Green

# Step 7: Create GitHub release
Write-Host "🎉 Step 7: Creating GitHub release..." -ForegroundColor Yellow
gh release create "v$Version" --title "v$Version" --generate-notes --latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ GitHub release failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ GitHub release created!`n" -ForegroundColor Green

# Step 8: Verify
Write-Host "🔍 Step 8: Verifying release..." -ForegroundColor Yellow
Write-Host "npm view @getmemoir/sdk version" -ForegroundColor Cyan
npm view @getmemoir/sdk version
Write-Host ""

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  ✅ RELEASE COMPLETE!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "`n📦 Package: @getmemoir/sdk@$Version" -ForegroundColor Cyan
Write-Host "📚 npm: https://www.npmjs.com/package/@getmemoir/sdk" -ForegroundColor Cyan
Write-Host "🐙 GitHub: https://github.com/Anu-Code07/memoir/releases/tag/v$Version`n" -ForegroundColor Cyan

