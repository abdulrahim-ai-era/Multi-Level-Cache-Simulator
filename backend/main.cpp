#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <fstream>
#include <thread>
#include <mutex>
#include <atomic>
#include <algorithm>

#include "cache_types.h"
#include "cache_level.h"
#include "memory_hierarchy.h"
#include "json_helper.h"

#pragma comment(lib, "ws2_32.lib")

// Global engine instance protected by a mutex
std::mutex g_engineMutex;
MemoryHierarchy g_hierarchy(4, 8, PolicyType::LRU);
std::string g_frontendDir = "./frontend";

// Helper to determine MIME type
std::string getMimeType(const std::string& path) {
    if (path.find(".html") != std::string::npos || path.find(".htm") != std::string::npos) return "text/html; charset=UTF-8";
    if (path.find(".css") != std::string::npos) return "text/css; charset=UTF-8";
    if (path.find(".js") != std::string::npos) return "application/javascript; charset=UTF-8";
    if (path.find(".json") != std::string::npos) return "application/json; charset=UTF-8";
    if (path.find(".png") != std::string::npos) return "image/png";
    if (path.find(".jpg") != std::string::npos || path.find(".jpeg") != std::string::npos) return "image/jpeg";
    if (path.find(".svg") != std::string::npos) return "image/svg+xml";
    if (path.find(".ico") != std::string::npos) return "image/x-icon";
    return "text/plain; charset=UTF-8";
}

// Builds full JSON state response of the simulator
std::string buildFullStateJson(const OperationRecord* lastOp = nullptr) {
    std::ostringstream ss;
    ss << "{";
    ss << "\"status\":\"ok\",";
    ss << "\"connected\":true,";
    ss << "\"engine\":\"C++ Multi-Level Cache Simulator\",";
    ss << "\"policy\":\"" << JsonHelper::policyToString(g_hierarchy.getPolicy()) << "\",";
    ss << "\"l1Capacity\":" << g_hierarchy.getL1Capacity() << ",";
    ss << "\"l2Capacity\":" << g_hierarchy.getL2Capacity() << ",";

    // Metrics
    auto l1Entries = g_hierarchy.getL1Entries();
    auto l2Entries = g_hierarchy.getL2Entries();
    auto ramEntries = g_hierarchy.getRamEntries();

    ss << "\"metrics\":" << JsonHelper::metricsToJson(g_hierarchy.getMetrics(),
                                                     g_hierarchy.getL1Capacity(),
                                                     g_hierarchy.getL2Capacity(),
                                                     l1Entries.size(),
                                                     l2Entries.size()) << ",";

    // L1 Entries
    ss << "\"l1\":[";
    for (size_t i = 0; i < l1Entries.size(); ++i) {
        if (i > 0) ss << ",";
        ss << JsonHelper::entryToJson(l1Entries[i], i, l1Entries.size());
    }
    ss << "],";

    // L2 Entries
    ss << "\"l2\":[";
    for (size_t i = 0; i < l2Entries.size(); ++i) {
        if (i > 0) ss << ",";
        ss << JsonHelper::entryToJson(l2Entries[i], i, l2Entries.size());
    }
    ss << "],";

    // RAM Entries
    ss << "\"ram\":[";
    for (size_t i = 0; i < ramEntries.size(); ++i) {
        if (i > 0) ss << ",";
        ss << "{\"address\":\"" << JsonHelper::escapeString(ramEntries[i]) << "\",\"position\":" << i << "}";
    }
    ss << "],";

    // Latest Operation
    if (lastOp) {
        ss << "\"latestOperation\":" << JsonHelper::operationToJson(*lastOp);
    } else {
        const auto& hist = g_hierarchy.getHistory();
        if (!hist.empty()) {
            ss << "\"latestOperation\":" << JsonHelper::operationToJson(hist.back());
        } else {
            ss << "\"latestOperation\":null";
        }
    }

    ss << "}";
    return ss.str();
}

