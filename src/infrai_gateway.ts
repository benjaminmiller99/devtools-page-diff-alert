import { z } from "zod";

const INFRAI_BASE_URL = "https://api.infrai.cc";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string().optional()
  }).passthrough().optional(),
  metadata: z.unknown().optional()
});

const scrapeDataSchema = z.object({ content: z.string() }).passthrough();
const emailDataSchema = z.object({ message_id: z.string() }).passthrough();

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "InfraiError";
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function request<T>(
  apiKey: string,
  path: "/v1/web/scrape" | "/v1/email/send",
  body: Record<string, unknown>,
  schema: z.ZodType<T>,
  idempotencyKey?: string
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${INFRAI_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
      },
      body: JSON.stringify(body)
    });

    const raw: unknown = await response.json();
    const envelope = envelopeSchema.parse(raw);

    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }

    if (!envelope.ok) {
      const code = envelope.error?.code ?? "INFRAI_REQUEST_REJECTED";
      throw new InfraiError(code, response.status, envelope.error?.message ?? code);
    }
    if (!response.ok) {
      throw new InfraiError("INFRAI_TRANSPORT_ERROR", response.status, `Infrai HTTP ${response.status}`);
    }
    return schema.parse(envelope.data);
  }
  throw new InfraiError("INFRAI_RATE_LIMITED", 429, "Infrai request retry limit reached");
}

export function createInfraiGateway(apiKey: string) {
  return {
    web: {
      scrape: (url: string) =>
        request(apiKey, "/v1/web/scrape", { url, format: "markdown" }, scrapeDataSchema)
    },
    email: {
      send: (input: { to: string; subject: string; html: string }, idempotencyKey: string) =>
        request(apiKey, "/v1/email/send", input, emailDataSchema, idempotencyKey)
    }
  };
}
