@echo off
title CACHEFLOW - Multi-Level Cache Simulator
echo ========================================================
echo   CACHEFLOW — Multi-Level Hardware Cache Simulator
echo   DSA Semester Project Launcher
echo ========================================================
echo.

if not exist cache_engine.exe (
    echo [INFO] cache_engine.exe not found. Building now...
    call compile.bat
)

if not exist cache_engine.exe (
    echo [ERROR] Failed to find or build cache_engine.exe.
    pause
    exit /b 1
)

echo [INFO] Starting CACHEFLOW Native C++ Engine Server...
echo [INFO] Listening at http://localhost:8080
echo.

start "" "http://localhost:8080"
cache_engine.exe 8080

