#ifndef JSON_HELPER_H
#define JSON_HELPER_H

#include "cache_types.h"
#include <string>
#include <vector>
#include <sstream>
#include <iomanip>

namespace JsonHelper {

inline std::string escapeString(const std::string& input) {
    std::ostringstream ss;
    for (char c : input) {
        if (c == '"') ss << "\\\"";
        else if (c == '\\') ss << "\\\\";
        else if (c == '\b') ss << "\\b";
        else if (c == '\f') ss << "\\f";
        else if (c == '\n') ss << "\\n";
        else if (c == '\r') ss << "\\r";
        else if (c == '\t') ss << "\\t";
        else ss << c;
    }
    return ss.str();
}

inline std::string policyToString(PolicyType p) {
    switch (p) {
        case PolicyType::LRU: return "LRU";
        case PolicyType::FIFO: return "FIFO";
        case PolicyType::LFU: return "LFU";
        default: return "LRU";
    }
}

inline PolicyType stringToPolicy(const std::string& str) {
    if (str == "FIFO") return PolicyType::FIFO;
    if (str == "LFU") return PolicyType::LFU;
    return PolicyType::LRU;
}

inline std::string resultToString(AccessResult r) {
    switch (r) {
        case AccessResult::L1_HIT: return "L1_HIT";
        case AccessResult::L2_HIT: return "L2_HIT";
        case AccessResult::RAM_MISS: return "RAM_MISS";
        default: return "UNKNOWN";
    }
}

inline std::string entryToJson(const CacheEntry& e, int position, int total) {
    std::ostringstream ss;
    ss << "{"
       << "\"address\":\"" << escapeString(e.address) << "\","
       << "\"frequency\":" << e.frequency << ","
       << "\"position\":" << position << ","
       << "\"isMru\":" << (position == 0 ? "true" : "false") << ","
       << "\"isLru\":" << (position == total - 1 ? "true" : "false")
       << "}";
    return ss.str();
}

inline std::string metricsToJson(const CacheMetrics& m, size_t l1Cap, size_t l2Cap, size_t l1Size, size_t l2Size) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(2);
    ss << "{"
       << "\"totalRequests\":" << m.totalRequests << ","
       << "\"l1Hits\":" << m.l1Hits << ","
       << "\"l2Hits\":" << m.l2Hits << ","
       << "\"ramMisses\":" << m.ramMisses << ","
       << "\"totalEvictions\":" << m.totalEvictions << ","
       << "\"totalAccessTimeNs\":" << m.totalAccessTimeNs << ","
       << "\"overallHitRate\":" << m.getOverallHitRate() << ","
       << "\"l1HitRate\":" << m.getL1HitRate() << ","
       << "\"l2HitRate\":" << m.getL2HitRate() << ","
       << "\"ramMissRate\":" << m.getRamMissRate() << ","
       << "\"avgAccessTimeNs\":" << m.getAvgAccessTime() << ","
       << "\"timeSavedNs\":" << m.getTimeSaved() << ","
       << "\"speedupFactor\":" << m.getSpeedup() << ","
       << "\"l1OccupancyPct\":" << (l1Cap > 0 ? (double)l1Size * 100.0 / l1Cap : 0.0) << ","
       << "\"l2OccupancyPct\":" << (l2Cap > 0 ? (double)l2Size * 100.0 / l2Cap : 0.0)
       << "}";
    return ss.str();
}

inline std::string operationToJson(const OperationRecord& op) {
    std::ostringstream ss;
    ss << std::fixed << std::setprecision(1);
    ss << "{"
       << "\"address\":\"" << escapeString(op.address) << "\","
       << "\"result\":\"" << resultToString(op.result) << "\","
       << "\"accessTimeNs\":" << op.accessTimeNs << ","
       << "\"description\":\"" << escapeString(op.description) << "\","
       << "\"promotedAddress\":\"" << escapeString(op.promotedAddress) << "\","
       << "\"demotedAddress\":\"" << escapeString(op.demotedAddress) << "\","
       << "\"evictedAddress\":\"" << escapeString(op.evictedAddress) << "\","
       << "\"movement\":[";
    for (size_t i = 0; i < op.movementBreadcrumb.size(); ++i) {
        if (i > 0) ss << ",";
        ss << "\"" << escapeString(op.movementBreadcrumb[i]) << "\"";
    }
    ss << "]}";
    return ss.str();
}

// Simple key-value extractor for JSON payloads
inline std::string extractStringField(const std::string& json, const std::string& key) {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return "";

    pos = json.find(':', pos);
    if (pos == std::string::npos) return "";

    // Find opening quote
    size_t start = json.find('"', pos);
    if (start == std::string::npos) return "";

    size_t end = json.find('"', start + 1);
    if (end == std::string::npos) return "";

    return json.substr(start + 1, end - start - 1);
}

inline int extractIntField(const std::string& json, const std::string& key, int defaultVal = 0) {
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return defaultVal;

    pos = json.find(':', pos);
    if (pos == std::string::npos) return defaultVal;

    // Skip whitespace
    pos = json.find_first_not_of(" \t\r\n", pos + 1);
    if (pos == std::string::npos) return defaultVal;

    try {
        return std::stoi(json.substr(pos));
    } catch (...) {
        return defaultVal;
    }
}

inline std::vector<std::string> extractStringArray(const std::string& json, const std::string& key) {
    std::vector<std::string> result;
    std::string pattern = "\"" + key + "\"";
    size_t pos = json.find(pattern);
    if (pos == std::string::npos) return result;

    pos = json.find('[', pos);
    if (pos == std::string::npos) return result;

    size_t endBracket = json.find(']', pos);
    if (endBracket == std::string::npos) return result;

    size_t curr = pos + 1;
    while (curr < endBracket) {
        size_t quoteStart = json.find('"', curr);
        if (quoteStart == std::string::npos || quoteStart >= endBracket) break;
        size_t quoteEnd = json.find('"', quoteStart + 1);
        if (quoteEnd == std::string::npos || quoteEnd > endBracket) break;

        result.push_back(json.substr(quoteStart + 1, quoteEnd - quoteStart - 1));
        curr = quoteEnd + 1;
    }
    return result;
}

} // namespace JsonHelper

#endif // JSON_HELPER_H

