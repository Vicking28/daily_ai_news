import nodemailer, { Transporter } from 'nodemailer';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fetchAllFeeds } from './rssFetcher';
import { generatePodcastScript } from './podcastGenerator';
import { synthesizePodcast, getMP3Duration, formatDuration } from './tts';
import { uploadPodcastText } from './driveUploader';

// Load environment variables
dotenv.config();

/**
 * Creates and returns a configured nodemailer transporter
 */
function createTransporter(): Transporter {
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
 * Ensures the output directory exists
 */
function ensureOutputDirectory(): string {
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`📁 Created output directory: ${outputDir}`);
  }
  return outputDir;
}

/**
 * Gets email recipients from environment variables
 * Supports both single email and comma-separated list
 */
function getEmailRecipients(): string[] {
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
 * Saves the podcast script as a text file
 * @param script - The podcast script text
 * @param outputDir - The output directory path
 * @returns Path to the saved text file
 */
function savePodcastScript(script: string, outputDir: string): string {
  const scriptPath = path.join(outputDir, 'podcast.txt');
  fs.writeFileSync(scriptPath, script, 'utf8');
  console.log(`📝 Saved podcast script to: ${scriptPath}`);
  return scriptPath;
}

/**
 * Generates HTML email content with top articles
 * @param articles - Array of articles
 * @param scriptLength - Length of the generated script
 * @param actualDuration - Actual duration of the MP3 file in seconds
 * @param driveUrl - Optional Google Drive URL for the podcast text
 * @returns HTML email content
 */
function generateEmailContent(articles: any[], scriptLength: number, actualDuration: number, driveUrl?: string): string {
  // Get top 5 articles for the email
  const topArticles = articles.slice(0, 5);
  
  const articleList = topArticles
    .map(article => `<li><a href="${article.link}" target="_blank">${article.title}</a> <small>(${article.source})</small></li>`)
    .join('\n');

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px;">
        🎙️ Daily AI News Podcast
      </h2>
      
      <p style="font-size: 16px; line-height: 1.6; color: #555;">
        Good morning! Here's your daily dose of AI and technology news, curated and transformed into an engaging podcast format.
      </p>
      
      <h3 style="color: #333; margin-top: 30px;">📰 Today's Top Stories:</h3>
      <ul style="font-size: 14px; line-height: 1.8; color: #555;">
        ${articleList}
      </ul>
      
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <h3 style="color: #333; margin-top: 0;">🎧 Your Podcast is Ready!</h3>
        <p style="margin-bottom: 10px; color: #555;">
          <strong>📝 Script Length:</strong> ${scriptLength} characters<br>
          <strong>⏱️ Actual Duration:</strong> ${formatDuration(actualDuration)}
        </p>
        <p style="color: #555; margin-bottom: 10px;">
          Attached you'll find both the full podcast script (podcast.txt) and the audio file (podcast.mp3) 
          generated using AI-powered text-to-speech technology.
        </p>
        ${driveUrl ? `
        <p style="color: #555; margin-bottom: 0;">
          You can also <a href="${driveUrl}" target="_blank" style="color: #007acc; text-decoration: none;">read the podcast text on Google Drive</a> for easy access and sharing.
        </p>
        ` : ''}
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

  try {
    // Step 1: Fetch RSS feeds
    console.log('📡 Step 1: Fetching RSS feeds...');
    const allArticles = await fetchAllFeeds();
    console.log(`✅ Fetched ${allArticles.length} articles from RSS feeds\n`);

    // Step 2: Generate podcast script
    console.log('🤖 Step 2: Generating podcast script with AI...');
    const script = await generatePodcastScript(allArticles.slice(0, 20)); // Limit for cost control
    console.log(`✅ Generated script: ${script.length} characters\n`);

    // Step 3: Ensure output directory exists
    const outputDir = ensureOutputDirectory();

    // Step 4: Generate audio file
    console.log('🎤 Step 3: Converting script to speech...');
    const audioPath = path.join(outputDir, 'podcast.mp3');
    await synthesizePodcast(script, audioPath);
    console.log(`✅ Generated audio file: ${audioPath}\n`);

    // Step 4.5: Get actual MP3 duration
    console.log('⏱️ Getting actual MP3 duration...');
    let actualDuration: number;
    try {
      actualDuration = await getMP3Duration(audioPath);
      console.log(`✅ Actual duration: ${formatDuration(actualDuration)}\n`);
    } catch (error) {
      console.log('⚠️ Could not get actual duration, using estimation...');
      // Fallback to estimation
      actualDuration = Math.round(script.length / 2.5);
      console.log(`📊 Estimated duration: ${formatDuration(actualDuration)}\n`);
    }

    // Step 5: Save script as text file
    console.log('📝 Step 4: Saving podcast script...');
    const scriptPath = savePodcastScript(script, outputDir);
    console.log(`✅ Saved script file: ${scriptPath}\n`);

    // Step 6: Upload to Google Drive (optional)
    let driveUrl: string | undefined;
    try {
      console.log('☁️ Step 5: Uploading to Google Drive...');
      driveUrl = await uploadPodcastText(scriptPath);
      console.log(`✅ Google Drive upload successful: ${driveUrl}\n`);
    } catch (error) {
      console.log('⚠️ Google Drive upload failed, continuing without Drive link...');
      console.log('   Error:', error instanceof Error ? error.message : 'Unknown error');
      console.log('   Email will be sent with attachments only.\n');
    }

    // Step 7: Prepare email content
    console.log('📧 Step 6: Preparing email content...');
    const htmlContent = generateEmailContent(allArticles, script.length, actualDuration, driveUrl);

    // Step 8: Determine recipients
    const emailRecipients = recipients || getEmailRecipients();
    console.log(`📧 Sending to ${emailRecipients.length} recipient(s): ${emailRecipients.join(', ')}`);

    // Step 9: Send email
    console.log('📤 Step 8: Sending email...');
    const transporter = createTransporter();

    // Verify connection configuration
    await transporter.verify();
    console.log('✅ SMTP server connection verified');

    // Send email with attachments
    const info = await transporter.sendMail({
      from: `"Daily AI News" <${process.env.EMAIL_USER}>`,
      to: emailRecipients[0], // Primary recipient
      bcc: emailRecipients.slice(1), // BCC for additional recipients
      subject: 'Daily AI News Podcast',
      html: htmlContent,
      attachments: [
        {
          filename: 'podcast.txt',
          path: scriptPath,
          contentType: 'text/plain',
        },
        {
          filename: 'podcast.mp3',
          path: audioPath,
          contentType: 'audio/mpeg',
        },
      ],
    });

    console.log('✅ Daily AI podcast email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Preview URL:', nodemailer.getTestMessageUrl(info));

    // Clean up temporary files (optional - you might want to keep them)
    // fs.unlinkSync(scriptPath);
    // fs.unlinkSync(audioPath);

  } catch (error) {
    console.error('❌ Failed to send daily podcast email:', error);
    
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
