import { fetchAllFeeds } from './rssFetcher';
import { generatePodcastScript, estimateReadingTime, formatPodcastScript } from './podcastGenerator';

/**
 * Test script for podcast generation functionality
 */
async function testPodcastGeneration(): Promise<void> {
  console.log('🎙️ Testing AI Podcast Generation...\n');

  try {
    // Step 1: Fetch RSS feeds
    console.log('📡 Step 1: Fetching RSS feeds...');
    const allArticles = await fetchAllFeeds();
    
    // Limit to 20 articles for cost control
    const sampleArticles = allArticles.slice(0, 20);
    console.log(`📋 Using ${sampleArticles.length} articles for podcast generation\n`);

    // Step 2: Generate podcast script
    console.log('🤖 Step 2: Generating podcast script with AI...');
    const rawScript = await generatePodcastScript(sampleArticles);

    // Step 3: Format and analyze the script
    console.log('\n📝 Step 3: Formatting and analyzing script...');
    const formattedScript = formatPodcastScript(rawScript);
    const readingStats = estimateReadingTime(formattedScript);

    // Step 4: Display results
    console.log('\n📊 Podcast Generation Results:');
    console.log('=' .repeat(50));
    console.log(`📈 Articles processed: ${sampleArticles.length}`);
    console.log(`📝 Script length: ${formattedScript.length} characters`);
    console.log(`📊 Word count: ${readingStats.wordCount} words`);
    console.log(`⏱️ Estimated reading time: ${readingStats.estimatedMinutes} minutes`);
    console.log(`🎯 Target: 5-8 minutes (700-900 words)`);
    
    if (readingStats.estimatedMinutes >= 5 && readingStats.estimatedMinutes <= 8) {
      console.log('✅ Script length is within target range!');
    } else if (readingStats.estimatedMinutes < 5) {
      console.log('⚠️ Script is shorter than target (consider adding more content)');
    } else {
      console.log('⚠️ Script is longer than target (consider condensing)');
    }

    console.log('\n🎙️ Generated Podcast Script:');
    console.log('=' .repeat(50));
    console.log(formattedScript);
    console.log('=' .repeat(50));

    console.log('\n✅ Podcast generation test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Podcast generation test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your OpenAI API key to the .env file');
        console.log('   Get your API key from: https://platform.openai.com/api-keys');
      }
    }
    
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testPodcastGeneration()
    .then(() => {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}
