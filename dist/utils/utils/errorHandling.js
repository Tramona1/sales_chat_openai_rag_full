"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryProcessingError = exports.NetworkError = exports.VectorStoreError = exports.AIModelError = exports.DocumentProcessingError = void 0;
exports.handleOpenAIError = handleOpenAIError;
exports.handleError = handleError;
exports.createFallbackResponse = createFallbackResponse;
exports.safeExecute = safeExecute;
exports.standardizeApiErrorResponse = standardizeApiErrorResponse;
exports.formatValidationError = formatValidationError;
exports.logError = logError;
exports.logWarning = logWarning;
exports.logInfo = logInfo;
exports.logDebug = logDebug;
exports.createError = createError;
exports.formatApiError = formatApiError;
exports.withErrorHandling = withErrorHandling;
var openai_1 = require("openai");
var config_1 = require("./config");
// Get the config
var config = (0, config_1.getConfig)();
// Browser-compatible logging configuration
var LOG_LEVEL = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};
var currentLevel = LOG_LEVEL[((_a = config.logging) === null || _a === void 0 ? void 0 : _a.level) || 'info'];
// Custom error classes for better error identification
var DocumentProcessingError = /** @class */ (function (_super) {
    __extends(DocumentProcessingError, _super);
    function DocumentProcessingError(message, originalError) {
        var _this = _super.call(this, message) || this;
        _this.originalError = originalError;
        _this.name = 'DocumentProcessingError';
        return _this;
    }
    return DocumentProcessingError;
}(Error));
exports.DocumentProcessingError = DocumentProcessingError;
var AIModelError = /** @class */ (function (_super) {
    __extends(AIModelError, _super);
    function AIModelError(message, originalError) {
        var _this = _super.call(this, message) || this;
        _this.originalError = originalError;
        _this.name = 'AIModelError';
        return _this;
    }
    return AIModelError;
}(Error));
exports.AIModelError = AIModelError;
var VectorStoreError = /** @class */ (function (_super) {
    __extends(VectorStoreError, _super);
    function VectorStoreError(message, originalError) {
        var _this = _super.call(this, message) || this;
        _this.originalError = originalError;
        _this.name = 'VectorStoreError';
        return _this;
    }
    return VectorStoreError;
}(Error));
exports.VectorStoreError = VectorStoreError;
var NetworkError = /** @class */ (function (_super) {
    __extends(NetworkError, _super);
    function NetworkError(message, originalError) {
        var _this = _super.call(this, message) || this;
        _this.originalError = originalError;
        _this.name = 'NetworkError';
        return _this;
    }
    return NetworkError;
}(Error));
exports.NetworkError = NetworkError;
var QueryProcessingError = /** @class */ (function (_super) {
    __extends(QueryProcessingError, _super);
    function QueryProcessingError(message, originalError) {
        var _this = _super.call(this, message) || this;
        _this.originalError = originalError;
        _this.name = 'QueryProcessingError';
        return _this;
    }
    return QueryProcessingError;
}(Error));
exports.QueryProcessingError = QueryProcessingError;
// Error handler for OpenAI API errors
function handleOpenAIError(error) {
    if (error instanceof openai_1.OpenAI.APIError) {
        if (error.status === 400) {
            return new AIModelError("Invalid request to OpenAI: ".concat(error.message), error);
        }
        else if (error.status === 401) {
            return new AIModelError('Authentication error with OpenAI API. Check your API key.', error);
        }
        else if (error.status === 429) {
            return new AIModelError('Rate limit exceeded with OpenAI API. Please try again later.', error);
        }
        else if (error.status >= 500) {
            return new AIModelError('OpenAI service is currently unavailable. Please try again later.', error);
        }
    }
    return new AIModelError("Unexpected error with OpenAI: ".concat(error instanceof Error ? error.message : String(error)), error instanceof Error ? error : undefined);
}
// General purpose error handler
function handleError(error, context) {
    // Log the error for debugging
    console.error("Error in ".concat(context, ":"), error);
    // Specific handling based on error type
    if (error instanceof openai_1.OpenAI.APIError) {
        return handleOpenAIError(error);
    }
    if (error instanceof DocumentProcessingError ||
        error instanceof AIModelError ||
        error instanceof VectorStoreError ||
        error instanceof NetworkError ||
        error instanceof QueryProcessingError) {
        return error; // Already a custom error, return as is
    }
    // Generic error handling
    var message = error instanceof Error ? error.message : String(error);
    return new Error("Error in ".concat(context, ": ").concat(message));
}
// Helper for fallback response creation
function createFallbackResponse(defaultValue) {
    return defaultValue;
}
// Type-safe try/catch wrapper for async functions
function safeExecute(operation, context, fallback) {
    return __awaiter(this, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, operation()];
                case 1: return [2 /*return*/, _a.sent()];
                case 2:
                    error_1 = _a.sent();
                    handleError(error_1, context);
                    return [2 /*return*/, fallback];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * Standardize error responses for API endpoints
 * This ensures consistent error formatting across the application
 */
function standardizeApiErrorResponse(error) {
    var _a;
    console.error('Error details:', error);
    // Handle OpenAI API errors
    if (error.name === 'OpenAIError' || (error.response && error.response.headers && error.response.headers.get('x-request-id'))) {
        return {
            error: {
                message: 'Error processing your request with the language model',
                code: 'OPENAI_API_ERROR',
                details: process.env.NODE_ENV !== 'production' ? {
                    message: error.message,
                    type: error.type,
                    statusCode: error.status || error.statusCode
                } : undefined
            }
        };
    }
    // Handle vector store errors
    if (error.message && error.message.includes('vector store')) {
        return {
            error: {
                message: 'Error retrieving information from knowledge base',
                code: 'VECTOR_STORE_ERROR',
                details: process.env.NODE_ENV !== 'production' ? {
                    message: error.message
                } : undefined
            }
        };
    }
    // Handle timeout errors
    if (error.name === 'AbortError' || error.code === 'ETIMEDOUT' || ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('timeout'))) {
        return {
            error: {
                message: 'Request timed out. Please try again.',
                code: 'TIMEOUT_ERROR',
                details: process.env.NODE_ENV !== 'production' ? {
                    message: error.message
                } : undefined
            }
        };
    }
    // Default error response
    return {
        error: {
            message: 'An unexpected error occurred',
            code: 'INTERNAL_SERVER_ERROR',
            details: process.env.NODE_ENV !== 'production' ? {
                message: error.message || 'Unknown error'
            } : undefined
        }
    };
}
/**
 * Format validation errors consistently
 */
