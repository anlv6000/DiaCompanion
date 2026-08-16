param(
    [switch]$WithDatabase,
    [switch]$Coverage
)

$ErrorActionPreference = "Stop"
$project = Join-Path $PSScriptRoot "DiaCompanion.Tests.csproj"
$results = Join-Path $PSScriptRoot "TestResults"

New-Item -ItemType Directory -Force -Path $results | Out-Null

$arguments = @(
    "test",
    $project,
    "--logger", "trx;LogFileName=DiaCompanion.Tests.trx",
    "--results-directory", $results
)

if (-not $WithDatabase) {
    $arguments += @("--filter", "Level!=L2-Database")
}

if ($Coverage) {
    $arguments += '--collect:XPlat Code Coverage'
}

& dotnet @arguments
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

