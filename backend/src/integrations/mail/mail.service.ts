import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { Errors } from '../../common/errors';

export interface OutgoingMail { to: string; subject: string; text: string; html: string }

/**
 * Sends transactional email over SMTP (SMTP_* + MAIL_FROM in backend/.env).
 * Not configured → callers get 503 EMAIL_NOT_CONFIGURED. A failed delivery → 502 EMAIL_DELIVERY_FAILED.
 * Nothing is ever reported as sent unless the SMTP server accepted it.
 */
@Injectable()
export class MailService {
  private transporter: Transporter | null = null;
  private readonly log = new Logger('Mail');
  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {}

  get configured() { return this.cfg.mail.configured; }

  assertConfigured() {
    if (!this.configured) throw Errors.unavailable('EMAIL_NOT_CONFIGURED', 'Password reset emails are not set up on this server yet, so no email can be sent. (Server admin: set SMTP_HOST and MAIL_FROM in backend/.env.)');
  }

  async send(mail: OutgoingMail): Promise<void> {
    this.assertConfigured();
    const m = this.cfg.mail;
    this.transporter ??= createTransport({ host: m.host, port: m.port, secure: m.secure, auth: m.user ? { user: m.user, pass: m.password } : undefined });
    try {
      await this.transporter.sendMail({ from: m.from, ...mail });
    } catch (e) {
      this.log.error(`SMTP delivery failed: ${(e as Error).message}`);
      throw Errors.badGateway('EMAIL_DELIVERY_FAILED', "We couldn't send the email right now. Please try again in a few minutes.");
    }
  }
}
