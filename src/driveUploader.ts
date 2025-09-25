import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Creates and returns a configured Google Drive client
 */
function createDriveClient() {
  // Validate required environment variables
  const requiredVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Google Drive environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all required Google Drive variables are set.\n' +
      'See README for setup instructions.'
    );
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
  );

  // Set credentials using refresh token
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  // Create Drive client
  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Uploads a podcast text file to Google Drive and returns a public shareable link
 * @param filePath - Path to the local podcast.txt file
 * @returns Promise<string> - Public shareable Google Drive URL
 */
export async function uploadPodcastText(filePath: string): Promise<string> {
  console.log('📤 Starting Google Drive upload...');
  console.log(`📁 File to upload: ${filePath}`);

  try {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSizeKB = Math.round(stats.size / 1024);
    console.log(`📊 File size: ${fileSizeKB} KB`);

    // Create Drive client
    const drive = createDriveClient();

    // Generate unique filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uniqueFileName = `daily-ai-podcast-${timestamp}.txt`;

    console.log(`📝 Uploading as: ${uniqueFileName}`);

    // Upload file to Google Drive
    const uploadResponse = await drive.files.create({
      requestBody: {
        name: uniqueFileName,
        description: `Daily AI News Podcast Script - ${timestamp}`,
        parents: [], // Upload to root folder
      },
      media: {
        mimeType: 'text/plain',
        body: fs.createReadStream(filePath),
      },
      fields: 'id,name,webViewLink',
    });

    if (!uploadResponse.data.id) {
      throw new Error('Failed to upload file - no file ID returned');
    }

    const fileId = uploadResponse.data.id;
    console.log(`✅ File uploaded successfully! File ID: ${fileId}`);

    // Set file permissions to "anyone with the link can view"
    console.log('🔓 Setting public permissions...');
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    console.log('✅ Public permissions set successfully');

    // Generate public shareable link for viewing (not downloading)
    const webViewUrl = uploadResponse.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
    const downloadUrl = `https://drive.google.com/uc?id=${fileId}`;

    console.log(`🌐 Web view link: ${webViewUrl}`);
    console.log(`🔗 Download link: ${downloadUrl}`);

    return webViewUrl;

  } catch (error) {
    console.error('❌ Google Drive upload failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('GOOGLE_CLIENT_ID') || error.message.includes('GOOGLE_CLIENT_SECRET')) {
        console.log('\n💡 Tip: Make sure to add your Google OAuth2 credentials to the .env file');
        console.log('   Required: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
        console.log('   See README for Google Cloud setup instructions');
      } else if (error.message.includes('refresh_token')) {
        console.log('\n💡 Tip: Your Google refresh token may have expired');
        console.log('   You may need to regenerate it using the OAuth2 flow');
      } else if (error.message.includes('quota')) {
        console.log('\n💡 Tip: Google Drive API quota exceeded');
        console.log('   Check your Google Cloud Console for usage limits');
      }
    }
    
    throw error;
  }
}

/**
 * Lists recent files in Google Drive (for debugging)
 */
export async function listRecentFiles(): Promise<void> {
  try {
    const drive = createDriveClient();
    
    const response = await drive.files.list({
      pageSize: 10,
      fields: 'nextPageToken, files(id, name, createdTime, webViewLink)',
      orderBy: 'createdTime desc',
    });

    console.log('📁 Recent files in Google Drive:');
    response.data.files?.forEach(file => {
      console.log(`  - ${file.name} (${file.id}) - ${file.createdTime}`);
    });

  } catch (error) {
    console.error('❌ Failed to list Google Drive files:', error);
  }
}
