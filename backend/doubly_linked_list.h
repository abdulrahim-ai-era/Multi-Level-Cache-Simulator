#ifndef DOUBLY_LINKED_LIST_H
#define DOUBLY_LINKED_LIST_H

#include "cache_types.h"
#include <vector>

/**
 * Custom Doubly Linked List for Cache Line Tracking.
 * Head represents Most Recently Used (MRU) or newest entry.
 * Tail represents Least Recently Used (LRU) or oldest entry.
 * All node operations are strictly O(1).
 */
class DoublyLinkedList {
private:
    Node* head;
    Node* tail;
    size_t size_;

public:
    DoublyLinkedList() : head(nullptr), tail(nullptr), size_(0) {}

    ~DoublyLinkedList() {
        clear();
    }

    // Disable copy constructor/assignment to prevent double free
    DoublyLinkedList(const DoublyLinkedList&) = delete;
    DoublyLinkedList& operator=(const DoublyLinkedList&) = delete;

    size_t size() const {
        return size_;
    }

    bool empty() const {
        return size_ == 0;
    }

    Node* getHead() const {
        return head;
    }

    Node* getTail() const {
        return tail;
    }

    // Inserts a newly allocated node at the head (MRU) - O(1)
    void pushFront(Node* node) {
        if (!node) return;
        node->prev = nullptr;
        node->next = head;

        if (head) {
            head->prev = node;
        } else {
            tail = node; // first element
        }
        head = node;
        size_++;
    }

    // Removes an existing node from anywhere in the list - O(1)
    void removeNode(Node* node) {
        if (!node) return;

        if (node->prev) {
            node->prev->next = node->next;
        } else {
            head = node->next; // node was head
        }

        if (node->next) {
            node->next->prev = node->prev;
        } else {
            tail = node->prev; // node was tail
        }

        node->prev = nullptr;
        node->next = nullptr;
        size_--;
    }

    // Moves an existing node to the head (MRU) - O(1)
    void moveToFront(Node* node) {
        if (!node || node == head) return;
        removeNode(node);
        pushFront(node);
    }

    // Removes and returns the tail node (LRU / oldest) - O(1)
    Node* popBack() {
        if (!tail) return nullptr;
        Node* lruNode = tail;
        removeNode(lruNode);
        return lruNode;
    }

    // Clears and frees all nodes
    void clear() {
        Node* curr = head;
        while (curr) {
            Node* temp = curr;
            curr = curr->next;
            delete temp;
        }
        head = nullptr;
        tail = nullptr;
        size_ = 0;
    }

    // Exports entries from Head (MRU) to Tail (LRU)
    std::vector<CacheEntry> toVector() const {
        std::vector<CacheEntry> result;
        Node* curr = head;
        while (curr) {
            result.push_back(curr->entry);
            curr = curr->next;
        }
        return result;
    }
};

#endif // DOUBLY_LINKED_LIST_H

