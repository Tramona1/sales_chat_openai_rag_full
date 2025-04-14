// get_vector.ts
import dotenv from 'dotenv';
import path from 'path';
// Load environment variables from .env.local and .env
// Adjust paths if your .env files are located differently
console.log('Loading environment variables...');
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
console.log('.env files loaded (if found).');
// Adjust the import path based on YOUR project structure
// Assuming utils directory is at the root level alongside get_vector.ts
// Add .ts extension for ES Module compatibility
import { getEmbeddingClient } from './utils/embeddingClient.ts'; // Corrected path with .ts extension
// Optionally import AI_SETTINGS if needed to check the provider
// import { AI_SETTINGS } from './utils/modelConfig.ts'; // Assuming modelConfig.ts exists
// --- Configuration ---
const QUERY_TO_EMBED = "what is our product suite";
// --- End Configuration ---
async function generateAndPrintVector() {
    // console.log('Inside generateAndPrintVector (should not run if commented out below)'); // Removed test log
    // /* // Removed comment start
    console.log(`Attempting to generate embedding for query: "${QUERY_TO_EMBED}"`);
    try {
        // --- Pre-check Environment Variables (Example for Gemini) ---
        // Adjust this check based on the provider configured in AI_SETTINGS
        // We know it's Gemini now, but keeping the check for robustness
        const expectedProvider = 'gemini'; // Hardcoded based on our finding
        console.log(`Expected embedding provider: ${expectedProvider}`);
        let apiKey;
        if (expectedProvider === 'gemini') {
            apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
            if (!apiKey) {
                throw new Error('GEMINI_API_KEY or GOOGLE_AI_API_KEY not found in environment variables. Make sure it is set in your .env or .env.local file.');
            }
            console.log('Gemini API Key found.');
        }
        // Removed OpenAI check
        // else if (expectedProvider === 'openai') { ... }
        // Add checks for other providers if necessary
        // --- End Pre-check ---
        console.log('Initializing embedding client...');
        const embeddingClient = getEmbeddingClient(); // Gets your client instance
        console.log(`Embedding client initialized. Provider: ${embeddingClient.getProvider()}`);
        // Ensure the client has the embedText method
        if (typeof embeddingClient.embedText !== 'function') {
            console.error("Error: The embedding client does not have an 'embedText' method.");
            console.error("Check the implementation in utils/embeddingClient.ts");
            process.exit(1);
        }
        console.log("Calling embedText...");
        const vector = await embeddingClient.embedText(QUERY_TO_EMBED /*, 'RETRIEVAL_QUERY' */); // Task type is likely default
        if (!vector || vector.length === 0) {
            console.error("Error: embedText returned an empty or invalid vector.");
            process.exit(1);
        }
        console.log("\n--- SUCCESS ---");
        console.log("Query:", QUERY_TO_EMBED);
        console.log("Generated Vector (Copy the line below including brackets []):");
        // Print in SQL-friendly format
        console.log(`[${vector.join(',')}]`);
        console.log("\nVector Dimension:", vector.length); // Should be 768
    }
    catch (error) { // Added :any for type safety in catch
        console.error("\n--- ERROR ---");
        console.error("Error generating embedding:", error);
        // Optionally add stack trace logging if needed
        // if (error instanceof Error && error.stack) {
        //   console.error("Stack trace:\n", error.stack);
        // }
        process.exit(1);
    }
    // */ // Removed comment end
}
// Execute the function (Uncommented)
generateAndPrintVector();
// console.log('Script finished loading (imports and dotenv done).'); // Removed test log 
