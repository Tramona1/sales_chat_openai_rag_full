// Filename: crawl_test_headless_false.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';

// --- Configuration ---
const START_URL = 'https://workstream.my.site.com/knowledgebase/s/';
const ALLOWED_DOMAIN = new URL(START_URL).hostname;
const HTML_OUTPUT_FILE = path.resolve(process.cwd(), 'data', 'workstream_crawl_full_content_puppeteer_targeted.jsonl');
const PDF_LOG_FILE = path.resolve(process.cwd(), 'data', 'workstream_crawl_pdf_log.jsonl');
const PDF_DOWNLOAD_DIR = path.resolve(process.cwd(), 'data', 'crawled_pdfs');
const LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_crawler_test1.log'); // Separate log file
const ALL_URLS_LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_all_encountered_urls_test1.txt');
const VISITED_URLS_LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_visited_urls_test1.txt');

const MAX_CONCURRENCY = 1; // Run only one page at a time for visual inspection
const DELAY_MS = 2000;
const PAGE_LOAD_TIMEOUT_MS = 90000;
const EXPLICIT_WAIT_TIMEOUT_MS = 40000;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_QUEUE_SIZE = 50000;
const MIN_CONTENT_LENGTH = 100;

const USER_AGENT = 'SalesKnowledgeAssistantCrawler/1.0 (+https://your-contact-info.com)';
// --- End Configuration ---

// --- Directory Setup & Logging ---
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

// --- Global State ---
const visitedUrls = new Set();
const allEncounteredUrls = new Set();
const queue = [];
const limit = pLimit(MAX_CONCURRENCY);
let htmlCrawlCount = 0;
let pdfDownloadCount = 0;
let browser = null;

// --- Helper Functions ---
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
if (isAllowed(START_URL)) { queue.push(START_URL); allEncounteredUrls.add(START_URL); }
else { log('error', `START_URL ${START_URL} is not allowed.`); process.exit(1); }

