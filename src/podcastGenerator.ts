import { OpenAI } from 'openai';
import { Article } from './rssFetcher';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Generates a podcast-style script from a collection of articles
 * @param articles - Array of articles to summarize
 * @returns Promise<string> - Generated podcast script
 */
export async function generatePodcastScript(
  articles: Article[]
): Promise<string> {
  // Validate OpenAI configuration
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'Missing required environment variable: OPENAI_API_KEY\n' +
      'Please add your OpenAI API key to the .env file.'
    );
  }

  if (articles.length === 0) {
    throw new Error('No articles provided for podcast generation');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log(`🎙️ Generating podcast script from ${articles.length} articles...`);

  // Prepare the articles data for the prompt
  const articlesText = articles
    .map((article, index) => {
      return `${index + 1}. [${article.source}] ${article.title}
   Summary: ${article.summary}
   Link: ${article.link}
   Published: ${new Date(article.pubDate).toLocaleDateString()}`;
    })
    .join('\n\n');

  const prompt = `You are a professional AI news podcast host. Create an engaging, conversational podcast script based on the following AI and technology news articles.

ARTICLES TO SUMMARIZE:
${articlesText}

REQUIREMENTS:
- Create a 5-8 minute podcast script (approximately 700-900 words)
- Use a conversational, engaging tone as if speaking to listeners
- Start with a brief introduction about today's AI news
- Summarize the most important and interesting stories
- Group related stories together when possible
- Include transitions between topics
- End with a brief conclusion
- Focus on the most significant developments and their implications
- Make it accessible to both technical and non-technical audiences
- Use natural speech patterns and avoid overly formal language

FORMAT:
- Write as a continuous script without section headers
- Use natural transitions like "Speaking of...", "In other news...", "Meanwhile..."
- Include brief pauses indicated by "..." where appropriate
- Keep sentences conversational and easy to follow when spoken aloud

Generate the podcast script now:`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an experienced podcast host specializing in AI and technology news. You create engaging, informative content that makes complex topics accessible to a broad audience.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const script = completion.choices[0]?.message?.content;

    if (!script) {
      throw new Error('Failed to generate podcast script - no content returned');
    }

    console.log('✅ Podcast script generated successfully!');
    console.log(`📝 Script length: ${script.length} characters`);
    console.log(`📊 Estimated word count: ${script.split(' ').length} words`);

    return script;
  } catch (error) {
    console.error('❌ Failed to generate podcast script:', error);
    throw error;
  }
}

