import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export const emailConfig: EmailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  user: process.env.EMAIL_USER || '',
  pass: process.env.EMAIL_PASS || '',
};

export const openaiConfig: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
};

// Validate required environment variables
export function validateConfig(): void {
  const requiredVars = ['EMAIL_USER', 'EMAIL_PASS'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env file and ensure all required variables are set.'
    );
  }
}

// Validate OpenAI configuration
export function validateOpenAIConfig(): void {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'Missing required environment variable: OPENAI_API_KEY\n' +
      'Please add your OpenAI API key to the .env file.'
    );
  }
}
