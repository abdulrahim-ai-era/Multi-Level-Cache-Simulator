#ifndef MEMORY_HIERARCHY_H
#define MEMORY_HIERARCHY_H

#include "cache_types.h"
#include "cache_level.h"
#include <string>
#include <vector>
#include <deque>
#include <memory>
#include <sstream>
#include <iomanip>
#include <algorithm>

inline std::string fmt1(double v) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(1) << v;
    return ss.str();
}

/**
 * Multi-Level Memory Hierarchy Simulator.
 * Simulates CPU Request -> L1 Cache -> L2 Cache -> RAM.
 * Supports LRU, FIFO, LFU, and ADAPTIVE (automatic dynamic switching).
 */
class MemoryHierarchy {
private:
    static constexpr double L1_LATENCY = 1.0;
    static constexpr double L2_LATENCY = 4.0;
    static constexpr double RAM_LATENCY = 100.0;
    static constexpr uint64_t ADAPT_WINDOW = 200;

    CacheLevel l1_;
    CacheLevel l2_;
    CacheMetrics metrics_;
    PolicyType policy_;
    uint64_t simulatedTimeStep_;
    std::deque<std::string> ramRecentAddresses_;
    std::vector<OperationRecord> history_;

    // Adaptive policy shadow simulation
    std::unique_ptr<MemoryHierarchy> shadowLru_;
    std::unique_ptr<MemoryHierarchy> shadowLfu_;
    uint64_t windowRequests_;
    uint64_t lruWindowStartHits_;
    uint64_t lfuWindowStartHits_;
    double lastLruRate_;
    double lastLfuRate_;
    std::vector<SwitchEvent> switchLog_;
    size_t blockSize_;

    static PolicyType concrete(PolicyType p) {
        return (p == PolicyType::ADAPTIVE) ? PolicyType::LRU : p;
    }

    void applyActive(PolicyType p) {
        l1_.setPolicy(p);
        l2_.setPolicy(p);
    }

    void setupAdaptive() {
        shadowLru_.reset(new MemoryHierarchy(l1_.getCapacity(), l2_.getCapacity(), PolicyType::LRU));
        shadowLfu_.reset(new MemoryHierarchy(l1_.getCapacity(), l2_.getCapacity(), PolicyType::LFU));
        windowRequests_ = 0;
        lruWindowStartHits_ = 0;
        lfuWindowStartHits_ = 0;
        lastLruRate_ = 0.0;
        lastLfuRate_ = 0.0;
        switchLog_.clear();
    }

    std::string toBlockAddress(const std::string& addr) const {
        if (blockSize_ <= 1) return addr;
        unsigned long long v = 0;
        try {
            v = std::stoull(addr.substr(2), nullptr, 16);
        } catch (...) {
            return addr;
        }
        v -= v % blockSize_;
        std::ostringstream ss;
        ss << "0x" << std::uppercase << std::hex << std::setw(4) << std::setfill('0') << v;
        return ss.str();
    }

    void adaptiveStep(const std::string& addr, OperationRecord& op) {
        if (!shadowLru_ || !shadowLfu_) return;
        shadowLru_->request(addr);
        shadowLfu_->request(addr);
        windowRequests_++;
        if (windowRequests_ < ADAPT_WINDOW) return;

        const CacheMetrics& a = shadowLru_->getMetrics();
        const CacheMetrics& b = shadowLfu_->getMetrics();
        uint64_t lruHits = a.l1Hits + a.l2Hits;
        uint64_t lfuHits = b.l1Hits + b.l2Hits;
        double lruRate = static_cast<double>(lruHits - lruWindowStartHits_) * 100.0 / ADAPT_WINDOW;
        double lfuRate = static_cast<double>(lfuHits - lfuWindowStartHits_) * 100.0 / ADAPT_WINDOW;
        lruWindowStartHits_ = lruHits;
        lfuWindowStartHits_ = lfuHits;
        lastLruRate_ = lruRate;
        lastLfuRate_ = lfuRate;
        windowRequests_ = 0;

        PolicyType current = l1_.getPolicy();
        PolicyType winner = current;
        if (lruRate > lfuRate) winner = PolicyType::LRU;
        else if (lfuRate > lruRate) winner = PolicyType::LFU;

        if (winner != current) {
            SwitchEvent ev = {simulatedTimeStep_, current, winner, lruRate, lfuRate};
            switchLog_.push_back(ev);
            applyActive(winner);
            op.policySwitch = "Adaptive switch at request " + std::to_string(simulatedTimeStep_) + ": " +
                              policyName(current) + " -> " + policyName(winner) +
                              " (LRU " + fmt1(lruRate) + "% vs LFU " + fmt1(lfuRate) + "%)";
        }
    }

