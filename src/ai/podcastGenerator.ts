import { OpenAI } from 'openai';
import { Article } from '../types/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure dayjs plugins
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Generates a podcast script from pre-selected articles (Pass B)
 * @param selectedArticles - Array of articles that were already selected in Pass A
 * @param localDateISO - Optional date string in ISO format (defaults to current date in Budapest timezone)
 * @returns Promise<string> - Generated podcast script
 */
export async function generatePodcastScriptFromSelected(
  selectedArticles: Article[],
  localDateISO?: string
): Promise<string> {
  // Validate OpenAI configuration
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'Missing required environment variable: OPENAI_API_KEY\n' +
      'Please add your OpenAI API key to the .env file.'
    );
  }

  if (selectedArticles.length === 0) {
    throw new Error('No selected articles provided for podcast generation');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log(`🎙️ Generating podcast script from ${selectedArticles.length} selected articles...`);

  // Format today's date in Europe/Budapest timezone, month & day only (no year)
  const formattedDateNoYear = localDateISO 
    ? dayjs(localDateISO).tz('Europe/Budapest').format('MMMM D')
    : dayjs().tz('Europe/Budapest').format('MMMM D');

  // Prepare the articles data for the prompt (compact context)
  const articlesText = selectedArticles
    .map((article, index) => {
      const pubDate = article.pubDate ? new Date(article.pubDate) : new Date();
      const month = pubDate.toLocaleDateString('en-US', { month: 'long' });
      const day = pubDate.getDate();
      
      return `${index + 1}. [${article.source}] ${article.title}
   ${article.summary.substring(0, 200)}...`;
    })
    .join('\n\n');

  const prompt = `You are a podcast scriptwriter. Produce a clear, engaging spoken script for the "49x AI Podcast".

- The script is meant to be read aloud exactly as written.
- Do NOT include any music cues, stage directions, host name placeholders, or formatting (no bold, no headers).
- Target length: 800–1000 words (≈5–7 minutes spoken).
- Select the most important updates from the data and use only AI or AI related news in the podcast. Anything that is not AI related is not relevant and should not be used for the podcast.
- Smooth transitions between sections.
- Factual, concise, natural tone. Conversational but professional.
- Avoid any fancy wording, robotic style, or overly professional tone. This should be easy to understand and good to listen for the audience.
- Mention sources conversationally ("according to the New York Times…") — no raw URLs.
- The very first sentence must always be:
  "Welcome to the 49 X AI Podcast, your daily briefing on artificial intelligence, today is ${formattedDateNoYear}."
- The very last lines must always:
   1) Wrap up with "This was the 49x AI Podcast for ${formattedDateNoYear}. Thanks for listening."
   2) Include a few sentences summarizing the most important news of the day, like a closing highlight reel.
- Do not duplicate news items. If multiple items cover the same event, merge them.
- Mention dates only as month and day (no years).

ARTICLES TO SUMMARIZE:
${articlesText}

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

