"use strict";
/**
 * Logger utility for standardized logging throughout the application
 * Provides different log levels and consistent formatting
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logError = logError;
exports.logInfo = logInfo;
exports.logDebug = logDebug;
exports.logWarning = logWarning;
exports.logSuccess = logSuccess;
exports.logApiCall = logApiCall;
// Set this to true to enable debug logs in production
var DEBUG_MODE = process.env.DEBUG_MODE === 'true';
var supabaseClient_1 = require("./supabaseClient"); // Add Supabase admin client import
/**
 * Log an error message with optional error object
 * @param message The error message
 * @param error Optional error object with details
 */
function logError(message, error) {
    console.error("[ERROR] ".concat(message));
    if (error) {
        if (error instanceof Error) {
            console.error("Details: ".concat(error.message));
            if (error.stack) {
                console.error("Stack: ".concat(error.stack));
            }
        }
        else if (typeof error === 'object') {
            try {
                console.error('Error details:', JSON.stringify(error, null, 2));
            }
            catch (e) {
                console.error('Error details (non-stringifiable):', error);
            }
        }
        else {
            console.error('Error details:', error);
        }
    }
}
/**
 * Log an informational message
 * @param message The info message
 * @param data Optional data to include with the log
 */
function logInfo(message, data) {
    console.log("[INFO] ".concat(message));
    if (data && typeof data === 'object') {
        try {
            console.log(JSON.stringify(data, null, 2));
        }
        catch (e) {
            console.log('Additional data (non-stringifiable):', data);
        }
    }
    else if (data !== undefined) {
        console.log(data);
    }
}
/**
 * Log a debug message - only shows if DEBUG_MODE is enabled
 * @param message The debug message
 * @param data Optional data to include with the log
 */
function logDebug(message, data) {
    if (!DEBUG_MODE)
        return;
    console.log("[DEBUG] ".concat(message));
    if (data && typeof data === 'object') {
        try {
            console.log(JSON.stringify(data, null, 2));
        }
        catch (e) {
            console.log('Debug data (non-stringifiable):', data);
        }
    }
    else if (data !== undefined) {
        console.log(data);
    }
}
/**
 * Log a warning message
 * @param message The warning message
 * @param data Optional data to include with the log
 */
function logWarning(message, data) {
    console.warn("[WARNING] ".concat(message));
    if (data && typeof data === 'object') {
        try {
            console.warn(JSON.stringify(data, null, 2));
        }
        catch (e) {
            console.warn('Warning data (non-stringifiable):', data);
        }
    }
    else if (data !== undefined) {
        console.warn(data);
    }
}
/**
 * Log a successful operation
 * @param message The success message
 * @param data Optional data to include with the log
 */
function logSuccess(message, data) {
    console.log("[SUCCESS] ".concat(message));
    if (data && typeof data === 'object') {
        try {
            console.log(JSON.stringify(data, null, 2));
        }
        catch (e) {
            console.log('Success data (non-stringifiable):', data);
        }
    }
    else if (data !== undefined) {
        console.log(data);
    }
}
/**
 * Logs an external API call attempt to the Supabase database.
 * Handles errors during the database insert silently to avoid breaking the caller.
 *
 * @param service The external service called (e.g., 'gemini', 'openai').
 * @param api_function The specific function/endpoint called (e.g., 'embedding', 'chat_completion', 'rerank').
 * @param status 'success' or 'error'.
 * @param duration_ms Optional duration of the call in milliseconds.
 * @param error_message Optional error message if status is 'error'.
 * @param metadata Optional additional JSON data (e.g., model used, input size).
 */
function logApiCall(service, api_function, status, duration_ms, error_message, metadata) {
    return __awaiter(this, void 0, void 0, function () {
        var supabase, insertError, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    supabase = (0, supabaseClient_1.getSupabaseAdmin)();
                    if (!supabase) {
                        logWarning('[logApiCall] Supabase client not available, skipping DB log.');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, supabase
                            .from('api_call_logs')
                            .insert({
                            service: service,
                            api_function: api_function,
                            status: status,
                            duration_ms: duration_ms,
                            error_message: error_message ? String(error_message).substring(0, 500) : undefined, // Limit error message length
                            metadata: metadata,
                        })];
                case 1:
                    insertError = (_a.sent()).error;
                    if (insertError) {
                        // Log the insert error but don't throw, as logging shouldn't break primary functionality
                        logError('[logApiCall] Failed to insert API call log into database', {
                            service: service,
                            api_function: api_function,
                            status: status,
                            dbError: insertError.message,
                        });
                    }
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    // Catch any unexpected errors during the logging process itself
                    logError('[logApiCall] Unexpected error during API call logging', {
                        error: err_1 instanceof Error ? err_1.message : String(err_1),
                        service: service,
                        api_function: api_function,
                        status: status,
                    });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
