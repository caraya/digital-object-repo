import { chromium } from 'playwright';
import TurndownService from 'turndown';
import logger from '../logger.js';

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
        const title = url.split('/').pop();
        let mimeType = 'application/octet-stream';
        if (url.toLowerCase().endsWith('.pdf')) mimeType = 'application/pdf';
        return { title, content: '', mimeType };
      }
      throw err;
    }

    const mimeType = response.headers()['content-type'];

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
