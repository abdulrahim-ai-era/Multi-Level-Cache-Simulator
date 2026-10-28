#ifndef CACHE_LEVEL_H
#define CACHE_LEVEL_H

#include "cache_types.h"
#include "doubly_linked_list.h"
#include <unordered_map>
#include <string>
#include <vector>
#include <algorithm>

/**
 * A Single Cache Level (e.g. L1 or L2) parameterized by capacity and policy.
 * Combines std::unordered_map for O(1) address lookup with a custom DoublyLinkedList
 * for O(1) recency/order tracking.
 */
class CacheLevel {
private:
    std::string name_;
    size_t capacity_;
    PolicyType policy_;
    double latencyNs_;
    DoublyLinkedList list_;
    std::unordered_map<std::string, Node*> lookupTable_;

public:
    CacheLevel(const std::string& name, size_t capacity, PolicyType policy = PolicyType::LRU, double latencyNs = 1.0)
        : name_(name), capacity_(capacity), policy_(policy), latencyNs_(latencyNs) {}

    ~CacheLevel() {
        clear();
    }

    std::string getName() const { return name_; }
    size_t getCapacity() const { return capacity_; }
    size_t getSize() const { return lookupTable_.size(); }
    double getLatency() const { return latencyNs_; }
    PolicyType getPolicy() const { return policy_; }

    void setCapacity(size_t newCap) {
        capacity_ = (newCap > 0) ? newCap : 1;
    }

    void setPolicy(PolicyType p) {
        policy_ = p;
    }

    bool isFull() const {
        return lookupTable_.size() >= capacity_;
    }

    bool contains(const std::string& addr) const {
        return lookupTable_.find(addr) != lookupTable_.end();
    }

    // Accesses an address if present. Updates LRU/LFU position.
    bool access(const std::string& addr, uint64_t currentTime, CacheEntry* outEntry = nullptr) {
        auto it = lookupTable_.find(addr);
        if (it == lookupTable_.end()) {
            return false;
        }

        Node* node = it->second;
        node->entry.frequency++;
        node->entry.lastAccessTime = currentTime;

        if (policy_ == PolicyType::LRU) {
            list_.moveToFront(node);
        }
        // FIFO does NOT move to front on access (preserves insertion order)
        // LFU keeps frequency, list can be re-ordered or sorted on eviction

        if (outEntry) {
            *outEntry = node->entry;
        }
        return true;
    }

    // Inserts a new entry into this cache level.
    // If full, evicts the designated entry according to policy and returns true with evictedEntry.
    bool insert(const CacheEntry& entry, CacheEntry* evictedEntry = nullptr) {
        // If address already exists, just update it
        auto it = lookupTable_.find(entry.address);
        if (it != lookupTable_.end()) {
            Node* node = it->second;
            node->entry = entry;
            node->entry.frequency++;
            if (policy_ == PolicyType::LRU) {
                list_.moveToFront(node);
            }
            return false;
        }

        bool didEvict = false;
        if (isFull()) {
            didEvict = evictCandidate(evictedEntry);
        }

        // Insert new entry at Head (MRU)
        Node* newNode = new Node(entry);
        list_.pushFront(newNode);
        lookupTable_[entry.address] = newNode;

        return didEvict;
    }

    // Removes an entry by address (e.g. for promotion)
    bool remove(const std::string& addr, CacheEntry* outEntry = nullptr) {
        auto it = lookupTable_.find(addr);
        if (it == lookupTable_.end()) {
            return false;
        }

        Node* node = it->second;
        if (outEntry) {
            *outEntry = node->entry;
        }

        list_.removeNode(node);
        lookupTable_.erase(it);
        delete node;
        return true;
    }

    // Evicts one entry according to current policy
    bool evictCandidate(CacheEntry* evictedEntry = nullptr) {
        if (lookupTable_.empty()) return false;

        Node* candidate = nullptr;

        if (policy_ == PolicyType::LRU || policy_ == PolicyType::FIFO) {
            // For LRU, Tail is least recently used
            // For FIFO, Tail is oldest inserted (pushed to head on insert)
            candidate = list_.getTail();
        } else if (policy_ == PolicyType::LFU) {
            // Find node with minimum frequency. Tie-breaker: oldest access time
            Node* curr = list_.getHead();
            candidate = curr;
            while (curr) {
                if (curr->entry.frequency < candidate->entry.frequency ||
                   (curr->entry.frequency == candidate->entry.frequency && 
                    curr->entry.lastAccessTime < candidate->entry.lastAccessTime)) {
                    candidate = curr;
                }
                curr = curr->next;
            }
        }

        if (!candidate) return false;

        if (evictedEntry) {
            *evictedEntry = candidate->entry;
        }

        lookupTable_.erase(candidate->entry.address);
        list_.removeNode(candidate);
        delete candidate;
        return true;
    }

    void clear() {
        lookupTable_.clear();
        list_.clear();
    }

    // Returns ordered vector from MRU (head) to LRU (tail)
    std::vector<CacheEntry> getEntries() const {
        return list_.toVector();
    }
};

#endif // CACHE_LEVEL_H