    OperationRecord process(const std::string& addr) {
        simulatedTimeStep_++;
        metrics_.totalRequests++;

        OperationRecord op;
        op.address = addr;

        // 1. Check L1 Cache
        CacheEntry l1FoundEntry;
        if (l1_.access(addr, simulatedTimeStep_, &l1FoundEntry)) {
            metrics_.l1Hits++;
            double time = L1_LATENCY;
            metrics_.totalAccessTimeNs += time;

            op.result = AccessResult::L1_HIT;
            op.accessTimeNs = time;
            op.description = "Address " + addr + " found in L1 Cache.";
            op.movementBreadcrumb = {"L1 Hit", "L2", "RAM"};

            history_.push_back(op);
            return op;
        }

        // 2. Check L2 Cache
        CacheEntry l2FoundEntry;
        if (l2_.contains(addr)) {
            metrics_.l2Hits++;
            double time = L1_LATENCY + L2_LATENCY; // 5.0 ns
            metrics_.totalAccessTimeNs += time;

            l2_.remove(addr, &l2FoundEntry);
            l2FoundEntry.frequency++;
            l2FoundEntry.lastAccessTime = simulatedTimeStep_;
            op.promotedAddress = addr;

            CacheEntry l1Evicted;
            bool l1Demoted = l1_.insert(l2FoundEntry, &l1Evicted);
            if (l1Demoted) {
                op.demotedAddress = l1Evicted.address;
                CacheEntry l2Evicted;
                bool l2EvictedFlag = l2_.insert(l1Evicted, &l2Evicted);
                if (l2EvictedFlag) {
                    op.evictedAddress = l2Evicted.address;
                    metrics_.totalEvictions++;
                }
            }

            op.result = AccessResult::L2_HIT;
            op.accessTimeNs = time;
            op.description = "Address " + addr + " found in L2 Cache. Promoted to L1.";
            op.movementBreadcrumb = {"L1 Miss", "L2 Hit", "Promoted to L1"};

            history_.push_back(op);
            return op;
        }

        // 3. Cache Miss - Backing Memory (RAM Found / RAM Hit)
        metrics_.ramHits++;
        double time = L1_LATENCY + L2_LATENCY + RAM_LATENCY; // 105.0 ns
        metrics_.totalAccessTimeNs += time;

        CacheEntry fetched(addr, 0, simulatedTimeStep_);

        bool alreadyInRamList = false;
        for (const auto& r : ramRecentAddresses_) {
            if (r == addr) {
                alreadyInRamList = true;
                break;
            }
        }
        if (!alreadyInRamList) {
            ramRecentAddresses_.push_front(addr);
            if (ramRecentAddresses_.size() > 6) {
                ramRecentAddresses_.pop_back();
            }
        }

        CacheEntry l1Evicted;
        bool l1Demoted = l1_.insert(fetched, &l1Evicted);
        if (l1Demoted) {
            op.demotedAddress = l1Evicted.address;
            CacheEntry l2Evicted;
            bool l2EvictedFlag = l2_.insert(l1Evicted, &l2Evicted);
            if (l2EvictedFlag) {
                op.evictedAddress = l2Evicted.address;
                metrics_.totalEvictions++;
            }
        }

        op.result = AccessResult::RAM_HIT;
        op.accessTimeNs = time;
        op.description = "Address " + addr + " was not in L1 or L2, so it was fetched from RAM (RAM Found).";
        op.movementBreadcrumb = {"L1 Miss", "L2 Miss", "RAM Found"};

        history_.push_back(op);
        return op;
    }

public:
    MemoryHierarchy(size_t l1Cap = 4, size_t l2Cap = 8, PolicyType policy = PolicyType::LRU)
        : l1_("L1 Cache", l1Cap, concrete(policy), L1_LATENCY),
          l2_("L2 Cache", l2Cap, concrete(policy), L2_LATENCY),
          policy_(policy),
          simulatedTimeStep_(0),
          windowRequests_(0),
          lruWindowStartHits_(0),
          lfuWindowStartHits_(0),
          blockSize_(1) {
        initRam();
        if (policy_ == PolicyType::ADAPTIVE) setupAdaptive();
    }

