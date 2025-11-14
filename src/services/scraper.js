import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import logger from '../logger.js';

/**
 * Scrapes the text content and title from a given URL.
 * @param {string} url The URL to scrape.
 * @returns {Promise<{title: string, content: string} | null>} An object containing the title and content, or null if scraping fails.
 */
export const scrapeUrl = async (url) => {
  try {
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
      },
    });
    const $ = cheerio.load(data);
    const turndownService = new TurndownService({ headingStyle: 'atx' });

    const h1 = $('h1').first().text().trim();
    const title = h1 || $('title').text().trim();
    
    // Remove script, style, and other common non-content elements
    $('script, style, nav, footer, header, aside, form, noscript').remove();

    // Attempt to find the main content area of the page
    let mainContentHtml = $('main').html() || $('article').html() || $('div[role="main"]').html();
    
    // If no main content area is found, fall back to the body
    if (!mainContentHtml) {
      mainContentHtml = $('body').html();
    }

    // Convert the cleaned HTML to Markdown
    const content = turndownService.turndown(mainContentHtml || '');

    return { title, content };
  } catch (error) {
    logger.error(`Error scraping URL ${url}:`, error);
    return null;
  }
};
