$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
Push-Location $projectPath
try {
    New-Item -ItemType Directory -Force build-tests | Out-Null
    g++ -std=c++11 -Wall -Wextra -Werror -Iinclude -Isrc test/test_logic.cpp -o build-tests/test_logic.exe
    if ($LASTEXITCODE -ne 0) { throw 'Host test compilation failed' }
    & ./build-tests/test_logic.exe
    if ($LASTEXITCODE -ne 0) { throw 'Host tests failed' }
} finally {
    Pop-Location
}
