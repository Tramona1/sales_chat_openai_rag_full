"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const errorHandling_1 = require("@/utils/errorHandling");
// Storage paths
const DATA_DIR = path_1.default.join(process.cwd(), 'data');
const SESSIONS_DIR = path_1.default.join(DATA_DIR, 'sessions');
const INDEX_FILE = path_1.default.join(DATA_DIR, 'session_index.json');
// Ensure storage directories exist
async function ensureStorageExists() {
    try {
        await promises_1.default.mkdir(DATA_DIR, { recursive: true });
        await promises_1.default.mkdir(SESSIONS_DIR, { recursive: true });
        // Create index file if it doesn't exist
        try {
            await promises_1.default.access(INDEX_FILE);
        }
        catch (_a) {
            // Index doesn't exist, create it
            await promises_1.default.writeFile(INDEX_FILE, JSON.stringify({ sessions: [] }, null, 2));
        }
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to ensure storage directories exist', error);
        throw new Error('Storage initialization failed');
    }
}
// Get session index
async function getSessionIndex() {
    try {
        await ensureStorageExists();
        const data = await promises_1.default.readFile(INDEX_FILE, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to read session index', error);
        return { sessions: [] };
    }
}
// Save session index
async function saveSessionIndex(index) {
    try {
        await ensureStorageExists();
        await promises_1.default.writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to save session index', error);
        throw new Error('Failed to update session index');
    }
}
// Save chat session
async function saveChatSession(session) {
    try {
        // Generate ID and timestamps
        const now = new Date().toISOString();
        const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // Create full session object
        const fullSession = {
            ...session,
            id,
            createdAt: now,
            updatedAt: now
        };
        // Check if this is a duplicate of a recent company session
        if (session.sessionType === 'company' && session.companyName) {
            const index = await getSessionIndex();
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            // Find recent session for same company
            const recentSession = index.sessions.find(s => {
                var _a, _b;
                return s.sessionType === 'company' &&
                    ((_a = s.companyName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === ((_b = session.companyName) === null || _b === void 0 ? void 0 : _b.toLowerCase()) &&
                    s.updatedAt > oneHourAgo;
            });
            if (recentSession) {
                // Return existing session ID instead of creating a new one
                return recentSession.id;
            }
        }
        // Save to file
        await ensureStorageExists();
        const sessionPath = path_1.default.join(SESSIONS_DIR, `${id}.json`);
        await promises_1.default.writeFile(sessionPath, JSON.stringify(fullSession, null, 2));
        // Update index
        const index = await getSessionIndex();
        // Add to index
        index.sessions.push({
            id,
            title: fullSession.title,
            sessionType: fullSession.sessionType,
            updatedAt: now,
            companyName: fullSession.companyName
        });
        await saveSessionIndex(index);
        return id;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to save chat session', error);
        throw new Error('Failed to save chat session');
    }
}
// Get chat session by ID
async function getChatSession(sessionId) {
    try {
        const sessionPath = path_1.default.join(SESSIONS_DIR, `${sessionId}.json`);
        try {
            const data = await promises_1.default.readFile(sessionPath, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            // Session not found
            return null;
        }
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to get chat session', error);
        return null;
    }
}
// Update chat session
async function updateChatSession(sessionId, updates) {
    try {
        // Get current session
        const session = await getChatSession(sessionId);
        if (!session) {
            return false;
        }
        // Update fields
        const now = new Date().toISOString();
        const updatedSession = {
            ...session,
            ...updates,
            id: sessionId,
            createdAt: session.createdAt,
            updatedAt: now
        };
        // Save to file
        const sessionPath = path_1.default.join(SESSIONS_DIR, `${sessionId}.json`);
        await promises_1.default.writeFile(sessionPath, JSON.stringify(updatedSession, null, 2));
        // Update index if title changed
        if (updates.title) {
            const index = await getSessionIndex();
            const sessionIndex = index.sessions.findIndex(s => s.id === sessionId);
            if (sessionIndex !== -1) {
                index.sessions[sessionIndex].title = updates.title;
                index.sessions[sessionIndex].updatedAt = now;
                await saveSessionIndex(index);
            }
        }
        return true;
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to update chat session', error);
        return false;
    }
}
// List all chat sessions
async function listChatSessions() {
    try {
        const index = await getSessionIndex();
        return index.sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    catch (error) {
        (0, errorHandling_1.logError)('Failed to list chat sessions', error);
        return [];
    }
}
// Get sessions by type
async function getSessionsByType(sessionType) {
    try {
        const index = await getSessionIndex();
        return index.sessions
            .filter(session => session.sessionType === sessionType)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    catch (error) {
        (0, errorHandling_1.logError)(`Failed to get ${sessionType} sessions`, error);
        return [];
    }
}
async function handler(req, res) {
    try {
        await ensureStorageExists();
        const { method, action } = req.query;
        switch (method) {
            case 'GET':
                // Handle get requests
                if (action === 'list') {
                    const { type } = req.query;
                    if (type === 'company' || type === 'general') {
                        const sessions = await getSessionsByType(type);
                        return res.status(200).json(sessions);
                    }
                    else {
                        const sessions = await listChatSessions();
                        return res.status(200).json(sessions);
                    }
                }
                else if (action === 'get' && req.query.id) {
                    const sessionId = req.query.id;
                    const session = await getChatSession(sessionId);
                    if (!session) {
                        return res.status(404).json({ error: 'Session not found' });
                    }
                    return res.status(200).json(session);
                }
                break;
            case 'POST':
                // Handle post requests
                if (action === 'save') {
                    if (!req.body) {
                        return res.status(400).json({ error: 'Missing session data' });
                    }
                    const sessionId = await saveChatSession(req.body);
                    return res.status(200).json({ sessionId });
                }
                break;
            case 'PUT':
                // Handle put requests
                if (action === 'update' && req.query.id) {
                    if (!req.body) {
                        return res.status(400).json({ error: 'Missing update data' });
                    }
                    const sessionId = req.query.id;
                    const success = await updateChatSession(sessionId, req.body);
                    if (!success) {
                        return res.status(404).json({ error: 'Session not found' });
                    }
                    return res.status(200).json({ success: true });
                }
                break;
        }
        return res.status(400).json({ error: 'Invalid request' });
    }
    catch (error) {
        (0, errorHandling_1.logError)('Chat storage API error', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
