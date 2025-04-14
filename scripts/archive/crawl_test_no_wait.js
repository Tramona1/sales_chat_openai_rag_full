// Filename: crawl_test_no_wait.js
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
const LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_crawler_test2.log'); // Separate log file
const ALL_URLS_LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_all_encountered_urls_test2.txt');
const VISITED_URLS_LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_visited_urls_test2.txt');

const MAX_CONCURRENCY = 2;
const DELAY_MS = 2000;
const PAGE_LOAD_TIMEOUT_MS = 90000;
// const EXPLICIT_WAIT_TIMEOUT_MS = 40000; // Not used in this test
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
const log = (level, message, data) => { /* ... same logging function ... */ };

// --- Global State (Same as before) ---
const visitedUrls = new Set();
const allEncounteredUrls = new Set();
const queue = [];
const limit = pLimit(MAX_CONCURRENCY);
let htmlCrawlCount = 0;
let pdfDownloadCount = 0;
let browser = null;

// --- Helper Functions ---
function isAllowed(url) { /* ... same isAllowed function ... */ }
if (isAllowed(START_URL)) { queue.push(START_URL); allEncounteredUrls.add(START_URL); }
else { log('error', `START_URL ${START_URL} is not allowed.`); process.exit(1); }

async function extractDataPuppeteer(page, url) { /* ... same extractDataPuppeteer function ... */ }
async function findLinksPuppeteerTargeted(page, baseUrl) { /* ... same findLinksPuppeteerTargeted function ... */ }
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
        log('debug', `Navigation response status: ${response?.status()} for ${url}`);
    } catch (gotoError) { /* ... goto error handling ... */ }

    const status = response?.status();
    const finalUrl = page.url();

    // Redirect handling (same)
    if (finalUrl !== url) { /* ... */ }
    // Error status handling (same)
    if (!status || status < 200 || status >= 400) { /* ... */ }

    const contentType = response?.headers()['content-type']?.toLowerCase() || '';

    if (contentType.includes('text/html')) {
      log('debug', `Page loaded (HTML), attempting to process content... ${finalUrl}`);

      // *** EXPLICIT WAIT REMOVED FOR THIS TEST ***
      log('debug', 'Skipping explicit waitForSelector for this test.');
      // *** END WAIT REMOVED ***

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
  finally { /* ... finally block with page close ... */ }
}

// --- Main Execution ---
async function startCrawling() {
  log('info', 'Crawler starting TEST 2 (No Explicit Wait)...');
  log('warn', 'ROBOTS.TXT CHECK IS CURRENTLY DISABLED.');
  try {
      log('info', 'Launching browser (HEADLESS)...');
      // *** Headless is TRUE for this test ***
      browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-zygote','--disable-gpu']
       });
      log('info', `Browser launched successfully. PID: ${browser.process()?.pid || 'N/A'}`);
      browser.on('disconnected', () => { log('error', 'BROWSER DISCONNECTED UNEXPECTEDLY.'); browser = null; });

      const crawlPromises = [];
      // *** Limit to only the first URL for this test ***
      if (queue.length > 0) {
          const currentUrl = queue.shift();
           if (isAllowed(currentUrl)) {
               allEncounteredUrls.add(currentUrl);
               log('info', `Processing only START_URL: ${currentUrl}`);
               const promise = limit(() => crawlPage(currentUrl)).catch(err => log('error', `Unhandled error in limited task for ${currentUrl}`, err));
               crawlPromises.push(promise);
           } else { log('error', `START_URL ${currentUrl} became disallowed?`); }
      } else { log('error', 'Queue is empty, cannot start test.'); }
      // *** End limit to first URL ***

      log('info', `Waiting for the first page task to finish...`);
      await Promise.all(crawlPromises).catch(err => log('error', 'Error during Promise.all wait', err));
      log('info', 'First page task completed or errored.');

  } catch (error) { log('error', 'Fatal error during crawling setup or execution', error); }
  finally {
      // Close browser after test
      if (browser && browser.isConnected()) {
          log('info', 'Closing browser...');
          await browser.close().catch(e => log('error', 'Error closing browser', e));
      }
      log('info', `Test 2 finished. Visited: ${visitedUrls.size}, Encountered: ${allEncounteredUrls.size}`);
      logStream.end();
  }
}

// --- Execute ---
startCrawling().catch(error => { /* ... */ });
// Keep process handlers
process.on('SIGINT', async () => { /* ... */ });
process.on('uncaughtException', (error, origin) => { /* ... */ });
process.on('unhandledRejection', (reason, promise) => { /* ... */ });