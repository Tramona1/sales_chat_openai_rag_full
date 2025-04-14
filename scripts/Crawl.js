import axios from 'axios';
import * as cheerio from 'cheerio'; // Keep for title fallback
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';

// --- Configuration ---
const START_URL = 'https://workstream.my.site.com/knowledgebase/s/';
const ALLOWED_DOMAIN = new URL(START_URL).hostname;
const HTML_OUTPUT_FILE = path.resolve(process.cwd(), 'data', 'workstream_crawl_full_content_puppeteer_targeted.jsonl'); // Renamed
const PDF_LOG_FILE = path.resolve(process.cwd(), 'data', 'workstream_crawl_pdf_log.jsonl');
const PDF_DOWNLOAD_DIR = path.resolve(process.cwd(), 'data', 'crawled_pdfs');
const LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_crawler.log');
const ALL_URLS_LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_all_encountered_urls.txt');
const VISITED_URLS_LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_visited_urls.txt');

const MAX_CONCURRENCY = 2;
const DELAY_MS = 2000;
const PAGE_LOAD_TIMEOUT_MS = 90000;
const EXPLICIT_WAIT_TIMEOUT_MS = 40000; // Increased wait slightly more
const REQUEST_TIMEOUT_MS = 30000;
const MAX_QUEUE_SIZE = 50000;
const MIN_CONTENT_LENGTH = 100;

const USER_AGENT = 'SalesKnowledgeAssistantCrawler/1.0 (+https://your-contact-info.com)';
// --- End Configuration ---

// --- Directory Setup & Logging (Same as before) ---
fs.mkdirSync(path.dirname(HTML_OUTPUT_FILE), { recursive: true });
fs.mkdirSync(path.dirname(PDF_LOG_FILE), { recursive: true });
fs.mkdirSync(PDF_DOWNLOAD_DIR, { recursive: true });
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const log = (level, message, data) => { /* ... same logging function ... */
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase();
    const logEntry = `[${timestamp}] [${levelUpper}] ${message}`;
    console.log(logEntry);
    logStream.write(logEntry + '\n');
    if (data) {
        const dataStr = (typeof data === 'string' || data instanceof Error) ? String(data) : JSON.stringify(data, null, 2);
        logStream.write(dataStr + '\n');
        if (level === 'error' && data instanceof Error) {
            console.error(data.stack || data);
            logStream.write((data.stack || '') + '\n');
        } else if (level === 'error') {
            console.error(data);
        }
    }
};

// --- Global State (Same as before) ---
const visitedUrls = new Set();
const allEncounteredUrls = new Set();
const queue = [];
const limit = pLimit(MAX_CONCURRENCY);
let htmlCrawlCount = 0;
let pdfDownloadCount = 0;
let browser = null;


// --- Helper Functions ---

// Function isAllowed (with internal logging)
function isAllowed(url) { /* ... same isAllowed function ... */
    if (!url) return false;
    try {
        const parsedUrl = new URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) { log('debug', `isAllowed: FALSE (protocol) - ${url}`); return false; }
        if (parsedUrl.hostname !== ALLOWED_DOMAIN) { log('debug', `isAllowed: FALSE (domain) - ${url}`); return false; }
        const pathname = parsedUrl.pathname.toLowerCase();
        if (/\.(zip|jpg|jpeg|png|gif|css|js|mp4|mov|avi|woff|woff2|svg|ico)$/i.test(pathname) ||
            pathname.startsWith('/sfsites/c/resource/') || pathname.startsWith('/sfsites/l/')) {
            log('debug', `isAllowed: FALSE (file/resource path) - ${url}`); return false;
        }
        log('debug', `isAllowed: TRUE - ${url}`); return true;
    } catch (error) { log('warn', `Invalid URL encountered during isAllowed check: ${url}`, error); return false; }
}

// Add START_URL *after* defining isAllowed
if (isAllowed(START_URL)) { queue.push(START_URL); allEncounteredUrls.add(START_URL); }
else { log('error', `START_URL ${START_URL} is not allowed.`); process.exit(1); }


