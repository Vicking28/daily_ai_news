import { google } from 'googleapis';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Interactive script to get Google OAuth2 refresh token
 * Run this once to get your refresh token, then add it to .env
 */
async function getRefreshToken(): Promise<void> {
  console.log('🔑 Google OAuth2 Refresh Token Generator\n');

  // Validate required environment variables
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.error('❌ Missing required environment variables:');
    console.error('   GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env');
    console.error('\n💡 Make sure you have added your Google OAuth2 credentials to .env');
    process.exit(1);
  }

  console.log('✅ Found Google OAuth2 credentials in .env');
  console.log(`📋 Client ID: ${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...`);
  console.log(`📋 Client Secret: ${process.env.GOOGLE_CLIENT_SECRET.substring(0, 10)}...\n`);

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
  );

  // Generate the authorization URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    prompt: 'consent', // Force consent screen to get refresh token
  });

  console.log('🌐 Step 1: Authorize the application');
  console.log('📱 Open this URL in your browser:');
  console.log(`\n${authUrl}\n`);

  console.log('📋 Step 2: Copy the authorization code');
  console.log('After authorizing, you\'ll be redirected to a page that may show an error.');
  console.log('Look at the URL bar - it will contain a "code" parameter.');
  console.log('Copy everything after "code=" until the next "&" or end of URL.\n');

  // Create readline interface for user input
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    rl.question('🔑 Paste the authorization code here: ', async (code) => {
      try {
        console.log('\n🔄 Exchanging authorization code for tokens...');

        // Exchange authorization code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('✅ Successfully obtained tokens!');
        console.log(`🔑 Refresh Token: ${tokens.refresh_token}`);
        console.log(`🎫 Access Token: ${tokens.access_token?.substring(0, 20)}...`);

        console.log('\n📝 Step 3: Add to your .env file');
        console.log('Add this line to your .env file:');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);

        console.log('\n🎉 Setup complete! You can now use Google Drive integration.');
        console.log('💡 You only need to do this once - the refresh token will work indefinitely.');

        rl.close();
        resolve();
      } catch (error) {
        console.error('\n❌ Failed to exchange authorization code:', error);
        console.error('\n💡 Make sure you copied the complete authorization code from the URL.');
        rl.close();
        reject(error);
      }
    });
  });
}

// Run the script
if (require.main === module) {
  getRefreshToken()
    .then(() => {
      console.log('\n✅ Refresh token generation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Failed to generate refresh token:', error);
      process.exit(1);
    });
}
