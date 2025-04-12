import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
// import robotsParser from 'robots-parser'; // Still commented out for testing
import pLimit from 'p-limit';
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames

// --- Configuration ---
const START_URL = 'https://workstream.my.site.com/knowledgebase/s/';
const ALLOWED_DOMAIN = new URL(START_URL).hostname;
// Output for HTML page data
const HTML_OUTPUT_FILE = path.resolve(process.cwd(), 'data', 'workstream_crawl_html_output.jsonl');
// Output log for downloaded PDFs
const PDF_LOG_FILE = path.resolve(process.cwd(), 'data', 'workstream_crawl_pdf_log.jsonl');
// Directory to save downloaded PDFs
const PDF_DOWNLOAD_DIR = path.resolve(process.cwd(), 'data', 'crawled_pdfs');
const LOG_FILE = path.resolve(process.cwd(), 'data', 'logs', 'workstream_crawler.log');
const MAX_CONCURRENCY = 5;
const DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 20000; // Increased slightly for potential larger downloads
const USER_AGENT = 'SalesKnowledgeAssistantCrawler/1.0 (+http://your-contact-info.com)';
// --- End Configuration ---

// Ensure directories exist
fs.mkdirSync(path.dirname(HTML_OUTPUT_FILE), { recursive: true });
fs.mkdirSync(path.dirname(PDF_LOG_FILE), { recursive: true });
fs.mkdirSync(PDF_DOWNLOAD_DIR, { recursive: true });
fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });

const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
const log = (level, message, data) => {
    // (Same logging function as before)
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  console.log(logEntry);
  logStream.write(logEntry + '\n');
  if (data) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    logStream.write(dataStr + '\n');
    if (level === 'error' && data instanceof Error) {
      console.error(data);
    }
  }
};

const visitedUrls = new Set();
const queue = [START_URL];
const limit = pLimit(MAX_CONCURRENCY);
let htmlCrawlCount = 0;
let pdfDownloadCount = 0;

// Function isAllowed (Robots check still commented out)
function isAllowed(url) {
  // (Same as previous version with robots check commented)
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) return false;
    if (parsedUrl.hostname !== ALLOWED_DOMAIN) return false;
    log('warn', `Robots.txt check skipped for testing: ${url}`); // Add warning when skipping
    return true;
  } catch (error) {
    log('warn', `Invalid URL encountered: ${url}`, error);
    return false;
  }
}

// Function extractData (For HTML pages only)
function extractData(html, url) {
  // (Same as before - NEEDS REFINEMENT FOR SITE)
  try {
    const $ = cheerio.load(html);
    const title = $('title').first().text() || $('h1').first().text() || url;
    $('script, style, nav, header, footer, aside, form, button, noscript').remove();
    let content = $('main').text() || $('article').text() || $('body').text();
    content = content.replace(/\s\s+/g, ' ').replace(/(\r\n|\n|\r)/gm, " ").trim();
    if (content.length < 100) {
        log('info', `Skipping page due to minimal content: ${url}`);
        return null;
    }
    return {
      url: url,
      title: title.trim(),
      content: content, // Extracted text content
      contentType: 'html',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    log('error', `Error extracting data from ${url}`, error);
    return null;
  }
}

// Function findLinks (Same as before)
function findLinks(html, baseUrl) {
  // (Same as before)
  const links = new Set();
  try {
    const $ = cheerio.load(html);
    $('a[href]').each((i, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).toString();
          const urlObj = new URL(absoluteUrl);
          urlObj.hash = '';
          const cleanUrl = urlObj.toString();
          links.add(cleanUrl);
        } catch (e) { /* Ignore invalid URLs */ }
      }
    });
  } catch (error) {
    log('error', `Error finding links on ${baseUrl}`, error);
  }
  return Array.from(links);
}


// Function to save HTML data
function saveHtmlData(data) {
  try {
    fs.appendFileSync(HTML_OUTPUT_FILE, JSON.stringify(data) + '\n');
    htmlCrawlCount++;
  } catch (error) {
    log('error', `Failed to write HTML data to ${HTML_OUTPUT_FILE}`, error);
  }
}

