/**
 * CACHEFLOW — Main Application Controller
 * Coordinates API communication with C++ Engine, UI Tab Routing,
 * Dynamic State Sync, Execution Traces, and Hardware Metric Counters.
 */

const App = (function() {
    // Configuration
    let API_BASE_URL = window.location.origin && window.location.origin.startsWith('http')
        ? window.location.origin
        : 'http://localhost:8080';

    let currentL1Cap = 4;
    let currentL2Cap = 8;
    let currentDelayMs = 500;
    let currentPolicy = 'LRU';

    // Sequence Simulation State
    let sequenceQueue = [];
    let currentStepIndex = 0;
    let isPlaying = false;
    let playTimer = null;
    let operationHistory = [];

    // Cached DOM Elements
    const pageHeaderTitle = document.getElementById('pageHeaderTitle');
    const pageHeaderSubtitle = document.getElementById('pageHeaderSubtitle');
    const engineStatusBadge = document.getElementById('engineStatusBadge');
    const engineStatusText = document.getElementById('engineStatusText');

    // Overview Metric Elements
    const valTotalRequests = document.getElementById('valTotalRequests');
    const valHitRate = document.getElementById('valHitRate');
    const valAvgTime = document.getElementById('valAvgTime');
    const valRamMisses = document.getElementById('valRamMisses');
    const trendRequests = document.getElementById('trendRequests');
    const trendHitRate = document.getElementById('trendHitRate');
    const trendAvgTime = document.getElementById('trendAvgTime');
    const trendRamMisses = document.getElementById('trendRamMisses');

    // Controls
    const inputSingleAddr = document.getElementById('inputSingleAddr');
    const btnSendAddr = document.getElementById('btnSendAddr');
    const inputSequence = document.getElementById('inputSequence');
    const btnLoadSeq = document.getElementById('btnLoadSeq');
    const btnRequest = document.getElementById('btnRequest');
    const btnNextStep = document.getElementById('btnNextStep');
    const btnReset = document.getElementById('btnReset');

    const selectL1Cap = document.getElementById('selectL1Cap');
    const selectL2Cap = document.getElementById('selectL2Cap');
    const selectDelay = document.getElementById('selectDelay');

    // Latest Operation Elements
    const opStatusBadge = document.getElementById('opStatusBadge');
    const opStatusText = document.getElementById('opStatusText');
    const opDescText = document.getElementById('opDescText');
    const opAccessTimeText = document.getElementById('opAccessTimeText');
    const crumbL1 = document.getElementById('crumbL1');
    const crumbL2 = document.getElementById('crumbL2');
    const crumbRAM = document.getElementById('crumbRAM');

    // Simulator Page Elements
    const simProgressLabel = document.getElementById('simProgressLabel');
    const simProgressBar = document.getElementById('simProgressBar');
    const btnSimPlay = document.getElementById('btnSimPlay');
    const btnSimPlayText = document.getElementById('btnSimPlayText');
    const btnSimStep = document.getElementById('btnSimStep');
    const btnSimPause = document.getElementById('btnSimPause');
    const btnSimReset = document.getElementById('btnSimReset');
    const traceTableBody = document.getElementById('traceTableBody');
    const traceCountBadge = document.getElementById('traceCountBadge');

    // Analytics Page Elements
    const analyticsL1HitRate = document.getElementById('analyticsL1HitRate');
    const analyticsL1Hits = document.getElementById('analyticsL1Hits');
    const barL1HitRate = document.getElementById('barL1HitRate');
    const analyticsL2HitRate = document.getElementById('analyticsL2HitRate');
    const analyticsL2Hits = document.getElementById('analyticsL2Hits');
    const barL2HitRate = document.getElementById('barL2HitRate');
    const analyticsRamMissRate = document.getElementById('analyticsRamMissRate');
    const analyticsRamMisses = document.getElementById('analyticsRamMisses');
    const barRamMissRate = document.getElementById('barRamMissRate');
    const analyticsAvgTime = document.getElementById('analyticsAvgTime');
    const analyticsTimeSaved = document.getElementById('analyticsTimeSaved');
    const barAvgTime = document.getElementById('barAvgTime');
    const occupancyL1Text = document.getElementById('occupancyL1Text');
    const barOccupancyL1 = document.getElementById('barOccupancyL1');
    const occupancyL2Text = document.getElementById('occupancyL2Text');
    const barOccupancyL2 = document.getElementById('barOccupancyL2');
    const valEffectiveSpeedup = document.getElementById('valEffectiveSpeedup');

    // Counters
    const statL1Hits = document.getElementById('statL1Hits');
    const statL2Hits = document.getElementById('statL2Hits');
    const statRamMisses = document.getElementById('statRamMisses');
    const statEvictions = document.getElementById('statEvictions');
    const statTimeSaved = document.getElementById('statTimeSaved');
    const statSpeedup = document.getElementById('statSpeedup');

    // Comparison Page Elements
    const btnRunComparison = document.getElementById('btnRunComparison');
    const cmpLruHitRate = document.getElementById('cmpLruHitRate');
    const cmpLruMissRate = document.getElementById('cmpLruMissRate');
    const cmpLruAvgTime = document.getElementById('cmpLruAvgTime');
    const cmpLruEvictions = document.getElementById('cmpLruEvictions');
    const cmpFifoHitRate = document.getElementById('cmpFifoHitRate');
    const cmpFifoMissRate = document.getElementById('cmpFifoMissRate');
    const cmpFifoAvgTime = document.getElementById('cmpFifoAvgTime');
    const cmpFifoEvictions = document.getElementById('cmpFifoEvictions');
    const cmpLfuHitRate = document.getElementById('cmpLfuHitRate');
    const cmpLfuMissRate = document.getElementById('cmpLfuMissRate');
    const cmpLfuAvgTime = document.getElementById('cmpLfuAvgTime');
    const cmpLfuEvictions = document.getElementById('cmpLfuEvictions');

    // Settings Modal
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const btnCloseSettings = document.getElementById('btnCloseSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const settingApiUrl = document.getElementById('settingApiUrl');
    const settingPolicy = document.getElementById('settingPolicy');

    // ==========================================
    // EMBEDDED DSA ENGINE (For Cloud Deployments like Vercel & Netlify)
    // Runs when native C++ backend is not reachable in cloud/static environments
    // ==========================================
    class CloudNode {
        constructor(entry) {
            this.entry = entry;
            this.prev = null;
            this.next = null;
        }
    }

    class CloudDoublyLinkedList {
        constructor() {
            this.head = null;
            this.tail = null;
            this.size = 0;
        }
        pushFront(node) {
            node.prev = null;
            node.next = this.head;
            if (this.head) this.head.prev = node;
            else this.tail = node;
            this.head = node;
            this.size++;
        }
        removeNode(node) {
            if (!node) return;
            if (node.prev) node.prev.next = node.next;
            else this.head = node.next;
            if (node.next) node.next.prev = node.prev;
            else this.tail = node.prev;
            node.prev = null;
            node.next = null;
            this.size--;
        }
        moveToFront(node) {
            if (!node || node === this.head) return;
            this.removeNode(node);
            this.pushFront(node);
        }
        popBack() {
            if (!this.tail) return null;
            const lru = this.tail;
            this.removeNode(lru);
            return lru;
        }
        toVector() {
            const res = [];
            let curr = this.head;
            while (curr) {
                res.push(curr.entry);
                curr = curr.next;
            }
            return res;
        }
        clear() {
            this.head = null;
            this.tail = null;
            this.size = 0;
        }
    }

    class CloudCacheLevel {
        constructor(name, capacity, policy = 'LRU', latency = 1.0) {
            this.name = name;
            this.capacity = capacity;
            this.policy = policy;
            this.latency = latency;
            this.list = new CloudDoublyLinkedList();
            this.map = new Map();
        }
        isFull() { return this.map.size >= this.capacity; }
        contains(addr) { return this.map.has(addr); }
        access(addr, time) {
            if (!this.map.has(addr)) return false;
            const node = this.map.get(addr);
            node.entry.frequency++;
            node.entry.lastAccessTime = time;
            if (this.policy === 'LRU') this.list.moveToFront(node);
            return true;
        }
        insert(entry) {
            if (this.map.has(entry.address)) {
                const node = this.map.get(entry.address);
                node.entry = entry;
                node.entry.frequency++;
                if (this.policy === 'LRU') this.list.moveToFront(node);
                return { didEvict: false, evicted: null };
            }
            let didEvict = false;
            let evicted = null;
            if (this.isFull()) {
                evicted = this.evictCandidate();
                didEvict = evicted !== null;
            }
            const newNode = new CloudNode(entry);
            this.list.pushFront(newNode);
            this.map.set(entry.address, newNode);
            return { didEvict, evicted };
        }
        remove(addr) {
            if (!this.map.has(addr)) return null;
            const node = this.map.get(addr);
            this.map.delete(addr);
            this.list.removeNode(node);
            return node.entry;
        }
        evictCandidate() {
            if (this.map.size === 0) return null;
            let candidate = null;
            if (this.policy === 'LRU' || this.policy === 'FIFO') {
                candidate = this.list.tail;
            } else if (this.policy === 'LFU') {
                let curr = this.list.head;
                candidate = curr;
                while (curr) {
                    if (curr.entry.frequency < candidate.entry.frequency ||
                        (curr.entry.frequency === candidate.entry.frequency && curr.entry.lastAccessTime < candidate.entry.lastAccessTime)) {
                        candidate = curr;
                    }
                    curr = curr.next;
                }
            }
            if (!candidate) return null;
            const entry = candidate.entry;
            this.map.delete(entry.address);
            this.list.removeNode(candidate);
            return entry;
        }
        clear() {
            this.map.clear();
            this.list.clear();
        }
        getEntries() {
            return this.list.toVector();
        }
    }

    class CloudMemoryHierarchy {
        constructor(l1Cap = 4, l2Cap = 8, policy = 'LRU') {
            this.policy = policy;
            this.l1 = new CloudCacheLevel('L1', l1Cap, policy, 1.0);
            this.l2 = new CloudCacheLevel('L2', l2Cap, policy, 4.0);
            this.timeStep = 0;
            this.ramList = ['0x0000', '0x1000', '0x2000', '0x3000'];
            this.history = [];
            this.metrics = {
                totalRequests: 0, l1Hits: 0, l2Hits: 0, ramMisses: 0,
                totalEvictions: 0, totalAccessTimeNs: 0
            };
        }
        normalizeAddress(raw) {
            let s = String(raw).trim().toUpperCase();
            if (s.startsWith('0X')) s = s.substring(2);
            while (s.length < 4) s = '0' + s;
            return '0x' + s;
        }
        request(rawAddr) {
            const addr = this.normalizeAddress(rawAddr);
            this.timeStep++;
            this.metrics.totalRequests++;

            const op = {
                address: addr,
                result: 'RAM_MISS',
                accessTimeNs: 105.0,
                description: '',
                promotedAddress: '',
                demotedAddress: '',
                evictedAddress: '',
                movement: []
            };

            // 1. Check L1
            if (this.l1.access(addr, this.timeStep)) {
                this.metrics.l1Hits++;
                this.metrics.totalAccessTimeNs += 1.0;
                op.result = 'L1_HIT';
                op.accessTimeNs = 1.0;
                op.description = `Address ${addr} found in L1 Cache.`;
                op.movement = ['L1 Hit', 'L2', 'RAM'];
                this.history.push(op);
                return op;
            }

            // 2. Check L2
            if (this.l2.contains(addr)) {
                this.metrics.l2Hits++;
                this.metrics.totalAccessTimeNs += 5.0;
                const entry = this.l2.remove(addr);
                entry.frequency++;
                entry.lastAccessTime = this.timeStep;
                op.promotedAddress = addr;

                const l1Res = this.l1.insert(entry);
                if (l1Res.didEvict) {
                    op.demotedAddress = l1Res.evicted.address;
                    const l2Res = this.l2.insert(l1Res.evicted);
                    if (l2Res.didEvict) {
                        op.evictedAddress = l2Res.evicted.address;
                        this.metrics.totalEvictions++;
                    }
                }

                op.result = 'L2_HIT';
                op.accessTimeNs = 5.0;
                op.description = `Address ${addr} found in L2 Cache. Promoted to L1.`;
                op.movement = ['L1 Miss', 'L2 Hit', 'Promoted to L1'];
                this.history.push(op);
                return op;
            }

            // 3. RAM Miss
            this.metrics.ramMisses++;
            this.metrics.totalAccessTimeNs += 105.0;
            const fetched = { address: addr, frequency: 1, lastAccessTime: this.timeStep };

            if (!this.ramList.includes(addr)) {
                this.ramList.unshift(addr);
                if (this.ramList.length > 6) this.ramList.pop();
            }

            const l1Res = this.l1.insert(fetched);
            if (l1Res.didEvict) {
                op.demotedAddress = l1Res.evicted.address;
                const l2Res = this.l2.insert(l1Res.evicted);
                if (l2Res.didEvict) {
                    op.evictedAddress = l2Res.evicted.address;
                    this.metrics.totalEvictions++;
                }
            }

            op.result = 'RAM_MISS';
            op.accessTimeNs = 105.0;
            op.description = `Address ${addr} was absent from both cache levels and required a RAM access.`;
            op.movement = ['L1 Miss', 'L2 Miss', 'RAM Fetch'];
            this.history.push(op);
            return op;
        }
        getState(lastOp = null) {
            const tot = this.metrics.totalRequests;
            const l1H = this.metrics.l1Hits;
            const l2H = this.metrics.l2Hits;
            const rM = this.metrics.ramMisses;
            const accTime = this.metrics.totalAccessTimeNs;
            const directRam = 105.0 * tot;
            const saved = directRam - accTime;

            const metricsObj = {
                totalRequests: tot,
                l1Hits: l1H,
                l2Hits: l2H,
                ramMisses: rM,
                totalEvictions: this.metrics.totalEvictions,
                totalAccessTimeNs: accTime,
                overallHitRate: tot > 0 ? ((l1H + l2H) / tot) * 100 : 0.0,
                l1HitRate: tot > 0 ? (l1H / tot) * 100 : 0.0,
                l2HitRate: tot > 0 ? (l2H / tot) * 100 : 0.0,
                ramMissRate: tot > 0 ? (rM / tot) * 100 : 0.0,
                avgAccessTimeNs: tot > 0 ? accTime / tot : 0.0,
                timeSavedNs: saved,
                speedupFactor: accTime > 0 ? directRam / accTime : 1.0,
                l1OccupancyPct: (this.l1.map.size / this.l1.capacity) * 100,
                l2OccupancyPct: (this.l2.map.size / this.l2.capacity) * 100
            };

            const l1Arr = this.l1.getEntries();
            const l2Arr = this.l2.getEntries();

            return {
                status: 'ok',
                connected: true,
                engine: 'CACHEFLOW Engine (Cloud Web Mode)',
                policy: this.policy,
                l1Capacity: this.l1.capacity,
                l2Capacity: this.l2.capacity,
                metrics: metricsObj,
                l1: l1Arr.map((e, idx) => ({ address: e.address, frequency: e.frequency, position: idx, isMru: idx === 0, isLru: idx === l1Arr.length - 1 })),
                l2: l2Arr.map((e, idx) => ({ address: e.address, frequency: e.frequency, position: idx, isMru: idx === 0, isLru: idx === l2Arr.length - 1 })),
                ram: this.ramList.map((addr, idx) => ({ address: addr, position: idx })),
                latestOperation: lastOp || (this.history.length > 0 ? this.history[this.history.length - 1] : null)
            };
        }
        reset(l1Cap, l2Cap, policy) {
            if (l1Cap) this.l1.capacity = l1Cap;
            if (l2Cap) this.l2.capacity = l2Cap;
            if (policy) {
                this.policy = policy;
                this.l1.policy = policy;
                this.l2.policy = policy;
            }
            this.l1.clear();
            this.l2.clear();
            this.timeStep = 0;
            this.ramList = ['0x0000', '0x1000', '0x2000', '0x3000'];
            this.history = [];
            this.metrics = {
                totalRequests: 0, l1Hits: 0, l2Hits: 0, ramMisses: 0,
                totalEvictions: 0, totalAccessTimeNs: 0
            };
        }
    }

    const cloudSim = new CloudMemoryHierarchy(4, 8, 'LRU');

    function executeCloudCompare(seq, l1Cap, l2Cap) {
        const simL = new CloudMemoryHierarchy(l1Cap, l2Cap, 'LRU');
        const simF = new CloudMemoryHierarchy(l1Cap, l2Cap, 'FIFO');
        const simU = new CloudMemoryHierarchy(l1Cap, l2Cap, 'LFU');

        seq.forEach(addr => {
            simL.request(addr);
            simF.request(addr);
            simU.request(addr);
        });

        return {
            status: 'ok',
            sequenceLength: seq.length,
            l1Capacity: l1Cap,
            l2Capacity: l2Cap,
            lru: simL.getState().metrics,
            fifo: simF.getState().metrics,
            lfu: simU.getState().metrics
        };
    }

    // ==========================================
    // API SERVICE WRAPPER (Dual-Mode: Local C++ / Cloud Emulation)
    // ==========================================
    async function apiRequest(endpoint, method = 'GET', data = null) {
        const url = `${API_BASE_URL}${endpoint}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (data && method === 'POST') {
            options.body = JSON.stringify(data);
        }

        try {
            // Short timeout so cloud deployments fall back instantly
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1200);
            options.signal = controller.signal;

            const resp = await fetch(url, options);
            clearTimeout(timeoutId);

            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const json = await resp.json();
            setEngineConnected(true, 'C++ Engine Connected');
            return json;
        } catch (err) {
            // Seamlessly fall back to Cloud DSA Engine (for Vercel/Netlify)
            setEngineConnected(true, 'Cloud Engine Active');

            if (endpoint === '/api/status') {
                return cloudSim.getState();
            }
            if (endpoint === '/api/request' && method === 'POST') {
                const op = cloudSim.request(data && data.address ? data.address : '0x0000');
                return cloudSim.getState(op);
            }
            if (endpoint === '/api/sequence' && method === 'POST') {
                let lastOp = null;
                const seq = (data && data.sequence) || [];
                seq.forEach(addr => { lastOp = cloudSim.request(addr); });
                return cloudSim.getState(lastOp);
            }
            if (endpoint === '/api/reset' && method === 'POST') {
                cloudSim.reset(data.l1Capacity, data.l2Capacity, data.policy);
                return cloudSim.getState();
            }
            if (endpoint === '/api/config' && method === 'POST') {
                if (data.l1Capacity) cloudSim.l1.capacity = data.l1Capacity;
                if (data.l2Capacity) cloudSim.l2.capacity = data.l2Capacity;
                if (data.policy) {
                    cloudSim.policy = data.policy;
                    cloudSim.l1.policy = data.policy;
                    cloudSim.l2.policy = data.policy;
                }
                return cloudSim.getState();
            }
            if (endpoint === '/api/compare' && method === 'POST') {
                const seq = (data && data.sequence && data.sequence.length > 0)
                    ? data.sequence
                    : ['0x1000', '0x2000', '0x3000', '0x4000', '0x1000', '0x5000', '0x2000', '0x6000', '0x1000', '0x7000'];
                return executeCloudCompare(seq, data.l1Capacity || 4, data.l2Capacity || 8);
            }

            return null;
        }
    }

    function setEngineConnected(isConnected, label = 'C++ Engine Connected') {
        if (isConnected) {
            engineStatusBadge.className = 'engine-badge';
            engineStatusText.textContent = label;
        } else {
            engineStatusBadge.className = 'engine-badge disconnected';
            engineStatusText.textContent = 'Engine Offline';
        }
    }

    // ==========================================
    // UI SYNCHRONIZATION
    // ==========================================
    function updateDashboard(state, lastOp = null) {
        if (!state) return;

        const m = state.metrics || {};

        // Top 4 Compact Metric Cards
        valTotalRequests.textContent = m.totalRequests !== undefined ? m.totalRequests.toLocaleString() : '0';
        valHitRate.textContent = m.overallHitRate !== undefined ? `${m.overallHitRate.toFixed(1)}%` : '0.0%';
        valAvgTime.textContent = m.avgAccessTimeNs !== undefined ? `${m.avgAccessTimeNs.toFixed(1)} ns` : '0.0 ns';
        valRamMisses.textContent = m.ramMisses !== undefined ? m.ramMisses.toLocaleString() : '0';

        // Trend indicators based on values
        if (m.totalRequests > 0) {
            trendRequests.textContent = `↑ ${m.totalRequests}`;
            trendHitRate.textContent = m.overallHitRate > 75 ? `↑ ${m.overallHitRate.toFixed(1)}%` : `↓ ${(100 - m.overallHitRate).toFixed(1)}%`;
            trendAvgTime.textContent = m.avgAccessTimeNs < 30 ? `↓ ${m.avgAccessTimeNs.toFixed(1)} ns` : `↑ ${m.avgAccessTimeNs.toFixed(1)} ns`;
            trendRamMisses.textContent = `${m.ramMissRate.toFixed(1)}% miss`;
        }

        // Cache Hierarchy Visualization
        CacheViz.render(state);
        if (lastOp) {
            CacheViz.handleOperation(lastOp);
        }

        // Latest Operation Summary
        const op = lastOp || state.latestOperation;
        if (op) {
            updateLatestOperationPanel(op);
        }

        // Analytics Sync
        updateAnalyticsUI(state);
    }

    function updateLatestOperationPanel(op) {
        if (!op) return;

        opStatusBadge.className = 'op-status-badge';
        if (op.result === 'L1_HIT') {
            opStatusBadge.classList.add('hit');
            opStatusText.textContent = 'L1 HIT';
        } else if (op.result === 'L2_HIT') {
            opStatusBadge.classList.add('l2-hit');
            opStatusText.textContent = 'L2 HIT';
        } else {
            opStatusBadge.classList.add('miss');
            opStatusText.textContent = 'RAM MISS';
        }

        opDescText.textContent = op.description || `Processed address ${op.address}`;
        opAccessTimeText.textContent = `Access Time: ${op.accessTimeNs} ns`;

        // Cache Movement Breadcrumbs
        crumbL1.className = 'step-pill';
        crumbL2.className = 'step-pill';
        crumbRAM.className = 'step-pill';

        if (op.result === 'L1_HIT') {
            crumbL1.classList.add('active');
            crumbL1.textContent = '● L1 Hit';
            crumbL2.textContent = '○ L2';
            crumbRAM.textContent = '○ RAM';
        } else if (op.result === 'L2_HIT') {
            crumbL1.textContent = '✕ L1 Miss';
            crumbL2.classList.add('active');
            crumbL2.textContent = '● L2 Hit (Promoted)';
            crumbRAM.textContent = '○ RAM';
        } else {
            crumbL1.textContent = '✕ L1 Miss';
            crumbL2.textContent = '✕ L2 Miss';
            crumbRAM.classList.add('active');
            crumbRAM.textContent = '● RAM Fetch';
        }
    }

    function updateAnalyticsUI(state) {
        if (!state || !state.metrics) return;
        const m = state.metrics;

        // Metric Bars
        analyticsL1HitRate.textContent = `${m.l1HitRate.toFixed(1)}%`;
        analyticsL1Hits.textContent = `${m.l1Hits} hits`;
        barL1HitRate.style.width = `${Math.min(m.l1HitRate, 100)}%`;

        analyticsL2HitRate.textContent = `${m.l2HitRate.toFixed(1)}%`;
        analyticsL2Hits.textContent = `${m.l2Hits} hits`;
        barL2HitRate.style.width = `${Math.min(m.l2HitRate, 100)}%`;

        analyticsRamMissRate.textContent = `${m.ramMissRate.toFixed(1)}%`;
        analyticsRamMisses.textContent = `${m.ramMisses} misses`;
        barRamMissRate.style.width = `${Math.min(m.ramMissRate, 100)}%`;

        analyticsAvgTime.textContent = `${m.avgAccessTimeNs.toFixed(1)} ns`;
        analyticsTimeSaved.textContent = `${m.timeSavedNs.toFixed(0)} ns saved`;
        barAvgTime.style.width = `${Math.min((m.avgAccessTimeNs / 105) * 100, 100)}%`;

        // Occupancy
        const l1Size = (state.l1 || []).length;
        const l1Cap = state.l1Capacity || currentL1Cap;
        const l1OccPct = l1Cap > 0 ? (l1Size / l1Cap) * 100 : 0;
        occupancyL1Text.textContent = `${l1Size} / ${l1Cap} lines (${l1OccPct.toFixed(0)}%)`;
        barOccupancyL1.style.width = `${l1OccPct}%`;

        const l2Size = (state.l2 || []).length;
        const l2Cap = state.l2Capacity || currentL2Cap;
        const l2OccPct = l2Cap > 0 ? (l2Size / l2Cap) * 100 : 0;
        occupancyL2Text.textContent = `${l2Size} / ${l2Cap} lines (${l2OccPct.toFixed(0)}%)`;
        barOccupancyL2.style.width = `${l2OccPct}%`;

        // Effective Speedup
        valEffectiveSpeedup.textContent = m.speedupFactor ? `${m.speedupFactor.toFixed(2)}x` : '1.0x';

        // Performance Counters
        statL1Hits.textContent = m.l1Hits;
        statL2Hits.textContent = m.l2Hits;
        statRamMisses.textContent = m.ramMisses;
        statEvictions.textContent = m.totalEvictions;
        statTimeSaved.textContent = `${m.timeSavedNs.toFixed(0)} ns`;
        const speedupPct = m.totalRequests > 0 ? ((m.timeSavedNs / (105.0 * m.totalRequests)) * 100) : 0;
        statSpeedup.textContent = `${speedupPct.toFixed(1)}%`;

        // Render Latency Timeline Chart
        CacheCharts.renderTimeline('timelineChart', operationHistory);
    }

    function addTraceRow(op) {
        if (!op) return;
        operationHistory.push(op);

        if (traceTableBody.querySelector('.empty-cell')) {
            traceTableBody.innerHTML = '';
        }

        const tr = document.createElement('tr');
        const stepNum = operationHistory.length;

        let resBadgeClass = 'emerald-text';
        if (op.result === 'L2_HIT') resBadgeClass = 'blue-text';
        if (op.result === 'RAM_MISS') resBadgeClass = 'violet-text';

        tr.innerHTML = `
            <td>#${stepNum}</td>
            <td><strong>${op.address}</strong></td>
            <td class="${resBadgeClass}"><strong>${op.result}</strong></td>
            <td>${op.accessTimeNs} ns</td>
            <td>${op.promotedAddress || '—'}</td>
            <td>${op.demotedAddress || '—'}</td>
            <td>${op.evictedAddress || '—'}</td>
            <td><small>${op.description}</small></td>
        `;

        traceTableBody.insertBefore(tr, traceTableBody.firstChild);
        traceCountBadge.textContent = `${stepNum} operations`;
    }

    // ==========================================
    // CONTROLLER ACTIONS
    // ==========================================
    async function executeSingleAddress(addr) {
        if (!addr || !addr.trim()) return;
        const res = await apiRequest('/api/request', 'POST', { address: addr.trim() });
        if (res && res.latestOperation) {
            addTraceRow(res.latestOperation);
            updateDashboard(res, res.latestOperation);
        }
    }

    async function executeNextStep() {
        if (sequenceQueue.length === 0) {
            // If empty, take address from input or generate sample
            const val = inputSingleAddr.value.trim() || '0x3A1F';
            await executeSingleAddress(val);
            return;
        }

        if (currentStepIndex >= sequenceQueue.length) {
            pauseSequence();
            return;
        }

        const addr = sequenceQueue[currentStepIndex];
        currentStepIndex++;
        updateProgress();

        await executeSingleAddress(addr);

        if (currentStepIndex >= sequenceQueue.length) {
            pauseSequence();
        }
    }

    function updateProgress() {
        const total = sequenceQueue.length;
        simProgressLabel.textContent = `Step ${currentStepIndex} of ${total}`;
        const pct = total > 0 ? (currentStepIndex / total) * 100 : 0;
        simProgressBar.style.width = `${pct}%`;
    }

    function playSequence() {
        if (sequenceQueue.length === 0) {
            loadSequenceFromInput();
            if (sequenceQueue.length === 0) {
                // Load default preset loop
                loadPreset('loop');
            }
        }

        if (currentStepIndex >= sequenceQueue.length) {
            currentStepIndex = 0;
        }

        isPlaying = true;
        btnSimPlayText.textContent = 'Running...';
        btnSimPlay.classList.add('pulse');

        clearInterval(playTimer);
        playTimer = setInterval(async () => {
            if (currentStepIndex < sequenceQueue.length) {
                await executeNextStep();
            } else {
                pauseSequence();
            }
        }, currentDelayMs);
    }

    function pauseSequence() {
        isPlaying = false;
        clearInterval(playTimer);
        btnSimPlayText.textContent = 'Run Auto';
        btnSimPlay.classList.remove('pulse');
    }

    async function resetSimulation() {
        pauseSequence();
        sequenceQueue = [];
        currentStepIndex = 0;
        operationHistory = [];
        updateProgress();

        traceTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center empty-cell">No requests executed yet. Run a sequence above to stream C++ simulation trace.</td>
            </tr>
        `;
        traceCountBadge.textContent = '0 operations';

        const res = await apiRequest('/api/reset', 'POST', {
            l1Capacity: currentL1Cap,
            l2Capacity: currentL2Cap,
            policy: currentPolicy
        });
        if (res) {
            updateDashboard(res);
        }
    }

    function loadSequenceFromInput() {
        const raw = inputSequence.value.trim();
        if (!raw) return;

        // Split by comma or space
        const tokens = raw.split(/[\s,]+/).filter(t => t.length > 0);
        if (tokens.length > 0) {
            sequenceQueue = tokens;
            currentStepIndex = 0;
            updateProgress();
            inputSequence.value = tokens.join(', ');
        }
    }

    function loadPreset(presetType) {
        let seq = [];
        if (presetType === 'loop') {
            // High Temporal Locality
            seq = ['0x1000', '0x2000', '0x3000', '0x1000', '0x2000', '0x3000', '0x1000', '0x2000', '0x1000'];
        } else if (presetType === 'sequential') {
            // Spatial Locality
            seq = ['0x1000', '0x1004', '0x1008', '0x100C', '0x1010', '0x1014', '0x1018', '0x101C'];
        } else if (presetType === 'thrash') {
            // Ping-pong thrashing exceeding L1 & L2 capacity
            seq = ['0x1000', '0x2000', '0x3000', '0x4000', '0x5000', '0x6000', '0x7000', '0x8000', '0x9000', '0xA000', '0xB000', '0xC000'];
        } else if (presetType === 'random') {
            for (let i = 0; i < 10; i++) {
                const hex = (Math.floor(Math.random() * 8) * 0x1000).toString(16).toUpperCase();
                seq.push(`0x${hex.padStart(4, '0')}`);
            }
        }

        sequenceQueue = seq;
        currentStepIndex = 0;
        inputSequence.value = seq.join(', ');
        updateProgress();
    }

    async function runMultiPolicyBenchmark() {
        btnRunComparison.disabled = true;
        btnRunComparison.textContent = 'Running Benchmark in C++...';

        const seq = sequenceQueue.length > 0 ? sequenceQueue : ['0x1000', '0x2000', '0x3000', '0x4000', '0x1000', '0x5000', '0x2000', '0x6000', '0x1000', '0x7000'];

        const res = await apiRequest('/api/compare', 'POST', {
            sequence: seq,
            l1Capacity: currentL1Cap,
            l2Capacity: currentL2Cap
        });

        btnRunComparison.disabled = false;
        btnRunComparison.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Run Multi-Policy Benchmark</span>
        `;

        if (res) {
            // Update LRU
            if (res.lru) {
                cmpLruHitRate.textContent = `${res.lru.overallHitRate.toFixed(1)}%`;
                cmpLruMissRate.textContent = `${res.lru.ramMissRate.toFixed(1)}%`;
                cmpLruAvgTime.textContent = `${res.lru.avgAccessTimeNs.toFixed(1)} ns`;
                cmpLruEvictions.textContent = res.lru.totalEvictions;
            }
            // Update FIFO
            if (res.fifo) {
                cmpFifoHitRate.textContent = `${res.fifo.overallHitRate.toFixed(1)}%`;
                cmpFifoMissRate.textContent = `${res.fifo.ramMissRate.toFixed(1)}%`;
                cmpFifoAvgTime.textContent = `${res.fifo.avgAccessTimeNs.toFixed(1)} ns`;
                cmpFifoEvictions.textContent = res.fifo.totalEvictions;
            }
            // Update LFU
            if (res.lfu) {
                cmpLfuHitRate.textContent = `${res.lfu.overallHitRate.toFixed(1)}%`;
                cmpLfuMissRate.textContent = `${res.lfu.ramMissRate.toFixed(1)}%`;
                cmpLfuAvgTime.textContent = `${res.lfu.avgAccessTimeNs.toFixed(1)} ns`;
                cmpLfuEvictions.textContent = res.lfu.totalEvictions;
            }

            CacheCharts.renderComparison('comparisonChart', res);
        }
    }

    // ==========================================
    // INITIALIZATION & EVENT LISTENERS
    // ==========================================
    function setupEventListeners() {
        // Tab Navigation
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');

                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

                btn.classList.add('active');
                const targetPane = document.getElementById(`pane-${targetTab}`);
                if (targetPane) targetPane.classList.add('active');

                // Update Header
                const tabTitles = {
                    overview: { title: 'CACHEFLOW', sub: 'Multi-Level Cache Simulator' },
                    simulator: { title: 'SIMULATOR', sub: 'Sequence Execution & Trace Inspector' },
                    analytics: { title: 'ANALYTICS', sub: 'Hardware Performance & Latency Telemetry' },
                    comparison: { title: 'COMPARISON', sub: 'LRU vs FIFO vs LFU Multi-Policy Benchmark' },
                    about: { title: 'ABOUT', sub: 'DSA Architecture & Academic Invariants' }
                };
                if (tabTitles[targetTab]) {
                    pageHeaderTitle.textContent = tabTitles[targetTab].title;
                    pageHeaderSubtitle.textContent = tabTitles[targetTab].sub;
                }

                // If Analytics or Comparison opened, re-render charts to fit size
                if (targetTab === 'analytics') {
                    setTimeout(() => CacheCharts.renderTimeline('timelineChart', operationHistory), 50);
                }
            });
        });

        // Overview Send Address
        btnSendAddr.addEventListener('click', () => {
            const addr = inputSingleAddr.value.trim() || '0x3A1F';
            executeSingleAddress(addr);
        });

        inputSingleAddr.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const addr = inputSingleAddr.value.trim() || '0x3A1F';
                executeSingleAddress(addr);
            }
        });

        // Load Sequence
        btnLoadSeq.addEventListener('click', loadSequenceFromInput);

        // Control Buttons
        btnRequest.addEventListener('click', () => {
            if (isPlaying) {
                pauseSequence();
            } else {
                playSequence();
            }
        });

        btnNextStep.addEventListener('click', executeNextStep);
        btnReset.addEventListener('click', resetSimulation);

        // Simulator Page Buttons
        btnSimPlay.addEventListener('click', () => {
            if (isPlaying) pauseSequence();
            else playSequence();
        });
        btnSimStep.addEventListener('click', executeNextStep);
        btnSimPause.addEventListener('click', pauseSequence);
        btnSimReset.addEventListener('click', resetSimulation);

        // Presets
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                loadPreset(preset);
            });
        });

        // Capacity & Delay Selectors
        selectL1Cap.addEventListener('change', async (e) => {
            currentL1Cap = parseInt(e.target.value, 10);
            await apiRequest('/api/config', 'POST', { l1Capacity: currentL1Cap, l2Capacity: currentL2Cap });
            refreshState();
        });

        selectL2Cap.addEventListener('change', async (e) => {
            currentL2Cap = parseInt(e.target.value, 10);
            await apiRequest('/api/config', 'POST', { l1Capacity: currentL1Cap, l2Capacity: currentL2Cap });
            refreshState();
        });

        selectDelay.addEventListener('change', (e) => {
            currentDelayMs = parseInt(e.target.value, 10);
            if (isPlaying) {
                playSequence(); // restart with new interval
            }
        });

        // Comparison Page Action
        btnRunComparison.addEventListener('click', runMultiPolicyBenchmark);

        // Settings Modal
        btnSettings.addEventListener('click', () => {
            settingApiUrl.value = API_BASE_URL;
            settingPolicy.value = currentPolicy;
            settingsModal.classList.add('open');
        });

        btnCloseSettings.addEventListener('click', () => {
            settingsModal.classList.remove('open');
        });

        btnSaveSettings.addEventListener('click', async () => {
            API_BASE_URL = settingApiUrl.value.trim().replace(/\/+$/, '');
            currentPolicy = settingPolicy.value;
            settingsModal.classList.remove('open');
            await apiRequest('/api/config', 'POST', { policy: currentPolicy });
            refreshState();
        });
    }

    async function refreshState() {
        const state = await apiRequest('/api/status');
        if (state) {
            currentL1Cap = state.l1Capacity || currentL1Cap;
            currentL2Cap = state.l2Capacity || currentL2Cap;
            currentPolicy = state.policy || currentPolicy;
            selectL1Cap.value = currentL1Cap.toString();
            selectL2Cap.value = currentL2Cap.toString();
            updateDashboard(state);
        }
    }

    return {
        async init() {
            setupEventListeners();
            await refreshState();
            // Periodic connection health poll every 4 seconds
            setInterval(async () => {
                const state = await apiRequest('/api/status');
                if (state) {
                    setEngineConnected(true);
                }
            }, 4000);
        }
    };
})();

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

