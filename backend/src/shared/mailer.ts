import nodemailer from 'nodemailer';

export const sendEmail = async (to: string, subject: string, text: string, html: string) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASS,
      },
    });

    const mailOptions = {
        from: `"${process.env.APP_NAME || 'HeroClash4Geeks'}" <${process.env.GMAIL_USER}>`, 
        to,
        subject,
        text,
        html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw error to prevent blocking main flow if email fails
    return null;
  }
};
