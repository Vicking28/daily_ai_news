# Daily AI News

A TypeScript project for gathering AI news from multiple RSS feeds, generating AI-powered podcast scripts, converting them to speech, and automatically sending daily podcast emails with attachments using Node.js, rss-parser, OpenAI API, Deepgram TTS, and nodemailer.

## 🚀 Features

- **TypeScript** - Full type safety and modern JavaScript features
- **RSS Feed Aggregation** - Fetch news from 13+ AI/tech RSS feeds in parallel
- **AI Podcast Generation** - Transform articles into engaging podcast scripts using OpenAI GPT-4o-mini
- **Text-to-Speech** - Convert podcast scripts to natural-sounding MP3 audio using Deepgram TTS
- **Daily Email Automation** - Send complete podcast emails with script and audio attachments
- **Email Functionality** - Send emails using nodemailer with SMTP configuration
- **HTML Content Cleaning** - Strip HTML tags and decode entities for clean text
- **Environment Configuration** - Secure credential management with dotenv
- **Development Tools** - ESLint, Prettier, and ts-node for development
- **Modular Structure** - Clean separation of concerns with config and src directories

## 📁 Project Structure

```
daily_ai_news/
├── src/                    # Source TypeScript files
│   ├── index.ts           # Main application entry point
│   ├── email.ts           # Basic email functionality
│   ├── emailPodcast.ts    # Daily podcast email automation
│   ├── rssFetcher.ts      # RSS feed aggregation
│   ├── podcastGenerator.ts # AI-powered podcast script generation
│   ├── tts.ts             # Text-to-speech conversion
│   ├── testPodcast.ts     # Podcast generation testing
│   ├── testTTS.ts         # Complete TTS testing
│   └── testEmailPodcast.ts # Email podcast testing
├── config/                # Configuration files
│   └── config.ts          # Environment variable configuration
├── output/                # Generated files
│   ├── podcast.mp3        # Generated podcast audio
│   └── podcast.txt        # Generated podcast script
├── dist/                  # Compiled JavaScript output
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules
├── eslint.config.js      # ESLint configuration
├── .prettierrc           # Prettier configuration
├── tsconfig.json         # TypeScript configuration
└── package.json          # Node.js dependencies and scripts
```

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:

   ```env
   # Required: Your email credentials
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password-here
   
   # Optional: SMTP server settings (defaults to Gmail)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   
   # Required: OpenAI API key for podcast generation
   OPENAI_API_KEY=your-openai-api-key-here
   
   # Optional: OpenAI model (defaults to gpt-4o-mini)
   OPENAI_MODEL=gpt-4o-mini
   
   # Required: Deepgram API key for text-to-speech conversion
   DEEPGRAM_API_KEY=your-deepgram-api-key-here
   ```

### 3. OpenAI API Setup

#### Get Your API Key
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to "API Keys" section
4. Click "Create new secret key"
5. Copy the key and add it to your `.env` file

#### API Usage & Costs
- **Model**: `gpt-4o-mini` (cost-effective, high-quality)
- **Estimated cost**: ~$0.01-0.05 per podcast generation
- **Rate limits**: Check your OpenAI account dashboard
- **Billing**: Monitor usage in OpenAI dashboard

### 4. Deepgram API Setup