async function extractDataPuppeteer(page, url) { /* ... same extractDataPuppeteer function ... */
    try {
        log('debug', `Attempting data extraction via page.evaluate for: ${url}`);
        const extractedData = await page.evaluate((MIN_CONTENT_LENGTH_BROWSER) => {
            let content = ''; let title = '';
            function getTextRecursive(element) { /* ... */ }
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
async function findLinksPuppeteerTargeted(page, baseUrl) { /* ... same findLinksPuppeteerTargeted function ... */
    const links = new Set();
    const selectorsToTry = [ /* ... */ ];
    log('debug', `Attempting link extraction via TARGETED page.$$eval for: ${baseUrl}`);
    let totalRawHrefs = 0;
    for (const selector of selectorsToTry) {
        try {
            log('debug', `Evaluating selector: ${selector}`);
            const hrefs = await page.$$eval(selector, anchors => anchors.map(a => a.href));
            totalRawHrefs += hrefs.length;
            log('debug', `Found ${hrefs.length} raw hrefs for selector "${selector}": ${JSON.stringify(hrefs)}`);
            for (const href of hrefs) { /* ... link processing ... */ }
        } catch (error) { /* ... error handling ... */ }
    }
    log('debug', `Finished evaluating all targeted selectors. Total raw hrefs found: ${totalRawHrefs}`);
    return Array.from(links);
}
function saveHtmlData(data) { /* ... */ }
function savePdfLog(pdfInfo) { /* ... */ }

// --- Core Crawling Logic ---
async function crawlPage(url) {
  if (visitedUrls.has(url)) { log('debug', `Already visited: ${url}`); return; }
  log('info', `Crawling: ${url}`);
  visitedUrls.add(url);

  let page = null;

  try {
    // PDF Check (same)
    const urlPath = new URL(url).pathname.toLowerCase();
    let isLikelyPdf = urlPath.endsWith('.pdf') || urlPath.includes('/file-asset/');
    if (isLikelyPdf) { /* ... same PDF handling logic ... */ }

    // Puppeteer Crawl
    log('debug', `Using Puppeteer for: ${url}`);
    if (!browser || !browser.isConnected()) { log('error', 'Browser not available in crawlPage'); return; }
    page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1366, height: 768 });
    await page.setRequestInterception(true);
    page.on('request', (req) => { /* ... same request interception ... */ });

    let response;
    try {
        log('debug', `Navigating browser to: ${url}`);
        response = await page.goto(url, { waitUntil: 'load', timeout: PAGE_LOAD_TIMEOUT_MS });
        log('debug', `Navigation response status: ${response?.status()} for ${url}`); // Log status immediately
    } catch (gotoError) { /* ... goto error handling ... */ }

    const status = response?.status(); // Use optional chaining
    const finalUrl = page.url();

    // Redirect handling (same)
    if (finalUrl !== url) { /* ... */ }
    // Error status handling (same)
    if (!status || status < 200 || status >= 400) { /* ... */ }

    const contentType = response?.headers()['content-type']?.toLowerCase() || '';

    if (contentType.includes('text/html')) {
      log('debug', `Page loaded (HTML), attempting to process content... ${finalUrl}`);
      const waitSelector = 'a.comm-tile-menu__item-link, a.article-link, .slds-rich-text-editor__output, footer';
      try {
          log('debug', `Waiting for specific content/link selector '${waitSelector}' on ${finalUrl}`);
          await page.waitForSelector(waitSelector, { timeout: EXPLICIT_WAIT_TIMEOUT_MS });
          log('debug', `Specific selector '${waitSelector}' found. Proceeding.`);
      } catch (waitError) {
          log('warn', `Timeout waiting for specific selector '${waitSelector}' on ${finalUrl}. Page might be incomplete.`, waitError.message);
      }

      // Use Puppeteer functions for extraction
      const extracted = await extractDataPuppeteer(page, finalUrl);
      const newLinks = await findLinksPuppeteerTargeted(page, finalUrl);

      // Close page
      if (page && !page.isClosed()) await page.close().catch(e => log('error', 'Error closing page after evaluations', e));
      page = null;

      // Process results (same)
      if (extracted) { /* ... */ } else { /* ... */ }
      if (newLinks.length === 0) { /* ... */ } else { /* ... */ }
      for (const link of newLinks) { /* ... */ }

    } else { /* ... non-HTML handling ... */ }

  } catch (error) { /* ... main error handling ... */ }
  finally { // Ensure page is closed even if errors occur before explicit close
      if (page && !page.isClosed()) {
          log('warn', `Closing page in finally block for ${url}`);
          await page.close().catch(e => log('error', 'Error closing page in finally block', e));
      }
  }
}

// --- Main Execution ---
async function startCrawling() {
  log('info', 'Crawler starting TEST 1 (Headless: false)...');
  log('warn', 'ROBOTS.TXT CHECK IS CURRENTLY DISABLED.');
  try {
      log('info', 'Launching browser (VISIBLE)...');
      browser = await puppeteer.launch({
          headless: false, // *** VISIBLE BROWSER ***
          slowMo: 150, // Optional: Slow down operations slightly (ms)
          args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              // '--window-size=1400,900' // Optional: Set window size
          ]
       });
      log('info', `Browser launched successfully. PID: ${browser.process()?.pid || 'N/A'}`);
      browser.on('disconnected', () => { log('error', 'BROWSER DISCONNECTED UNEXPECTEDLY.'); browser = null; });

      const crawlPromises = [];
      // *** Limit to only the first URL for this test ***
      if (queue.length > 0) {
          const currentUrl = queue.shift();
          if (isAllowed(currentUrl)) { // Double check allowed
              allEncounteredUrls.add(currentUrl);
              log('info', `Processing only START_URL: ${currentUrl}`);
              const promise = limit(() => crawlPage(currentUrl)).catch(err => log('error', `Unhandled error in limited task for ${currentUrl}`, err));
              crawlPromises.push(promise);
          } else {
               log('error', `START_URL ${currentUrl} became disallowed?`);
          }
      } else {
          log('error', 'Queue is empty, cannot start test.');
      }
      // *** End limit to first URL ***

      log('info', `Waiting for the first page task to finish...`);
      await Promise.all(crawlPromises).catch(err => log('error', 'Error during Promise.all wait', err));
      log('info', 'First page task completed or errored.');

  } catch (error) { log('error', 'Fatal error during crawling setup or execution', error); }
  finally {
      // Keep browser open for inspection if headless: false, otherwise close
      if (browser && browser.isConnected()) {
          log('info', 'Test finished. Browser window kept open for inspection (if headless: false). Close it manually.');
          // await browser.close(); // Uncomment to auto-close
      }
      log('info', `Test 1 finished. Visited: ${visitedUrls.size}, Encountered: ${allEncounteredUrls.size}`);
      logStream.end();
  }
}

// --- Execute ---
startCrawling().catch(error => { /* ... */ });
// Keep process handlers
process.on('SIGINT', async () => { /* ... */ });
process.on('uncaughtException', (error, origin) => { /* ... */ });
process.on('unhandledRejection', (reason, promise) => { /* ... */ });