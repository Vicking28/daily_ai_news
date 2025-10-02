import { Client, GatewayIntentBits, EmbedBuilder, ChannelType, SlashCommandBuilder, REST, Routes, InteractionResponseFlags } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Discord Logger Utility with RichEmbeds and Slash Commands
 * 
 * Provides comprehensive Discord logging with RichEmbeds and interactive slash commands
 * for manual podcast generation, status checks, and testing.
 */

// Discord client instance
let discordClient: Client | null = null;
let isInitialized = false;

/**
 * Initialize the Discord client and register slash commands
 */
async function initializeDiscord(): Promise<void> {
  if (isInitialized || !process.env.DISCORD_BOT_TOKEN) {
    return;
  }

  try {
    // Create Discord client with necessary intents
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ],
    });

    // Login to Discord
    await discordClient.login(process.env.DISCORD_BOT_TOKEN);
    
    // Wait for client to be ready
    await new Promise<void>((resolve) => {
      if (discordClient!.readyAt) {
        resolve();
      } else {
        discordClient!.once('ready', () => resolve());
      }
    });

    // Register slash commands
    await registerSlashCommands();
    
    isInitialized = true;
    console.log('✅ Discord bot initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Discord bot:', error);
    discordClient = null;
  }
}

/**
 * Get email recipients from environment variables for slash command choices
 */
function getEmailRecipientsForChoices(): { name: string; value: string }[] {
  const choices: { name: string; value: string }[] = [];
  const allEmails = new Set<string>(); // Use Set to avoid duplicates
  
  // Check for EMAIL_RECIPIENTS first (comma-separated list)
  if (process.env.EMAIL_RECIPIENTS) {
    const recipients = process.env.EMAIL_RECIPIENTS
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    recipients.forEach(email => {
      allEmails.add(email);
    });
  }
  
  // Add EMAIL_TO if it exists (could also be comma-separated)
  if (process.env.EMAIL_TO) {
    const emailToValues = process.env.EMAIL_TO
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);
    
    emailToValues.forEach(email => {
      allEmails.add(email);
    });
  }
  
  // Convert Set to choices array
  allEmails.forEach(email => {
    choices.push({ name: email, value: email });
  });
  
  // Default fallback if no emails configured
  if (choices.length === 0) {
    choices.push({ name: 'zlatnikvince@gmail.com', value: 'zlatnikvince@gmail.com' });
  }
  
  return choices;
}

/**
 * Register slash commands with Discord
 */
async function registerSlashCommands(): Promise<void> {
  if (!discordClient || !process.env.DISCORD_BOT_TOKEN) {
    return;
  }

  const emailChoices = getEmailRecipientsForChoices();

  const commands = [
    new SlashCommandBuilder()
      .setName('send-podcast')
      .setDescription('Send daily podcast email to all configured recipients'),

    new SlashCommandBuilder()
      .setName('status')
      .setDescription('Check the health status of the daily AI news service'),

    new SlashCommandBuilder()
      .setName('test-podcast')
      .setDescription('Send a test podcast with limited articles')
      .addStringOption(option => {
        const stringOption = option
          .setName('recipient')
          .setDescription('Email recipient for the test podcast')
          .setRequired(true);
        
        // Add choices for each email recipient
        emailChoices.forEach(choice => {
          stringOption.addChoices(choice);
        });
        
        return stringOption;
      }),
  ];

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

  try {
    console.log('🔄 Registering slash commands...');
    
    await rest.put(
      Routes.applicationCommands(discordClient.application!.id),
      { body: commands }
    );
    
    console.log('✅ Slash commands registered successfully');
  } catch (error) {
    console.error('❌ Failed to register slash commands:', error);
  }
}

/**
 * Get the Discord client (initialize if needed)
 */
async function getDiscordClient(): Promise<Client | null> {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log('⚠️ Discord bot token not configured, skipping Discord log');
    return null;
  }

  if (!isInitialized) {
    await initializeDiscord();
  }

  return discordClient;
}

/**
 * Send a message to Discord using RichEmbeds
 */
