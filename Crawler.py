import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from collections import deque
import time
import json
import signal
import sys
import traceback # For detailed error logging if needed
# from urllib.robotparser import RobotFileParser # <-- ROBOTS: Commented out import

# --- Configuration ---
START_URL = "https://www.workstream.us/"
ALLOWED_DOMAIN = urlparse(START_URL).netloc
OUTPUT_FILE = "workstream_crawl_data_unlimited_cleaned_NO_ROBOTS_FINAL.json" # <-- ROBOTS: Changed output file name again
REQUEST_DELAY = 0.5  # Keep delay for politeness, even without robots check (Increase if needed!)
# MAX_PAGES removed for unlimited crawl
USER_AGENT = "MySimplePythonCrawler/1.2 (TESTING - Robots Disabled) (+http://your-contact-info-or-project-url.com)" # <<< --- *** PLEASE CHANGE THIS URL ***

# --- Global Variables ---
visited_urls = set()
pages_crawled = 0
crawl_data = {}
# --- Simple mechanism to save periodically ---
SAVE_EVERY_N_PAGES = 200 # Save progress every N pages
last_save_count = 0

# --- Robots.txt Parser (Commented Out Section) ---
# rp = RobotFileParser()
# robots_url = urljoin(START_URL, "/robots.txt")
# print(f"Attempting to fetch robots.txt from: {robots_url}")
# try:
#     rp.set_url(robots_url)
#     rp.read()
#     crawl_delay = rp.crawl_delay(USER_AGENT)
#     if crawl_delay:
#         print(f"Robots.txt suggests a crawl delay of {crawl_delay} seconds. Adjusting REQUEST_DELAY.")
#         REQUEST_DELAY = max(REQUEST_DELAY, crawl_delay)
#     request_rate = rp.request_rate(USER_AGENT)
#     if request_rate:
#          calculated_delay = request_rate.seconds / request_rate.requests
#          print(f"Robots.txt suggests a request rate of {request_rate.requests} req / {request_rate.seconds} sec. Adjusting REQUEST_DELAY.")
#          REQUEST_DELAY = max(REQUEST_DELAY, calculated_delay)
#     print(f"Successfully read robots.txt. Effective Request Delay: {REQUEST_DELAY} seconds.")
#     if not rp.can_fetch(USER_AGENT, START_URL):
#         print(f"WARNING: robots.txt specifically disallows crawling for User-Agent '{USER_AGENT}' at {START_URL}. Exiting.")
#         sys.exit(1)
#     else:
#         print(f"robots.txt permits crawling for User-Agent '{USER_AGENT}' at {START_URL} (will check subsequent pages).")
# except Exception as e:
#     print(f"Warning: Could not fetch or parse robots.txt: {e}")
#     print(f"Proceeding with default delay {REQUEST_DELAY}s, but unable to verify robots.txt rules.")
# --- End of Commented Out Robots.txt Section ---

# --- Graceful Exit Handler ---
def signal_handler(sig, frame):
    print('\nCtrl+C detected! Stopping crawl and saving final data...')
    save_data(crawl_data, OUTPUT_FILE) # Ensure final save on exit
    print(f"Final data saved to {OUTPUT_FILE}")
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler) # Handle Ctrl+C

# --- Helper Functions ---

# --- Commented out is_allowed_by_robots function ---
# def is_allowed_by_robots(url):
#     # *** ROBOTS.TXT CHECK IS DISABLED FOR THIS RUN ***
#     return True # Always allow when check is disabled
# --- End of commented out function ---


def is_valid_url(url):
    """Checks if the URL is valid, within the allowed domain, and not an anchor/mailto/etc."""
    try:
        parsed = urlparse(url)
        # Check scheme, domain, and avoid fragments
        if not (parsed.scheme in ["http", "https"] and parsed.netloc == ALLOWED_DOMAIN and '#' not in url):
            return False
        # Avoid common non-HTML file extensions
        lower_url = url.lower()
        excluded_extensions = (
            '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.docx', '.xlsx',
            '.pptx', '.mp4', '.mov', '.avi', '.svg', '.css', '.js', '.xml',
            '.txt', '.ico', '.webp', '.woff', '.woff2', '.ttf', '.eot', '.map'
        )
        if lower_url.split('?')[0].split('#')[0].endswith(excluded_extensions):
            # print(f"  Skipping potential file URL: {url}") # Uncomment for debugging
            return False
        return True
    except ValueError:
        print(f"  Skipping malformed URL: {url}")
        return False


def save_data(data, filename, is_final=False):
    """Saves the crawled data to a JSON file."""
    if is_final:
        print(f"\nAttempting to save FINAL data for {len(data)} pages to {filename}...")
    else:
         print(f"\n--- Saving intermediate progress ({len(data)} pages) to {filename} ---")
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Successfully saved data to {filename}.")
    except Exception as e:
        print(f"Error saving data to {filename}: {e}")
    except MemoryError:
         print(f"MemoryError: Failed to save data to {filename} - likely too large.")
         print("Consider more frequent saves or streaming to disk.")