// Function to save PDF metadata log
function savePdfLog(pdfInfo) {
   try {
    fs.appendFileSync(PDF_LOG_FILE, JSON.stringify(pdfInfo) + '\n');
    pdfDownloadCount++;
  } catch (error) {
    log('error', `Failed to write PDF log to ${PDF_LOG_FILE}`, error);
  }
}

// Modified crawlPage function
async function crawlPage(url) {
  if (visitedUrls.has(url)) {
    return;
  }
  log('info', `Crawling: ${url}`);
  visitedUrls.add(url);

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: REQUEST_TIMEOUT_MS,
      responseType: 'arraybuffer', // Fetch as buffer to handle both HTML and PDF
      validateStatus: status => status >= 200 && status < 300,
    });

    const contentType = response.headers['content-type']?.toLowerCase() || '';
    const buffer = Buffer.from(response.data); // Convert arraybuffer to Node.js Buffer

    if (contentType.includes('text/html')) {
      const html = buffer.toString('utf-8'); // Decode buffer as HTML
      const extracted = extractData(html, url);
      if (extracted) {
        saveHtmlData(extracted); // Save extracted HTML data
      }

      // Find links only on HTML pages
      const newLinks = findLinks(html, url);
      for (const link of newLinks) {
        if (isAllowed(link) && !visitedUrls.has(link) && !queue.includes(link)) {
          if(queue.length < 50000) {
             queue.push(link);
          } else {
              log('warn', 'Queue size limit reached, not adding more links.');
              break;
          }
        }
      }
    } else if (contentType.includes('application/pdf')) {
      log('info', `PDF detected: ${url}`);
      // Generate a unique filename for the PDF
      const urlFilename = path.basename(new URL(url).pathname);
      const uniqueFilename = `${Date.now()}_${uuidv4()}_${urlFilename.replace(/[^a-z0-9.]/gi, '_')}.pdf`;
      const savePath = path.join(PDF_DOWNLOAD_DIR, uniqueFilename);

      try {
        fs.writeFileSync(savePath, buffer);
        log('success', `Saved PDF: ${uniqueFilename} (from ${url})`);
        // Log metadata about the downloaded PDF
        savePdfLog({
            url: url,
            filePath: savePath,
            filename: uniqueFilename,
            contentType: contentType,
            size: buffer.length,
            downloadTimestamp: new Date().toISOString()
        });
      } catch (saveError) {
          log('error', `Failed to save PDF ${uniqueFilename} from ${url}`, saveError);
      }
      // We don't typically find further links within PDF content with this method
    } else {
      log('info', `Skipping unsupported content type at ${url} (Type: ${contentType})`);
    }
  } catch (error) {
     if (axios.isAxiosError(error)) {
       log('error', `Axios error crawling ${url}: ${error.message}`, error.response?.status ? `Status: ${error.response.status}` : '');
     } else {
       log('error', `Unexpected error crawling ${url}`, error);
     }
  }
}

// Main startCrawling function (modified to work with newer p-limit)
async function startCrawling() {
  log('info', 'Crawler starting... (ROBOTS.TXT CHECK DISABLED FOR TESTING)');
  // await fetchRobotsTxt(); // Keep commented out for testing

  const crawlPromises = [];

  while (queue.length > 0) {
      const currentUrl = queue.shift();
      if (!visitedUrls.has(currentUrl) && isAllowed(currentUrl)) {
         // Store the promise returned by limit
         const promise = limit(() => crawlPage(currentUrl));
         crawlPromises.push(promise);
         await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      } else if (visitedUrls.has(currentUrl)) {
          // log('info', `Already visited or queued: ${currentUrl}`); // Reduce log noise
      }
  }

  // Wait for all crawl tasks to complete
  await Promise.all(crawlPromises);
  
  log('info', `Crawling finished. Visited ${visitedUrls.size} URLs. Saved ${htmlCrawlCount} HTML pages. Downloaded ${pdfDownloadCount} PDFs.`);
  logStream.end();
}

// Execute the crawler
startCrawling().catch(error => {
  log('error', 'Crawler encountered a fatal error', error);
  logStream.end();
  process.exit(1);
});