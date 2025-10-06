import { OpenAI } from 'openai';
import { Article, SelectedArticlesResult, ArticleSelectionOptions } from '../types/types';
import { normalizeTitleForDedup, uniqueBy, truncateText } from '../utils/textUtils';
import { logInfo } from '../utils/logger';
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
 * Filters articles to only include AI-related content using OpenAI
 * @param articles - Array of articles to filter
 * @returns Array of AI-related articles
 */
async function filterAIArticles(articles: Article[]): Promise<Article[]> {
  if (articles.length === 0) {
    return [];
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ OpenAI API key not configured, falling back to keyword filtering');
    return articles.filter(article => {
      const title = article.title.toLowerCase();
      const summary = article.summary.toLowerCase();
      
      return AI_KEYWORDS.some(keyword => 
        title.includes(keyword) || summary.includes(keyword)
      );
    });
  }

  console.log(`🤖 Using AI to filter ${articles.length} articles for AI-related content...`);

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Prepare articles for AI filtering (simplified format for efficiency)
  const articlesForFiltering = articles.map(article => ({
    id: article.id,
    title: article.title.replace(/\n/g, ' ').replace(/\r/g, ' ').trim(),
    summary: truncateText(article.summary.replace(/\n/g, ' ').replace(/\r/g, ' ').trim(), 200) // Shorter summary for filtering
  }));

  // If we have too many articles, process them in chunks
  const CHUNK_SIZE = 100; // Process 100 articles at a time
  if (articlesForFiltering.length > CHUNK_SIZE) {
    console.log(`📦 Processing ${articlesForFiltering.length} articles in chunks of ${CHUNK_SIZE}...`);
    
    const allSelectedIds: string[] = [];
    
    for (let i = 0; i < articlesForFiltering.length; i += CHUNK_SIZE) {
      const chunk = articlesForFiltering.slice(i, i + CHUNK_SIZE);
      console.log(`📦 Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(articlesForFiltering.length / CHUNK_SIZE)} (${chunk.length} articles)...`);
      
      try {
        const chunkResult = await processArticleChunk(openai, chunk, i);
        allSelectedIds.push(...chunkResult);
      } catch (error) {
        console.error(`❌ Failed to process chunk ${Math.floor(i / CHUNK_SIZE) + 1}, skipping:`, error);
        // Continue with other chunks
      }
    }
    
    console.log(`✅ Processed all chunks, found ${allSelectedIds.length} AI-related articles`);
    
    // Filter articles based on all selected IDs
    const aiRelatedArticles = articles.filter(article => 
      allSelectedIds.includes(article.id)
    );
    
    return aiRelatedArticles;
  }

  // Process all articles at once if under chunk size
  const selectedIds = await processArticleChunk(openai, articlesForFiltering, 0);
  return articles.filter(article => selectedIds.includes(article.id));
}

/**
 * Process a chunk of articles with AI filtering
 */
async function processArticleChunk(openai: OpenAI, articlesForFiltering: any[], chunkIndex: number): Promise<string[]> {
  const systemPrompt = `You are an expert AI news curator. Your job is to identify which articles are genuinely AI-related and important for an AI news podcast.

FILTERING CRITERIA:
- Include articles about artificial intelligence, machine learning, LLMs, AI research, AI companies, AI tools, AI applications
- Include articles about major AI models (GPT, Claude, Gemini, etc.), AI frameworks, AI hardware
- Include articles about AI ethics, AI policy, AI industry developments
- Exclude articles that only mention AI in passing or as a minor topic
- Exclude non-AI tech articles, general business news, or unrelated content
- Focus on articles that would be interesting to AI practitioners and enthusiasts

RETURN FORMAT:
Return ONLY a valid JSON object with this exact structure:
{
  "aiRelatedIds": ["id1", "id2", "id3", ...]
}

The IDs MUST come from the provided list with no modifications.`;

  // Use JSON.stringify with proper escaping
  const articlesJson = JSON.stringify(articlesForFiltering, null, 2);

  const userPrompt = `Here are the candidate articles. Identify which ones are genuinely AI-related and important:

${articlesJson}

Return the JSON with aiRelatedIds array:`;

  try {
    console.log(`📊 Sending ${articlesForFiltering.length} articles to OpenAI for filtering...`);
    console.log(`📏 Input size: ${userPrompt.length} characters`);
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 4000, // Increased token limit for larger responses
      temperature: 0.1, // Low temperature for consistent filtering
      response_format: { type: 'json_object' }
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    console.log(`📊 OpenAI response length: ${response.length} characters`);
    console.log(`🔍 Response preview: ${response.substring(0, 200)}...`);

    // Check if response looks truncated
    if (!response.trim().endsWith('}')) {
      console.warn('⚠️ Response appears to be truncated (does not end with }), this might cause JSON parsing issues');
    }

    // Parse the JSON response
    let result: { aiRelatedIds: string[] };
    try {
      result = JSON.parse(response) as { aiRelatedIds: string[] };
    } catch (parseError) {
      console.error('❌ JSON parsing failed:');
      console.error('Response length:', response.length);
      console.error('Response ends with:', response.slice(-100));
      console.error('Parse error:', parseError);
      throw new Error(`JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
    
    if (!result.aiRelatedIds || !Array.isArray(result.aiRelatedIds)) {
      console.error('❌ Invalid response format:');
      console.error('Response:', response);
      throw new Error('Invalid response format from AI');
    }

    console.log(`📊 AI selected ${result.aiRelatedIds.length} article IDs from chunk`);
    return result.aiRelatedIds;

  } catch (error) {
    console.error(`❌ Failed to process chunk ${chunkIndex + 1}:`, error);
    throw error;
  }
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
  const { maxCount = 10 } = opts;
  
  console.log(`🔍 Starting article selection from ${articles.length} total articles...`);
  
  // Step 1: Filter for AI-related articles using AI
  const aiArticles = await filterAIArticles(articles);
  console.log(`🤖 AI filtered to ${aiArticles.length} AI-related articles`);
  
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