function formatValidationError(message, fieldErrors) {
    return {
        error: {
            message: message || 'Validation error',
            code: 'VALIDATION_ERROR',
            details: fieldErrors
        }
    };
}
/**
 * Log error in browser-compatible way
 */
function logError(message, error, level) {
    if (level === void 0) { level = 'error'; }
    // Skip logging if level is below the configured level
    if (LOG_LEVEL[level] < currentLevel) {
        return;
    }
    // In browser - use console for logging
    console.error("[".concat(level.toUpperCase(), "] ").concat(message), error);
    // No file system operations in this browser-compatible version
}
/**
 * Log warning in browser-compatible way
 */
function logWarning(message, data) {
    if (currentLevel <= LOG_LEVEL.warn) {
        console.warn("[WARN] ".concat(message), data);
    }
}
/**
 * Log info in browser-compatible way
 */
function logInfo(message, data) {
    if (currentLevel <= LOG_LEVEL.info) {
        console.info("[INFO] ".concat(message), data);
    }
}
/**
 * Log debug in browser-compatible way
 */
function logDebug(message, data) {
    if (currentLevel <= LOG_LEVEL.debug) {
        console.debug("[DEBUG] ".concat(message), data);
    }
}
/**
 * Create an error with a specific code
 */
function createError(message, code, additionalDetails) {
    var error = new Error(message);
    if (code) {
        error.code = code;
    }
    if (additionalDetails) {
        error.details = additionalDetails;
    }
    return error;
}
/**
 * Format API errors consistently for response
 */
function formatApiError(message, code, details) {
    if (message === void 0) { message = 'An unexpected error occurred'; }
    if (code === void 0) { code = 'UNKNOWN_ERROR'; }
    return {
        error: {
            message: message,
            code: code,
            timestamp: new Date().toISOString()
        }
    };
}
/**
 * Higher-order function for error handling
 * Wraps a function with automatic error handling
 */
function withErrorHandling(fn, errorMessage) {
    var _this = this;
    if (errorMessage === void 0) { errorMessage = 'Operation failed'; }
    return function () {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return __awaiter(_this, void 0, void 0, function () {
            var error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fn.apply(void 0, args)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2:
                        error_2 = _a.sent();
                        logError(errorMessage, error_2);
                        throw createError(error_2 instanceof Error ? error_2.message : errorMessage, error_2.code || 'UNKNOWN_ERROR');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
}
