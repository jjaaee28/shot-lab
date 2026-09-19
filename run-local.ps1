$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$bundledRoot = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node'
if ($nodeCommand) { $shotNode = $nodeCommand.Source } else { $shotNode = Join-Path $bundledRoot 'bin/node.exe' }
if (-not (Test-Path -LiteralPath $shotNode)) { throw 'Node.js 20.9+ is required. Install Node.js LTS and run this file again.' }
$env:PATH = (Split-Path $shotNode) + ';' + $env:PATH
$env:NEXT_TELEMETRY_DISABLED = '1'
if (-not (Test-Path 'node_modules/next/dist/bin/next')) {
  $bundledPnpm = Join-Path $bundledRoot 'node_modules/pnpm/bin/pnpm.cjs'
  if (Test-Path $bundledPnpm) { & $shotNode $bundledPnpm install --frozen-lockfile }
  else { npm.cmd install }
  if ($LASTEXITCODE -ne 0) { throw 'Package installation failed.' }
}
Write-Host 'SHOT LAB - Open the Local URL below. Press Ctrl+C to stop.'
& $shotNode 'node_modules/next/dist/bin/next' dev --hostname 127.0.0.1 --port 3000
