# CACHEFLOW PowerShell Launcher
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  CACHEFLOW — Multi-Level Hardware Cache Simulator" -ForegroundColor White
Write-Host "  DSA Semester Project Launcher" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$exePath = Join-Path $PSScriptRoot "cache_engine.exe"

if (-not (Test-Path $exePath)) {
    Write-Host "[INFO] cache_engine.exe not found. Compiling backend..." -ForegroundColor Yellow
    $compiler = "C:\Program Files (x86)\Dev-Cpp\MinGW64\bin\g++.exe"
    if (-not (Test-Path $compiler)) {
        $compiler = "g++"
    }
    & $compiler -std=c++11 -O2 "$PSScriptRoot\backend\main.cpp" -o "$exePath" -lws2_32
}

if (-not (Test-Path $exePath)) {
    Write-Host "[ERROR] Could not build cache_engine.exe" -ForegroundColor Red
    Exit 1
}

Write-Host "[INFO] Launching browser: http://localhost:8080" -ForegroundColor Green
Start-Process "http://localhost:8080"

Write-Host "[INFO] Starting C++ Engine on port 8080..." -ForegroundColor Cyan
& $exePath 8080

