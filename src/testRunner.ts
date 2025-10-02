import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fetchAllFeeds } from './rssFetcher';
import { generatePodcastScript } from './podcastGenerator';
import { synthesizePodcast, getMP3Duration, formatDuration } from './tts';
import { createTransporter, getEmailRecipients, generateEmailContent } from './emailPodcast';
import { logProcessStart, logSuccess, logError, logInfo, logNewsCollection, logPodcastGeneration, logAudioSynthesis, logEmailSent } from './logger';

// Load environment variables
dotenv.config();

/**
 * Test Runner for Daily AI News Podcast
 * 
 * Runs the full pipeline with limited articles for faster testing and reduced token usage.
 * Perfect for development, testing, and manual runs via Discord slash commands.
 */

// Limit articles for testing (reduces API costs and processing time)
const TEST_ARTICLE_LIMIT = 10;

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
 * Generates bulletpoints from podcast script using AI (copied from emailPodcast.ts)
 */
async function generateBulletpoints(script: string): Promise<string[]> {
  const { OpenAI } = await import('openai');
  
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
 * Sends a test podcast email with limited articles
 * @param recipients - Optional array of email addresses to send to
 */
export async function sendTestPodcastEmail(recipients?: string[]): Promise<void> {
  console.log('🧪 Starting TEST podcast email generation...\n');
  await logProcessStart('Test podcast email generation', `Limited to ${TEST_ARTICLE_LIMIT} articles`);

  // Generate timestamp for all files
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // Step 1: Fetch RSS feeds (limited for testing)
    console.log('📡 Step 1: Fetching RSS feeds (TEST MODE)...');
    const allArticles = await fetchAllFeeds();
    
    // Limit articles for testing
    const limitedArticles = allArticles.slice(0, TEST_ARTICLE_LIMIT);
    console.log(`✅ Fetched ${allArticles.length} total articles, using ${limitedArticles.length} for testing\n`);
    
    await logNewsCollection(limitedArticles.length, 12); // Assuming 12 RSS sources

    // Step 2: Generate podcast script
    console.log('🤖 Step 2: Generating TEST podcast script with AI...');
    const script = await generatePodcastScript(limitedArticles);
    const wordCount = script.split(' ').length;
    console.log(`✅ Generated TEST script: ${script.length} characters (${wordCount} words)\n`);
    
    await logPodcastGeneration(script.length, wordCount);

    // Step 3: Ensure output directory exists
    const outputDir = ensureOutputDirectory();

    // Step 4: Generate audio file
    console.log('🎤 Step 3: Converting TEST script to speech...');
    const audioPath = path.join(outputDir, `podcast_test_${timestamp}.mp3`);
    await synthesizePodcast(script, audioPath);
    console.log(`✅ Generated TEST audio file: ${audioPath}\n`);

    // Step 4.5: Get actual MP3 duration
    console.log('⏱️ Getting actual MP3 duration...');
    let actualDuration: number;
    let fileSize: string;
    try {
      actualDuration = await getMP3Duration(audioPath);
      const stats = fs.statSync(audioPath);
      fileSize = `${(stats.size / 1024).toFixed(0)} KB`;
      console.log(`✅ Actual duration: ${formatDuration(actualDuration)}, File size: ${fileSize}\n`);
    } catch (error) {
      console.log('⚠️ Could not get actual duration, using estimation...');
      // Fallback to estimation
      actualDuration = Math.round(script.length / 2.5);
      fileSize = 'Unknown';
      console.log(`📊 Estimated duration: ${formatDuration(actualDuration)}\n`);
    }

    await logAudioSynthesis(formatDuration(actualDuration), fileSize);

    // Step 5: Save script as text file
    console.log('📝 Step 4: Saving TEST podcast script...');
    const scriptPath = path.join(outputDir, `podcast_test_${timestamp}.txt`);
    fs.writeFileSync(scriptPath, script, 'utf8');
    console.log(`✅ Saved TEST script file: ${scriptPath}\n`);

    // Step 6: Generate bulletpoints from podcast content
    console.log('📝 Step 5: Generating bulletpoints from TEST podcast content...');
    const bulletpoints = await generateBulletpoints(script);
    console.log(`✅ Generated ${bulletpoints.length} bulletpoints\n`);
    await logInfo(`Generated ${bulletpoints.length} bulletpoints from test podcast content`);

    // Step 7: Prepare email content
    console.log('📧 Step 6: Preparing TEST email content...');
    const htmlContent = generateEmailContent(limitedArticles, script.length, actualDuration, bulletpoints);

    // Step 8: Determine recipients
    const emailRecipients = recipients || getEmailRecipients();
    console.log(`📧 Sending TEST email to ${emailRecipients.length} recipient(s): ${emailRecipients.join(', ')}`);

    // Step 9: Send email
    console.log('📤 Step 7: Sending TEST email...');
    const transporter = createTransporter();

    // Verify connection configuration
    await transporter.verify();
    console.log('✅ SMTP server connection verified');

    // Send email with attachments
    const info = await transporter.sendMail({
      from: `"Daily AI News (TEST)" <${process.env.EMAIL_USER}>`,
      to: emailRecipients[0], // Primary recipient
      bcc: emailRecipients.slice(1), // BCC for additional recipients
      subject: 'Daily AI News Podcast (TEST MODE)',
      html: htmlContent,
      attachments: [
        {
          filename: `podcast_test_${timestamp}.txt`,
          path: scriptPath,
          contentType: 'text/plain',
        },
        {
          filename: `podcast_test_${timestamp}.mp3`,
          path: audioPath,
          contentType: 'audio/mpeg',
        },
      ],
    });

    console.log('✅ TEST podcast email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Preview URL:', require('nodemailer').getTestMessageUrl(info));
    
    await logEmailSent(emailRecipients.length, info.messageId || 'Unknown');

    // Clean up test files (optional)
    // fs.unlinkSync(scriptPath);
    // fs.unlinkSync(audioPath);

  } catch (error) {
    console.error('❌ Failed to send TEST podcast email:', error);
    
    // Log error to Discord with user mention
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Test podcast generation failed: ${errorMessage}`);
    
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

/**
 * Main test runner function
 */
async function runTest(): Promise<void> {
  console.log('🧪 Starting Daily AI News Podcast TEST Runner...\n');
  console.log(`📋 Test Configuration:`);
  console.log(`   - Article Limit: ${TEST_ARTICLE_LIMIT} articles`);
  console.log(`   - Mode: TEST (reduced API usage)`);
  console.log(`   - Files: podcast_test_YYYY-MM-DD.*\n`);

  try {
    await sendTestPodcastEmail();
    console.log('\n🎉 TEST run completed successfully!');
    console.log('💡 This was a TEST run with limited articles for faster execution.');
  } catch (error) {
    console.error('\n💥 TEST run failed:', error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  runTest()
    .then(() => {
      console.log('\n✅ TEST runner completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 TEST runner failed:', error);
      process.exit(1);
    });
}
