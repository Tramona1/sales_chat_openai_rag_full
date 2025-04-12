"use strict";
/**
 * BM25 Keyword Search Utilities
 *
 * This module provides functions for performing keyword-based search using the BM25 algorithm.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.performBM25Search = performBM25Search;
const bm25_1 = require("./bm25");
const errorHandling_1 = require("./errorHandling");
/**
 * Perform BM25 keyword search
 *
 * @param query The search query
 * @param limit Maximum number of results to return
 * @param filter Optional filter to apply to results
 * @returns Array of search results with scores
 */
async function performBM25Search(query, limit = 10, filter) {
    try {
        // Get corpus statistics
        const corpusStats = (0, bm25_1.getCorpusStatistics)();
        // Get all items from the vector store
        const allItems = await Promise.resolve().then(() => __importStar(require('./vectorStore'))).then(m => m.getAllVectorStoreItems());
        // Calculate BM25 score for each item
        const scoredItems = allItems.map(item => {
            const document = {
                id: item.id || '',
                text: item.text
            };
            const score = (0, bm25_1.calculateBM25Score)(query, document, corpusStats);
            return {
                item,
                score,
                bm25Score: score
            };
        });
        // Apply filter if provided
        const filteredResults = filter
            ? scoredItems.filter(result => filter(result.item))
            : scoredItems;
        // Sort by score (descending) and take top results
        return filteredResults
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    catch (error) {
        (0, errorHandling_1.logError)('Error in performBM25Search', error);
        return [];
    }
}