def crawl(start_url):
    """Main crawling function."""
    global visited_urls, pages_crawled, crawl_data, last_save_count

    queue = deque([start_url])
    headers = {'User-Agent': USER_AGENT}

    print("\n" + "="*40)
    print("   🛑 WARNING: ROBOTS.TXT CHECK IS DISABLED! 🛑  ")
    print("   This crawler WILL NOT respect robots.txt rules.")
    print("   Use ONLY for brief, limited testing.")
    print("   Re-enable robots.txt before any real crawl.")
    print("="*40 + "\n")
    print("--- Starting Unlimited Crawl (Refined Cleaned Text - NO ROBOTS) ---")
    print(f"Request Delay: {REQUEST_DELAY} seconds")
    print(f"Saving progress every {SAVE_EVERY_N_PAGES} pages to {OUTPUT_FILE}")
    print("Press Ctrl+C to stop gracefully and save final progress.")
    print("-" * 30)

    while queue:
        # --- MAX_PAGES Check Removed ---

        current_url = queue.popleft()

        # Clean URL slightly for consistency
        parsed_url_temp = urlparse(current_url)
        if parsed_url_temp.path and parsed_url_temp.path != '/' and current_url.endswith('/'):
             current_url = current_url.rstrip('/')

        if current_url in visited_urls:
            continue

        # --- Check robots.txt (Commented Out) ---
        # if not is_allowed_by_robots(current_url):
        #     print(f"Skipping (disallowed by robots.txt): {current_url}")
        #     visited_urls.add(current_url)
        #     continue
        # --- End of Commented Out Check ---

        # Proceeding without robots check
        print(f"Crawling ({pages_crawled + 1}): {current_url}")
        visited_urls.add(current_url)


        try:
            # --- Add Delay ---
            time.sleep(REQUEST_DELAY)

            response = requests.get(current_url, headers=headers, timeout=25) # Slightly longer timeout
            response.raise_for_status()
            response.encoding = response.apparent_encoding # Try to guess encoding

            # --- Check Content Type ---
            content_type = response.headers.get('content-type', '').lower()
            if 'text/html' not in content_type:
                print(f"  Skipping non-HTML content: {current_url} ({content_type})")
                crawl_data[current_url] = {"status": "skipped_non_html", "content_type": content_type}
                # Increment pages_crawled here since we processed the URL header
                pages_crawled += 1
                continue

            # --- Parse HTML ---
            try:
                soup = BeautifulSoup(response.content, 'lxml') # Prefer lxml
            except:
                soup = BeautifulSoup(response.content, 'html.parser') # Fallback

            # --- Extract Text (Refined Strategy) ---
            main_content_area = None
            page_text = ""
            extraction_method = "Unknown" # For logging

            # Strategy 1: Look for <main id="main-content">
            main_content_area = soup.find('main', id='main-content')
            if main_content_area:
                extraction_method = "main#main-content"
                page_text = main_content_area.get_text(separator=' ', strip=True)
            else:
                # Strategy 2: Look for just <main> tag
                main_content_area = soup.find('main')
                if main_content_area:
                    extraction_method = "<main> tag"
                    print(f"  Found main content using '{extraction_method}'.")
                    page_text = main_content_area.get_text(separator=' ', strip=True)
                else:
                    # Strategy 3: Look for <div class="body-container-wrapper">
                    main_content_area = soup.find('div', class_='body-container-wrapper')
                    if main_content_area:
                        extraction_method = "div.body-container-wrapper"
                        print(f"  Found main content using '{extraction_method}'.")
                        # Clean boilerplate *within* this div if needed (make copy)
                        temp_soup = BeautifulSoup(str(main_content_area), 'html.parser')
                        selectors_to_remove = ['header', 'footer', 'nav', '.announcement_bar', 'script', 'style', 'noscript']
                        removed_count = 0
                        for selector in selectors_to_remove:
                             for element in temp_soup.select(selector):
                                  element.decompose()
                                  removed_count += 1
                        if removed_count > 0:
                            print(f"    ({extraction_method}) Removed {removed_count} potential boilerplate element(s) from within.")
                        page_text = temp_soup.get_text(separator=' ', strip=True)
                    else:
                        # Strategy 4: Absolute Fallback - Process the whole body and attempt removal
                        extraction_method = "Fallback (Body Cleanup)"
                        print(f"  Warning: Could not find preferred content containers on {current_url}. {extraction_method}.")
                        if soup.body:
                            temp_body_soup = BeautifulSoup(str(soup.body), 'html.parser')
                            selectors_to_remove = [
                                'header', 'footer', 'nav', '.announcement_bar',
                                'div.header_mega_menu', 'div.header_fixed_manage',
                                'noscript', 'script', 'style',
                                '.social-links', '#sidebar', '.advertisement', '.cookie-consent',
                                '.hs-skip-link', '#hs-web-interactives-.*', '.go[0-9]+', # HubSpot specific / dynamic IDs
                                'iframe[src*="googletagmanager"]' # GTM iframe
                            ]
                            removed_count = 0
                            for selector in selectors_to_remove:
                                 for element in temp_body_soup.select(selector):
                                      element.decompose()
                                      removed_count += 1
                            if removed_count > 0:
                                 print(f"    ({extraction_method}) Removed {removed_count} potential boilerplate element(s).")
                            page_text = temp_body_soup.get_text(separator=' ', strip=True)
                        else:
                             extraction_method = "Fallback (Full Document - No Body)"
                             print(f"  Error: No <body> tag found on {current_url}. Getting text from entire document.")
                             page_text = soup.get_text(separator=' ', strip=True)

            # --- Store Data ---
            page_title = soup.title.string.strip() if soup.title and soup.title.string else "No Title Found"
            crawl_data[current_url] = {
                "status": "success",
                "text": page_text,
                "title": page_title,
                "extraction_method": extraction_method # Log how text was found
            }

            # --- Find and Queue Links (Uses original soup) ---
            links_found_this_page = 0
            new_links_added = 0
            for link in soup.find_all('a', href=True):
                href = link.get('href')
                if not href:
                    continue

                absolute_url = urljoin(current_url, href.strip())
                parsed_new_url = urlparse(absolute_url)
                absolute_url = parsed_new_url._replace(fragment="").geturl()
                if parsed_new_url.path and parsed_new_url.path != '/' and absolute_url.endswith('/'):
                    absolute_url = absolute_url.rstrip('/')

                links_found_this_page += 1
                if is_valid_url(absolute_url) and absolute_url not in visited_urls and absolute_url not in queue:
                    queue.append(absolute_url)
                    new_links_added+=1

            # Increment pages_crawled AFTER successful processing
            pages_crawled += 1

            # --- Periodic Save ---
            if pages_crawled % SAVE_EVERY_N_PAGES == 0 and pages_crawled > last_save_count:
                 save_data(crawl_data, OUTPUT_FILE, is_final=False)
                 last_save_count = pages_crawled


        except requests.exceptions.Timeout:
             print(f"  Timeout Error fetching {current_url}")
             crawl_data[current_url] = {"status": "error", "error_message": "Request timed out"}
             pages_crawled += 1 # Count error pages as processed
        except requests.exceptions.RequestException as e:
            print(f"  Request Error fetching {current_url}: {e}")
            crawl_data[current_url] = {"status": "error", "error_message": str(e)}
            pages_crawled += 1 # Count error pages as processed
        except Exception as e:
            print(f"  General Error processing {current_url}: {type(e).__name__} - {e}")
            # print(traceback.format_exc()) # Uncomment for detailed traceback
            crawl_data[current_url] = {"status": "processing_error", "error_message": f"{type(e).__name__}: {e}"}
            pages_crawled += 1 # Count error pages as processed
        except KeyboardInterrupt:
             print("\nKeyboard Interrupt detected in loop! Saving data...")
             save_data(crawl_data, OUTPUT_FILE, is_final=True)
             sys.exit(1)


    print("-" * 30)
    print(f"\nCrawling finished (queue is empty).")
    print(f"Visited {len(visited_urls)} unique URLs.")
    print(f"Processed approximately {pages_crawled} pages (including skips/errors).")


