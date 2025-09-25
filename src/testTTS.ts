import { fetchAllFeeds } from './rssFetcher';
import { generatePodcastScript } from './podcastGenerator';
import { synthesizePodcast, estimateAudioDuration, validateOutputPath } from './tts';
import path from 'path';

/**
 * Test script for complete podcast generation and TTS synthesis
 */
async function testTTSGeneration(): Promise<void> {
  console.log('🎙️ Testing Complete Podcast Generation with TTS...\n');

  try {
    // Step 1: Fetch RSS feeds
    console.log('📡 Step 1: Fetching RSS feeds...');
    const allArticles = await fetchAllFeeds();
    
    // Limit to 20 articles for cost control
    const sampleArticles = allArticles.slice(0, 20);
    console.log(`📋 Using ${sampleArticles.length} articles for podcast generation\n`);

    // Step 2: Generate podcast script
    console.log('🤖 Step 2: Generating podcast script with AI...');
    const script = await generatePodcastScript(sampleArticles);
    console.log(`📝 Generated script: ${script.length} characters\n`);

    // Step 3: Prepare output path
    const outputDir = path.join(process.cwd(), 'output');
    const outputPath = path.join(outputDir, 'podcast.mp3');
    
    console.log('🎤 Step 3: Converting script to speech...');
    console.log(`📁 Output directory: ${outputDir}`);
    console.log(`🎵 Output file: ${outputPath}`);

    // Validate output path
    if (!validateOutputPath(outputPath)) {
      throw new Error('Invalid output path. Please use a valid audio file extension (.mp3, .wav, .m4a, .ogg)');
    }

    // Step 4: Synthesize speech
    await synthesizePodcast(script, outputPath);

    // Step 5: Display results
    console.log('\n📊 Complete Podcast Generation Results:');
    console.log('=' .repeat(60));
    console.log(`📈 Articles processed: ${sampleArticles.length}`);
    console.log(`📝 Script length: ${script.length} characters`);
    console.log(`📊 Word count: ${script.split(' ').length} words`);
    console.log(`⏱️ Estimated audio duration: ${estimateAudioDuration(script)} seconds`);
    console.log(`🎵 Audio file: ${outputPath}`);
    
    // Check if file exists and get size
    const fs = require('fs');
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      const fileSizeKB = Math.round(stats.size / 1024);
      console.log(`📁 File size: ${fileSizeKB} KB`);
    }

    console.log('\n🎉 Complete podcast generation test completed successfully!');
    console.log('🎧 You can now play the generated MP3 file!');
    
  } catch (error) {
    console.error('\n❌ Podcast generation test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('DEEPGRAM_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your Deepgram API key to the .env file');
        console.log('   Get your API key from: https://console.deepgram.com/');
      } else if (error.message.includes('OPENAI_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your OpenAI API key to the .env file');
        console.log('   Get your API key from: https://platform.openai.com/api-keys');
      }
    }
    
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testTTSGeneration()
    .then(() => {
      console.log('\n🎉 All tests completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}
