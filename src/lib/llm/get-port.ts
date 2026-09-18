import Anthropic from "@anthropic-ai/sdk";
import { AnthropicLlmPort } from "./anthropic-port";
import type { LlmPort } from "./port";

let port: LlmPort | undefined;

export function getLlmPort(): LlmPort {
  if (!port) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY must be set");
    }
    port = new AnthropicLlmPort(new Anthropic());
  }
  return port;
}