# --- Main Execution ---
if __name__ == "__main__":
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print("!!! 🛑 WARNING: ROBOTS.TXT CHECK IS DISABLED  🛑 !!!")
    print("!!! THIS CRAWLER WILL IGNORE ROBOTS.TXT          !!!")
    print("!!! USE FOR LIMITED TESTING PURPOSES ONLY!       !!!")
    print("!!! HIGH RISK OF IP BLOCK & SERVER OVERLOAD!     !!!")
    print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    print(f"\nStarting UNLIMITED crawl for {START_URL}")
    print(f"Allowed domain: {ALLOWED_DOMAIN}")
    print(f"Output file: {OUTPUT_FILE}")
    print(f"User-Agent: {USER_AGENT} <<< --- CHANGE THIS!")
    print("-" * 30)

    start_time = time.time()
    try:
        crawl(START_URL)
    except Exception as main_e:
        print("\n" + "="*10 + " UNEXPECTED ERROR IN MAIN EXECUTION " + "="*10)
        print(f"An error occurred: {type(main_e).__name__} - {main_e}")
        print(traceback.format_exc())
        print("Attempting to save any data collected so far...")
    finally:
        save_data(crawl_data, OUTPUT_FILE, is_final=True) # Save final data regardless of exit reason
        end_time = time.time()
        elapsed_time = end_time - start_time
        print(f"\nTotal crawling time: {elapsed_time:.2f} seconds ({elapsed_time/60:.1f} minutes)")
        if pages_crawled > 0:
             print(f"Average time per page processed: {elapsed_time / pages_crawled:.3f} seconds")
        print("\n--- Crawl Attempt Completed ---")
        print("\n*** REMINDER: Re-enable robots.txt checks before any real crawling! ***")