/**
 * CACHEFLOW — Lightweight HTML5 Canvas Chart Renderer
 * Self-contained charts for Analytics timeline and Policy Comparison.
 * Zero external CDN dependencies, runs 100% offline.
 */

const CacheCharts = (function() {
    let lastHistoryData = null;
    let lastCmpData = null;

    /**
     * Resizes canvas buffer to match its CSS container width cleanly (Retina/Mobile sharp)
     */
    function fitCanvasToParent(canvas) {
        if (!canvas || !canvas.parentElement) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        const targetW = Math.floor(rect.width) || canvas.clientWidth || 320;
        if (targetW > 50 && Math.abs(canvas.width - targetW) > 5) {
            canvas.width = targetW;
        }
    }

    /**
     * Draws the latency over time line chart
     */
    function renderTimeline(canvasId, historyData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        fitCanvasToParent(canvas);

        if (historyData !== undefined) lastHistoryData = historyData;
        const data = historyData || lastHistoryData;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const isMobile = width < 520;
        const padLeft = isMobile ? 38 : 45;
        const padRight = isMobile ? 12 : 20;
        const padTop = 20;
        const padBottom = 30;

        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        // Draw grid lines
        ctx.strokeStyle = 'rgba(45, 85, 130, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        const yLevels = [0, 25, 50, 75, 105];
        ctx.fillStyle = '#576A84';
        ctx.font = isMobile ? '9px "JetBrains Mono", monospace' : '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';

        yLevels.forEach(val => {
            const y = padTop + chartH - (val / 110) * chartH;
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(width - padRight, y);
            ctx.stroke();
            ctx.fillText(`${val}ns`, padLeft - 6, y + 3);
        });

        ctx.setLineDash([]);

        if (!data || data.length === 0) {
            ctx.fillStyle = '#576A84';
            ctx.font = isMobile ? '10px "Inter", sans-serif' : '12px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No history data yet. Execute operations to plot latency waveform.', width / 2, height / 2);
            return;
        }

        const points = data.slice(-30); // show last 30 requests
        const stepX = chartW / Math.max(points.length - 1, 1);

        // Draw fill gradient
        const gradient = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
        gradient.addColorStop(0, 'rgba(0, 217, 255, 0.35)');
        gradient.addColorStop(1, 'rgba(0, 217, 255, 0.0)');

        ctx.beginPath();
        points.forEach((pt, idx) => {
            const x = padLeft + idx * stepX;
            const y = padTop + chartH - (Math.min(pt.accessTimeNs, 110) / 110) * chartH;
            if (idx === 0) {
                ctx.moveTo(x, padTop + chartH);
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        const lastX = padLeft + (points.length - 1) * stepX;
        ctx.lineTo(lastX, padTop + chartH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = '#00D9FF';
        ctx.lineWidth = 2.5;

        points.forEach((pt, idx) => {
            const x = padLeft + idx * stepX;
            const y = padTop + chartH - (Math.min(pt.accessTimeNs, 110) / 110) * chartH;
            if (idx === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw point circles
        points.forEach((pt, idx) => {
            const x = padLeft + idx * stepX;
            const y = padTop + chartH - (Math.min(pt.accessTimeNs, 110) / 110) * chartH;

            ctx.beginPath();
            ctx.arc(x, y, isMobile ? 3 : 4, 0, Math.PI * 2);
            if (pt.result === 'L1_HIT') {
                ctx.fillStyle = '#00E5A3';
            } else if (pt.result === 'L2_HIT') {
                ctx.fillStyle = '#0088FF';
            } else {
                ctx.fillStyle = '#EF4444';
            }
            ctx.fill();
            ctx.strokeStyle = '#061426';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        });
    }

    /**
     * Draws the Comparison multi-bar chart (LRU vs FIFO vs LFU vs ADAPTIVE)
     */
    function renderComparison(canvasId, cmpData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        fitCanvasToParent(canvas);

        if (cmpData !== undefined) lastCmpData = cmpData;
        const data = cmpData || lastCmpData;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        if (!data || !data.lru) {
            ctx.fillStyle = '#576A84';
            ctx.font = width < 520 ? '10px "Inter", sans-serif' : '12px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No benchmark run yet. Load a sequence and click "Run Multi-Policy Benchmark".', width / 2, height / 2);
            return;
        }

        const isMobile = width < 520;
        const isTiny = width < 400;

        const padLeft = isTiny ? 28 : (isMobile ? 36 : 60);
        const padRight = isTiny ? 12 : (isMobile ? 18 : 30);
        const padTop = 30;
        const padBottom = isMobile ? 46 : 40;

        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        // Categories: Hit Rate (%), Avg Latency (ns), Evictions
        const policies = [
            { name: 'LRU', color: '#00E5A3', data: data.lru },
            { name: 'FIFO', color: '#0088FF', data: data.fifo },
            { name: 'LFU', color: '#A855F7', data: data.lfu }
        ];

        if (data.adaptive) {
            policies.push({ name: 'ADAPTIVE', color: '#00D9FF', data: data.adaptive });
        }

        // Draw hit rate comparison bars
        const groupWidth = chartW / 3;
        const barCount = policies.length;
        const barGap = isTiny ? 2 : (isMobile ? 3 : 4);
        
        // Dynamically compute bar width so bars never overflow group
        const availWidth = groupWidth - 10;
        const calculatedBarW = Math.floor((availWidth - (barCount - 1) * barGap) / barCount);
        const barWidth = Math.max(6, Math.min(barCount === 4 ? 20 : 26, calculatedBarW));
        const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;

        const maxEvictions = Math.max(
            data.lru ? data.lru.totalEvictions : 0,
            data.fifo ? data.fifo.totalEvictions : 0,
            data.lfu ? data.lfu.totalEvictions : 0,
            data.adaptive ? data.adaptive.totalEvictions : 0,
            5
        );

        const metricsList = [
            { key: 'overallHitRate', label: isTiny ? 'Hit Rate' : 'Hit Rate (%)', max: 100 },
            { key: 'avgAccessTimeNs', label: isTiny ? 'Latency' : (isMobile ? 'Avg Latency' : 'Avg Latency (ns)'), max: 110 },
            { key: 'totalEvictions', label: isTiny ? 'Evictions' : 'Total Evictions', max: maxEvictions }
        ];

        metricsList.forEach((metric, mIdx) => {
            const groupX = padLeft + mIdx * groupWidth + (groupWidth - totalBarsWidth) / 2;

            // Metric label
            ctx.fillStyle = '#8B9BB4';
            ctx.font = isTiny ? '8.5px "Inter", sans-serif' : (isMobile ? '10px "Inter", sans-serif' : '11px "Inter", sans-serif');
            ctx.textAlign = 'center';
            ctx.fillText(metric.label, groupX + totalBarsWidth / 2, height - (isMobile ? 10 : 12));

            policies.forEach((p, pIdx) => {
                const val = p.data ? (p.data[metric.key] || 0) : 0;
                const barH = Math.max(2, (val / metric.max) * (chartH - 24));
                const x = groupX + pIdx * (barWidth + barGap);
                const y = padTop + chartH - barH;

                // Bar
                ctx.fillStyle = p.color;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(x, y, barWidth, barH, [3, 3, 0, 0]);
                } else {
                    ctx.rect(x, y, barWidth, barH);
                }
                ctx.fill();

                // Value on top
                ctx.fillStyle = '#FFFFFF';
                ctx.font = isTiny ? '7px "JetBrains Mono", monospace' : (isMobile ? '8px "JetBrains Mono", monospace' : '9px "JetBrains Mono", monospace');
                ctx.textAlign = 'center';
                const formattedVal = metric.key === 'overallHitRate' ? `${val.toFixed(0)}%` : (metric.key === 'avgAccessTimeNs' ? `${val.toFixed(1)}` : `${val}`);
                ctx.fillText(formattedVal, x + barWidth / 2, y - 4);
            });
        });
    }

    return {
        renderTimeline,
        renderComparison,
        resizeCharts() {
            renderTimeline('timelineChart');
            renderComparison('comparisonChart');
        }
    };
})();

