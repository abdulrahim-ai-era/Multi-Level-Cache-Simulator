/**
 * CACHEFLOW — Cache Hierarchy Visualizer
 * Manages dynamic rendering of L1, L2, and RAM modules, address slots,
 * glowing transfer animations, and MRU/LRU indicators.
 */

const CacheViz = (function() {
    // DOM Elements
    const l1SlotsEl = document.getElementById('l1Slots');
    const l2SlotsEl = document.getElementById('l2Slots');
    const ramSlotsEl = document.getElementById('ramSlots');
    
    const moduleL1 = document.getElementById('moduleL1');
    const moduleL2 = document.getElementById('moduleL2');
    const moduleRAM = document.getElementById('moduleRAM');

    const connectorL1L2 = document.getElementById('connectorL1L2');
    const connectorL2RAM = document.getElementById('connectorL2RAM');

    const l1SpecEl = document.getElementById('l1Spec');
    const l2SpecEl = document.getElementById('l2Spec');

    /**
     * Renders address slots for a cache level
     */
    function renderSlots(containerEl, entries, capacity, dotClass, isRam = false) {
        if (!containerEl) return;
        containerEl.innerHTML = '';

        const totalToRender = isRam ? Math.max(entries.length, 4) : capacity;

        for (let i = 0; i < totalToRender; i++) {
            const slot = document.createElement('div');
            slot.className = 'slot-item';

            if (i < entries.length) {
                const item = entries[i];
                const addr = typeof item === 'string' ? item : item.address;
                slot.id = `slot-${dotClass}-${addr.replace('0x', '')}`;
                
                const addrSpan = document.createElement('span');
                addrSpan.className = 'slot-addr';
                addrSpan.textContent = addr;

                const dotSpan = document.createElement('span');
                dotSpan.className = `slot-dot ${dotClass}`;

                slot.appendChild(addrSpan);
                slot.appendChild(dotSpan);

                // Add frequency or position tooltip
                if (typeof item === 'object' && item.frequency) {
                    slot.title = `Freq: ${item.frequency} | Pos: ${i === 0 ? 'MRU' : (i === entries.length - 1 ? 'LRU' : i)}`;
                }
            } else {
                slot.className += ' empty';
                const emptySpan = document.createElement('span');
                emptySpan.className = 'slot-addr';
                emptySpan.textContent = '--';
                slot.appendChild(emptySpan);
            }

            containerEl.appendChild(slot);
        }
    }

    /**
     * Highlights an active hit or miss on the respective module
     */
    function triggerModulePulse(moduleEl) {
        if (!moduleEl) return;
        moduleEl.classList.add('highlight');
        setTimeout(() => {
            moduleEl.classList.remove('highlight');
        }, 700);
    }

    /**
     * Highlights the accessed address slot specifically
     */
    function highlightAddressSlot(dotClass, address) {
        if (!address) return;
        const cleanAddr = address.replace('0x', '');
        const slotEl = document.getElementById(`slot-${dotClass}-${cleanAddr}`);
        if (slotEl) {
            slotEl.classList.add('highlight-addr');
            setTimeout(() => {
                slotEl.classList.remove('highlight-addr');
            }, 900);
        }
    }

    /**
     * Animates transfer connectors
     */
    function animateConnector(connectorEl, direction = 'right') {
        if (!connectorEl) return;
        const animClass = direction === 'right' ? 'animate-right' : 'animate-left';
        connectorEl.classList.add(animClass);
        setTimeout(() => {
            connectorEl.classList.remove(animClass);
        }, 800);
    }

    return {
        /**
         * Updates all hierarchy modules with fresh state from C++
         */
        render(state) {
            if (!state) return;

            // Update Specs
            if (l1SpecEl && state.l1Capacity) {
                l1SpecEl.textContent = `${state.l1Capacity} Lines | 4-way`;
            }
            if (l2SpecEl && state.l2Capacity) {
                l2SpecEl.textContent = `${state.l2Capacity} Lines | 8-way`;
            }

            // Render Slots
            renderSlots(l1SlotsEl, state.l1 || [], state.l1Capacity || 4, 'emerald');
            renderSlots(l2SlotsEl, state.l2 || [], state.l2Capacity || 8, 'blue');
            renderSlots(ramSlotsEl, state.ram || [], 4, 'violet', true);
        },

        /**
         * Executes visual feedback based on OperationRecord
         */
        handleOperation(op) {
            if (!op) return;

            if (op.result === 'L1_HIT') {
                triggerModulePulse(moduleL1);
                highlightAddressSlot('emerald', op.address);
            } else if (op.result === 'L2_HIT') {
                triggerModulePulse(moduleL2);
                highlightAddressSlot('blue', op.address);
                // Promotion animation: transfer from L2 towards L1
                animateConnector(connectorL1L2, 'left');
            } else if (op.result === 'RAM_MISS') {
                triggerModulePulse(moduleRAM);
                highlightAddressSlot('violet', op.address);
                // RAM fetch animation
                animateConnector(connectorL2RAM, 'left');
                setTimeout(() => {
                    animateConnector(connectorL1L2, 'left');
                }, 300);
            }
        }
    };
})();