async function sendDiscordEmbed(embed: EmbedBuilder, isError: boolean = false): Promise<void> {
  const client = await getDiscordClient();
  
  if (!client || !process.env.DISCORD_LOG_CHANNEL_ID) {
    console.log('⚠️ Discord not available, skipping log');
    return;
  }

  try {
    const channel = await client.channels.fetch(process.env.DISCORD_LOG_CHANNEL_ID);
    
    if (!channel || !channel.isTextBased()) {
      console.error('❌ Invalid Discord channel');
      return;
    }

    // Add user mention for errors
    if (isError && process.env.DISCORD_USER_ID) {
      embed.setFooter({ text: `Alerting: <@${process.env.DISCORD_USER_ID}>` });
    }

    // Type assertion to ensure channel is text-based
    const textChannel = channel as any;
    await textChannel.send({ embeds: [embed] });
    console.log(`📱 Discord embed sent: ${isError ? 'ERROR' : 'INFO'}`);
  } catch (error) {
    console.error('❌ Failed to send Discord embed:', error);
  }
}

/**
 * Logs a success message to Discord with green embed
 */
export async function logSuccess(message: string, details?: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle(':white_check_mark: Success')
    .setDescription(message)
    .setTimestamp();

  if (details) {
    embed.addFields({ name: 'Details', value: details, inline: false });
  }

  await sendDiscordEmbed(embed);
}

/**
 * Logs an error message to Discord with red embed and user mention
 */
export async function logError(message: string, details?: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xFF0000) // Red
    .setTitle(':x: Error')
    .setDescription(message)
    .setTimestamp();

  if (details) {
    embed.addFields({ name: 'Details', value: details, inline: false });
  }

  await sendDiscordEmbed(embed, true);
}

/**
 * Logs an informational message to Discord with blue embed
 */
export async function logInfo(message: string, details?: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF) // Blue
    .setTitle(':information_source: Info')
    .setDescription(message)
    .setTimestamp();

  if (details) {
    embed.addFields({ name: 'Details', value: details, inline: false });
  }

  await sendDiscordEmbed(embed);
}

/**
 * Logs a process start message to Discord
 */
export async function logProcessStart(processName: string, details?: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF) // Blue
    .setTitle(':rocket: Process Started')
    .setDescription(processName)
    .setTimestamp();

  if (details) {
    embed.addFields({ name: 'Details', value: details, inline: false });
  }

  await sendDiscordEmbed(embed);
}

/**
 * Logs a process completion message to Discord
 */
export async function logProcessComplete(processName: string, details?: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle(':white_check_mark: Process Complete')
    .setDescription(processName)
    .setTimestamp();

  if (details) {
    embed.addFields({ name: 'Details', value: details, inline: false });
  }

  await sendDiscordEmbed(embed);
}

/**
 * Logs news collection information
 */
export async function logNewsCollection(articleCount: number, sourceCount: number): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF) // Blue
    .setTitle(':newspaper: News Collection')
    .setDescription(`Collected ${articleCount} articles from ${sourceCount} RSS sources`)
    .setTimestamp();

  await sendDiscordEmbed(embed);
}

/**
 * Logs podcast generation information
 */
export async function logPodcastGeneration(scriptLength: number, wordCount: number): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF) // Blue
    .setTitle(':headphones: Podcast Generated')
    .setDescription(`Generated podcast script with ${wordCount} words`)
    .addFields(
      { name: 'Script Length', value: `${scriptLength} characters`, inline: true }
    )
    .setTimestamp();

  await sendDiscordEmbed(embed);
}

/**
 * Logs audio synthesis information
 */
export async function logAudioSynthesis(duration: string, fileSize: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x0099FF) // Blue
    .setTitle(':musical_note: Audio Synthesized')
    .setDescription('Text-to-speech conversion completed')
    .addFields(
      { name: 'Duration', value: duration, inline: true },
      { name: 'File Size', value: fileSize, inline: true }
    )
    .setTimestamp();

  await sendDiscordEmbed(embed);
}

/**
 * Logs email sending information
 */
export async function logEmailSent(recipientCount: number, messageId: string): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle(':incoming_envelope: Email Sent')
    .setDescription(`Daily podcast email sent to ${recipientCount} recipient(s)`)
    .addFields({ name: 'Message ID', value: messageId, inline: false })
    .setTimestamp();

  await sendDiscordEmbed(embed);
}

/**
 * Setup slash command handlers
 */
