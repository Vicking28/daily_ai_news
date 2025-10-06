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
 * @returns Promise<Buffer> - The MP3 audio data as a Buffer
 */
export async function synthesizePodcast(script: string): Promise<Buffer> {
  // Validate Deepgram API key
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error(
      'Missing required environment variable: DEEPGRAM_API_KEY\n' +
      'Please add your Deepgram API key to the .env file.\n' +
      'Get your API key from: https://console.deepgram.com/'
    );
  }

  // Get voice ID from environment or use default
  const voiceId = process.env.DEEPGRAM_VOICE_ID || 'aura-asteria-en';

  if (!script || script.trim().length === 0) {
    throw new Error('Script cannot be empty');
  }

  console.log('🎤 Starting text-to-speech synthesis...');
  console.log(`📝 Script length: ${script.length} characters`);

  try {
    // Initialize Deepgram client
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

    // Chunk the script if it's too long
    const textChunks = chunkText(script);
    console.log(`📄 Script split into ${textChunks.length} chunks for processing`);

    console.log('🔊 Synthesizing speech with Deepgram...');
    console.log(`🎭 Using voice: ${voiceId}`);
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
          model: voiceId,
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

    // Get file size for logging
    const fileSizeKB = Math.round(finalAudioBuffer.length / 1024);

    console.log('✅ Text-to-speech synthesis completed successfully!');
    console.log(`📊 Audio buffer size: ${fileSizeKB} KB`);
    console.log(`⏱️ Estimated duration: ${Math.round(script.split(' ').length / 2.5)} seconds`);

    return finalAudioBuffer;

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
 * Gets the actual duration of an MP3 buffer using ffprobe
 * @param audioBuffer - The MP3 audio data as a Buffer
 * @returns Promise<number> - Duration in seconds
 */
export async function getMP3Duration(audioBuffer: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    // Create a temporary file for ffprobe to read
    const tempFile = require('path').join(require('os').tmpdir(), `temp_audio_${Date.now()}.mp3`);
    
    try {
      // Write buffer to temporary file
      require('fs').writeFileSync(tempFile, audioBuffer);
      
      // Try to use ffprobe if available
      const ffprobe = spawn('ffprobe', [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        tempFile
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
        // Clean up temporary file
        try {
          require('fs').unlinkSync(tempFile);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        if (code === 0) {
          const duration = parseFloat(output.trim());
          if (!isNaN(duration)) {
            resolve(duration);
          } else {
            reject(new Error('Could not parse duration from ffprobe output'));
          }
        } else {
          // Fallback: estimate based on buffer size (rough approximation)
          console.log('⚠️ ffprobe not available, using buffer size estimation');
          const fileSizeKB = audioBuffer.length / 1024;
          // Rough estimation: ~320KB per minute for MP3
          const estimatedDuration = Math.round((fileSizeKB / 320) * 60);
          resolve(estimatedDuration);
        }
      });

      ffprobe.on('error', (error) => {
        // Clean up temporary file
        try {
          require('fs').unlinkSync(tempFile);
        } catch (cleanupError) {
          // Ignore cleanup errors
        }
        
        // Fallback: estimate based on buffer size
        console.log('⚠️ ffprobe not available, using buffer size estimation');
        const fileSizeKB = audioBuffer.length / 1024;
        // Rough estimation: ~320KB per minute for MP3
        const estimatedDuration = Math.round((fileSizeKB / 320) * 60);
        resolve(estimatedDuration);
      });
    } catch (error) {
      // Fallback: estimate based on buffer size
      console.log('⚠️ Could not create temporary file, using buffer size estimation');
      const fileSizeKB = audioBuffer.length / 1024;
      // Rough estimation: ~320KB per minute for MP3
      const estimatedDuration = Math.round((fileSizeKB / 320) * 60);
      resolve(estimatedDuration);
    }
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