// Function extractDataPuppeteer (Same as previous version using evaluate)
async function extractDataPuppeteer(page, url) { /* ... same extractDataPuppeteer function ... */
    try {
        log('debug', `Attempting data extraction via page.evaluate for: ${url}`);
        const extractedData = await page.evaluate((MIN_CONTENT_LENGTH_BROWSER) => {
            let content = ''; let title = '';
            function getTextRecursive(element) { /* ... */ } // Keep recursive helper
            const articleContentEl = document.querySelector('.slds-rich-text-editor__output');
            if (articleContentEl) { /* ... */ }
            if (!content || content.replace(/\s+/g, ' ').trim().length < MIN_CONTENT_LENGTH_BROWSER) { /* ... main fallback ... */ }
            if (!content || content.replace(/\s+/g, ' ').trim().length < MIN_CONTENT_LENGTH_BROWSER) { /* ... body fallback ... */ }
            title = title || document.title;
            content = content.replace(/[\s\n\r]+/g, ' ').trim();
            return { title, content };
        }, MIN_CONTENT_LENGTH);
        if (!extractedData || !extractedData.content || extractedData.content.length < MIN_CONTENT_LENGTH) { /* ... minimal content log ... */ return null; }
        log('debug', `Successfully extracted content (${extractedData.content.length} chars) via evaluate: ${url}`);
        return { url: url, title: (extractedData.title || url).trim(), content: extractedData.content, contentType: 'html', timestamp: new Date().toISOString() };
    } catch (error) { /* ... error handling ... */ return null; }
}


// *** MODIFIED: findLinks using TARGETED page.$$eval calls ***
async function findLinksPuppeteerTargeted(page, baseUrl) {
    const links = new Set();
    const selectorsToTry = [
        'a.comm-tile-menu__item-link',                 // Homepage tiles
        'a.article-link',                              // Topic page article links
        '.slds-rich-text-editor__output a',            // Links within article content
        'nav.forceCommunityThemeNav a',                // Main navigation links
        '.forceCommunityRelatedListPlaceholder a',     // Related list links (if any)
        '.forceCommunityRelatedListContainer a',       // Related list links (alternative)
        'a.forceTopicTopicLink'                        // Breadcrumb/topic links
        // Add more specific selectors if other link areas are identified
    ];

    log('debug', `Attempting link extraction via TARGETED page.$$eval for: ${baseUrl}`);
    let totalRawHrefs = 0;

    for (const selector of selectorsToTry) {
        try {
            log('debug', `Evaluating selector: ${selector}`);
            const hrefs = await page.$$eval(selector, anchors => anchors.map(a => a.href));
            totalRawHrefs += hrefs.length;
            log('debug', `Found ${hrefs.length} raw hrefs for selector "${selector}": ${JSON.stringify(hrefs)}`);

            for (const href of hrefs) {
                if (href) {
                    try {
                        const absoluteUrl = new URL(href, baseUrl).toString();
                        const urlObj = new URL(absoluteUrl);
                        if (!['http:', 'https:'].includes(urlObj.protocol)) continue;
                        urlObj.hash = '';
                        const cleanUrl = urlObj.toString();
                        if (isAllowed(cleanUrl)) {
                            // isAllowed logs TRUE internally
                            links.add(cleanUrl);
                        } else {
                            // isAllowed logs FALSE internally with reason
                        }
                    } catch (e) {
                        log('debug', `Ignoring invalid/unparsable raw href: ${href} from selector "${selector}" on ${baseUrl}`, e.message);
                    }
                } else {
                     log('debug', `Ignoring empty raw href from selector "${selector}" on ${baseUrl}`);
                }
            }
        } catch (error) {
            // Handle potential errors during evaluation for a specific selector
            if (error.message.includes('Execution context was destroyed')) {
                 log('warn', `Caught 'Execution context destroyed' during evaluate for selector "${selector}" on ${baseUrl}. Some links might be missed.`);
                 // Continue to the next selector if possible
            } else if (error.message.includes('failed to find element matching selector')) {
                log('debug', `Selector "${selector}" not found on ${baseUrl}. Skipping.`);
            }
             else {
                log('error', `Error finding links via page.$$eval for selector "${selector}" on ${baseUrl}`, error);
            }
        }
    } // End loop through selectors

    log('debug', `Finished evaluating all targeted selectors. Total raw hrefs found: ${totalRawHrefs}`);
    return Array.from(links);
}


