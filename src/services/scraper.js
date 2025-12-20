import { chromium } from 'playwright';
import TurndownService from 'turndown';
import logger from '../logger.js';
import axios from 'axios';
import * as pdfjs from 'pdfjs-dist';

// This is required for pdfjs-dist to work in a Node.js environment
pdfjs.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/build/pdf.worker.mjs';

/**
 * Scrapes the text content from a PDF URL.
 * @param {string} url The URL of the PDF.
 * @returns {Promise<{title: string, content: string, mimeType: string}>}
 */
const scrapePdf = async (url) => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const uint8array = new Uint8Array(response.data);
    const doc = await pdfjs.getDocument(uint8array).promise;
    let text = '';
    
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      
      let lastY;
      let pageText = '';
      
      for (const item of content.items) {
        const currentY = item.transform[5];
        
        if (lastY !== undefined) {
          const yDiff = Math.abs(currentY - lastY);
          if (yDiff > 5) {
            // New line detected
            pageText += '\n';
            // If the gap is large, treat it as a paragraph break
            if (yDiff > 15) {
              pageText += '\n';
            }
          } else {
            // Same line, add a space if the item doesn't already start with one
            if (pageText.length > 0 && !pageText.endsWith(' ') && !item.str.startsWith(' ')) {
              pageText += ' ';
            }
          }
        }
        
        pageText += item.str;
        lastY = currentY;
      }
      text += pageText + '\n\n--- Page ' + i + ' ---\n\n';
    }
    
    const title = url.split('/').pop();
    return { title, content: text.trim(), mimeType: 'application/pdf' };
  } catch (error) {
    logger.error(`Error scraping PDF ${url}:`, error);
    // Fallback to returning empty content if PDF scraping fails
    const title = url.split('/').pop();
    return { title, content: '', mimeType: 'application/pdf' };
  }
};

/**
 * Scrapes the text content and title from a given URL using Playwright.
 * @param {string} url The URL to scrape.
 * @returns {Promise<{title: string, content: string, mimeType: string} | null>} An object containing the title, content, and mime type, or null if scraping fails.
 */
export const scrapeUrl = async (url) => {
  let browser = null;
  try {
    browser = await chromium.launch({
      headless: true,
    });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    
    let response;
    try {
      response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
    } catch (err) {
      if (err.message.includes('Download is starting') || url.toLowerCase().endsWith('.pdf')) {
        return await scrapePdf(url);
      }
      throw err;
    }

    const mimeType = response.headers()['content-type'];

    // If it's a PDF, scrape it as a PDF
    if (mimeType && mimeType.includes('application/pdf')) {
      return await scrapePdf(url);
    }

    // If it's not an HTML page, we can't scrape it for text content.
    if (!mimeType || !mimeType.includes('text/html')) {
      const title = url.split('/').pop();
      return { title, content: '', mimeType };
    }

    const pageTitle = await page.title();
    
    // Remove script, style, and other common non-content elements
    await page.evaluate(() => {
      document.querySelectorAll('script, style, nav, footer, header, aside, form, noscript').forEach(el => el.remove());
    });

    // Attempt to find the main content area of the page
    let mainContentHtml = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) return main.innerHTML;
      const article = document.querySelector('article');
      if (article) return article.innerHTML;
      const roleMain = document.querySelector('div[role="main"]');
      if (roleMain) return roleMain.innerHTML;
      return document.body.innerHTML;
    });
    
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    const content = turndownService.turndown(mainContentHtml || '');

    return { title: pageTitle, content, mimeType };
  } catch (error) {
    logger.error(`Error scraping URL ${url}:`, error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
