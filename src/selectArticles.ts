import { OpenAI } from 'openai';
import { Article, SelectedArticlesResult, ArticleSelectionOptions } from './types';
import { normalizeTitleForDedup, uniqueBy, truncateText } from './textUtils';
import { logInfo } from './logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * AI keywords for filtering AI-related articles
 */
const AI_KEYWORDS = [
  'ai', 'artificial intelligence', 'llm', 'large language model', 'model', 'gpt',
  'anthropic', 'openai', 'deepmind', 'nvidia', 'transformer', 'machine learning',
  'ml', 'deep learning', 'neural network', 'chatgpt', 'computer vision', 'nlp',
  'natural language processing', 'robotics', 'automation', 'algorithm', 'data science',
  'tensorflow', 'pytorch', 'generative ai', 'attention', 'reinforcement learning',
  'claude', 'gemini', 'bard', 'copilot', 'midjourney', 'dall-e', 'stable diffusion'
];

/**
 * Filters articles to only include AI-related content
 * @param articles - Array of articles to filter
 * @returns Array of AI-related articles
 */
function filterAIArticles(articles: Article[]): Article[] {
  return articles.filter(article => {
    const title = article.title.toLowerCase();
    const summary = article.summary.toLowerCase();
    
    return AI_KEYWORDS.some(keyword => 
      title.includes(keyword) || summary.includes(keyword)
    );
  });
}

/**
 * Deduplicates articles by link and normalized title
 * @param articles - Array of articles to deduplicate
 * @returns Array of unique articles
 */
function deduplicateArticles(articles: Article[]): Article[] {
  // First deduplicate by link
  const byLink = uniqueBy(articles, article => article.link);
  
  // Then deduplicate by normalized title
  const byTitle = uniqueBy(byLink, article => normalizeTitleForDedup(article.title));
  
  return byTitle;
}

/**
 * Prepares articles for AI selection by formatting them compactly
 * @param articles - Array of articles to prepare
 * @returns Formatted string for AI prompt
 */
function prepareArticlesForAI(articles: Article[]): string {
  return articles.map(article => {
    const pubDate = article.pubDate ? new Date(article.pubDate).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    }) : 'Unknown date';
    
    return `{
  "id": "${article.id}",
  "source": "${article.source}",
  "title": "${article.title.replace(/"/g, '\\"')}",
  "pubDate": "${pubDate}",
  "summary": "${truncateText(article.summary.replace(/"/g, '\\"'), 500)}"
}`;
  }).join(',\n');
}

/**
 * Selects the top AI-related articles using AI
 * @param articles - Array of all articles
 * @param opts - Selection options
 * @returns Object containing selected article IDs
 */
export async function selectTopArticles(
  articles: Article[],
  opts: ArticleSelectionOptions = {}
): Promise<SelectedArticlesResult> {
  const { maxCount = 15 } = opts;
  
  console.log(`🔍 Starting article selection from ${articles.length} total articles...`);
  
  // Step 1: Filter for AI-related articles
  const aiArticles = filterAIArticles(articles);
  console.log(`🤖 Filtered to ${aiArticles.length} AI-related articles`);
  
  if (aiArticles.length === 0) {
    throw new Error('No AI-related articles found');
  }
  
  // Step 2: Deduplicate articles
  const uniqueArticles = deduplicateArticles(aiArticles);
  console.log(`🔄 Deduplicated to ${uniqueArticles.length} unique articles`);
  
  // Step 3: Prepare for AI selection
  const articlesForAI = prepareArticlesForAI(uniqueArticles);
  
  // Step 4: Get AI selection
  const selectedIds = await selectArticlesWithAI(articlesForAI, maxCount);
  
  console.log(`✅ Selected ${selectedIds.length} articles for podcast`);
  await logInfo(`Selected ${selectedIds.length} articles from ${articles.length} total articles`);
  
  return { selectedIds };
}

/**
 * Uses AI to select the best articles from the prepared list
 * @param articlesJson - JSON string of articles
 * @param maxCount - Maximum number of articles to select
 * @returns Array of selected article IDs
 */
async function selectArticlesWithAI(articlesJson: string, maxCount: number): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an expert AI news curator. Your job is to select the most important and impactful AI-related news articles for a daily podcast.

SELECTION CRITERIA:
- Choose ONLY AI-related news (artificial intelligence, machine learning, LLMs, etc.)
- Prefer recent and high-impact stories
- Remove near duplicates (if multiple articles cover the same event, pick the best one)
- Target ${maxCount} articles (but quality over quantity)
- Focus on developments that matter to AI practitioners and enthusiasts

RETURN FORMAT:
Return ONLY a valid JSON object with this exact structure:
{
  "selectedIds": ["id1", "id2", "id3", ...]
}

The IDs MUST come from the provided list with no modifications.`;

  const userPrompt = `Here are the candidate articles. Select the best ${maxCount} for today's AI podcast:

[${articlesJson}]

Return the JSON with selectedIds array:`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const result = JSON.parse(response) as SelectedArticlesResult;
    
    if (!result.selectedIds || !Array.isArray(result.selectedIds)) {
      throw new Error('Invalid response format from AI');
    }

    // Validate and limit the results
    const validIds = result.selectedIds.slice(0, maxCount);
    
    if (validIds.length < 5) {
      console.warn(`⚠️ AI selected only ${validIds.length} articles, which is less than recommended minimum of 5`);
    }

    return validIds;

  } catch (error) {
    console.error('❌ Failed to select articles with AI:', error);
    throw error;
  }
}

/**
 * Builds HTML bulletpoints from selected articles
 * @param selected - Array of selected articles
 * @param limit - Maximum number of bulletpoints to show
 * @returns HTML string with clickable bulletpoints
 */
export function buildBulletHtmlFromSelected(selected: Article[], limit = 10): string {
  const limited = selected.slice(0, limit);
  
  const bulletpoints = limited.map(article => 
    `<li><a href="${article.link}" target="_blank" style="color: #007acc; text-decoration: none;">${article.title}</a> <span style="color: #888; font-size: 0.9em;">(${article.source})</span></li>`
  ).join('\n');
  
  return `<ul style="font-size: 14px; line-height: 1.8; color: #555; list-style-type: disc; padding-left: 20px;">\n${bulletpoints}\n</ul>`;
}
