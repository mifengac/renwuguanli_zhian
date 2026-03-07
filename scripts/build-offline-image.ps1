$ErrorActionPreference = "Stop"

$ImageName = "zhian-renwuguanli:0307"
$TarName = "zhian-renwuguanli-0307.tar"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OracleDir = Join-Path $ProjectRoot "instantclient_11_2"
$RequiredPatterns = @(
  "libclntsh.so*",
  "libnnz*.so",
  "libocci.so*"
)

if (-not (Test-Path $OracleDir)) {
  throw "Oracle client directory not found: $OracleDir"
}

$MissingPatterns = $RequiredPatterns | Where-Object {
  @(Get-ChildItem -Path (Join-Path $OracleDir $_) -ErrorAction SilentlyContinue).Count -eq 0
}

if ($MissingPatterns.Count -gt 0) {
  throw "Oracle Instant Client is incomplete. Missing patterns: $($MissingPatterns -join ', ')"
}

docker build --pull --tag $ImageName $ProjectRoot
docker save --output (Join-Path $ProjectRoot $TarName) $ImageName

Write-Host "Image exported: $(Join-Path $ProjectRoot $TarName)"
