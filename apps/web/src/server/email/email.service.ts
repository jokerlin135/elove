import type { Resend } from "resend";
import { render } from "@react-email/render";
import { WelcomeEmail } from "./templates/welcome";
import { RsvpReceivedEmail } from "./templates/rsvp-received";
import { TrialEndingEmail } from "./templates/trial-ending";
import { PaymentFailedEmail } from "./templates/payment-failed";
import { PaymentSucceededEmail } from "./templates/payment-succeeded";
import { ProjectPublishedEmail } from "./templates/project-published";
import { CustomDomainSetupEmail } from "./templates/custom-domain-setup";
import { AccountDeactivatedEmail } from "./templates/account-deactivated";

const EMAIL_CONFIGS = {
  welcome: { subject: "Chào mừng bạn đến với ELove! 🎉", template: WelcomeEmail },
  rsvp_received: { subject: "Khách mời mới xác nhận tham dự!", template: RsvpReceivedEmail },
  trial_ending: { subject: "Gói dùng thử còn {daysLeft} ngày", template: TrialEndingEmail },
  payment_failed: { subject: "Thanh toán thất bại — Vui lòng cập nhật", template: PaymentFailedEmail },
  payment_succeeded: { subject: "Thanh toán thành công", template: PaymentSucceededEmail },
  project_published: { subject: "Thiệp cưới đã được phát hành!", template: ProjectPublishedEmail },
  custom_domain_setup: { subject: "Hướng dẫn cài đặt tên miền", template: CustomDomainSetupEmail },
  account_deactivated: { subject: "Tài khoản đã bị vô hiệu hóa", template: AccountDeactivatedEmail },
} as const;

type EmailType = keyof typeof EMAIL_CONFIGS;

const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 1000;

export class EmailService {
  constructor(private resend: Resend) {}

  async send(type: EmailType, { to, data }: { to: string; data: Record<string, unknown> }) {
    const config = EMAIL_CONFIGS[type];
    const html = await render(config.template(data as any));
    const subject = config.subject.replace(/\{(\w+)\}/g, (_, k) => String(data[k] ?? ""));

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        await this.resend.emails.send({
          from: "ELove <no-reply@elove.me>",
          to,
          subject,
          html,
        });
        return;
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRY_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, BASE_RETRY_DELAY_MS * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError;
  }
}
