# Vercel Deployment Troubleshooting

This document outlines common issues and solutions for deploying the Sales Chat RAG application to Vercel.

## Environment Variables

Ensure the following environment variables are properly set in your Vercel project settings:

```
# API Keys
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
GOOGLE_AI_API_KEY=AIza...
PERPLEXITY_API_KEY=pplx-...

# Model settings
DEFAULT_LLM_MODEL=gemini-2.0-flash
FALLBACK_LLM_MODEL=gpt-3.5-turbo-1106
EMBEDDING_PROVIDER=gemini
EMBEDDING_MODEL=text-embedding-004

# Feature flags
USE_GEMINI_EMBEDDINGS=true
USE_GEMINI_CONTEXT=true
USE_GEMINI_RERANKING=true
USE_PERPLEXITY=true
PERPLEXITY_COMPANY_RESEARCH_ONLY=true
PERPLEXITY_CACHE_HOURS=24
PERPLEXITY_DEBUG=true

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
USE_SUPABASE=true
```

## Supabase Client Issues

The application uses two different Supabase client implementations:
1. A standard implementation in `utils/supabaseClient.ts`
2. A Vercel-specific implementation in `utils/vercelSupabaseClient.ts`

### Recent Fixes:

1. **Dynamic Client Selection**: The Perplexity client now dynamically selects the appropriate Supabase client based on the runtime environment (Vercel vs. development).

2. **Error Handling**: Improved error handling in Supabase client interaction to prevent API failures.

3. **Cache Management**: Enhanced caching mechanisms to reduce load on the Perplexity API and Supabase.

## TypeScript Fixes

Several TypeScript errors were fixed:

1. Added `source` property to the `SearchResultItem` interface in `pages/api/query.ts`
2. Fixed type mismatch in `contextForAnswer` assignment by adding required properties to array items

## Debugging Vercel Deployments

If you continue to experience issues with Vercel deployment:

1. Check the Vercel deployment logs for specific error messages
2. Verify that all environment variables are correctly set
3. Test the Supabase connection by adding console logs at the beginning of API routes
4. Use Vercel's development tools to simulate production environment locally

## Common Issues

### 400 Error on Company Verification

If you're getting a 400 error on `/api/company/verify`:

1. Check that `PERPLEXITY_API_KEY` is correctly set in Vercel
2. Verify `USE_PERPLEXITY` is set to `true`
3. Inspect API logs for detailed error messages
4. Test the Supabase connection through the Vercel dashboard

### Missing Database Tables

If you're seeing database-related errors:

1. Ensure the Supabase project has all required tables, particularly `company_cache`
2. Check database permissions for the service role key
3. Run the database migration scripts if needed 