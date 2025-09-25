import { sendTestEmail } from './email';
import { fetchAllFeeds, getArticlesBySource } from './rssFetcher';

/**
 * Tests the RSS feed functionality
 */
async function testRssFeeds(): Promise<void> {
  console.log('📰 Testing RSS feed functionality...\n');

  try {
    const articles = await fetchAllFeeds();
    const articlesBySource = getArticlesBySource(articles);

    console.log('\n📊 RSS Feed Summary:');
    console.log(`📈 Total articles fetched: ${articles.length}`);
    console.log('\n📋 Articles by source:');
    Object.entries(articlesBySource).forEach(([source, count]) => {
      console.log(`  • ${source}: ${count} articles`);
    });

    console.log('\n📝 Sample article titles:');
    articles.slice(0, 5).forEach((article, index) => {
      console.log(`  ${index + 1}. [${article.source}] ${article.title}`);
    });

    if (articles.length > 5) {
      console.log(`  ... and ${articles.length - 5} more articles`);
    }

    console.log('\n✅ RSS feed test completed successfully!');
  } catch (error) {
    console.error('\n❌ RSS feed test failed:', error);
    throw error;
  }
}

/**
 * Main entry point for the Daily AI News application
 */
async function main(): Promise<void> {
  console.log('🚀 Starting Daily AI News application...\n');

  try {
    // Test RSS feeds first
    await testRssFeeds();

    console.log('\n' + '='.repeat(50));
    console.log('📧 Testing email functionality...\n');

    const emailSent = await sendTestEmail();

    if (emailSent) {
      console.log('\n🎉 Application started successfully!');
      console.log('📬 Check your email inbox for the test message.');
    } else {
      console.log(
        '\n❌ Failed to send test email. Please check your configuration.'
      );
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Application failed to start:', error);
    process.exit(1);
  }
}

// Run the application
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}