// Runs comparison of identical sequence across LRU, FIFO, and LFU
std::string runComparison(const std::vector<std::string>& sequence, size_t l1Cap, size_t l2Cap) {
    MemoryHierarchy simLru(l1Cap, l2Cap, PolicyType::LRU);
    MemoryHierarchy simFifo(l1Cap, l2Cap, PolicyType::FIFO);
    MemoryHierarchy simLfu(l1Cap, l2Cap, PolicyType::LFU);

    for (const auto& addr : sequence) {
        simLru.request(addr);
        simFifo.request(addr);
        simLfu.request(addr);
    }

    std::ostringstream ss;
    ss << "{";
    ss << "\"status\":\"ok\",";
    ss << "\"sequenceLength\":" << sequence.size() << ",";
    ss << "\"l1Capacity\":" << l1Cap << ",";
    ss << "\"l2Capacity\":" << l2Cap << ",";
    
    // LRU
    ss << "\"lru\":" << JsonHelper::metricsToJson(simLru.getMetrics(), l1Cap, l2Cap, simLru.getL1Entries().size(), simLru.getL2Entries().size()) << ",";
    // FIFO
    ss << "\"fifo\":" << JsonHelper::metricsToJson(simFifo.getMetrics(), l1Cap, l2Cap, simFifo.getL1Entries().size(), simFifo.getL2Entries().size()) << ",";
    // LFU
    ss << "\"lfu\":" << JsonHelper::metricsToJson(simLfu.getMetrics(), l1Cap, l2Cap, simLfu.getL1Entries().size(), simLfu.getL2Entries().size());

    ss << "}";
    return ss.str();
}

// Reads file content as binary or string
bool readFile(const std::string& filepath, std::string& content) {
    std::ifstream file(filepath.c_str(), std::ios::in | std::ios::binary);
    if (!file.is_open()) return false;
    std::ostringstream ss;
    ss << file.rdbuf();
    content = ss.str();
    return true;
}

// HTTP Response generator
void sendHttpResponse(SOCKET clientSocket, int statusCode, const std::string& contentType, const std::string& body) {
    std::ostringstream response;
    std::string statusText = (statusCode == 200) ? "OK" : ((statusCode == 404) ? "Not Found" : "Internal Error");
    
    response << "HTTP/1.1 " << statusCode << " " << statusText << "\r\n";
    response << "Content-Type: " << contentType << "\r\n";
    response << "Content-Length: " << body.size() << "\r\n";
    response << "Access-Control-Allow-Origin: *\r\n";
    response << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n";
    response << "Access-Control-Allow-Headers: Content-Type\r\n";
    response << "Connection: close\r\n\r\n";
    response << body;

    std::string responseStr = response.str();
    int totalSent = 0;
    int toSend = static_cast<int>(responseStr.size());
    while (totalSent < toSend) {
        int sent = send(clientSocket, responseStr.c_str() + totalSent, toSend - totalSent, 0);
        if (sent <= 0) break;
        totalSent += sent;
    }
    shutdown(clientSocket, SD_SEND);
    char drain[256];
    while (recv(clientSocket, drain, sizeof(drain), 0) > 0) {}
    closesocket(clientSocket);
}

