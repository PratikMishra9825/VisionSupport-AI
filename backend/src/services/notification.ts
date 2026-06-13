// Send SMS notification
export const sendSMS = async (to: string, message: string): Promise<void> => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (accountSid && authToken && fromNumber) {
    try {
      // Lazy load twilio to avoid crash if not installed
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);
      await client.messages.create({
        body: message,
        from: fromNumber,
        to: to,
      });
      console.log(`SMS successfully sent to ${to}`);
    } catch (error) {
      console.error(`Twilio SMS sending failed to ${to}:`, error);
    }
  } else {
    // Elegant fallback logger
    console.log(`[SMS Notification] (MOCK/SIMULATED) To: ${to} | Msg: ${message}`);
  }
};

// Send Email notification
export const sendEmail = async (to: string, subject: string, htmlContent: string): Promise<void> => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort) || 587,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: '"VisionSupport AI" <noreply@visionsupport.ai>',
        to,
        subject,
        html: htmlContent,
      });
      console.log(`Email successfully sent to ${to}`);
    } catch (error) {
      console.error(`Nodemailer Email sending failed to ${to}:`, error);
    }
  } else {
    // Elegant fallback logger
    console.log(`[Email Notification] (MOCK/SIMULATED) To: ${to} | Subj: ${subject} | Body: ${htmlContent.substring(0, 100)}...`);
  }
};

// Send Web Push notification
export const sendPushNotification = async (subscription: any, title: string, body: string, url?: string): Promise<void> => {
  if (subscription && subscription.endpoint) {
    console.log(`[Push Notification] (SIMULATED VIA OTLP) Target: ${subscription.endpoint} | Title: ${title} | Body: ${body} | Url: ${url}`);
  } else {
    console.log(`[Push Notification] (MOCK/SIMULATED) Title: ${title} | Body: ${body}`);
  }
};
