"use strict";
/**
 * Simple Evaluation Script for Contextual Retrieval
 *
 * This simplified script tests a few queries to compare traditional
 * vs. contextual retrieval without complex dependencies.
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
// Import Node.js built-ins which are module-compatible
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const url_1 = require("url");
const path_1 = require("path");
const dotenv = __importStar(require("dotenv"));
// Set up directory paths for ESM
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, path_1.dirname)(__filename);
// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// ANSI color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};
// Test queries
const testQueries = [
    {
        id: 'factual',
        query: 'What are the pricing tiers for your product?',
        expectedTopics: ['pricing', 'tiers', 'product']
    },
    {
        id: 'technical',
        query: 'How does your API authentication work?',
        expectedTopics: ['api', 'authentication', 'security']
    },
    {
        id: 'comparative',
        query: 'Compare your features with competing products',
        expectedTopics: ['features', 'comparison', 'competitors']
    }
];
/**
 * Main evaluation function
 */
async function runSimpleEvaluation() {
    var _a, _b, _c, _d, _e, _f;
    console.log(`${colors.bright}${colors.green}SIMPLIFIED CONTEXTUAL RETRIEVAL EVALUATION${colors.reset}\n`);
    // Create results directory
    const resultsDir = path.join(process.cwd(), 'data', 'evaluation_results');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    // Check for API keys
    if (!process.env.OPENAI_API_KEY) {
        console.error(`${colors.red}Error: OPENAI_API_KEY not found in environment variables${colors.reset}`);
        process.exit(1);
    }
    if (!process.env.GEMINI_API_KEY) {
        console.error(`${colors.red}Error: GEMINI_API_KEY not found in environment variables${colors.reset}`);
        process.exit(1);
    }
    // Load vector store data to check what we're working with
    console.log(`${colors.cyan}Checking vector store data...${colors.reset}`);
    try {
        const vectorStorePath = path.join(process.cwd(), 'data', 'vectorStore.json');
        if (fs.existsSync(vectorStorePath)) {
            const vectorStoreRaw = fs.readFileSync(vectorStorePath, 'utf8');
            const vectorStore = JSON.parse(vectorStoreRaw);
            console.log(`Vector store contains ${((_a = vectorStore.items) === null || _a === void 0 ? void 0 : _a.length) || 0} items`);
            // Check for contextual metadata
            const contextualItems = (_b = vectorStore.items) === null || _b === void 0 ? void 0 : _b.filter(item => { var _a, _b; return ((_a = item.metadata) === null || _a === void 0 ? void 0 : _a.context) || ((_b = item.metadata) === null || _b === void 0 ? void 0 : _b.documentSummary); });
            console.log(`Found ${(contextualItems === null || contextualItems === void 0 ? void 0 : contextualItems.length) || 0} items with contextual metadata`);
            if ((contextualItems === null || contextualItems === void 0 ? void 0 : contextualItems.length) > 0) {
                console.log(`${colors.green}Great! We have contextual data to evaluate${colors.reset}`);
                // Show a sample of contextual metadata
                const sample = contextualItems[0];
                console.log(`\nSample contextual metadata:`);
                if ((_c = sample.metadata) === null || _c === void 0 ? void 0 : _c.documentSummary) {
                    console.log(`Document Summary: ${sample.metadata.documentSummary.substring(0, 100)}...`);
                }
                if ((_d = sample.metadata) === null || _d === void 0 ? void 0 : _d.context) {
                    console.log(`Context Description: ${(_e = sample.metadata.context.description) === null || _e === void 0 ? void 0 : _e.substring(0, 100)}...`);
                    console.log(`Key Points: ${(_f = sample.metadata.context.keyPoints) === null || _f === void 0 ? void 0 : _f.slice(0, 2).join(', ')}...`);
                }
            }
            else {
                console.log(`${colors.yellow}Warning: No items with contextual metadata found${colors.reset}`);
                console.log(`This evaluation may not show differences between traditional and contextual retrieval.`);
                console.log(`Please process some documents with contextual chunking first.`);
            }
        }
        else {
            console.log(`${colors.yellow}Warning: Vector store file not found at ${vectorStorePath}${colors.reset}`);
        }
    }
    catch (error) {
        console.error(`${colors.red}Error reading vector store:${colors.reset}`, error);
    }
    // Write summary of what we found
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const summaryFile = path.join(resultsDir, `evaluation_check_${timestamp}.json`);
    fs.writeFileSync(summaryFile, JSON.stringify({
        timestamp,
        environment: {
            node: process.version,
            openaiKey: process.env.OPENAI_API_KEY ? 'present' : 'missing',
            geminiKey: process.env.GEMINI_API_KEY ? 'present' : 'missing',
        },
        testQueries,
        message: "This is a placeholder for the full evaluation results. To run the complete evaluation, please compile the TypeScript files first."
    }, null, 2));
    console.log(`\n${colors.bright}${colors.blue}Next Steps:${colors.reset}`);
    console.log(`1. Ensure you have processed documents with contextual chunking`);
    console.log(`2. Compile the TypeScript files with: npm run build`);
    console.log(`3. Run the full evaluation with the provided scripts`);
    console.log(`\nEvaluation check results saved to: ${summaryFile}`);
}
// Run the evaluation
runSimpleEvaluation().catch(error => {
    console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
    process.exit(1);
});