    void initRam() {
        ramRecentAddresses_.clear();
        ramRecentAddresses_.push_back("0x0000");
        ramRecentAddresses_.push_back("0x1000");
        ramRecentAddresses_.push_back("0x2000");
        ramRecentAddresses_.push_back("0x3000");
    }

    void reset(size_t l1Cap = 0, size_t l2Cap = 0) {
        if (l1Cap > 0) l1_.setCapacity(l1Cap);
        if (l2Cap > 0) l2_.setCapacity(l2Cap);
        l1_.clear();
        l2_.clear();
        metrics_ = CacheMetrics();
        simulatedTimeStep_ = 0;
        history_.clear();
        initRam();
        applyActive(concrete(policy_));
        if (policy_ == PolicyType::ADAPTIVE) setupAdaptive();
    }

    void setPolicy(PolicyType p) {
        policy_ = p;
        applyActive(concrete(p));
        if (p == PolicyType::ADAPTIVE) {
            setupAdaptive();
        } else {
            shadowLru_.reset();
            shadowLfu_.reset();
            switchLog_.clear();
        }
    }

    void setBlockSize(size_t b) {
        blockSize_ = (b > 0) ? b : 1;
    }

    PolicyType getPolicy() const { return policy_; }
    PolicyType getActivePolicy() const { return l1_.getPolicy(); }
    size_t getBlockSize() const { return blockSize_; }
    size_t getL1Capacity() const { return l1_.getCapacity(); }
    size_t getL2Capacity() const { return l2_.getCapacity(); }
    const std::vector<SwitchEvent>& getSwitchLog() const { return switchLog_; }
    uint64_t getWindowRequests() const { return windowRequests_; }
    double getLastLruRate() const { return lastLruRate_; }
    double getLastLfuRate() const { return lastLfuRate_; }

    void setCapacities(size_t l1Cap, size_t l2Cap) {
        if (l1Cap > 0) l1_.setCapacity(l1Cap);
        if (l2Cap > 0) l2_.setCapacity(l2Cap);
    }

    static std::string normalizeAddress(const std::string& raw) {
        std::string s = raw;
        size_t first = s.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) return "";
        size_t last = s.find_last_not_of(" \t\r\n");
        s = s.substr(first, (last - first + 1));

        if (s.size() >= 2 && (s[0] == '0' && (s[1] == 'x' || s[1] == 'X'))) {
            s = s.substr(2);
        }

        for (char& c : s) {
            c = static_cast<char>(std::toupper(c));
        }

        while (s.size() < 4) {
            s = "0" + s;
        }

        return "0x" + s;
    }

    OperationRecord request(const std::string& rawAddress) {
        std::string addr = normalizeAddress(rawAddress);
        if (addr.empty()) {
            OperationRecord emptyOp;
            emptyOp.address = "0x0000";
            emptyOp.result = AccessResult::RAM_HIT;
            emptyOp.accessTimeNs = 0.0;
            emptyOp.description = "Invalid address entered";
            return emptyOp;
        }

        addr = toBlockAddress(addr);
        OperationRecord op = process(addr);
        if (policy_ == PolicyType::ADAPTIVE) adaptiveStep(addr, op);
        return op;
    }

    const CacheMetrics& getMetrics() const {
        return metrics_;
    }

    std::vector<CacheEntry> getL1Entries() const {
        return l1_.getEntries();
    }

    std::vector<CacheEntry> getL2Entries() const {
        return l2_.getEntries();
    }

    std::vector<std::string> getRamEntries() const {
        return std::vector<std::string>(ramRecentAddresses_.begin(), ramRecentAddresses_.end());
    }

    const std::vector<OperationRecord>& getHistory() const {
        return history_;
    }
};

#endif // MEMORY_HIERARCHY_H