export function setupSlashCommandHandlers(): void {
  if (!discordClient) {
    return;
  }

  discordClient.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    // Check if interaction is too old (Discord has a 3-second timeout)
    const interactionAge = Date.now() - interaction.createdTimestamp;
    if (interactionAge > 2500) { // 2.5 seconds safety margin
      console.log('⚠️ Interaction too old, ignoring');
      return;
    }

    try {
      switch (interaction.commandName) {
        case 'send-podcast':
          await handleSendPodcastCommand(interaction);
          break;
        case 'status':
          await handleStatusCommand(interaction);
          break;
        case 'test-podcast':
          await handleTestPodcastCommand(interaction);
          break;
        default:
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
              content: 'Unknown command', 
              flags: InteractionResponseFlags.Ephemeral 
            });
          }
      }
    } catch (error) {
      console.error('❌ Error handling slash command:', error);
      
      // Check if this is a "Unknown interaction" error - if so, just ignore it
      if (error instanceof Error && error.message.includes('Unknown interaction')) {
        console.log('⚠️ Unknown interaction error, ignoring');
        return;
      }
      
      // Try to respond with error if interaction hasn't been acknowledged yet
      if (!interaction.replied && !interaction.deferred) {
        try {
          await interaction.reply({ 
            content: '❌ An error occurred while processing your command', 
            flags: InteractionResponseFlags.Ephemeral
          });
        } catch (replyError) {
          console.error('❌ Failed to send error reply:', replyError);
        }
      } else if (interaction.deferred && !interaction.replied) {
        // If we deferred but haven't replied yet, edit the reply
        try {
          await interaction.editReply({
            content: '❌ An error occurred while processing your command'
          });
        } catch (editError) {
          console.error('❌ Failed to edit error reply:', editError);
        }
      }
    }
  });
}

/**
 * Handle the send-podcast slash command
 */
async function handleSendPodcastCommand(interaction: any): Promise<void> {
  // Check if user is authorized
  const authorizedUserId = process.env.DISCORD_USER_ID;
  if (authorizedUserId && interaction.user.id !== authorizedUserId) {
    await interaction.reply({ 
      content: '❌ You are not authorized to use this command.', 
      flags: InteractionResponseFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });

  try {
    // Import the emailPodcast module to get recipients and send email
    const { sendDailyPodcastEmail, getEmailRecipients } = await import('./emailPodcast');
    
    // Get all configured email recipients (same as daily runner)
    const allRecipients = getEmailRecipients();
    
    // Send to all configured recipients
    await sendDailyPodcastEmail(allRecipients);
    
    await interaction.editReply({
      content: `✅ Daily podcast email sent successfully to all ${allRecipients.length} configured recipient(s): ${allRecipients.join(', ')}`
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await interaction.editReply({
      content: `❌ Failed to send podcast email: ${errorMessage}`
    });
  }
}

/**
 * Handle the status slash command
 */
async function handleStatusCommand(interaction: any): Promise<void> {
  // Check if user is authorized
  const authorizedUserId = process.env.DISCORD_USER_ID;
  if (authorizedUserId && interaction.user.id !== authorizedUserId) {
    await interaction.reply({ 
      content: '❌ You are not authorized to use this command.', 
      flags: InteractionResponseFlags.Ephemeral
    });
    return;
  }

  // Default to production if NODE_ENV is undefined
  const nodeEnv = process.env.NODE_ENV || 'production';

  // Get current timestamp in seconds for Discord markdown
  const now = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setColor(0x00FF00) // Green
    .setTitle(':green_circle: Service Status')
    .setDescription('Daily AI News service is running normally')
    .addFields(
      { name: 'Scheduler', value: 'Active (6:30 AM GMT+2)', inline: true },
      { name: 'Last Check', value: `<t:${now}:F>`, inline: true },
      { name: 'Environment', value: nodeEnv, inline: true }
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

/**
 * Handle the test-podcast slash command
 */
async function handleTestPodcastCommand(interaction: any): Promise<void> {
  // Check if user is authorized
  const authorizedUserId = process.env.DISCORD_USER_ID;
  if (authorizedUserId && interaction.user.id !== authorizedUserId) {
    await interaction.reply({ 
      content: '❌ You are not authorized to use this command.', 
      flags: InteractionResponseFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: InteractionResponseFlags.Ephemeral });

  const recipient = interaction.options.getString('recipient');

  try {
    // Dynamic import to avoid circular dependency
    const testRunner = await import('./testRunner');
    await testRunner.sendTestPodcastEmail([recipient]);
    
    await interaction.editReply({
      content: `✅ Test podcast email sent successfully to ${recipient}`
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await interaction.editReply({
      content: `❌ Failed to send test podcast email: ${errorMessage}`
    });
  }
}

/**
 * Initialize Discord and setup handlers
 */
export async function initializeDiscordLogger(): Promise<void> {
  await initializeDiscord();
  setupSlashCommandHandlers();
}

// Initialize Discord when module is imported
initializeDiscordLogger().catch(console.error);