// Function saveHtmlData (same as before)
function saveHtmlData(data) { /* ... */ }
// Function savePdfLog (same as before)
function savePdfLog(pdfInfo) { /* ... */ }

// --- Core Crawling Logic ---

async function crawlPage(url) {
  if (visitedUrls.has(url)) { log('debug', `Already visited: ${url}`); return; }
  log('info', `Crawling: ${url}`);
  visitedUrls.add(url);

  let page = null;

  try {
    // --- Direct PDF Download Attempt (same as before) ---
    const urlPath = new URL(url).pathname.toLowerCase();
    let isLikelyPdf = urlPath.endsWith('.pdf') || urlPath.includes('/file-asset/');
    if (isLikelyPdf) { /* ... same PDF handling logic ... */ }

    // --- Puppeteer Crawl ---
    log('debug', `Using Puppeteer for: ${url}`);
    page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 768 });
    await page.setRequestInterception(true);
    page.on('request', (req) => { /* ... same request interception ... */ });

    let response;
    try {
        log('debug', `Navigating browser to: ${url}`);
        response = await page.goto(url, { waitUntil: 'load', timeout: PAGE_LOAD_TIMEOUT_MS });
    } catch (gotoError) { /* ... goto error handling ... */ }

    const status = response.status();
    const finalUrl = page.url();

    // Redirect handling
    if (finalUrl !== url) { /* ... same redirect handling ... */ }
    // Error status handling
    if (status < 200 || status >= 400) { /* ... same error status handling ... */ }

    const contentType = response.headers()['content-type']?.toLowerCase() || '';

    if (contentType.includes('text/html')) {
      log('debug', `Page loaded (HTML), attempting to process content... ${finalUrl}`);
      // Wait for *any* of the key link/content selectors
      const waitSelector = 'a.comm-tile-menu__item-link, a.article-link, .slds-rich-text-editor__output, footer';
      try {
          log('debug', `Waiting for specific content/link selector '${waitSelector}' on ${finalUrl}`);
          await page.waitForSelector(waitSelector, { timeout: EXPLICIT_WAIT_TIMEOUT_MS });
          log('debug', `Specific selector '${waitSelector}' found. Proceeding.`);
      } catch (waitError) {
          log('warn', `Timeout waiting for specific selector '${waitSelector}' on ${finalUrl}. Page might be incomplete.`, waitError.message);
      }

      // *** Use targeted Puppeteer functions for extraction ***
      const extracted = await extractDataPuppeteer(page, finalUrl); // Keep using evaluate for content
      const newLinks = await findLinksPuppeteerTargeted(page, finalUrl); // Use targeted $$eval for links

      // Close page ASAP
      if (page && !page.isClosed()) await page.close().catch(e => log('error', 'Error closing page after evaluations', e));
      page = null;

      // Process results
      if (extracted) { saveHtmlData(extracted); }
      else { log('warn', `Content extraction failed or yielded minimal content for: ${finalUrl}`); }

      if (newLinks.length === 0) { log('warn', `Found 0 processable links via TARGETED $$eval on HTML page: ${finalUrl}`); }
      else { log('info', `Found ${newLinks.length} potential links via TARGETED $$eval on: ${finalUrl}`); }

      for (const link of newLinks) {
        if (!visitedUrls.has(link) && !queue.includes(link)) {
          if (queue.length < MAX_QUEUE_SIZE) { queue.push(link); allEncounteredUrls.add(link); }
          else { log('warn', 'Queue size limit reached, not adding more links.'); break; }
        }
      }

    } else {
      log('info', `Skipping unsupported content type via Puppeteer at ${finalUrl} (Type: ${contentType})`);
      if (page && !page.isClosed()) await page.close().catch(e => log('error', 'Error closing page for unsupported type', e));
      page = null;
    }

  } catch (error) {
    log('error', `Unhandled error during Puppeteer crawl for ${url} (Final URL: ${page?.url() || 'N/A'})`, error);
    if (page && !page.isClosed()) {
      await page.close().catch(e => log('error', 'Error closing page after main crawl error', e));
    }
  }
}

