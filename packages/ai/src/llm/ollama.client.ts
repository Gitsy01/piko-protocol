import { OLLAMA_DEFAULT_MODEL } from "@depokemongo/common";
import { SYSTEM_PROMPTS } from "./prompts";

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export class OllamaClient {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_URL || "http://localhost:11434";
    this.model = model || process.env.OLLAMA_MODEL || OLLAMA_DEFAULT_MODEL;
  }

  async generate(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          system: systemPrompt || SYSTEM_PROMPTS.default,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = (await response.json()) as OllamaResponse;
      return data.response;
    } catch (error) {
      console.warn("Ollama unavailable, falling back to rule engine", error);
      return "";
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}
