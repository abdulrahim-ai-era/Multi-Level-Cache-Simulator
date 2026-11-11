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
    let currentBlockSize = 1;

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
    const hierarchySubtitle = document.getElementById('hierarchySubtitle');
    const badgeActivePolicy = document.getElementById('badgeActivePolicy');

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
    const selectPolicy = document.getElementById('selectPolicy');
    const selectBlockSize = document.getElementById('selectBlockSize');

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
    const cmpAdaptiveHitRate = document.getElementById('cmpAdaptiveHitRate');
    const cmpAdaptiveSwitches = document.getElementById('cmpAdaptiveSwitches');
    const cmpAdaptiveAvgTime = document.getElementById('cmpAdaptiveAvgTime');
    const cmpAdaptiveActivePolicy = document.getElementById('cmpAdaptiveActivePolicy');

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
        constructor(l1Cap = 4, l2Cap = 8, policy = 'LRU', blockSize = 1) {
            this.policy = policy;
            this.blockSize = blockSize || 1;
            this.concretePolicy = policy === 'ADAPTIVE' ? 'LRU' : policy;
            this.l1 = new CloudCacheLevel('L1', l1Cap, this.concretePolicy, 1.0);
            this.l2 = new CloudCacheLevel('L2', l2Cap, this.concretePolicy, 4.0);
            this.timeStep = 0;
            this.ramList = ['0x0000', '0x1000', '0x2000', '0x3000'];
            this.history = [];
            this.switchLog = [];
            this.metrics = {
                totalRequests: 0, l1Hits: 0, l2Hits: 0, ramMisses: 0,
                totalEvictions: 0, totalAccessTimeNs: 0
            };

            // Shadow simulators for Adaptive policy
            this.windowRequests = 0;
            this.lruWindowStartHits = 0;
            this.lfuWindowStartHits = 0;
            if (this.policy === 'ADAPTIVE') {
                this.setupAdaptive();
            }
        }
        setupAdaptive() {
            this.shadowLru = new CloudMemoryHierarchy(this.l1.capacity, this.l2.capacity, 'LRU', this.blockSize);
            this.shadowLfu = new CloudMemoryHierarchy(this.l1.capacity, this.l2.capacity, 'LFU', this.blockSize);
            this.windowRequests = 0;
            this.lruWindowStartHits = 0;
            this.lfuWindowStartHits = 0;
            this.switchLog = [];
        }
        toBlockAddress(addr) {
            if (this.blockSize <= 1) return addr;
            try {
                let v = parseInt(addr.replace('0x', ''), 16);
                v -= (v % this.blockSize);
                return '0x' + v.toString(16).toUpperCase().padStart(4, '0');
            } catch (e) {
                return addr;
            }
        }
        normalizeAddress(raw) {
            let s = String(raw).trim().toUpperCase();
            if (s.startsWith('0X')) s = s.substring(2);
            while (s.length < 4) s = '0' + s;
            return '0x' + s;
        }
        adaptiveStep(addr, op) {
            if (!this.shadowLru || !this.shadowLfu) return;
            this.shadowLru.request(addr);
            this.shadowLfu.request(addr);
            this.windowRequests++;

            if (this.windowRequests < 200) return;

            const lruHits = this.shadowLru.metrics.l1Hits + this.shadowLru.metrics.l2Hits;
            const lfuHits = this.shadowLfu.metrics.l1Hits + this.shadowLfu.metrics.l2Hits;
            const lruRate = ((lruHits - this.lruWindowStartHits) * 100.0) / 200;
            const lfuRate = ((lfuHits - this.lfuWindowStartHits) * 100.0) / 200;
            this.lruWindowStartHits = lruHits;
            this.lfuWindowStartHits = lfuHits;
            this.windowRequests = 0;

            const current = this.l1.policy;
            let winner = current;
            if (lruRate > lfuRate) winner = 'LRU';
            else if (lfuRate > lruRate) winner = 'LFU';

            if (winner !== current) {
                this.switchLog.push({
                    atRequest: this.timeStep,
                    from: current,
                    to: winner,
                    lruRate: lruRate,
                    lfuRate: lfuRate
                });
                this.l1.policy = winner;
                this.l2.policy = winner;
                op.policySwitch = `Adaptive switch at request ${this.timeStep}: ${current} -> ${winner} (LRU ${lruRate.toFixed(1)}% vs LFU ${lfuRate.toFixed(1)}%)`;
            }
        }
        request(rawAddr) {
            let addr = this.normalizeAddress(rawAddr);
            addr = this.toBlockAddress(addr);

            this.timeStep++;
            this.metrics.totalRequests++;

            const op = {
                address: addr,
                result: 'RAM_HIT',
                accessTimeNs: 105.0,
                description: '',
                promotedAddress: '',
                demotedAddress: '',
                evictedAddress: '',
                policySwitch: '',
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
                if (this.policy === 'ADAPTIVE') this.adaptiveStep(addr, op);
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
                if (this.policy === 'ADAPTIVE') this.adaptiveStep(addr, op);
                this.history.push(op);
                return op;
            }

            // 3. RAM Hit (RAM Found)
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

            op.result = 'RAM_HIT';
            op.accessTimeNs = 105.0;
            op.description = `Address ${addr} was not in L1 or L2, so it was fetched from RAM (RAM Found).`;
            op.movement = ['L1 Miss', 'L2 Miss', 'RAM Found'];
            if (this.policy === 'ADAPTIVE') this.adaptiveStep(addr, op);
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
                ramHits: rM,
                ramMisses: rM,
                totalEvictions: this.metrics.totalEvictions,
                totalAccessTimeNs: accTime,
                overallHitRate: tot > 0 ? ((l1H + l2H) / tot) * 100 : 0.0,
                l1HitRate: tot > 0 ? (l1H / tot) * 100 : 0.0,
                l2HitRate: tot > 0 ? (l2H / tot) * 100 : 0.0,
                ramHitRate: tot > 0 ? (rM / tot) * 100 : 0.0,
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
                activePolicy: this.l1.policy,
                blockSize: this.blockSize,
                switchCount: this.switchLog.length,
                switchLog: this.switchLog,
                l1Capacity: this.l1.capacity,
                l2Capacity: this.l2.capacity,
                metrics: metricsObj,
                l1: l1Arr.map((e, idx) => ({ address: e.address, frequency: e.frequency, position: idx, isMru: idx === 0, isLru: idx === l1Arr.length - 1 })),
                l2: l2Arr.map((e, idx) => ({ address: e.address, frequency: e.frequency, position: idx, isMru: idx === 0, isLru: idx === l2Arr.length - 1 })),
                ram: this.ramList.map((addr, idx) => ({ address: addr, position: idx })),
                latestOperation: lastOp || (this.history.length > 0 ? this.history[this.history.length - 1] : null)
            };
        }
        reset(l1Cap, l2Cap, policy, blockSize) {
            if (l1Cap) this.l1.capacity = l1Cap;
            if (l2Cap) this.l2.capacity = l2Cap;
            if (blockSize) this.blockSize = blockSize;
            if (policy) {
                this.policy = policy;
                this.concretePolicy = policy === 'ADAPTIVE' ? 'LRU' : policy;
                this.l1.policy = this.concretePolicy;
                this.l2.policy = this.concretePolicy;
            }
            this.l1.clear();
            this.l2.clear();
            this.timeStep = 0;
            this.ramList = ['0x0000', '0x1000', '0x2000', '0x3000'];
            this.history = [];
            this.switchLog = [];
            this.metrics = {
                totalRequests: 0, l1Hits: 0, l2Hits: 0, ramMisses: 0,
                totalEvictions: 0, totalAccessTimeNs: 0
            };
            if (this.policy === 'ADAPTIVE') this.setupAdaptive();
        }
    }

    const cloudSim = new CloudMemoryHierarchy(4, 8, 'LRU', 1);

    function executeCloudCompare(seq, l1Cap, l2Cap, blockSize = 1) {
        const simL = new CloudMemoryHierarchy(l1Cap, l2Cap, 'LRU', blockSize);
        const simF = new CloudMemoryHierarchy(l1Cap, l2Cap, 'FIFO', blockSize);
        const simU = new CloudMemoryHierarchy(l1Cap, l2Cap, 'LFU', blockSize);
        const simA = new CloudMemoryHierarchy(l1Cap, l2Cap, 'ADAPTIVE', blockSize);

        seq.forEach(addr => {
            simL.request(addr);
            simF.request(addr);
            simU.request(addr);
            simA.request(addr);
        });

        return {
            status: 'ok',
            sequenceLength: seq.length,
            l1Capacity: l1Cap,
            l2Capacity: l2Cap,
            blockSize: blockSize,
            lru: simL.getState().metrics,
            fifo: simF.getState().metrics,
            lfu: simU.getState().metrics,
            adaptive: simA.getState().metrics,
            adaptiveSwitches: simA.switchLog.length,
            adaptiveActivePolicy: simA.l1.policy
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
                cloudSim.reset(data.l1Capacity, data.l2Capacity, data.policy, data.blockSize);
                return cloudSim.getState();
            }
            if (endpoint === '/api/config' && method === 'POST') {
                if (data.l1Capacity) cloudSim.l1.capacity = data.l1Capacity;
                if (data.l2Capacity) cloudSim.l2.capacity = data.l2Capacity;
                if (data.blockSize) cloudSim.blockSize = data.blockSize;
                if (data.policy) {
                    cloudSim.policy = data.policy;
                    cloudSim.concretePolicy = data.policy === 'ADAPTIVE' ? 'LRU' : data.policy;
                    cloudSim.l1.policy = cloudSim.concretePolicy;
                    cloudSim.l2.policy = cloudSim.concretePolicy;
                    if (data.policy === 'ADAPTIVE') cloudSim.setupAdaptive();
                }
                return cloudSim.getState();
            }
            if (endpoint === '/api/compare' && method === 'POST') {
                const seq = (data && data.sequence && data.sequence.length > 0)
                    ? data.sequence
                    : ['0x1000', '0x2000', '0x3000', '0x4000', '0x1000', '0x5000', '0x2000', '0x6000', '0x1000', '0x7000'];
                return executeCloudCompare(seq, data.l1Capacity || 4, data.l2Capacity || 8, data.blockSize || 1);
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
        valRamMisses.textContent = (m.ramHits !== undefined ? m.ramHits : m.ramMisses || 0).toLocaleString();

        // Trend indicators based on values
        if (m.totalRequests > 0) {
            trendRequests.textContent = `↑ ${m.totalRequests}`;
            trendHitRate.textContent = m.overallHitRate > 75 ? `↑ ${m.overallHitRate.toFixed(1)}%` : `↓ ${(100 - m.overallHitRate).toFixed(1)}%`;
            trendAvgTime.textContent = m.avgAccessTimeNs < 30 ? `↓ ${m.avgAccessTimeNs.toFixed(1)} ns` : `↑ ${m.avgAccessTimeNs.toFixed(1)} ns`;
            trendRamMisses.textContent = `${(m.ramHitRate !== undefined ? m.ramHitRate : m.ramMissRate || 0).toFixed(1)}% RAM`;
        }

        // Active Policy display for ADAPTIVE
        if (state.policy === 'ADAPTIVE') {
            if (hierarchySubtitle) hierarchySubtitle.textContent = `L1 → L2 → RAM (⚡ ADAPTIVE Mode)`;
            if (badgeActivePolicy) {
                badgeActivePolicy.style.display = 'inline-block';
                badgeActivePolicy.textContent = `Active: ${state.activePolicy || 'LRU'}`;
            }
        } else {
            if (hierarchySubtitle) hierarchySubtitle.textContent = `L1 → L2 → RAM (Policy: ${state.policy || 'LRU'})`;
            if (badgeActivePolicy) {
                badgeActivePolicy.style.display = 'none';
            }
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
            opStatusText.textContent = 'RAM FOUND';
        }

        let desc = op.description || `Processed address ${op.address}`;
        if (op.policySwitch) {
            desc += ` [${op.policySwitch}]`;
        }
        opDescText.textContent = desc;
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
            crumbRAM.textContent = '● RAM Found';
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

        const ramHits = m.ramHits !== undefined ? m.ramHits : m.ramMisses || 0;
        const ramRate = m.ramHitRate !== undefined ? m.ramHitRate : m.ramMissRate || 0;
        analyticsRamMissRate.textContent = `${ramRate.toFixed(1)}%`;
        analyticsRamMisses.textContent = `${ramHits} found`;
        barRamMissRate.style.width = `${Math.min(ramRate, 100)}%`;

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
        statRamMisses.textContent = m.ramHits !== undefined ? m.ramHits : m.ramMisses || 0;
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
        let resLabel = op.result;
        if (op.result === 'L2_HIT') resBadgeClass = 'blue-text';
        if (op.result === 'RAM_HIT' || op.result === 'RAM_MISS') {
            resBadgeClass = 'violet-text';
            resLabel = 'RAM FOUND';
        }

        let descText = op.description || '';
        if (op.policySwitch) {
            descText = `<strong>${op.policySwitch}</strong><br>${descText}`;
        }

        tr.innerHTML = `
            <td>#${stepNum}</td>
            <td><strong>${op.address}</strong></td>
            <td class="${resBadgeClass}"><strong>${resLabel}</strong></td>
            <td>${op.accessTimeNs} ns</td>
            <td>${op.promotedAddress || '—'}</td>
            <td>${op.demotedAddress || '—'}</td>
            <td>${op.evictedAddress || '—'}</td>
            <td><small>${descText}</small></td>
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
            policy: currentPolicy,
            blockSize: currentBlockSize
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
        btnRunComparison.textContent = 'Building Benchmark Sequence...';

        // ── Build a benchmark sequence that EXPOSES policy differences ──────────
        // Problem: if all unique addresses fit inside L1+L2, every policy behaves
        // identically (no eviction from L2 ever happens).
        // Fix:
        //   1. Collect the user's sequence (or a default one).
        //   2. Append "flood" addresses so we EXCEED L1+L2 total capacity.
        //   3. Repeat the hot addresses so LFU's frequency counters diverge from LRU/FIFO.
        //   4. Ensure ≥ 300 total requests so ADAPTIVE's 200-request window can fire.

        const baseSeq = sequenceQueue.length > 0
            ? [...sequenceQueue]
            : ['0x1000','0x2000','0x3000','0x4000','0x1000','0x5000','0x2000','0x6000','0x1000','0x7000'];

        const totalCap = currentL1Cap + currentL2Cap;
        const uniqueInBase = [...new Set(baseSeq)];

        // Add flood addresses to push total unique count beyond L1+L2 capacity
        const floodAddrs = [];
        for (let i = uniqueInBase.length; i < totalCap + 6; i++) {
            floodAddrs.push(`0x${((i + 1) * 0x1000).toString(16).toUpperCase().padStart(4, '0')}`);
        }

        // Pattern: [base + flood] fills & overflows cache; [base × 3] shows recency/frequency differences
        let benchSeq = [...baseSeq, ...floodAddrs, ...baseSeq, ...baseSeq, ...baseSeq];

        // Pad to ≥ 300 so ADAPTIVE window (200 req) fires at least once
        while (benchSeq.length < 300) {
            benchSeq = [...benchSeq, ...baseSeq];
        }

        btnRunComparison.textContent = `Running ${benchSeq.length} requests across 4 policies...`;

        const res = await apiRequest('/api/compare', 'POST', {
            sequence: benchSeq,
            l1Capacity: currentL1Cap,
            l2Capacity: currentL2Cap,
            blockSize: currentBlockSize
        });

        btnRunComparison.disabled = false;
        btnRunComparison.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Run Multi-Policy Benchmark</span>
        `;

        if (res) {
            // Show how many requests were benchmarked
            const benchLen = benchSeq ? benchSeq.length : (res.sequenceLength || '?');
            const benchInfo = document.getElementById('benchmarkInfoLabel');
            if (benchInfo) {
                benchInfo.textContent = `Benchmarked ${benchLen} requests (L1=${currentL1Cap}, L2=${currentL2Cap}, Block=${currentBlockSize})`;
                benchInfo.style.display = 'block';
            }
            // Update LRU
            if (res.lru) {
                cmpLruHitRate.textContent = `${res.lru.overallHitRate.toFixed(1)}%`;
                cmpLruMissRate.textContent = `${(res.lru.ramMissRate ?? res.lru.ramHitRate ?? 0).toFixed(1)}%`;
                cmpLruAvgTime.textContent = `${res.lru.avgAccessTimeNs.toFixed(1)} ns`;
                cmpLruEvictions.textContent = res.lru.totalEvictions;
            }
            // Update FIFO
            if (res.fifo) {
                cmpFifoHitRate.textContent = `${res.fifo.overallHitRate.toFixed(1)}%`;
                cmpFifoMissRate.textContent = `${(res.fifo.ramMissRate ?? res.fifo.ramHitRate ?? 0).toFixed(1)}%`;
                cmpFifoAvgTime.textContent = `${res.fifo.avgAccessTimeNs.toFixed(1)} ns`;
                cmpFifoEvictions.textContent = res.fifo.totalEvictions;
            }
            // Update LFU
            if (res.lfu) {
                cmpLfuHitRate.textContent = `${res.lfu.overallHitRate.toFixed(1)}%`;
                cmpLfuMissRate.textContent = `${(res.lfu.ramMissRate ?? res.lfu.ramHitRate ?? 0).toFixed(1)}%`;
                cmpLfuAvgTime.textContent = `${res.lfu.avgAccessTimeNs.toFixed(1)} ns`;
                cmpLfuEvictions.textContent = res.lfu.totalEvictions;
            }
            // Update ADAPTIVE
            if (res.adaptive) {
                cmpAdaptiveHitRate.textContent = `${res.adaptive.overallHitRate.toFixed(1)}%`;
                cmpAdaptiveSwitches.textContent = `${res.adaptiveSwitches || 0} switches`;
                cmpAdaptiveAvgTime.textContent = `${res.adaptive.avgAccessTimeNs.toFixed(1)} ns`;
                cmpAdaptiveActivePolicy.textContent = res.adaptiveActivePolicy || 'LRU';
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

        // Capacity, Policy, Block Size & Delay Selectors
        if (selectPolicy) {
            selectPolicy.addEventListener('change', async (e) => {
                currentPolicy = e.target.value;
                await apiRequest('/api/config', 'POST', { policy: currentPolicy });
                refreshState();
            });
        }

        if (selectBlockSize) {
            selectBlockSize.addEventListener('change', async (e) => {
                currentBlockSize = parseInt(e.target.value, 10);
                await apiRequest('/api/config', 'POST', { blockSize: currentBlockSize });
                refreshState();
            });
        }

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
            currentBlockSize = state.blockSize || currentBlockSize;

            selectL1Cap.value = currentL1Cap.toString();
            selectL2Cap.value = currentL2Cap.toString();
            if (selectPolicy) selectPolicy.value = currentPolicy;
            if (selectBlockSize) selectBlockSize.value = currentBlockSize.toString();
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

