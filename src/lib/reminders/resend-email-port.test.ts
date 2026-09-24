import { describe, expect, it } from "vitest";
import { ResendEmailPort } from "./resend-email-port";

function recordingFetch(response: Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return response;
  };
  return { calls, fetchImpl: fetchImpl as typeof fetch };
}

const CONFIG = {
  apiKey: "re_test_key",
  from: "Study Drills <reminders@example.com>",
  to: "me@example.com",
};

describe("ResendEmailPort", () => {
  it("posts the email to Resend from and to the configured addresses", async () => {
    const { calls, fetchImpl } = recordingFetch(Response.json({ id: "email-1" }));
    const port = new ResendEmailPort(CONFIG, fetchImpl);

    await port.send({ subject: "2 Concepts due", text: "Go study", idempotencyKey: "day-1" });

    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer re_test_key");
    expect(headers.get("idempotency-key")).toBe("day-1");
    expect(JSON.parse(String(init.body))).toEqual({
      from: CONFIG.from,
      to: [CONFIG.to],
      subject: "2 Concepts due",
      text: "Go study",
    });
  });

  it("sends no idempotency key when the email has none", async () => {
    const { calls, fetchImpl } = recordingFetch(Response.json({ id: "email-1" }));
    const port = new ResendEmailPort(CONFIG, fetchImpl);

    await port.send({ subject: "s", text: "t" });

    expect(new Headers(calls[0].init.headers).has("idempotency-key")).toBe(false);
  });

  it("throws when Resend rejects the email", async () => {
    const { fetchImpl } = recordingFetch(
      Response.json({ message: "Invalid `from` field" }, { status: 422 }),
    );
    const port = new ResendEmailPort(CONFIG, fetchImpl);

    await expect(port.send({ subject: "s", text: "t" })).rejects.toThrow(/422/);
  });
});
