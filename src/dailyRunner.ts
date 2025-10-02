import cron from 'node-cron';
import dotenv from 'dotenv';
import { sendDailyPodcastEmail } from './emailPodcast';
import { logProcessStart, logSuccess, logError, initializeDiscordLogger } from './logger';

// Load environment variables
dotenv.config();

/**
 * Daily AI News Podcast Scheduler
 * 
 * This script sets up a cron job to automatically run the full podcast pipeline
 * every day at 6:30 AM GMT+2 (Hungary timezone).
 * 
 * The pipeline includes:
 * - Fetching RSS feeds from multiple AI/tech sources
 * - Generating AI-powered podcast script
 * - Converting script to speech using TTS
 * - Sending email with attachments
 */

console.log('🚀 Starting Daily AI News Podcast Scheduler...');
console.log('📅 Schedule: Every day at 6:30 AM GMT+2 (Hungary timezone)');
console.log('⏰ Cron expression: 30 4 * * * (4:30 AM UTC = 6:30 AM GMT+2)');
console.log('');

// Initialize Discord logging
initializeDiscordLogger().then(() => {
  logProcessStart('Daily AI News Podcast Scheduler started');
});

// Validate required environment variables
const requiredVars = ['EMAIL_USER', 'EMAIL_PASS', 'OPENAI_API_KEY', 'DEEPGRAM_API_KEY'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please check your .env file and ensure all required variables are set.');
  process.exit(1);
}

console.log('✅ Environment variables validated');
console.log('');

// Define the cron job
// 30 4 * * * = Every day at 4:30 AM UTC (6:30 AM GMT+2)
const cronExpression = '30 4 * * *';

console.log('⏰ Setting up cron job...');

const task = cron.schedule(cronExpression, async () => {
  const now = new Date();
  console.log('');
  console.log('🕕 ==========================================');
  console.log(`🕕 Daily AI News Podcast - ${now.toLocaleString('en-US', { 
    timeZone: 'Europe/Budapest',
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })} GMT+2`);
  console.log('🕕 ==========================================');
  console.log('');

  try {
    console.log('🎙️ Starting daily podcast generation...');
    await sendDailyPodcastEmail();
    console.log('✅ Daily podcast email sent successfully!');
    await logSuccess('Daily podcast email sent successfully');
  } catch (error) {
    console.error('❌ Failed to send daily podcast email:', error);
    
    // Log error to Discord with user mention
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logError(`Daily podcast generation failed: ${errorMessage}`);
    
    // Log error details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }

  console.log('');
  console.log('🕕 ==========================================');
  console.log('🕕 Daily podcast generation completed');
  console.log('🕕 ==========================================');
  console.log('');
}, {
  scheduled: false, // Don't start immediately
  timezone: 'Europe/Budapest' // Hungary timezone
});

// Start the cron job
task.start();
console.log('✅ Cron job started successfully!');
console.log('');

// Keep the process running
console.log('🔄 Scheduler is running... Press Ctrl+C to stop');
console.log('');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  task.stop();
  console.log('✅ Scheduler stopped');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  task.stop();
  console.log('✅ Scheduler stopped');
  process.exit(0);
});

// Test run option (for development)
if (process.argv.includes('--test')) {
  console.log('🧪 Test mode: Running podcast generation immediately...');
  console.log('');
  
  (async () => {
    try {
      await sendDailyPodcastEmail();
      console.log('✅ Test run completed successfully!');
    } catch (error) {
      console.error('❌ Test run failed:', error);
    }
    
    process.exit(0);
  })();
}

