import { standardizeApiErrorResponse } from '../../../utils/errorHandling';
import { logInfo, logError } from '../../../utils/logger';
import { getSupabaseAdmin } from '../../../utils/supabaseClient';
export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: { message: 'Method Not Allowed', code: 'method_not_allowed' } });
    }
    try {
        // Get search and filtering parameters
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const offset = (page - 1) * limit;
        const searchTerm = req.query.search ? req.query.search.toLowerCase() : '';
        const searchContent = req.query.searchContent === 'true';
        const contentType = req.query.contentType;
        const category = req.query.category;
        const approved = req.query.approved;
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        logInfo('Fetching documents from Supabase with filters', {
            limit, page, searchTerm, category, approved, contentType
        });
        // Get Supabase client
        const supabase = getSupabaseAdmin();
        // Build the query
        let query = supabase
            .from('documents')
            .select(`
        id,
        title,
        source,
        created_at,
        updated_at,
        approved,
        metadata,
        document_chunks!document_chunks_document_id_fkey (count)
      `, { count: 'exact' });
        // Apply search term filter if provided
        if (searchTerm) {
            logInfo(`Filtering by search term: ${searchTerm}`);
            if (searchContent) {
                // Search in document chunks content as well (more resource intensive)
                query = query.or(`title.ilike.%${searchTerm}%,source.ilike.%${searchTerm}%,document_chunks.text.ilike.%${searchTerm}%`);
            }
            else {
                // Search only in document metadata
                query = query.or(`title.ilike.%${searchTerm}%,source.ilike.%${searchTerm}%,metadata->>'summary'.ilike.%${searchTerm}%`);
            }
        }
        // Apply content type filter if provided
        if (contentType && contentType !== 'all') {
            logInfo(`Filtering by content type: ${contentType}`);
            query = query.contains('metadata', { contentType });
        }
        // Apply category filter if provided
        if (category && category !== 'all') {
            logInfo(`Filtering by category: ${category}`);
            query = query.eq('metadata->>primaryCategory', category);
        }
        // Apply approval status filter if provided
        if (approved === 'true') {
            query = query.eq('approved', true);
        }
        else if (approved === 'false') {
            query = query.eq('approved', false);
        }
        // Apply date range filters if provided
        if (startDate) {
            query = query.gte('created_at', startDate);
        }
        if (endDate) {
            query = query.lte('created_at', endDate);
        }
        // Apply pagination
        query = query
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);
        // Execute the query
        const { data: documentsData, error: documentsError, count } = await query;
        if (documentsError) {
            throw documentsError;
        }
        logInfo(`Retrieved ${documentsData?.length || 0} documents from Supabase`);
        // Format documents for the UI
        const documents = documentsData?.map(doc => {
            return {
                id: doc.id,
                title: doc.title || 'Untitled',
                source: doc.source || 'Unknown Source',
                approved: doc.approved,
                created_at: doc.created_at,
                updated_at: doc.updated_at,
                metadata: doc.metadata || {},
                chunkCount: doc.document_chunks?.length > 0 ? doc.document_chunks[0].count : 0
            };
        }) || [];
        // Return the documents
        logInfo(`Returning ${documents.length} documents to client`);
        return res.status(200).json({
            documents,
            total: count || documents.length,
            page,
            limit,
            totalPages: count ? Math.ceil(count / limit) : 1
        });
    }
    catch (error) {
        logError('Error fetching documents:', error);
        return res.status(500).json(standardizeApiErrorResponse(error));
    }
}
