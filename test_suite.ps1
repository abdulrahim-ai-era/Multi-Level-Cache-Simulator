$ErrorActionPreference = "Stop"

Write-Host "=========================================="
Write-Host "  CACHEFLOW Automated End-to-End Test Suite"
Write-Host "=========================================="

$port = 8085
$exe = Join-Path $PSScriptRoot "cache_engine.exe"

# Start backend in background on test port 8085
$proc = Start-Process -FilePath $exe -ArgumentList $port -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2

try {
    # 1. Test Static Serving
    Write-Host "[TEST 1] Testing static HTML serving..."
    $html = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing
    if ($html.StatusCode -eq 200 -and $html.Content -like "*CACHEFLOW*") {
        Write-Host "  -> PASS: Frontend index.html served correctly." -ForegroundColor Green
    } else {
        throw "Failed to serve index.html"
    }

    # 2. Test /api/status
    Write-Host "[TEST 2] Testing /api/status initial state..."
    $status = Invoke-RestMethod -Uri "http://localhost:$port/api/status"
    if ($status.status -eq "ok" -and $status.metrics.totalRequests -eq 0) {
        Write-Host "  -> PASS: Initial engine state verified." -ForegroundColor Green
    } else {
        throw "Failed /api/status test"
    }

    # 3. Test RAM Miss on new address
    Write-Host "[TEST 3] Testing RAM Miss on first access (0x3A1F)..."
    $body = @{ address = "0x3A1F" } | ConvertTo-Json
    $res1 = Invoke-RestMethod -Uri "http://localhost:$port/api/request" -Method Post -Body $body -ContentType "application/json"
    if ($res1.latestOperation.result -eq "RAM_MISS" -and $res1.latestOperation.accessTimeNs -eq 105) {
        Write-Host "  -> PASS: Correct RAM_MISS returned (105 ns)." -ForegroundColor Green
    } else {
        throw "Failed RAM Miss test"
    }

    # 4. Test L1 Hit on repeat address
    Write-Host "[TEST 4] Testing L1 Hit on immediate repeat access (0x3A1F)..."
    $res2 = Invoke-RestMethod -Uri "http://localhost:$port/api/request" -Method Post -Body $body -ContentType "application/json"
    if ($res2.latestOperation.result -eq "L1_HIT" -and $res2.latestOperation.accessTimeNs -eq 1) {
        Write-Host "  -> PASS: Correct L1_HIT returned (1 ns)." -ForegroundColor Green
    } else {
        throw "Failed L1 Hit test"
    }

    # 5. Test L1 Capacity and Demotion to L2
    Write-Host "[TEST 5] Testing L1 capacity overflow and demotion into L2..."
    $addresses = @("0x1000", "0x2000", "0x3000", "0x4000")
    foreach ($addr in $addresses) {
        $b = @{ address = $addr } | ConvertTo-Json
        $null = Invoke-RestMethod -Uri "http://localhost:$port/api/request" -Method Post -Body $b -ContentType "application/json"
    }

    # Check status: L1 should have 4 items, L2 should have demoted items
    $statusAfter = Invoke-RestMethod -Uri "http://localhost:$port/api/status"
    Write-Host "  -> L1 count: $($statusAfter.l1.Count), L2 count: $($statusAfter.l2.Count)"
    if ($statusAfter.l1.Count -eq 4 -and $statusAfter.l2.Count -gt 0) {
        Write-Host "  -> PASS: Demotion from L1 to L2 successfully verified." -ForegroundColor Green
    } else {
        throw "Failed demotion test"
    }

    # 6. Test Multi-Policy Comparison Benchmark
    Write-Host "[TEST 6] Testing Multi-Policy Comparison (/api/compare)..."
    $cmpBody = @{
        sequence = @("0x1000", "0x2000", "0x3000", "0x4000", "0x1000", "0x5000", "0x1000")
        l1Capacity = 4
        l2Capacity = 8
    } | ConvertTo-Json
    $cmpRes = Invoke-RestMethod -Uri "http://localhost:$port/api/compare" -Method Post -Body $cmpBody -ContentType "application/json"
    if ($cmpRes.status -eq "ok" -and $cmpRes.lru -and $cmpRes.fifo -and $cmpRes.lfu) {
        Write-Host "  -> PASS: LRU, FIFO, and LFU comparison benchmark executed cleanly." -ForegroundColor Green
        Write-Host "     LRU Hit Rate:  $($cmpRes.lru.overallHitRate)%"
        Write-Host "     FIFO Hit Rate: $($cmpRes.fifo.overallHitRate)%"
        Write-Host "     LFU Hit Rate:  $($cmpRes.lfu.overallHitRate)%"
    } else {
        throw "Failed comparison test"
    }

    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "  ALL 6 TESTS PASSED WITH 100% SUCCESS!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
}
finally {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

