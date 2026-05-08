import { OPENROUTER_DEFAULT_MODEL } from "@depokemongo/common";
import { SYSTEM_PROMPTS } from "./prompts";

interface OpenRouterContentPart {
  type?: string;
  text?: string;
}

interface OpenRouterResponse {
  choices?: Array<{
    message?: {
      content?: string | OpenRouterContentPart[];
    };
  }>;
  error?: {
    message?: string;
  };
}

export class OpenRouterClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly siteUrl?: string;
  private readonly siteName?: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    siteUrl?: string;
    siteName?: string;
  }) {
    this.apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY;
    this.baseUrl = options?.baseUrl || process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    this.model = options?.model || process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL;
    this.siteUrl = options?.siteUrl || process.env.OPENROUTER_SITE_URL;
    this.siteName = options?.siteName || process.env.OPENROUTER_SITE_NAME || "PIKO Protocol";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async generate(prompt: string, systemPrompt = SYSTEM_PROMPTS.default): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(this.siteUrl ? { "HTTP-Referer": this.siteUrl } : {}),
        ...(this.siteName ? { "X-OpenRouter-Title": this.siteName } : {}),
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = (await response.json()) as OpenRouterResponse;

    if (!response.ok) {
      throw new Error(data.error?.message || `OpenRouter error: ${response.status}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content === "string") {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => part.text || "")
        .join("")
        .trim();
    }

    throw new Error("OpenRouter returned an empty response");
  }
}

const defaultOpenRouterClient = new OpenRouterClient();

export async function callAI(prompt: string, systemPrompt?: string): Promise<string> {
  return defaultOpenRouterClient.generate(prompt, systemPrompt);
}