#### Get Your API Key
1. Visit [Deepgram Console](https://console.deepgram.com/)
2. Sign in or create an account
3. Navigate to "API Keys" section
4. Click "Create New API Key"
5. Copy the key and add it to your `.env` file

#### API Usage & Costs
- **Model**: `aura-asteria-en` (natural-sounding female voice)
- **Estimated cost**: ~$0.01-0.03 per minute of generated audio
- **Rate limits**: Check your Deepgram account dashboard
- **Billing**: Monitor usage in Deepgram dashboard

### 5. Email Provider Setup

#### Gmail Setup
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
   - Use this password in your `.env` file

#### Other Providers
- **Outlook/Hotmail**: `smtp-mail.outlook.com:587`
- **Yahoo**: `smtp.mail.yahoo.com:587`
- **Custom SMTP**: Use your provider's SMTP settings

### 6. Google Drive API Setup (Optional)

The project can automatically upload podcast text files to Google Drive for easy sharing. This is optional - emails will work without it.

#### Create Google Cloud Project
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" → "Library"
   - Search for "Google Drive API"
   - Click "Enable"

#### Create OAuth2 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Choose "Desktop application" as application type
4. Download the JSON file and note your:
   - `client_id`
   - `client_secret`

#### Get Refresh Token
1. Install Google OAuth2 Playground: [OAuth2 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) → "Use your own OAuth credentials"
3. Enter your `client_id` and `client_secret`
4. In the left panel, find "Drive API v3" → "https://www.googleapis.com/auth/drive.file"
5. Click "Authorize APIs" and sign in with your Google account
6. Click "Exchange authorization code for tokens"
7. Copy the `refresh_token` from the response

#### Add to Environment
Add these values to your `.env` file:
```env
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_REFRESH_TOKEN=your-refresh-token-here
```

#### Features
- **Automatic Upload**: Podcast text files uploaded to Google Drive
- **Public Sharing**: Files set to "anyone with link can view"
- **Unique Naming**: Files named with date (e.g., `daily-ai-podcast-2024-01-15.txt`)
- **Email Integration**: Drive links included in email content
- **Graceful Fallback**: System works without Drive if upload fails

### 7. Email Recipients Configuration

The system supports flexible email recipient configuration:

#### Single Recipient
Add to your `.env` file:
```env
EMAIL_TO=recipient@gmail.com
```

#### Multiple Recipients (BCC)
Add to your `.env` file:
```env
EMAIL_RECIPIENTS=user1@gmail.com,user2@gmail.com,user3@gmail.com
```

#### Command Line Override
Send to custom recipients without changing `.env`:
```bash
npm run send:podcast:custom user1@gmail.com user2@gmail.com user3@gmail.com
```

#### Email Delivery Features
- **BCC Privacy**: Additional recipients are BCC'd for privacy
- **Primary Recipient**: First email in list is the main "To" recipient
- **Flexible Configuration**: Supports both single and multiple recipients
- **Command Line Override**: Can specify recipients at runtime

## 🚀 Usage

### Development Mode
Run the application in development mode with hot reloading:

```bash
npm run dev
```

### Production Build
Build the TypeScript code for production:

```bash
npm run build
```

### Run Production Build
Execute the compiled JavaScript:

```bash
npm start
```

### Test RSS Feeds Only
Test just the RSS feed functionality:

```bash
npm run test:rss
```

### Test Podcast Generation
Test the AI-powered podcast script generation:

```bash
npm run test:podcast
```

### Test Complete TTS Pipeline
Test the complete pipeline: RSS → AI Script → Audio Generation:

```bash
npm run test:tts
```

### Send Daily Podcast Email
Send a complete daily podcast email with RSS → AI Script → Audio → Email:

```bash
# Send to recipients configured in .env file
npm run send:podcast

# Send to custom recipients (comma-separated)
npm run send:podcast:custom user1@gmail.com user2@gmail.com user3@gmail.com
```

### Code Quality
Lint and format your code:

```bash
# Check for linting issues
npm run lint

# Fix linting issues automatically
npm run lint:fix

# Format code with Prettier
npm run format
```

## 📰 RSS Feed Functionality

The project includes comprehensive RSS feed aggregation from 13+ AI and technology news sources:

### Supported RSS Feeds
- **OpenAI Blog** - Latest AI research and updates
- **TechCrunch AI** - AI industry news and analysis
- **MarkTechPost** - AI and machine learning news
- **KDnuggets** - Data science and AI insights
- **Financial Times AI** - Business perspective on AI
- **MIT News AI** - Academic AI research updates
- **The Gradient** - AI research blog
- **Analytics Vidhya** - AI tutorials and news
- **AI News** - Dedicated AI news source
- **NY Times Technology** - Tech news including AI
- **Google Research** - Google's AI research updates
- **Daily AI** - Daily AI news digest

### RSS Features
- **Parallel Fetching** - All feeds fetched simultaneously for speed
- **HTML Content Cleaning** - Strips HTML tags and decodes entities
- **Source Normalization** - Clean source names from URLs
- **Date Sorting** - Articles sorted by publication date (newest first)
- **Error Handling** - Graceful handling of failed feeds
- **Content Truncation** - Summaries limited to 500 characters

### Example Usage

```typescript
import { fetchAllFeeds, getArticlesBySource } from './src/rssFetcher';

// Fetch all RSS feeds
const articles = await fetchAllFeeds();
console.log(`Fetched ${articles.length} articles`);

// Get articles grouped by source
const articlesBySource = getArticlesBySource(articles);
console.log(articlesBySource); // { "openai": 5, "techcrunch": 8, ... }

// Access individual articles
articles.forEach(article => {
  console.log(`[${article.source}] ${article.title}`);
  console.log(`Link: ${article.link}`);
  console.log(`Summary: ${article.summary}`);
});
```

### Article Object Structure

```typescript
interface Article {
  source: string;      // Clean source name (e.g., "openai", "techcrunch")
  title: string;       // Article title
  link: string;        // Article URL
  pubDate: string;     // Publication date (ISO string)
  summary: string;     // Clean plain text summary (max 500 chars)
}
```

## 🎙️ AI Podcast Generation

The project includes AI-powered podcast script generation using OpenAI's GPT-4o-mini model:

### Features
- **Intelligent Summarization** - Combines multiple articles into coherent narratives
- **Conversational Style** - Generates engaging, podcast-ready content
- **Optimal Length** - Targets 5-8 minutes of spoken content (700-900 words)
- **Smart Grouping** - Groups related stories and includes smooth transitions
- **Accessible Language** - Makes complex AI topics understandable for all audiences

### Podcast Generation Process
1. **Article Collection** - Fetches latest articles from RSS feeds
2. **Content Analysis** - AI analyzes and prioritizes key stories
3. **Script Generation** - Creates conversational podcast script
4. **Quality Control** - Estimates reading time and validates content

### Example Usage

```typescript
import { fetchAllFeeds } from './src/rssFetcher';
import { generatePodcastScript, estimateReadingTime } from './src/podcastGenerator';

// Fetch articles and generate podcast script
const articles = await fetchAllFeeds();
const script = await generatePodcastScript(articles.slice(0, 20)); // Limit for cost

// Analyze the generated script
const stats = estimateReadingTime(script);
console.log(`Generated ${stats.wordCount} words (${stats.estimatedMinutes} minutes)`);
console.log(script);
```

### Script Output Format
The generated script includes:
- **Introduction** - Brief overview of today's AI news
- **Main Stories** - Key developments with context and implications
- **Transitions** - Natural flow between topics
- **Conclusion** - Summary and forward-looking insights

### Cost Management
- **Article Limiting** - Test with 20 articles to control costs
- **Model Selection** - Uses cost-effective `gpt-4o-mini`
- **Token Optimization** - Efficient prompts minimize API usage
- **Error Handling** - Graceful failure with helpful error messages

## 🎤 Text-to-Speech (TTS) Functionality

The project includes AI-powered text-to-speech conversion using Deepgram's advanced TTS API:

### Features
- **Natural Voice Synthesis** - Uses Deepgram's `aura-asteria-en` voice model
- **High-Quality Audio** - Generates professional MP3 audio files
- **Automatic Directory Creation** - Creates output folders as needed
- **Duration Estimation** - Calculates estimated audio length
- **Error Handling** - Comprehensive error handling with helpful messages

### TTS Process
1. **Script Input** - Takes generated podcast script as input
2. **Voice Selection** - Uses natural-sounding female voice (aura-asteria-en)
3. **Audio Generation** - Converts text to high-quality MP3 audio
4. **File Output** - Saves audio to specified output path

### Example Usage

```typescript
import { synthesizePodcast, estimateAudioDuration } from './src/tts';

// Convert script to speech
await synthesizePodcast(script, 'output/podcast.mp3');

// Estimate audio duration
const duration = estimateAudioDuration(script);
console.log(`Estimated duration: ${duration} seconds`);
```

### Complete Pipeline Example

```typescript
import { fetchAllFeeds } from './src/rssFetcher';
import { generatePodcastScript } from './src/podcastGenerator';
import { synthesizePodcast } from './src/tts';

// Complete pipeline: RSS → AI Script → Audio
const articles = await fetchAllFeeds();
const script = await generatePodcastScript(articles.slice(0, 20));
await synthesizePodcast(script, 'output/daily-ai-news.mp3');
```

### Audio Output
- **Format**: MP3 (high quality, widely compatible)
- **Voice**: Natural-sounding female voice
- **Location**: `output/podcast.mp3` (configurable)
- **Duration**: Typically 5-8 minutes for full podcast

### Cost Management
- **Voice Selection** - Uses cost-effective voice models
- **Script Optimization** - Efficient text processing
- **Usage Monitoring** - Track costs in Deepgram dashboard
- **Error Handling** - Graceful failure with cost-saving tips

## 📧 Daily Email Automation

The project includes comprehensive email automation for daily AI podcast delivery:

### Features
- **Complete Pipeline** - RSS → AI Script → Audio → Email in one command
- **Rich HTML Content** - Beautiful email with top stories and podcast info
- **File Attachments** - Includes both podcast script (.txt) and audio (.mp3)
- **Smart Content** - Shows top 5 articles with links and source attribution
- **Professional Formatting** - Clean, responsive HTML email design

### Email Content
- **Subject**: "Daily AI News Podcast"
- **HTML Body**: 
  - Introduction paragraph
  - Top 5 article titles with clickable links
  - Podcast statistics (script length, estimated duration)
  - Professional styling with branding
- **Attachments**:
  - `podcast.txt` - Full AI-generated script
  - `podcast.mp3` - High-quality audio file

### Example Usage

```typescript
import { sendDailyPodcastEmail } from './src/emailPodcast';

// Send complete daily podcast email
await sendDailyPodcastEmail();
```

### Email Process
1. **Fetch RSS Feeds** - Gets latest articles from 13+ sources
2. **Generate AI Script** - Creates engaging podcast content
3. **Convert to Speech** - Generates MP3 audio with TTS
4. **Create Attachments** - Saves script and audio files
5. **Send Email** - Delivers complete package with rich HTML content

## 📧 Basic Email Functionality

The project also includes a basic `sendTestEmail()` function that:

- Sends a test email to `zlatnikvince@gmail.com`
- Uses the subject: "Test email from News Podcast Project"
- Includes both plain text and HTML content
- Validates SMTP connection before sending
- Provides detailed logging and error handling

### Example Usage

```typescript
import { sendTestEmail } from './src/email';

// Send a test email
const success = await sendTestEmail();
if (success) {
  console.log('Email sent successfully!');
} else {
  console.log('Failed to send email');
}
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `EMAIL_USER` | ✅ | - | Your email address |
| `EMAIL_PASS` | ✅ | - | Your email password/app password |
| `SMTP_HOST` | ❌ | `smtp.gmail.com` | SMTP server hostname |
| `SMTP_PORT` | ❌ | `587` | SMTP server port |
| `EMAIL_TO` | ❌ | - | Single email recipient |
| `EMAIL_RECIPIENTS` | ❌ | - | Multiple recipients (comma-separated, uses BCC) |
| `OPENAI_API_KEY` | ✅ | - | OpenAI API key for podcast generation |
| `OPENAI_MODEL` | ❌ | `gpt-4o-mini` | OpenAI model to use |
| `DEEPGRAM_API_KEY` | ✅ | - | Deepgram API key for text-to-speech |
| `GOOGLE_CLIENT_ID` | ❌ | - | Google OAuth2 client ID (for Drive uploads) |
| `GOOGLE_CLIENT_SECRET` | ❌ | - | Google OAuth2 client secret (for Drive uploads) |
| `GOOGLE_REDIRECT_URI` | ❌ | `http://localhost:3000/oauth2callback` | OAuth2 redirect URI |
| `GOOGLE_REFRESH_TOKEN` | ❌ | - | Google OAuth2 refresh token (for Drive uploads) |

### TypeScript Configuration

The project uses strict TypeScript settings:
- Target: ES2020
- Module: CommonJS
- Strict mode enabled
- Source maps for debugging
- Declaration files generated

## 🛡️ Security Notes

- **Never commit your `.env` file** - it's included in `.gitignore`
- Use App Passwords instead of your main email password
- The `.env.example` file contains only placeholder values
- All sensitive data is loaded from environment variables

## 📝 Development

### Adding New Features

1. Create new TypeScript files in the `src/` directory
2. Update the configuration in `config/config.ts` if needed
3. Add new environment variables to `.env.example`
4. Update this README with new functionality

### Code Style

The project uses:
- **ESLint** for code linting
- **Prettier** for code formatting
- **TypeScript** strict mode for type safety

Run `npm run lint:fix` and `npm run format` before committing changes.

## 🐛 Troubleshooting

### Common Issues

1. **"Missing required environment variables"**
   - Ensure your `.env` file exists and contains all required variables
   - Check that variable names match exactly (case-sensitive)

2. **"Authentication failed"**
   - Verify your email credentials are correct
   - For Gmail, ensure you're using an App Password, not your regular password
   - Check that 2-Factor Authentication is enabled

3. **"Connection timeout"**
   - Verify your SMTP host and port settings
   - Check your internet connection
   - Some networks block SMTP ports

4. **TypeScript compilation errors**
   - Run `npm run build` to see detailed error messages
   - Ensure all imports are correct
   - Check that all required dependencies are installed

## 📄 License

ISC License - see package.json for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

---

**Happy coding! 🎉**
