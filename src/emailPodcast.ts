import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import { fetchAllFeeds } from './rssFetcher';
import { generatePodcastScript } from './podcastGenerator';
import { synthesizePodcast, getMP3Duration, formatDuration } from './tts';
import { OpenAI } from 'openai';
import { logProcessStart, logSuccess, logError, logInfo, logNewsCollection, logPodcastGeneration, logAudioSynthesis, logEmailSent } from './logger';

// Load environment variables
dotenv.config();

/**
 * Creates and returns a configured nodemailer transporter
 */
export function createTransporter(): Transporter {
  // Validate required environment variables
  const requiredVars = ['EMAIL_USER', 'EMAIL_PASS'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}


/**
 * Gets email recipients from environment variables
 * Supports both single email and comma-separated list
 */
export function getEmailRecipients(): string[] {
  // Check for EMAIL_RECIPIENTS first (comma-separated list)
  if (process.env.EMAIL_RECIPIENTS) {
    const recipients = process.env.EMAIL_RECIPIENTS
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    if (recipients.length > 0) {
      return recipients;
    }
  }

  // Fallback to EMAIL_TO (single email)
  if (process.env.EMAIL_TO) {
    return [process.env.EMAIL_TO.trim()];
  }

  // Default fallback
  return ['zlatnikvince@gmail.com'];
}


/**
 * Generates bulletpoints from podcast script using AI
 * @param script - The podcast script text
 * @returns Array of bulletpoint strings
 */
async function generateBulletpoints(script: string): Promise<string[]> {
  // Validate OpenAI configuration
  if (!process.env.OPENAI_API_KEY) {
    console.log('⚠️ OpenAI API key not available, using fallback bulletpoints');
    return ['AI news summary generated from podcast content'];
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Extract 5-7 concise bulletpoints from this podcast script that summarize the key AI and technology news stories. Each bulletpoint should be 1-2 sentences and capture the most important developments.

PODCAST SCRIPT:
${script}

REQUIREMENTS:
- Extract 5-7 bulletpoints maximum
- Each bulletpoint should be 1-2 sentences
- Focus on the most significant AI/tech developments
- Make them engaging and informative
- Use present tense and active voice
- Avoid redundant information

Return only the bulletpoints, one per line, without numbering or bullet symbols.`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at extracting key information from AI and technology content. You create concise, engaging bulletpoints that capture the most important developments.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }

    // Parse the response into individual bulletpoints
    const bulletpoints = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 7); // Limit to 7 bulletpoints max

    console.log(`✅ Generated ${bulletpoints.length} bulletpoints from podcast content`);
    return bulletpoints;

  } catch (error) {
    console.error('❌ Failed to generate bulletpoints:', error);
    // Fallback to generic bulletpoints
    return ['AI news summary generated from podcast content'];
  }
}

/**
 * Generates HTML email content with top articles
 * @param articles - Array of articles
 * @param scriptLength - Length of the generated script
 * @param actualDuration - Actual duration of the MP3 file in seconds
 * @param bulletpoints - Array of bulletpoints from podcast content
 * @returns HTML email content
 */
export function generateEmailContent(articles: any[], scriptLength: number, actualDuration: number, bulletpoints: string[]): string {
  const bulletpointList = bulletpoints
    .map(bulletpoint => `<li style="margin-bottom: 8px;">${bulletpoint}</li>`)
    .join('\n');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px;">
        🎙️ Daily AI News Podcast
      </h2>
      
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Good morning! Here's your daily dose of AI and technology news, curated and transformed into an engaging podcast format.
      </p>
      
      <h3 style="color: #333; margin-top: 30px;">📰 Today's Top News:</h3>
      <ul style="font-size: 14px; line-height: 1.8; color: #555; list-style-type: disc; padding-left: 20px;">
        ${bulletpointList}
      </ul>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <h3 style="color: #333; margin-top: 0;">🎧 Your Podcast is Ready!</h3>
        <p style="margin-bottom: 10px; color: #555;">
          <strong>📝 Script Length:</strong> ${scriptLength} characters<br>
          <strong>⏱️ Listen Duration:</strong> ${formatDuration(actualDuration)}
        </p>
        <p style="color: #555; margin-bottom: 0;">
          Attached you'll find both the full podcast script (podcast.txt) and the audio file (podcast.mp3) 
          generated using AI-powered text-to-speech technology.
        </p>
      </div>
      
      <div style="border-top: 1px solid #eee; padding-top: 20px; margin-top: 30px; text-align: center; color: #888; font-size: 12px;">
        <p>Generated by Daily AI News • Powered by OpenAI & Deepgram</p>
        <p>📅 ${new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
      </div>
    </div>
  `;
}

/**
 * Sends a daily AI podcast email with attachments
 * @param recipients - Optional array of email addresses to send to (defaults to EMAIL_RECIPIENTS from .env)
 */
export async function sendDailyPodcastEmail(recipients?: string[]): Promise<void> {
  console.log('📧 Starting daily AI podcast email generation...\n');
  await logProcessStart('Daily AI podcast email generation');

  // Generate timestamp for all files
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Step 1: Fetch RSS feeds
    console.log('📡 Step 1: Fetching RSS feeds...');
    const allArticles = await fetchAllFeeds();
    console.log(`✅ Fetched ${allArticles.length} articles from RSS feeds\n`);
    await logNewsCollection(allArticles.length, 12); // Assuming 12 RSS sources

    // Step 2: Generate podcast script
    console.log('🤖 Step 2: Generating podcast script with AI...');
    const script = await generatePodcastScript(allArticles); // Use all articles
    console.log(`✅ Generated script: ${script.length} characters\n`);
    const wordCount = script.split(' ').length;
    await logPodcastGeneration(script.length, wordCount);

    // Step 3: Generate audio file in memory
    console.log('🎤 Step 3: Converting script to speech...');
    const audioBuffer = await synthesizePodcast(script);
    console.log(`✅ Generated audio buffer: ${audioBuffer.length} bytes\n`);

    // Step 4.5: Get actual MP3 duration
    console.log('⏱️ Getting actual MP3 duration...');
    let actualDuration: number;
    let fileSize: string;
    try {
      actualDuration = await getMP3Duration(audioBuffer);
      fileSize = `${(audioBuffer.length / 1024).toFixed(0)} KB`;
      console.log(`✅ Actual duration: ${formatDuration(actualDuration)}, File size: ${fileSize}\n`);
    } catch (error) {
      console.log('⚠️ Could not get actual duration, using estimation...');
      // Fallback to estimation
      actualDuration = Math.round(script.length / 2.5);
      fileSize = `${(audioBuffer.length / 1024).toFixed(0)} KB`;
      console.log(`📊 Estimated duration: ${formatDuration(actualDuration)}\n`);
    }

    await logAudioSynthesis(formatDuration(actualDuration), fileSize);

    // Step 5: Prepare script text (no file saving needed)
    console.log('📝 Step 4: Preparing podcast script for email...');
    console.log(`✅ Script prepared for email attachment\n`);


    // Step 7: Generate bulletpoints from podcast content
    console.log('📝 Step 6: Generating bulletpoints from podcast content...');
    const bulletpoints = await generateBulletpoints(script);
    console.log(`✅ Generated ${bulletpoints.length} bulletpoints\n`);
    await logInfo(`Generated ${bulletpoints.length} bulletpoints from podcast content`);

    // Step 8: Prepare email content
    console.log('📧 Step 7: Preparing email content...');
    const htmlContent = generateEmailContent(allArticles, script.length, actualDuration, bulletpoints);

    // Step 9: Determine recipients
    const emailRecipients = recipients || getEmailRecipients();
    console.log(`📧 Sending to ${emailRecipients.length} recipient(s): ${emailRecipients.join(', ')}`);

    // Step 10: Send email
    console.log('📤 Step 9: Sending email...');
    const transporter = createTransporter();

    // Verify connection configuration
    await transporter.verify();
    console.log('✅ SMTP server connection verified');

    // Send email with in-memory attachments
    const info = await transporter.sendMail({
      from: `"Daily AI News" <${process.env.EMAIL_USER}>`,
      to: emailRecipients[0], // Primary recipient
      bcc: emailRecipients.slice(1), // BCC for additional recipients
      subject: 'Daily AI News Podcast',
      html: htmlContent,
      attachments: [
        {
          filename: `podcast_${timestamp}.txt`,
          content: script,
          contentType: 'text/plain',
        },
        {
          filename: `podcast_${timestamp}.mp3`,
          content: audioBuffer,
          contentType: 'audio/mpeg',
        },
      ],
    });

    console.log('✅ Daily AI podcast email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Preview URL:', nodemailer.getTestMessageUrl(info));
    await logEmailSent(emailRecipients.length, info.messageId || 'Unknown');

    // No cleanup needed since we're using in-memory attachments

  } catch (error) {
    console.error('❌ Failed to send daily podcast email:', error);
    
    // Log error to Discord with user mention
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Failed to send daily podcast email: ${errorMessage}`);
    
    if (error instanceof Error) {
      if (error.message.includes('EMAIL_USER') || error.message.includes('EMAIL_PASS')) {
        console.log('\n💡 Tip: Make sure to add your email credentials to the .env file');
      } else if (error.message.includes('OPENAI_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your OpenAI API key to the .env file');
      } else if (error.message.includes('DEEPGRAM_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your Deepgram API key to the .env file');
      }
    }
    
    throw error;
  }
}
