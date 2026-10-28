#ifndef CACHE_TYPES_H
#define CACHE_TYPES_H

#include <string>
#include <vector>
#include <cstdint>

// Eviction policy types
enum class PolicyType {
    LRU,
    FIFO,
    LFU
};

// Access outcome
enum class AccessResult {
    L1_HIT,
    L2_HIT,
    RAM_MISS
};

// Cache entry representation
struct CacheEntry {
    std::string address;
    uint64_t data;
    uint32_t frequency;      // For LFU
    uint64_t insertTime;     // For FIFO
    uint64_t lastAccessTime; // For LRU

    CacheEntry(const std::string& addr = "", uint64_t d = 0, uint64_t time = 0)
        : address(addr), data(d), frequency(1), insertTime(time), lastAccessTime(time) {}
};

// Custom Doubly Linked List Node for DSA rigor
struct Node {
    CacheEntry entry;
    Node* prev;
    Node* next;

    Node(const CacheEntry& e) : entry(e), prev(nullptr), next(nullptr) {}
};

// Operation record for tracing and GUI animation
struct OperationRecord {
    std::string address;
    AccessResult result;
    double accessTimeNs;
    std::string description;
    std::string promotedAddress;
    std::string demotedAddress;
    std::string evictedAddress;
    std::vector<std::string> movementBreadcrumb;
};

// Comprehensive simulation metrics
struct CacheMetrics {
    uint64_t totalRequests;
    uint64_t l1Hits;
    uint64_t l2Hits;
    uint64_t ramMisses;
    uint64_t totalEvictions;
    double totalAccessTimeNs;

    CacheMetrics()
        : totalRequests(0), l1Hits(0), l2Hits(0), ramMisses(0),
          totalEvictions(0), totalAccessTimeNs(0.0) {}

    double getOverallHitRate() const {
        if (totalRequests == 0) return 0.0;
        return (static_cast<double>(l1Hits + l2Hits) / totalRequests) * 100.0;
    }

    double getL1HitRate() const {
        if (totalRequests == 0) return 0.0;
        return (static_cast<double>(l1Hits) / totalRequests) * 100.0;
    }

    double getL2HitRate() const {
        if (totalRequests == 0) return 0.0;
        return (static_cast<double>(l2Hits) / totalRequests) * 100.0;
    }

    double getRamMissRate() const {
        if (totalRequests == 0) return 0.0;
        return (static_cast<double>(ramMisses) / totalRequests) * 100.0;
    }

    double getAvgAccessTime() const {
        if (totalRequests == 0) return 0.0;
        return totalAccessTimeNs / totalRequests;
    }

    double getTimeSaved(double ramLatencyNs = 105.0) const {
        double directRamTime = ramLatencyNs * totalRequests;
        return directRamTime - totalAccessTimeNs;
    }

    double getSpeedup(double ramLatencyNs = 105.0) const {
        if (totalAccessTimeNs <= 0.0 || totalRequests == 0) return 0.0;
        double directRamTime = ramLatencyNs * totalRequests;
        return (directRamTime / totalAccessTimeNs);
    }
};

#endif // CACHE_TYPES_H

