import { sendDailyPodcastEmail } from '../email/emailPodcast';

/**
 * Test script for daily AI podcast email functionality
 */
async function testDailyPodcastEmail(): Promise<void> {
  console.log('📧 Testing Daily AI Podcast Email...\n');

  try {
    // Check if custom recipients are provided via command line
    const customRecipients = process.argv.slice(2);
    
    if (customRecipients.length > 0) {
      console.log(`📧 Using custom recipients: ${customRecipients.join(', ')}`);
      await sendDailyPodcastEmail(customRecipients);
    } else {
      console.log('📧 Using recipients from .env file');
      await sendDailyPodcastEmail();
    }

    console.log('\n🎉 Daily AI podcast email sent successfully!');
    console.log('📬 Check your email inbox for the podcast and attachments.');
    console.log('📁 Audio and script files are also saved in the output/ directory.');

  } catch (error) {
    console.error('\n❌ Daily podcast email test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('EMAIL_USER') || error.message.includes('EMAIL_PASS')) {
        console.log('\n💡 Tip: Make sure to add your email credentials to the .env file');
        console.log('   Required: EMAIL_USER and EMAIL_PASS');
      } else if (error.message.includes('OPENAI_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your OpenAI API key to the .env file');
        console.log('   Get your API key from: https://platform.openai.com/api-keys');
      } else if (error.message.includes('DEEPGRAM_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your Deepgram API key to the .env file');
        console.log('   Get your API key from: https://console.deepgram.com/');
      }
    }
    
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testDailyPodcastEmail()
    .then(() => {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}
