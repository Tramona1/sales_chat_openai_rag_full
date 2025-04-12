"use strict";
/**
 * Run Evaluation Tests for the Contextual Retrieval System
 *
 * This script serves as the entry point for running evaluation tests to
 * compare traditional vs. contextual retrieval performance.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const evaluate_contextual_retrieval_ts_1 = require("./evaluate_contextual_retrieval.ts");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const url_1 = require("url");
const path_2 = require("path");
// Setup dirname equivalent for ESM
const __filename = (0, url_1.fileURLToPath)(import.meta.url);
const __dirname = (0, path_2.dirname)(__filename);
// Load environment variables
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env.local') });
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
/**
 * Main function to run the evaluation
 */
async function main() {
    console.log(`${colors.bright}${colors.green}=== CONTEXTUAL RETRIEVAL EVALUATION ===\n${colors.reset}`);
    // Ensure the data directory exists
    const dataDir = path_1.default.join(process.cwd(), 'data');
    const evalDir = path_1.default.join(dataDir, 'evaluation_results');
    if (!fs_1.default.existsSync(dataDir)) {
        console.log(`${colors.yellow}Creating data directory...${colors.reset}`);
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs_1.default.existsSync(evalDir)) {
        console.log(`${colors.yellow}Creating evaluation results directory...${colors.reset}`);
        fs_1.default.mkdirSync(evalDir, { recursive: true });
    }
    // Check for required environment variables
    const requiredEnvVars = ['OPENAI_API_KEY', 'GEMINI_API_KEY'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error(`${colors.red}ERROR: The following required environment variables are missing:${colors.reset}`);
        missingVars.forEach(varName => console.error(`- ${varName}`));
        console.error(`\nPlease add them to your .env.local file and try again.`);
        process.exit(1);
    }
    // Log execution environment
    console.log(`${colors.cyan}Execution Environment:${colors.reset}`);
    console.log(`- Node.js version: ${process.version}`);
    console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`- OpenAI API key: ${process.env.OPENAI_API_KEY.substring(0, 4)}...${process.env.OPENAI_API_KEY.substring(process.env.OPENAI_API_KEY.length - 4)}`);
    console.log(`- Gemini API key: ${process.env.GEMINI_API_KEY.substring(0, 4)}...${process.env.GEMINI_API_KEY.substring(process.env.GEMINI_API_KEY.length - 4)}`);
    try {
        // Run the evaluation
        console.log(`\n${colors.bright}${colors.blue}Starting evaluation...${colors.reset}\n`);
        const startTime = performance.now();
        await (0, evaluate_contextual_retrieval_ts_1.runEvaluation)();
        const endTime = performance.now();
        const timeInSeconds = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`\n${colors.green}✓ Evaluation completed in ${timeInSeconds} seconds${colors.reset}`);
        // Show next steps
        console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
        console.log(`1. Review the evaluation results in the data/evaluation_results directory`);
        console.log(`2. Use the results to further optimize the contextual retrieval system`);
        console.log(`3. Consider implementing suggested improvements from the evaluation`);
    }
    catch (error) {
        console.error(`\n${colors.red}ERROR: Failed to complete the evaluation:${colors.reset}`);
        console.error(error);
        process.exit(1);
    }
}
// Run the main function
main().catch(error => {
    console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
    process.exit(1);
});