// Request worker handler
void handleClient(SOCKET clientSocket) {
    std::string request;
    char buffer[4096];
    int bytesReceived = 0;

    // Read until headers end
    size_t headerEnd = std::string::npos;
    while ((bytesReceived = recv(clientSocket, buffer, sizeof(buffer), 0)) > 0) {
        request.append(buffer, bytesReceived);
        headerEnd = request.find("\r\n\r\n");
        if (headerEnd != std::string::npos) break;
    }

    if (headerEnd == std::string::npos) {
        closesocket(clientSocket);
        return;
    }

    // Extract method and path
    std::istringstream reqStream(request);
    std::string method, path, version;
    reqStream >> method >> path >> version;

    // Handle OPTIONS for CORS pre-flight
    if (method == "OPTIONS") {
        sendHttpResponse(clientSocket, 200, "text/plain", "");
        return;
    }

    // Check Content-Length for POST body
    size_t contentLength = 0;
    size_t clPos = request.find("Content-Length:");
    if (clPos == std::string::npos) {
        clPos = request.find("content-length:");
    }
    if (clPos != std::string::npos) {
        size_t lineEnd = request.find("\r\n", clPos);
        std::string clVal = request.substr(clPos + 15, lineEnd - (clPos + 15));
        try {
            contentLength = std::stoul(clVal);
        } catch (...) {
            contentLength = 0;
        }
    }

    // Read remaining body if not fully received
    size_t bodyStart = headerEnd + 4;
    while (request.size() - bodyStart < contentLength) {
        bytesReceived = recv(clientSocket, buffer, sizeof(buffer), 0);
        if (bytesReceived <= 0) break;
        request.append(buffer, bytesReceived);
    }

    std::string body = "";
    if (request.size() >= bodyStart) {
        body = request.substr(bodyStart, contentLength);
    }

    // Strip URL query parameters
    size_t queryPos = path.find('?');
    if (queryPos != std::string::npos) {
        path = path.substr(0, queryPos);
    }

    // ================= API ENDPOINTS =================
    if (path == "/api/status") {
        std::lock_guard<std::mutex> lock(g_engineMutex);
        std::string json = buildFullStateJson();
        sendHttpResponse(clientSocket, 200, "application/json", json);
        return;
    }

    if (path == "/api/request" && method == "POST") {
        std::string address = JsonHelper::extractStringField(body, "address");
        if (address.empty()) {
            address = "0x0000";
        }
        std::lock_guard<std::mutex> lock(g_engineMutex);
        OperationRecord op = g_hierarchy.request(address);
        std::string json = buildFullStateJson(&op);
        sendHttpResponse(clientSocket, 200, "application/json", json);
        return;
    }

    if (path == "/api/sequence" && method == "POST") {
        std::vector<std::string> seq = JsonHelper::extractStringArray(body, "sequence");
        std::lock_guard<std::mutex> lock(g_engineMutex);
        OperationRecord lastOp;
        for (const auto& addr : seq) {
            lastOp = g_hierarchy.request(addr);
        }
        std::string json = buildFullStateJson(seq.empty() ? nullptr : &lastOp);
        sendHttpResponse(clientSocket, 200, "application/json", json);
        return;
    }

    if (path == "/api/reset" && method == "POST") {
        int l1Cap = JsonHelper::extractIntField(body, "l1Capacity", 4);
        int l2Cap = JsonHelper::extractIntField(body, "l2Capacity", 8);
        std::string policyStr = JsonHelper::extractStringField(body, "policy");
        
        std::lock_guard<std::mutex> lock(g_engineMutex);
        if (!policyStr.empty()) {
            g_hierarchy.setPolicy(JsonHelper::stringToPolicy(policyStr));
        }
        g_hierarchy.reset(l1Cap, l2Cap);
        std::string json = buildFullStateJson();
        sendHttpResponse(clientSocket, 200, "application/json", json);
        return;
    }

    if (path == "/api/config" && method == "POST") {
        int l1Cap = JsonHelper::extractIntField(body, "l1Capacity", 0);
        int l2Cap = JsonHelper::extractIntField(body, "l2Capacity", 0);
        std::string policyStr = JsonHelper::extractStringField(body, "policy");

        std::lock_guard<std::mutex> lock(g_engineMutex);
        if (!policyStr.empty()) {
            g_hierarchy.setPolicy(JsonHelper::stringToPolicy(policyStr));
        }
        if (l1Cap > 0 || l2Cap > 0) {
            g_hierarchy.setCapacities(l1Cap, l2Cap);
        }
        std::string json = buildFullStateJson();
        sendHttpResponse(clientSocket, 200, "application/json", json);
        return;
    }

    if (path == "/api/compare" && method == "POST") {
        std::vector<std::string> seq = JsonHelper::extractStringArray(body, "sequence");
        int l1Cap = JsonHelper::extractIntField(body, "l1Capacity", 4);
        int l2Cap = JsonHelper::extractIntField(body, "l2Capacity", 8);

        if (seq.empty()) {
            // Default sample benchmark trace if empty
            seq = {"0x1000", "0x2000", "0x3000", "0x4000", "0x1000", "0x5000", "0x2000", "0x6000", "0x1000", "0x7000"};
        }

        std::string json = runComparison(seq, l1Cap, l2Cap);
        sendHttpResponse(clientSocket, 200, "application/json", json);
        return;
    }

    // ================= STATIC FILE SERVING =================
    if (path == "/" || path.empty()) {
        path = "/index.html";
    }

    // Resolve file on disk
    std::string filePath = g_frontendDir + path;
    std::string fileContent;
    if (readFile(filePath, fileContent)) {
        sendHttpResponse(clientSocket, 200, getMimeType(filePath), fileContent);
    } else {
        // Try fallback without frontend prefix
        if (readFile("." + path, fileContent)) {
            sendHttpResponse(clientSocket, 200, getMimeType(path), fileContent);
        } else {
            sendHttpResponse(clientSocket, 404, "text/plain", "404 Not Found: " + path);
        }
    }
}

