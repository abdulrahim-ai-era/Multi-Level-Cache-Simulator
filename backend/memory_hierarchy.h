#ifndef MEMORY_HIERARCHY_H
#define MEMORY_HIERARCHY_H

#include "cache_types.h"
#include "cache_level.h"
#include <string>
#include <vector>
#include <deque>
#include <sstream>
#include <iomanip>

/**
 * Multi-Level Memory Hierarchy Simulator.
 * Simulates CPU Request -> L1 Cache -> L2 Cache -> RAM.
 * Maintains exclusive placement, handling realistic promotions, demotions,
 * and eviction cascades between hierarchy levels.
 */
class MemoryHierarchy {
private:
    CacheLevel l1_;
    CacheLevel l2_;
    CacheMetrics metrics_;
    PolicyType policy_;
    uint64_t simulatedTimeStep_;
    std::deque<std::string> ramRecentAddresses_;
    std::vector<OperationRecord> history_;

    // Latency constants (in nanoseconds)
    const double L1_LATENCY = 1.0;
    const double L2_LATENCY = 4.0;   // L1 (1) + L2 (4) = 5 ns total
    const double RAM_LATENCY = 100.0; // Total 105 ns on RAM miss

public:
    MemoryHierarchy(size_t l1Cap = 4, size_t l2Cap = 8, PolicyType policy = PolicyType::LRU)
        : l1_("L1 Cache", l1Cap, policy, L1_LATENCY),
          l2_("L2 Cache", l2Cap, policy, L2_LATENCY),
          policy_(policy),
          simulatedTimeStep_(0) {
        initRam();
    }

    void initRam() {
        ramRecentAddresses_.clear();
        // Seed default representative RAM memory blocks as shown in reference design
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
    }

    void setPolicy(PolicyType p) {
        policy_ = p;
        l1_.setPolicy(p);
        l2_.setPolicy(p);
    }

    PolicyType getPolicy() const { return policy_; }
    size_t getL1Capacity() const { return l1_.getCapacity(); }
    size_t getL2Capacity() const { return l2_.getCapacity(); }

    void setCapacities(size_t l1Cap, size_t l2Cap) {
        if (l1Cap > 0) l1_.setCapacity(l1Cap);
        if (l2Cap > 0) l2_.setCapacity(l2Cap);
    }

    // Normalizes address string to standardized hexadecimal representation (e.g. 0x3A1F)
    static std::string normalizeAddress(const std::string& raw) {
        std::string s = raw;
        // Trim leading and trailing whitespace
        size_t first = s.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) return "";
        size_t last = s.find_last_not_of(" \t\r\n");
        s = s.substr(first, (last - first + 1));

        // Check for 0x prefix
        if (s.size() >= 2 && (s[0] == '0' && (s[1] == 'x' || s[1] == 'X'))) {
            s = s.substr(2);
        }

        // Convert hex digits to uppercase
        for (char& c : s) {
            c = static_cast<char>(std::toupper(c));
        }

        // Pad to at least 4 hex digits if practical
        while (s.size() < 4) {
            s = "0" + s;
        }

        return "0x" + s;
    }

    // Process a single memory request
    OperationRecord request(const std::string& rawAddress) {
        std::string addr = normalizeAddress(rawAddress);
        if (addr.empty()) {
            OperationRecord emptyOp;
            emptyOp.address = "0x0000";
            emptyOp.result = AccessResult::RAM_MISS;
            emptyOp.accessTimeNs = 0.0;
            emptyOp.description = "Invalid address entered";
            return emptyOp;
        }

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

            // Remove from L2 so it can be promoted exclusively to L1
            l2_.remove(addr, &l2FoundEntry);
            l2FoundEntry.frequency++;
            l2FoundEntry.lastAccessTime = simulatedTimeStep_;
            op.promotedAddress = addr;

            // Promote to L1. If L1 is full, demote L1's LRU to L2!
            CacheEntry l1Evicted;
            bool l1Demoted = l1_.insert(l2FoundEntry, &l1Evicted);
            if (l1Demoted) {
                op.demotedAddress = l1Evicted.address;
                // Insert demoted entry into L2
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

        // 3. Cache Miss - Backing Memory (RAM) Access
        metrics_.ramMisses++;
        double time = L1_LATENCY + L2_LATENCY + RAM_LATENCY; // 105.0 ns
        metrics_.totalAccessTimeNs += time;

        // Create new entry fetched from RAM
        CacheEntry fetched(addr, 0, simulatedTimeStep_);

        // Record in RAM recently accessed
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

        // Insert into L1
        CacheEntry l1Evicted;
        bool l1Demoted = l1_.insert(fetched, &l1Evicted);
        if (l1Demoted) {
            op.demotedAddress = l1Evicted.address;
            // Demote into L2
            CacheEntry l2Evicted;
            bool l2EvictedFlag = l2_.insert(l1Evicted, &l2Evicted);
            if (l2EvictedFlag) {
                op.evictedAddress = l2Evicted.address;
                metrics_.totalEvictions++;
            }
        }

        op.result = AccessResult::RAM_MISS;
        op.accessTimeNs = time;
        op.description = "Address " + addr + " was absent from both cache levels and required a RAM access.";
        op.movementBreadcrumb = {"L1 Miss", "L2 Miss", "RAM Fetch"};

        history_.push_back(op);
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

