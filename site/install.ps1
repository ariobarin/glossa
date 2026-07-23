Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-GlossaInstaller {
    if ($env:OS -ne "Windows_NT") {
        throw "Glossa currently supports Windows."
    }

    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) {
        throw "Node.js 22.9 or newer is required. Install Node.js, then run this command again."
    }
    $nodeText = (& $node.Source --version).Trim()
    if ($LASTEXITCODE -ne 0 -or $nodeText -notmatch '^v(\d+)\.(\d+)\.(\d+)') {
        throw "Glossa could not determine the installed Node.js version."
    }
    $nodeVersion = [version]"$($Matches[1]).$($Matches[2]).$($Matches[3])"
    if ($nodeVersion -lt [version]"22.9.0") {
        throw "Glossa requires Node.js 22.9 or newer. Found $nodeText."
    }

    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) {
        throw "npm is required. Repair the Node.js installation, then run this command again."
    }

    Write-Host "Installing the Glossa beta..."
    & $npm.Source install --global "@ariobarin/glossa@beta"
    if ($LASTEXITCODE -ne 0) {
        throw "npm could not install Glossa."
    }

    $prefix = (& $npm.Source prefix --global).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $prefix) {
        throw "Glossa was installed, but npm did not report its global prefix."
    }
    $glossa = Join-Path $prefix "glossa.cmd"
    if (-not (Test-Path -LiteralPath $glossa)) {
        throw "Glossa was installed, but $glossa was not found."
    }

    $version = (& $glossa --version).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $version) {
        throw "Glossa was installed, but its version check failed."
    }

    Write-Host "Installed Glossa $version."
    Write-Host "Next: run glossa doctor"
}

Invoke-GlossaInstaller
