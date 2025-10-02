import dotenv from 'dotenv';
import { fetchAllFeeds } from './rssFetcher';
import { generatePodcastScriptFromSelected } from './podcastGenerator';
import { selectTopArticles, buildBulletHtmlFromSelected } from './selectArticles';
import { synthesizePodcast, getMP3Duration, formatDuration } from './tts';
import { createTransporter, getEmailRecipients, generateEmailContent } from './emailPodcast';
import { logProcessStart, logSuccess, logError, logInfo, logNewsCollection, logPodcastGeneration, logAudioSynthesis, logEmailSent } from './logger';
import { Article } from './types';

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
 * Sends a test podcast email with limited articles using two-pass pipeline
 * @param recipients - Optional array of email addresses to send to
 */
export async function sendTestPodcastEmail(recipients?: string[]): Promise<void> {
  console.log('🧪 Starting TEST podcast email generation...\n');
  await logProcessStart('Test podcast email generation', `Limited to ${TEST_ARTICLE_LIMIT} articles`);

  // Generate timestamp for all files
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    // PASS A: Article Selection (with test limit)
    console.log('📡 Step 1: Fetching RSS feeds (TEST MODE)...');
    const allArticles = await fetchAllFeeds();
    console.log(`✅ Fetched ${allArticles.length} total articles\n`);
    
    await logNewsCollection(allArticles.length, 12); // Assuming 12 RSS sources

    console.log('🔍 Step 2: Selecting top AI articles (TEST MODE)...');
    const { selectedIds } = await selectTopArticles(allArticles, { maxCount: TEST_ARTICLE_LIMIT });
    const selectedArticles = allArticles.filter(article => selectedIds.includes(article.id));
    console.log(`✅ Selected ${selectedArticles.length} articles for TEST podcast\n`);
    await logInfo(`Selected ${selectedArticles.length} articles from ${allArticles.length} total articles for test`);

    // PASS B: Podcast Generation
    console.log('🤖 Step 3: Generating TEST podcast script from selected articles...');
    const script = await generatePodcastScriptFromSelected(selectedArticles);
    const wordCount = script.split(' ').length;
    console.log(`✅ Generated TEST script: ${script.length} characters (${wordCount} words)\n`);
    
    await logPodcastGeneration(script.length, wordCount);

    // Step 4: Generate audio file in memory
    console.log('🎤 Step 4: Converting TEST script to speech...');
    const audioBuffer = await synthesizePodcast(script);
    console.log(`✅ Generated TEST audio buffer: ${audioBuffer.length} bytes\n`);

    // Step 5: Get actual MP3 duration
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

    // Step 6: Prepare script text (no file saving needed)
    console.log('📝 Step 5: Preparing TEST podcast script for email...');
    console.log(`✅ TEST script prepared for email attachment\n`);

    // Step 7: Prepare email content with selected articles
    console.log('📧 Step 6: Preparing TEST email content...');
    const htmlContent = generateEmailContent(selectedArticles, script.length, actualDuration);

    // Step 8: Determine recipients
    const emailRecipients = recipients || getEmailRecipients();
    console.log(`📧 Sending TEST email to ${emailRecipients.length} recipient(s): ${emailRecipients.join(', ')}`);

    // Step 9: Send email
    console.log('📤 Step 7: Sending TEST email...');
    const transporter = createTransporter();

    // Verify connection configuration
    await transporter.verify();
    console.log('✅ SMTP server connection verified');

    // Send email with in-memory attachments
    const info = await transporter.sendMail({
      from: `"Daily AI News (TEST)" <${process.env.EMAIL_USER}>`,
      to: emailRecipients[0], // Primary recipient
      bcc: emailRecipients.slice(1), // BCC for additional recipients
      subject: 'Daily AI News Podcast (TEST MODE)',
      html: htmlContent,
      attachments: [
        {
          filename: `podcast_test_${timestamp}.txt`,
          content: script,
          contentType: 'text/plain',
        },
        {
          filename: `podcast_test_${timestamp}.mp3`,
          content: audioBuffer,
          contentType: 'audio/mpeg',
        },
      ],
    });

    console.log('✅ TEST podcast email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Preview URL:', require('nodemailer').getTestMessageUrl(info));
    
    await logEmailSent(emailRecipients.length, info.messageId || 'Unknown');

    // No cleanup needed since we're using in-memory attachments

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
