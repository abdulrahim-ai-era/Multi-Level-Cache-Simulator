/**
 * CACHEFLOW — Lightweight HTML5 Canvas Chart Renderer
 * Self-contained charts for Analytics timeline and Policy Comparison.
 * Zero external CDN dependencies, runs 100% offline.
 */

const CacheCharts = (function() {
    /**
     * Draws the latency over time line chart
     */
    function renderTimeline(canvasId, historyData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const padLeft = 45;
        const padRight = 20;
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
        ctx.font = '10px "JetBrains Mono", monospace';
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

        if (!historyData || historyData.length === 0) {
            ctx.fillStyle = '#576A84';
            ctx.font = '12px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No history data yet. Execute operations to plot latency waveform.', width / 2, height / 2);
            return;
        }

        const points = historyData.slice(-30); // show last 30 requests
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
            ctx.arc(x, y, 4, 0, Math.PI * 2);
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
     * Draws the Comparison multi-bar chart (LRU vs FIFO vs LFU)
     */
    function renderComparison(canvasId, cmpData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        if (!cmpData || !cmpData.lru) {
            ctx.fillStyle = '#576A84';
            ctx.font = '12px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No benchmark run yet. Load a sequence and click "Run Multi-Policy Benchmark".', width / 2, height / 2);
            return;
        }

        const padLeft = 60;
        const padRight = 30;
        const padTop = 30;
        const padBottom = 40;

        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        // Categories: Hit Rate (%), Avg Latency (ns), Evictions
        const policies = [
            { name: 'LRU', color: '#00E5A3', data: cmpData.lru },
            { name: 'FIFO', color: '#0088FF', data: cmpData.fifo },
            { name: 'LFU', color: '#A855F7', data: cmpData.lfu }
        ];

        if (cmpData.adaptive) {
            policies.push({ name: 'ADAPTIVE', color: '#00D9FF', data: cmpData.adaptive });
        }

        // Draw hit rate comparison bars
        const groupWidth = chartW / 3;
        const barCount = policies.length;
        const barWidth = barCount === 4 ? 20 : 26;
        const barGap = 4;
        const totalBarsWidth = barCount * barWidth + (barCount - 1) * barGap;

        const maxEvictions = Math.max(
            cmpData.lru ? cmpData.lru.totalEvictions : 0,
            cmpData.fifo ? cmpData.fifo.totalEvictions : 0,
            cmpData.lfu ? cmpData.lfu.totalEvictions : 0,
            cmpData.adaptive ? cmpData.adaptive.totalEvictions : 0,
            5
        );

        const metricsList = [
            { key: 'overallHitRate', label: 'Overall Hit Rate (%)', max: 100 },
            { key: 'avgAccessTimeNs', label: 'Avg Latency (ns)', max: 110 },
            { key: 'totalEvictions', label: 'Total Evictions', max: maxEvictions }
        ];

        metricsList.forEach((metric, mIdx) => {
            const groupX = padLeft + mIdx * groupWidth + (groupWidth - totalBarsWidth) / 2;

            // Metric label
            ctx.fillStyle = '#8B9BB4';
            ctx.font = '11px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(metric.label, groupX + totalBarsWidth / 2, height - 12);

            policies.forEach((p, pIdx) => {
                const val = p.data ? (p.data[metric.key] || 0) : 0;
                const barH = (val / metric.max) * (chartH - 20);
                const x = groupX + pIdx * (barWidth + barGap);
                const y = padTop + chartH - barH;

                // Bar
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
                ctx.fill();

                // Value on top
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '9px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                const formattedVal = metric.key === 'overallHitRate' ? `${val.toFixed(0)}%` : (metric.key === 'avgAccessTimeNs' ? `${val.toFixed(1)}` : `${val}`);
                ctx.fillText(formattedVal, x + barWidth / 2, y - 6);
            });
        });
    }

    return {
        renderTimeline,
        renderComparison
    };
})();

