$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"

genvm-lint check contracts/charter.py
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

genvm-lint check contracts/treasury.py
exit $LASTEXITCODE
