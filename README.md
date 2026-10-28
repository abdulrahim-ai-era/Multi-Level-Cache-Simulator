# CACHEFLOW — Multi-Level Hardware Cache Simulator
### University Data Structures & Algorithms (DSA) Semester Project

![CACHEFLOW Visual Architecture](https://img.shields.io/badge/Language-C%2B%2B11-blue.svg)
![Frontend](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3%20%7C%20Vanilla%20JS-cyan.svg)
![Architecture](https://img.shields.io/badge/Hierarchy-L1%20%E2%86%92%20L2%20%E2%86%92%20RAM-emerald.svg)
![Time Complexity](https://img.shields.io/badge/Lookup%20%26%20Eviction-O(1)%20Amortized-green.svg)

---

## 1. Project Overview

**CACHEFLOW** is a high-performance, modern hardware cache simulation engine and futuristic laboratory dashboard designed for educational demonstration and DSA semester projects. It simulates a realistic multi-level computer memory hierarchy:

$$\text{CPU Request} \longrightarrow \mathbf{L1\text{ Cache}} \longleftrightarrow \mathbf{L2\text{ Cache}} \longleftrightarrow \mathbf{RAM\text{ (Main Memory)}}$$

The application connects a **pure C++ simulation core** (`cache_engine.exe`) with a **modern futuristic hardware-laboratory web interface** through a local HTTP API. The GUI strictly renders real data returned by the C++ backend—**no duplicate or mocked simulation logic exists in JavaScript**.

---

## 2. DSA Architecture & Time Complexities

The C++ core is engineered around classical Data Structures and Algorithms to achieve **$O(1)$ constant time** for all cache operations:

### A. Custom Doubly Linked List (`backend/doubly_linked_list.h`)
- **Pointers**: `Node* head` (MRU — Most Recently Used) and `Node* tail` (LRU — Least Recently Used).
- `pushFront(Node*)`: Inserts newly fetched or accessed line at Head in **$O(1)$**.
- `moveToFront(Node*)`: Unlinks node and splices it to Head in **$O(1)$**.
- `popBack()`: Detaches and returns the LRU candidate at Tail in **$O(1)$**.
- Eliminates the need for array shifts ($O(N)$) upon eviction.

### B. Fast Hash Map (`backend/cache_level.h`)
- `std::unordered_map<std::string, Node*>` maps memory addresses (e.g. `"0x3A1F"`) to linked list node pointers in **$O(1)$ amortized**.
- Enables instant cache hit detection and immediate pointer acquisition.

### C. Multi-Level Memory Hierarchy (`backend/memory_hierarchy.h`)
- **Latency Hierarchy Model**:
  - **L1 Cache**: $1\text{ ns}$ latency (Default capacity: $4\text{ lines}$)
  - **L2 Cache**: $5\text{ ns}$ cumulative latency ($1\text{ ns L1} + 4\text{ ns L2}$, Default capacity: $8\text{ lines}$)
  - **RAM (Main Memory)**: $105\text{ ns}$ cumulative latency ($1\text{ ns L1} + 4\text{ ns L2} + 100\text{ ns RAM}$)
- **Invariants & Replacement Cascades**:
  1. **L1 Hit**: Address found in L1. Moved to L1 MRU. Latency: $1\text{ ns}$.
  2. **L2 Hit**: Address found in L2. Removed from L2 and **promoted** to L1 MRU. If L1 is full, L1's LRU line is **demoted** into L2 MRU. If L2 is also full, L2 evicts its LRU line.
  3. **RAM Miss**: Address absent from both caches. Fetched from RAM and placed in L1 MRU. If L1 is full, L1's LRU entry demotes to L2. If L2 is full, an eviction occurs.
- **Policies Supported**:
  - **LRU** (Least Recently Used)
  - **FIFO** (First In, First Out)
  - **LFU** (Least Frequently Used with frequency counters & timestamp tie-breaking)

---

## 3. Visual Interface & Design System

The GUI faithfully implements the futuristic hardware-laboratory aesthetic specified in the reference image:

- **Color Palette**:
  - Main Background: Deep Navy (`#061426`) with subtle circuit glow
  - Panels: `#0B1D33`
  - Secondary Surfaces: `#102640`
  - Primary Cyan: `#00D9FF`
  - L1 Accent: Emerald Green / Turquoise (`#00E5A3`)
  - L2 Accent: Electric Blue (`#0088FF`)
  - RAM Accent: Violet (`#A855F7`)
- **Structure**:
  1. **Top Header**: Status indicator with animated pulse reflecting actual C++ engine socket health (`C++ Engine Connected` / `Disconnected`).
  2. **Sidebar**: Compact navigation across **Overview**, **Simulator**, **Analytics**, **Comparison**, and **About**.
  3. **Overview Page (Simplified Main Dashboard)**:
     - 4 compact metric cards: **Total Requests**, **Overall Hit Rate**, **Avg. Access Time**, **RAM Misses**.
     - Central **Cache Hierarchy Visualization**: L1 $\leftrightarrow$ L2 $\leftrightarrow$ RAM with holographic pedestals, address slots, MRU/LRU tags, and bidirectional animated transfer arrows.
     - **Request Simulator Card**: Address input, sequence loader, step/run/reset controls, capacity dropdowns.
     - **Latest Operation Panel**: Prominent result badge (`L1 HIT`, `L2 HIT`, `RAM MISS`), access latency, and visual cache movement breadcrumbs.
  4. **Simulator Page**: Step-by-step debugger, trace progress bar, workload presets (Temporal locality loop, Spatial locality, Thrashing conflict, Random).
  5. **Analytics Page**: Hit rate progress bars, Canvas-rendered latency timeline waveform, L1/L2 cache occupancy bars, hardware counters, and speedup ratio.
  6. **Comparison Page**: Independent C++ multi-policy benchmark running identical address traces across LRU, FIFO, and LFU side-by-side.
  7. **About Page**: Academic DSA explanations, flow diagrams, and educational context.

---

## 4. Hardware Performance Formulas

All performance counters adhere strictly to the project specification:

$$\text{Overall Hit Rate} = \left(\frac{\text{L1 Hits} + \text{L2 Hits}}{\text{Total Requests}}\right) \times 100\%$$

$$\text{Average Access Time} = \frac{\text{Total Access Time (ns)}}{\text{Total Requests}}$$

$$\text{Time Saved} = (105\text{ ns} \times \text{Total Requests}) - \text{Total Access Time}$$

$$\text{Speedup Percentage} = \left(\frac{\text{Time Saved}}{105\text{ ns} \times \text{Total Requests}}\right) \times 100\%$$

$$\text{Effective Speedup Factor} = \frac{105\text{ ns} \times \text{Total Requests}}{\text{Total Access Time}}$$

---

## 5. Quick Start & Execution Guide (Windows)

The application requires **zero paid hosting, zero cloud setup, and zero external npm downloads**.

### Option A: One-Click Launcher (Recommended)
Double-click `start.bat` in the project root:
```cmd
start.bat
```
This automatically compiles `cache_engine.exe` (if needed), starts the native C++ HTTP server on port 8080, and opens your default browser at `http://localhost:8080`.

### Option B: Manual Compilation with MinGW / g++
```cmd
# 1. Compile C++ engine with Winsock
g++ -std=c++11 -O2 backend\main.cpp -o cache_engine.exe -lws2_32

# 2. Run C++ server on port 8080
cache_engine.exe 8080
```
Open `http://localhost:8080` in your web browser.

### Option C: PowerShell
```powershell
.\start.ps1
```

### Option D: Python Launcher
```cmd
python server.py
```

---

## 6. Project Directory Structure

```text
GUI for Cache Simulator/
├── backend/
│   ├── cache_types.h         # Core types, Node struct, Entry, Metrics, OperationRecord
│   ├── doubly_linked_list.h  # Custom Doubly Linked List with Head(MRU) & Tail(LRU)
│   ├── cache_level.h         # CacheLevel class: std::unordered_map + DoublyLinkedList
│   ├── memory_hierarchy.h    # L1 -> L2 -> RAM simulation, promotion, demotion, cascade
│   ├── json_helper.h         # Zero-dependency JSON serializer & extractor
│   └── main.cpp              # Native Winsock HTTP Server (Port 8080) & API endpoints
├── frontend/
│   ├── index.html            # Main SPA dashboard matching reference image
│   ├── css/
│   │   └── style.css         # Futuristic Navy & Cyan hardware lab stylesheet
│   └── js/
│       ├── app.js            # Main controller, API client, event handlers
│       ├── cache-viz.js      # L1/L2/RAM visualizer, pedestals, slot renderers
│       └── charts.js         # Offline HTML5 Canvas charts (Timeline & Comparison)
├── compile.bat               # Windows batch compiler
├── start.bat                 # One-click Windows launch script
├── start.ps1                 # PowerShell launcher
├── server.py                 # Optional Python server alternative
└── README.md                 # Complete project documentation
```

---

## 7. C++ REST API Reference

The C++ server exposes clean REST endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | `GET` | Returns connection state, metrics, L1 slots, L2 slots, RAM lines, and capacities. |
| `/api/request` | `POST` | Accepts `{"address":"0x3A1F"}`. Executes C++ lookup/promotions. Returns operation record and updated state. |
| `/api/sequence` | `POST` | Accepts `{"sequence":["0x1000","0x2000",...]}`. Executes full trace in C++. |
| `/api/reset` | `POST` | Resets cache levels, clearing all entries and performance metrics. |
| `/api/config` | `POST` | Updates `l1Capacity`, `l2Capacity`, or replacement `policy`. |
| `/api/compare` | `POST` | Runs the identical sequence across independent **LRU**, **FIFO**, and **LFU** instances. |

---

## 8. Academic Viva / Defense Q&A

**Q1: Why use a Doubly Linked List combined with a Hash Map?**  
> *A:* A Hash Map provides $O(1)$ address lookup but has no order. A Doubly Linked List maintains access recency order and allows removing any arbitrary node in $O(1)$ using pointer manipulation (`prev` and `next`), moving it to the head (MRU) without shifting an array ($O(N)$).

**Q2: What is the difference between an Inclusive and Exclusive cache?**  
> *A:* In an exclusive cache (implemented here), a cache line can exist in either L1 or L2, but not both simultaneously. When a hit occurs in L2, the line is promoted to L1, and if L1 is full, L1's LRU line is demoted to L2.

**Q3: How does LFU break ties?**  
> *A:* In CACHEFLOW, each entry tracks both access frequency and a timestamp. When multiple lines share the lowest frequency, the line with the oldest access timestamp is evicted.

