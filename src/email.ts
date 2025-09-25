import nodemailer, { Transporter } from 'nodemailer';
import { emailConfig, validateConfig } from '../config/config';

/**
 * Creates and returns a configured nodemailer transporter
 */
function createTransporter(): Transporter {
  validateConfig();

  return nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.port === 465, // true for 465, false for other ports
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });
}

/**
 * Sends a test email to zlatnikvince@gmail.com
 * @returns Promise<boolean> - true if email was sent successfully
 */
export async function sendTestEmail(): Promise<boolean> {
  try {
    const transporter = createTransporter();

    // Verify connection configuration
    await transporter.verify();
    console.log('✅ SMTP server connection verified');

    // Send test email
    const info = await transporter.sendMail({
      from: `"Daily AI News" <${emailConfig.user}>`,
      to: 'zlatnikvince@gmail.com',
      subject: 'Test email from News Podcast Project',
      text: 'Hello! This is a test email from our new project.',
      html: `
        <h2>Hello!</h2>
        <p>This is a test email from our new <strong>Daily AI News</strong> project.</p>
        <p>If you're receiving this, the email functionality is working correctly! 🎉</p>
        <hr>
        <small>Sent at: ${new Date().toISOString()}</small>
      `,
    });

    console.log('✅ Test email sent successfully!');
    console.log('📧 Message ID:', info.messageId);
    console.log('📬 Preview URL:', nodemailer.getTestMessageUrl(info));

    return true;
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    return false;
  }
}
