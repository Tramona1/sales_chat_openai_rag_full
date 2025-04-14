import { getSupabaseAdmin } from '@/utils/supabaseClient';
import { logInfo, logError, logWarning } from '@/utils/logger';
import { withAdminAuth } from '@/utils/auth';
import { hybridSearch } from '@/utils/hybridSearch';
import { DocumentCategoryType } from '@/utils/documentCategories';
/**
 * API handler for searching document chunks with advanced filtering
 * GET: Search for chunks with hybrid search (vector + keyword), with filtering options
 */
async function handler(req, res) {
    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }
        // Extract query parameters
        const { search = '', document_id, category, technical_level, tags, search_mode = 'hybrid', vector_weight = '0.5', keyword_weight = '0.5', limit = '50', page = '1' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const offset = (pageNum - 1) * limitNum;
        logInfo('Searching for chunks', {
            search,
            document_id,
            category,
            technical_level,
            tags,
            search_mode
        });
        // If search is empty but we have document_id, fetch directly from Supabase
        if ((!search || search === '') && document_id) {
            return await fetchChunksByDocumentId(document_id, pageNum, limitNum, res);
        }
        // If using hybrid search
        if (search_mode === 'hybrid' || search_mode === 'vector') {
            try {
                // --- Build the standardized HybridSearchFilter --- 
                const searchFilter = {};
                // Map query parameters to standardized filters
                if (category) {
                    // Attempt to map the incoming category string to a standard enum value
                    const categoryValue = category.toUpperCase().trim().replace(/\s+/g, '_');
                    if (Object.values(DocumentCategoryType).includes(categoryValue)) {
                        searchFilter.primaryCategory = categoryValue;
                        // Optionally, could also add logic to put it in secondaryCategories if it's not a primary one?
                        // searchFilter.secondaryCategories = [categoryValue as DocumentCategoryType];
                    }
                    else {
                        logWarning(`Received invalid category filter value: ${category}. Ignoring filter.`);
                    }
                }
                if (technical_level) {
                    const level = parseInt(technical_level, 10);
                    if (!isNaN(level)) {
                        // Apply as both min and max for exact match, respecting 1-10 scale
                        searchFilter.technicalLevelMin = Math.max(1, Math.min(10, level));
                        searchFilter.technicalLevelMax = Math.max(1, Math.min(10, level));
                    }
                    else {
                        logWarning(`Received invalid technical_level filter value: ${technical_level}. Ignoring filter.`);
                    }
                }
                if (tags) {
                    // Map tags to the keywords filter
                    searchFilter.keywords = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
                }
                // Add document_id filter if present (using customFilters for non-standard fields)
                const customFilters = {};
                if (document_id) {
                    customFilters.document_id = document_id;
                }
                if (Object.keys(customFilters).length > 0) {
                    searchFilter.customFilters = customFilters;
                }
                // --- End of filter building ---
                // Prepare search options
                const searchOptions = {
                    limit: limitNum + offset, // Fetch more for potential pagination slicing
                    vectorWeight: parseFloat(vector_weight),
                    keywordWeight: parseFloat(keyword_weight),
                    filter: searchFilter // Pass the standardized filter object
                };
                // Execute hybrid search
                const response = await hybridSearch(search, searchOptions);
                // Get total based on all results
                const totalCount = response.results.length;
                // Paginate results
                const paginatedResults = response.results.slice(offset, offset + limitNum);
                return res.status(200).json({
                    chunks: paginatedResults,
                    pagination: {
                        total: totalCount,
                        page: pageNum,
                        limit: limitNum,
                        totalPages: Math.ceil(totalCount / limitNum)
                    }
                });
            }
            catch (error) {
                logError('Error in hybrid search:', error);
                // Fall back to keyword-only search
                logWarning('Falling back to keyword search after hybrid search failure');
                return await keywordSearch(req.query, pageNum, limitNum, res);
            }
        }
        else {
            // Keyword-only search
            return await keywordSearch(req.query, pageNum, limitNum, res);
        }
    }
    catch (error) {
        logError('Error in chunk search:', error);
        return res.status(500).json({ error: 'Failed to search chunks' });
    }
}
/**
 * Fetch chunks directly by document ID
 */
async function fetchChunksByDocumentId(documentId, pageNum, limitNum, res) {
    try {
        const supabase = getSupabaseAdmin();
        const offset = (pageNum - 1) * limitNum;
        // Get count first
        const { count, error: countError } = await supabase
            .from('document_chunks')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', documentId);
        if (countError) {
            logError('Error counting chunks:', countError);
            return res.status(500).json({ error: 'Failed to count chunks' });
        }
        // Then get paginated results
        const { data, error } = await supabase
            .from('document_chunks')
            .select('*')
            .eq('document_id', documentId)
            .order('chunk_index', { ascending: true })
            .range(offset, offset + limitNum - 1);
        if (error) {
            logError('Error fetching chunks by document ID:', error);
            return res.status(500).json({ error: 'Failed to fetch chunks' });
        }
        return res.status(200).json({
            chunks: data,
            pagination: {
                total: count || 0,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil((count || 0) / limitNum)
            }
        });
    }
    catch (error) {
        logError('Error in fetchChunksByDocumentId:', error);
        return res.status(500).json({ error: 'Server error while fetching chunks' });
    }
}
/**
 * Execute a keyword-based search with filters using the hybrid search utility
 */
async function keywordSearch(queryParams, pageNum, limitNum, res) {
    try {
        const { search = '', document_id, category, technical_level, tags } = queryParams;
        const offset = (pageNum - 1) * limitNum;
        // --- Build the standardized HybridSearchFilter --- 
        const searchFilter = {};
        if (category) {
            const categoryValue = category.toUpperCase().trim().replace(/\s+/g, '_');
            if (Object.values(DocumentCategoryType).includes(categoryValue)) {
                searchFilter.primaryCategory = categoryValue;
            }
            else {
                logWarning(`KeywordSearch: Received invalid category filter value: ${category}. Ignoring filter.`);
            }
        }
        if (technical_level) {
            const level = parseInt(technical_level, 10);
            if (!isNaN(level)) {
                searchFilter.technicalLevelMin = Math.max(1, Math.min(10, level));
                searchFilter.technicalLevelMax = Math.max(1, Math.min(10, level));
            }
            else {
                logWarning(`KeywordSearch: Received invalid technical_level filter value: ${technical_level}. Ignoring filter.`);
            }
        }
        if (tags) {
            searchFilter.keywords = tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
        }
        const customFilters = {};
        if (document_id) {
            customFilters.document_id = document_id;
        }
        if (Object.keys(customFilters).length > 0) {
            searchFilter.customFilters = customFilters;
        }
        // --- End of filter building ---
        // Prepare search options for keyword-focused search
        const searchOptions = {
            limit: limitNum + offset, // Fetch more for pagination slicing
            vectorWeight: 0.01, // Minimal weight for vector
            keywordWeight: 0.99, // Maximum weight for keyword
            filter: searchFilter
        };
        // Execute hybrid search with keyword bias
        const response = await hybridSearch(search, searchOptions);
        // Get total based on all results
        const totalCount = response.results.length;
        // Paginate results
        const paginatedResults = response.results.slice(offset, offset + limitNum);
        return res.status(200).json({
            chunks: paginatedResults,
            pagination: {
                total: totalCount,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCount / limitNum)
            }
        });
    }
    catch (error) {
        logError('Error during keyword search (using hybridSearch utility):', error);
        return res.status(500).json({ error: 'Failed to execute keyword search' });
    }
}
export default withAdminAuth(handler);
