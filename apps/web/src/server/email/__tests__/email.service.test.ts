import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailService } from "../email.service";

vi.mock("@react-email/render", () => ({
  render: vi.fn().mockResolvedValue("<html><body>mocked email</body></html>"),
}));

describe("EmailService", () => {
  let mockResend: any;
  let service: EmailService;

  beforeEach(() => {
    mockResend = { emails: { send: vi.fn().mockResolvedValue({ id: "email-id" }) } };
    service = new EmailService(mockResend);
  });

  it("sends welcome email with correct data", async () => {
    await service.send("welcome", { to: "user@test.com", data: { userName: "Minh", loginUrl: "https://elove.me/login" } });
    expect(mockResend.emails.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@test.com", subject: expect.stringContaining("Chào mừng") })
    );
  });

  it("retries on failure up to 3 times", async () => {
    mockResend.emails.send
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ id: "ok" });
    await service.send("welcome", { to: "x@test.com", data: { userName: "X", loginUrl: "/" } });
    expect(mockResend.emails.send).toHaveBeenCalledTimes(3);
  });

  it("sends trial_ending email with Vietnamese content", async () => {
    await service.send("trial_ending", { to: "u@test.com", data: { userName: "Lan", daysLeft: 3, upgradeUrl: "/" } });
    const call = mockResend.emails.send.mock.calls[0][0];
    expect(call.subject).toMatch(/ngày/i); // Vietnamese word
  });
});