// --- Main Execution (Same as before, including final logging) ---
async function startCrawling() {
  log('info', 'Crawler starting with Puppeteer (Targeted Evaluate for Links)...');
  log('warn', 'ROBOTS.TXT CHECK IS CURRENTLY DISABLED.');
  try {
      log('info', 'Launching browser...');
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-zygote','--disable-gpu'] });
      log('info', `Browser launched successfully. PID: ${browser.process()?.pid || 'N/A'}`);
      browser.on('disconnected', () => { log('error', 'BROWSER DISCONNECTED UNEXPECTEDLY. Crawler may stop.'); browser = null; });
      const crawlPromises = [];
      while (queue.length > 0) {
          if (!browser || !browser.isConnected()) { log('error', 'Browser is not connected. Stopping crawl loop.'); break; }
          const currentUrl = queue.shift();
          if (visitedUrls.has(currentUrl)) { continue; }
          allEncounteredUrls.add(currentUrl);
          const promise = limit(() => crawlPage(currentUrl)).catch(err => log('error', `Unhandled error in limited task for ${currentUrl}`, err));
          crawlPromises.push(promise);
          if (visitedUrls.size % 20 === 0 && visitedUrls.size > 0) { log('info', `Queue size: ${queue.length}, Visited: ${visitedUrls.size}, Active tasks: ${limit.activeCount}`); }
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
      log('info', `Queue empty or browser disconnected. Waiting for ${limit.activeCount} active tasks to finish...`);
      await Promise.all(crawlPromises).catch(err => log('error', 'Error during Promise.all wait', err));
      log('info', 'All submitted crawl tasks have completed or errored.');
  } catch (error) { log('error', 'Fatal error during crawling setup or execution', error); }
  finally {
      try { log('info', `Writing ${visitedUrls.size} visited URLs to ${VISITED_URLS_LOG_FILE}`); fs.writeFileSync(VISITED_URLS_LOG_FILE, Array.from(visitedUrls).join('\n')); }
      catch (e) { log('error', 'Failed to write visited URLs file', e); }
      try { log('info', `Writing ${allEncounteredUrls.size} encountered URLs to ${ALL_URLS_LOG_FILE}`); fs.writeFileSync(ALL_URLS_LOG_FILE, Array.from(allEncounteredUrls).join('\n')); }
      catch (e) { log('error', 'Failed to write all encountered URLs file', e); }
      if (browser && browser.isConnected()) { /* ... browser close logic ... */ }
      else { /* ... */ }
      const missedCount = allEncounteredUrls.size - visitedUrls.size;
      log('info', `Crawling finished.`);
      log('info', `>> Total URLs Encountered: ${allEncounteredUrls.size} (see ${ALL_URLS_LOG_FILE})`);
      log('info', `>> Total URLs Visited & Processed: ${visitedUrls.size} (see ${VISITED_URLS_LOG_FILE})`);
      log('info', `>> Potential Missed/Errored URLs: ${missedCount}`);
      log('info', `>> Saved HTML Pages (Full Content): ${htmlCrawlCount}`);
      log('info', `>> Downloaded PDFs: ${pdfDownloadCount}`);
      logStream.end();
  }
}

// --- Execute (Same as before) ---
startCrawling().catch(error => { /* ... */ });
process.on('SIGINT', async () => { /* ... */ });
process.on('uncaughtException', (error, origin) => { /* ... */ });
process.on('unhandledRejection', (reason, promise) => { /* ... */ });