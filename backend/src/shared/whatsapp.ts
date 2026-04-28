import twilio from 'twilio';

class WhatsAppService {
  async send(phone: string, code: string): Promise<void> {
    if (process.env.WHATSAPP_TEST_MODE === 'true') {
      console.log(`[WhatsApp TEST] OTP para ${phone}: ${code}`);
      return;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !from) {
      throw new Error('Twilio env vars no configuradas');
    }

    const client = twilio(accountSid, authToken);
    await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${phone}`,
      body: `Tu código para activar tu cuenta de vendedor en HeroClash: ${code}. Válido por 10 minutos.`,
    });
  }
}

export const whatsAppService = new WhatsAppService();
