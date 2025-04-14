// Filename: scripts/test_nav.js
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';

const url = 'https://workstream.my.site.com/knowledgebase/s/';
const screenshotPath = path.resolve(process.cwd(), 'data', 'nav_test_screenshot.png');
const logPath = path.resolve(process.cwd(), 'data', 'logs', 'nav_test.log');

// Ensure directories exist
fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
fs.mkdirSync(path.dirname(logPath), { recursive: true });

const log = (msg) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${msg}`);
    fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
};

(async () => {
    let browser = null;
    log('Starting navigation test...');
    try {
        log('Launching browser...');
        browser = await puppeteer.launch({
            headless: false, // Keep it visible for this test
            slowMo: 100,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        log(`Browser launched (PID: ${browser.process()?.pid})`);

        const page = await browser.newPage();
        log('New page created.');
        await page.setViewport({ width: 1280, height: 800 });
        log(`Viewport set. Navigating to: ${url}`);

        // Increase navigation timeout significantly
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 120000 }); // Wait longer, try networkidle0

        log(`Navigation to ${url} completed (or timed out).`);
        await page.waitForTimeout(5000); // Wait 5 seconds after load signal

        log(`Taking screenshot: ${screenshotPath}`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        log('Screenshot saved.');

    } catch (error) {
        log(`ERROR during navigation test: ${error.message}`);
        console.error(error);
    } finally {
        if (browser) {
            log('Closing browser...');
            await browser.close();
            log('Browser closed.');
        }
        log('Navigation test finished.');
    }
})();