int main(int argc, char* argv[]) {
    int port = 8080;
    if (argc > 1) {
        port = std::atoi(argv[1]);
        if (port <= 0) port = 8080;
    }

    // Check if frontend directory exists relative to current path
    std::ifstream testFrontend("./frontend/index.html");
    if (!testFrontend.is_open()) {
        std::ifstream testFrontendUp("../frontend/index.html");
        if (testFrontendUp.is_open()) {
            g_frontendDir = "../frontend";
        }
    }

    WSADATA wsaData;
    int wsaRes = WSAStartup(MAKEWORD(2, 2), &wsaData);
    if (wsaRes != 0) {
        std::cerr << "[ERROR] WSAStartup failed: " << wsaRes << std::endl;
        return 1;
    }

    SOCKET serverSocket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSocket == INVALID_SOCKET) {
        std::cerr << "[ERROR] socket creation failed: " << WSAGetLastError() << std::endl;
        WSACleanup();
        return 1;
    }

    int opt = 1;
    setsockopt(serverSocket, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    sockaddr_in serverAddr;
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = INADDR_ANY;
    serverAddr.sin_port = htons(static_cast<u_short>(port));

    if (bind(serverSocket, (sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        std::cerr << "[ERROR] bind failed on port " << port << ": " << WSAGetLastError() << std::endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    if (listen(serverSocket, SOMAXCONN) == SOCKET_ERROR) {
        std::cerr << "[ERROR] listen failed: " << WSAGetLastError() << std::endl;
        closesocket(serverSocket);
        WSACleanup();
        return 1;
    }

    std::cout << "========================================================\n";
    std::cout << "  CACHEFLOW C++ Engine Server Active on http://localhost:" << port << "\n";
    std::cout << "  DSA Hierarchy: L1 Cache (4) -> L2 Cache (8) -> RAM\n";
    std::cout << "  Serving GUI from: " << g_frontendDir << "\n";
    std::cout << "========================================================\n" << std::flush;

    while (true) {
        sockaddr_in clientAddr;
        int clientSize = sizeof(clientAddr);
        SOCKET clientSocket = accept(serverSocket, (sockaddr*)&clientAddr, &clientSize);
        if (clientSocket == INVALID_SOCKET) {
            continue;
        }

        // Process request in a detached thread for concurrency
        std::thread([clientSocket]() {
            handleClient(clientSocket);
        }).detach();
    }

    closesocket(serverSocket);
    WSACleanup();
    return 0;
}
