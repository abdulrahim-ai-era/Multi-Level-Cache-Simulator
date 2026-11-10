$ErrorActionPreference = "Stop"

Write-Host "=========================================="
Write-Host "  CACHEFLOW Test Suite: RAM Found & ADAPTIVE"
Write-Host "=========================================="

$port = 8086
$exe = Join-Path $PSScriptRoot "cache_engine.exe"

$proc = Start-Process -FilePath $exe -ArgumentList $port -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

try {
    # 1. Test Static Serving
    Write-Host "[TEST 1] Testing static HTML serving..."
    $html = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing
    if ($html.StatusCode -eq 200 -and $html.Content -like "*RAM Found*") {
        Write-Host "  -> PASS: Frontend index.html with 'RAM Found' served correctly." -ForegroundColor Green
    } else {
        throw "Failed to serve index.html with RAM Found"
    }

    # 2. Test RAM HIT (RAM Found)
    Write-Host "[TEST 2] Testing RAM Found on first access (0x3A1F)..."
    $body = @{ address = "0x3A1F" } | ConvertTo-Json
    $res1 = Invoke-RestMethod -Uri "http://localhost:$port/api/request" -Method Post -Body $body -ContentType "application/json"
    if ($res1.latestOperation.result -eq "RAM_HIT" -and $res1.latestOperation.accessTimeNs -eq 105) {
        Write-Host "  -> PASS: Correct RAM_HIT (RAM Found) returned (105 ns)." -ForegroundColor Green
    } else {
        throw "Failed RAM Found test"
    }

    # 3. Test ADAPTIVE Policy Switching
    Write-Host "[TEST 3] Testing ADAPTIVE policy setting..."
    $cfg = @{ policy = "ADAPTIVE"; l1Capacity = 4; l2Capacity = 8 } | ConvertTo-Json
    $resCfg = Invoke-RestMethod -Uri "http://localhost:$port/api/config" -Method Post -Body $cfg -ContentType "application/json"
    if ($resCfg.policy -eq "ADAPTIVE") {
        Write-Host "  -> PASS: Simulator successfully configured to ADAPTIVE mode." -ForegroundColor Green
    } else {
        throw "Failed to set ADAPTIVE policy"
    }

    # 4. Test Multi-Policy 4-Way Comparison
    Write-Host "[TEST 4] Testing 4-way comparison (/api/compare with ADAPTIVE)..."
    $cmpBody = @{
        sequence = @("0x1000", "0x2000", "0x3000", "0x4000", "0x1000", "0x5000", "0x1000")
        l1Capacity = 4
        l2Capacity = 8
    } | ConvertTo-Json
    $cmpRes = Invoke-RestMethod -Uri "http://localhost:$port/api/compare" -Method Post -Body $cmpBody -ContentType "application/json"
    if ($cmpRes.lru -and $cmpRes.fifo -and $cmpRes.lfu -and $cmpRes.adaptive) {
        Write-Host "  -> PASS: 4-way comparison (LRU, FIFO, LFU, ADAPTIVE) benchmark successful!" -ForegroundColor Green
        Write-Host "     LRU Hit Rate:      $($cmpRes.lru.overallHitRate)%"
        Write-Host "     FIFO Hit Rate:     $($cmpRes.fifo.overallHitRate)%"
        Write-Host "     LFU Hit Rate:      $($cmpRes.lfu.overallHitRate)%"
        Write-Host "     ADAPTIVE Hit Rate: $($cmpRes.adaptive.overallHitRate)%"
    } else {
        throw "Failed 4-way comparison test"
    }

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  ALL TESTS PASSED WITH 100% SUCCESS!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
}
finally {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
