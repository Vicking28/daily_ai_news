import { createClient } from '@deepgram/sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { spawn } from 'child_process';

// Load environment variables
dotenv.config();

/**
 * Chunks text into smaller pieces that fit within Deepgram's character limit
 * @param text - The text to chunk
 * @param maxLength - Maximum length per chunk (default: 1900 to be safe)
 * @returns Array of text chunks
 */
function chunkText(text: string, maxLength: number = 1900): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentIndex = 0;

  while (currentIndex < text.length) {
    let endIndex = currentIndex + maxLength;
    
    // If we're not at the end of the text, try to break at a sentence boundary
    if (endIndex < text.length) {
      const lastSentenceEnd = text.lastIndexOf('.', endIndex);
      const lastQuestionEnd = text.lastIndexOf('?', endIndex);
      const lastExclamationEnd = text.lastIndexOf('!', endIndex);
      
      const lastBreak = Math.max(lastSentenceEnd, lastQuestionEnd, lastExclamationEnd);
      
      if (lastBreak > currentIndex + maxLength * 0.5) {
        endIndex = lastBreak + 1;
      }
    }

    chunks.push(text.slice(currentIndex, endIndex).trim());
    currentIndex = endIndex;
  }

  return chunks;
}

/**
 * Synthesizes a podcast script into MP3 audio using Deepgram TTS
 * @param script - The podcast script text to convert to speech
 * @param outputPath - The file path where the MP3 should be saved
 */
export async function synthesizePodcast(
  script: string,
  outputPath: string
): Promise<void> {
  // Validate Deepgram API key
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error(
      'Missing required environment variable: DEEPGRAM_API_KEY\n' +
      'Please add your Deepgram API key to the .env file.\n' +
      'Get your API key from: https://console.deepgram.com/'
    );
  }

  if (!script || script.trim().length === 0) {
    throw new Error('Script cannot be empty');
  }

  console.log('🎤 Starting text-to-speech synthesis...');
  console.log(`📝 Script length: ${script.length} characters`);
  console.log(`💾 Output path: ${outputPath}`);

  try {
    // Initialize Deepgram client
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 Created output directory: ${outputDir}`);
    }

    // Chunk the script if it's too long
    const textChunks = chunkText(script);
    console.log(`📄 Script split into ${textChunks.length} chunks for processing`);

    console.log('🔊 Synthesizing speech with Deepgram...');
    console.log(`🎭 Using voice: aura-asteria-en`);
    console.log(`🎵 Output format: MP3`);

    // Process each chunk and combine audio
    const allAudioChunks: Buffer[] = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(`🎵 Processing chunk ${i + 1}/${textChunks.length} (${chunk.length} chars)...`);

      // Convert text to speech using the speak method
      const response = await (deepgram as any).speak.request(
        { text: chunk },
        {
          model: 'aura-asteria-en',
          encoding: 'mp3',
        }
      );

      if (!response) {
        throw new Error(`No response received from Deepgram for chunk ${i + 1}`);
      }

      // Get the audio stream
      const audioStream = await (response as any).getStream();
      if (!audioStream) {
        throw new Error(`No audio stream received from Deepgram for chunk ${i + 1}`);
      }

      // Convert stream to buffer
      const chunks: any[] = [];
      const reader = audioStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // Convert chunks to Buffer
      const audioBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
      allAudioChunks.push(audioBuffer);
    }

    // Combine all audio chunks
    console.log('🔗 Combining audio chunks...');
    const finalAudioBuffer = Buffer.concat(allAudioChunks);

    // Write the audio file
    fs.writeFileSync(outputPath, finalAudioBuffer);

    // Get file size for logging
    const stats = fs.statSync(outputPath);
    const fileSizeKB = Math.round(stats.size / 1024);

    console.log('✅ Text-to-speech synthesis completed successfully!');
    console.log(`📁 Audio saved to: ${outputPath}`);
    console.log(`📊 File size: ${fileSizeKB} KB`);
    console.log(`⏱️ Estimated duration: ${Math.round(script.split(' ').length / 2.5)} seconds`);

  } catch (error) {
    console.error('❌ Text-to-speech synthesis failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('DEEPGRAM_API_KEY')) {
        console.log('\n💡 Tip: Make sure to add your Deepgram API key to the .env file');
        console.log('   Get your API key from: https://console.deepgram.com/');
      } else if (error.message.includes('quota') || error.message.includes('limit')) {
        console.log('\n💡 Tip: Check your Deepgram usage limits and billing');
      }
    }
    
    throw error;
  }
}


/**
 * Validates that the output path has a valid audio extension
 * @param outputPath - The output file path
 * @returns True if the path has a valid audio extension
 */
export function validateOutputPath(outputPath: string): boolean {
  const validExtensions = ['.mp3', '.wav', '.m4a', '.ogg'];
  const ext = path.extname(outputPath).toLowerCase();
  return validExtensions.includes(ext);
}

/**
 * Gets the actual duration of an MP3 file using ffprobe
 * @param filePath - Path to the MP3 file
 * @returns Promise<number> - Duration in seconds
 */
export async function getMP3Duration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    // Try to use ffprobe if available
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        if (!isNaN(duration)) {
          resolve(duration);
        } else {
          reject(new Error('Could not parse duration from ffprobe output'));
        }
      } else {
        // Fallback: estimate based on file size (rough approximation)
        console.log('⚠️ ffprobe not available, using file size estimation');
        try {
          const stats = fs.statSync(filePath);
          const fileSizeKB = stats.size / 1024;
          // Rough estimation: ~320KB per minute for MP3
          const estimatedDuration = Math.round((fileSizeKB / 320) * 60);
          resolve(estimatedDuration);
        } catch (error) {
          reject(new Error(`Could not get file duration: ${error}`));
        }
      }
    });

    ffprobe.on('error', (error) => {
      // Fallback: estimate based on file size
      console.log('⚠️ ffprobe not available, using file size estimation');
      try {
        const stats = fs.statSync(filePath);
        const fileSizeKB = stats.size / 1024;
        // Rough estimation: ~320KB per minute for MP3
        const estimatedDuration = Math.round((fileSizeKB / 320) * 60);
        resolve(estimatedDuration);
      } catch (fallbackError) {
        reject(new Error(`Could not get file duration: ${fallbackError}`));
      }
    });
  });
}

/**
 * Formats duration in seconds to a human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "5 minutes 30 seconds")
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  
  if (minutes === 0) {
    return `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  } else if (remainingSeconds === 0) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  } else {
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  }
}
