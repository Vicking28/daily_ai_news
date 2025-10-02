import Parser from 'rss-parser';
import striptags from 'striptags';
import crypto from 'crypto';
import { Article } from './types';

// RSS Parser instance
const parser = new Parser();

// Hard-coded array of AI/tech RSS feed URLs
const RSS_FEEDS = [
  'https://openai.com/blog/rss.xml',
  'https://techcrunch.com/category/artificial-intelligence/feed/',
  'https://www.marktechpost.com/feed/',
  'https://www.kdnuggets.com/feed',
  'https://www.ft.com/artificial-intelligence?format=rss',
  'https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml',
  'https://thegradient.pub/rss/',
  'https://www.analyticsvidhya.com/blog/category/artificial-intelligence/feed/',
  'https://www.artificialintelligence-news.com/feed/',
  'https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml',
  'https://research.google/blog/rss',
  'https://dailyai.com/feed',
];

/**
 * Generates a stable deterministic ID for an article
 * @param link - Article link
 * @param title - Article title
 * @param source - Article source
 * @returns 16-character hex ID
 */
function generateArticleId(link: string, title: string, source: string): string {
  // Prefer hashing the link if available
  if (link && link.trim()) {
    return crypto.createHash('sha1').update(link).digest('hex').slice(0, 16);
  }
  
  // Fallback to hashing title + source
  const fallback = `${title}${source}`;
  return crypto.createHash('sha1').update(fallback).digest('hex').slice(0, 16);
}

/**
 * Extracts the source name from a feed URL
 * @param feedUrl - The RSS feed URL
 * @returns A clean source name
 */
function extractSourceName(feedUrl: string): string {
  try {
    const url = new URL(feedUrl);
    const hostname = url.hostname;

    // Clean up common hostname patterns
    return hostname
      .replace('www.', '')
      .replace('.com', '')
      .replace('.org', '')
      .replace('.edu', '')
      .replace('.co.uk', '')
      .replace('news.', '')
      .replace('blog.', '')
      .replace('research.', '');
  } catch {
    return 'unknown-source';
  }
}

/**
 * Cleans HTML content and converts to plain text
 * @param htmlContent - Raw HTML content
 * @returns Clean plain text
 */
function cleanHtmlContent(htmlContent: string): string {
  if (!htmlContent) return '';

  // Strip HTML tags
  let cleanText = striptags(htmlContent);

  // Decode common HTML entities
  cleanText = cleanText
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '...')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Clean up whitespace
  cleanText = cleanText.replace(/\s+/g, ' ').trim();

  // Limit length to reasonable size
  if (cleanText.length > 500) {
    cleanText = cleanText.substring(0, 500) + '...';
  }

  return cleanText;
}

/**
 * Fetches a single RSS feed and returns normalized articles
 * @param feedUrl - The RSS feed URL to fetch
 * @returns Array of normalized articles
 */
async function fetchFeed(feedUrl: string): Promise<Article[]> {
  try {
    console.log(`📡 Fetching feed: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);
    const sourceName = extractSourceName(feedUrl);

    const articles: Article[] = feed.items.map((item) => {
      const title = item.title || 'Untitled';
      const link = item.link || '';
      const source = sourceName;
      
      return {
        id: generateArticleId(link, title, source),
        source,
        title,
        link,
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        summary: cleanHtmlContent(
          item.contentSnippet || item.content || item.description || ''
        ),
      };
    });

    console.log(`✅ Fetched ${articles.length} articles from ${sourceName}`);
    return articles;
  } catch (error) {
    console.error(`❌ Failed to fetch feed ${feedUrl}:`, error);
    return [];
  }
}

/**
 * Fetches all RSS feeds in parallel and returns combined articles
 * @returns Array of all normalized articles from all feeds
 */
export async function fetchAllFeeds(): Promise<Article[]> {
  console.log('🚀 Starting RSS feed fetch for all sources...');
  console.log(`📋 Total feeds to fetch: ${RSS_FEEDS.length}\n`);

  try {
    // Fetch all feeds in parallel
    const feedPromises = RSS_FEEDS.map((feedUrl) => fetchFeed(feedUrl));
    const feedResults = await Promise.all(feedPromises);

    // Flatten all articles into a single array
    const allArticles = feedResults.flat();

    // Sort by publication date (newest first)
    allArticles.sort(
      (a, b) => new Date(b.pubDate || 0).getTime() - new Date(a.pubDate || 0).getTime()
    );

    console.log(
      `\n🎉 Successfully fetched ${allArticles.length} total articles from ${RSS_FEEDS.length} feeds`
    );

    return allArticles;
  } catch (error) {
    console.error('💥 Error fetching RSS feeds:', error);
    throw error;
  }
}

