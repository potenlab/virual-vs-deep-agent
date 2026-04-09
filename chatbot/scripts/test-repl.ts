/**
 * REPL Test Script for the DeepAgent chatbot.
 *
 * Usage:
 *   npx tsx scripts/test-repl.ts
 *
 * Sends a hardcoded test question, then enters an interactive readline loop
 * so you can carry on a multi-turn conversation with the agent.
 * Type "exit" to quit.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import * as readline from "node:readline";
import { createAgent, invokeAgent } from "../src/lib/agent/agent";
import type { Message } from "../src/types";

function makeMessage(
  role: "user" | "assistant",
  content: string
): Message {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };
}

async function main() {
  console.log("Creating agent...");
  const agent = await createAgent();
  console.log("Agent created.\n");

  // --- Hardcoded smoke test ---
  const testQuestion = "What is the capital of France?";
  const messages: Message[] = [makeMessage("user", testQuestion)];

  console.log(`[smoke-test] You: ${testQuestion}`);
  const testResult = await invokeAgent(agent, messages);
  console.log(`[smoke-test] Agent: ${testResult.content}`);
  console.log(`[tokens] ${testResult.tokenUsage.promptTokens} in | ${testResult.tokenUsage.completionTokens} out | ${testResult.tokenUsage.totalTokens} total\n`);

  messages.push(makeMessage("assistant", testResult.content));

  // --- Interactive REPL loop ---
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question("You: ", async (input: string) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === "exit") {
        console.log("Goodbye!");
        rl.close();
        process.exit(0);
      }

      if (!trimmed) {
        prompt();
        return;
      }

      messages.push(makeMessage("user", trimmed));

      try {
        const result = await invokeAgent(agent, messages);
        console.log(`Agent: ${result.content}`);
        console.log(`[tokens] ${result.tokenUsage.promptTokens} in | ${result.tokenUsage.completionTokens} out | ${result.tokenUsage.totalTokens} total\n`);
        messages.push(makeMessage("assistant", result.content));
      } catch (err) {
        console.error("Error invoking agent:", err);
      }

      prompt();
    });
  };

  console.log('Interactive mode — type your message or "exit" to quit.\n');
  prompt();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
