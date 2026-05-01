// ═══════════════════════════════════════════════════════════
// ACP (Agent Chat Protocol) Implementation Guide
// 
// Official Fetch.ai ACP Documentation:
// https://innovationlab.fetch.ai/resources/docs/agent-communication/agent-chat-protocol
//
// This file provides the complete implementation pattern for
// multi-agent messaging using the official ACP protocol.
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// SECTION 1: ACP Protocol Installation & Imports
// ═══════════════════════════════════════════════════════════

/*
 * INSTALLATION STEPS:
 * -------------------
 * 
 * Option 1: Install via npm (when package is published)
 *   npm install @uagents/core
 *
 * Option 2: Install from GitHub repository
 *   npm install git+https://github.com/fetch-ai/uAgents.git
 *
 * Option 3: Install using pip (Python version)
 *   pip install uagents
 */

import { 
  Protocol 
} from "uagents"; // or appropriate import based on installation

/*
 * CORRECT ACP IMPORT PATH (as per official docs):
 * 
 * import { 
 *   chat_protocol_spec,
 *   ChatMessage, 
 *   ChatAcknowledgement, 
 *   TextContent 
 * } from "uagents_core.contrib.protocols.chat";
 * 
 * OR depending on version:
 * 
 * import { chat_protocol_spec } from "@uagents/protocols/chat";
 * import { 
 *   ChatMessage, 
 *   ChatAcknowledgement, 
 *   TextContent 
 * } from "@uagents/protocols/chat";
 */

// ═══════════════════════════════════════════════════════════
// SECTION 2: ACP Message Type Definitions
// ═══════════════════════════════════════════════════════════

/**
 * ChatMessage - The primary message type for agent chat
 * 
 * As documented in ACP spec:
 * - session_id: Unique identifier for the conversation session
 * - sender: Address of the sending agent
 * - target: Address of the receiving agent  
 * - content: The message content (TextContent or other content types)
 * - timestamp: Unix timestamp of when the message was created
 */
export interface ChatMessage {
  session_id: string;
  sender: string;
  target: string;
  content: TextContent;
  timestamp: number;
}

/**
 * ChatAcknowledgement - Acknowledgment of a received ChatMessage
 * 
 * As per ACP flow:
 * - MUST be sent immediately upon receiving a ChatMessage
 * - Allows sender to know their message was received
 * - Contains the session_id of the acknowledged message
 */
export interface ChatAcknowledgement {
  session_id: string;
  sender: string;
  target: string;
  acknowledged_message_id: string;
  timestamp: number;
}

/**
 * TextContent - Text-based message content
 * 
 * Content types per ACP spec:
 * - text/plain: Plain text
 * - text/markdown: Markdown formatted text
 * - application/json: JSON data
 */
export interface TextContent {
  text: string;
  content_type?: "text/plain" | "text/markdown" | "application/json";
}

// ═══════════════════════════════════════════════════════════
// SECTION 3: Complete ACP Flow Implementation
// ═══════════════════════════════════════════════════════════

/**
 * ACPFlow - Implements the full ACP messaging pattern
 * 
 * FLOW (as per official documentation):
 * 1. Agent A sends ChatMessage to Agent B
 * 2. Agent B receives ChatMessage
 * 3. Agent B sends ChatAcknowledgement to Agent A (immediately)
 * 4. Agent B processes the message
 * 5. [Optional] Agent B sends ChatMessage reply to Agent A
 * 
 * CRITICAL: Acknowledgement MUST be sent before processing/reply
 */
export class ACPFlow {
  private readonly agentAddress: string;
  private readonly agentName: string;
  
  constructor(address: string, name: string) {
    this.agentAddress = address;
    this.agentName = name;
  }

  /**
   * STEP 3: Handle Incoming ChatMessage
   * 
   * This is the entry point for all incoming chat messages
   */
  async handleIncomingChatMessage(message: ChatMessage): Promise<void> {
    console.log(`[${this.agentName}] =========================================`);
    console.log(`[${this.agentName}] Received ChatMessage`);
    console.log(`[${this.agentName}] From: ${message.sender}`);
    console.log(`[${this.agentName}] Session: ${message.session_id}`);
    console.log(`[${this.agentName}] Content: ${message.content.text}`);
    console.log(`[${this.agentName}] =========================================`);

    // ─────────────────────────────────────────────────────────
    // STEP 4: Send ChatAcknowledgement IMMEDIATELY
    // ─────────────────────────────────────────────────────────
    // CRITICAL: This MUST happen before any processing or reply
    await this.sendChatAcknowledgement(message);

    // ─────────────────────────────────────────────────────────
    // STEP 5: Process the message (business logic here)
    // ─────────────────────────────────────────────────────────
    const processingResult = await this.processChatMessage(message);

    // ─────────────────────────────────────────────────────────
    // STEP 6: [Optional] Send ChatMessage reply
    // ─────────────────────────────────────────────────────────
    if (processingResult.shouldReply) {
      await this.sendChatMessageReply(message, processingResult.replyText);
    }
  }

  /**
   * STEP 4: Send ChatAcknowledgement
   * 
   * ACKNOWLEDGEMENT FLOW (per ACP spec):
   * - Must be sent immediately upon receiving ChatMessage
   * - Confirms message receipt to sender
   * - Contains session_id of the message being acknowledged
   * - Enables reliable delivery tracking
   */
  private async sendChatAcknowledgement(originalMessage: ChatMessage): Promise<void> {
    const acknowledgement: ChatAcknowledgement = {
      session_id: originalMessage.session_id,
      sender: this.agentAddress,
      target: originalMessage.sender,
      acknowledged_message_id: originalMessage.session_id,
      timestamp: Date.now(),
    };

    console.log(`[${this.agentName}] --- Sending ChatAcknowledgement ---`);
    console.log(`[${this.agentName}] To: ${acknowledgement.target}`);
    console.log(`[${this.agentName}] Acknowledging: ${acknowledgement.acknowledged_message_id}`);
    console.log(`[${this.agentName}] Timestamp: ${acknowledgement.timestamp}`);
    console.log(`[${this.agentName}] -----------------------------------`);

    /*
     * REAL UAGENTS IMPLEMENTATION:
     * 
     * await this.agent.send(
     *   originalMessage.sender,
     *   ChatAcknowledgement.encode(acknowledgement),
     *   protocol=chat_protocol_spec.digest
     * );
     */
  }

  /**
   * STEP 5: Process the ChatMessage
   * 
   * This contains the business logic specific to each agent
   * Override this method in subclasses
   */
  protected async processChatMessage(message: ChatMessage): Promise<{
    shouldReply: boolean;
    replyText: string;
  }> {
    // Default implementation - override in subclasses
    return {
      shouldReply: false,
      replyText: "",
    };
  }

  /**
   * STEP 6: Send ChatMessage Reply
   * 
   * Reply follows the same ChatMessage format
   * Uses related session_id for conversation tracking
   */
  protected async sendChatMessageReply(
    originalMessage: ChatMessage,
    replyText: string
  ): Promise<void> {
    const reply: ChatMessage = {
      // Related session_id for conversation thread
      session_id: `${originalMessage.session_id}-reply-${Date.now()}`,
      sender: this.agentAddress,
      target: originalMessage.sender,
      content: {
        text: replyText,
        content_type: "text/plain",
      },
      timestamp: Date.now(),
    };

    console.log(`[${this.agentName}] --- Sending ChatMessage Reply ---`);
    console.log(`[${this.agentName}] To: ${reply.target}`);
    console.log(`[${this.agentName}] Session: ${reply.session_id}`);
    console.log(`[${this.agentName}] Content: ${reply.content.text}`);
    console.log(`[${this.agentName}] -----------------------------------`);

    /*
     * REAL UAGENTS IMPLEMENTATION:
     * 
     * await this.agent.send(
     *   originalMessage.sender,
     *   ChatMessage.encode(reply),
     *   protocol=chat_protocol_spec.digest
     * );
     */
  }

  /**
   * Helper: Send a new ChatMessage (initiate conversation)
   */
  async sendChatMessageRequest(
    targetAddress: string,
    text: string
  ): Promise<string> {
    const session_id = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const message: ChatMessage = {
      session_id,
      sender: this.agentAddress,
      target: targetAddress,
      content: {
        text,
        content_type: "text/plain",
      },
      timestamp: Date.now(),
    };

    console.log(`[${this.agentName}] --- Sending ChatMessage Request ---`);
    console.log(`[${this.agentName}] To: ${message.target}`);
    console.log(`[${this.agentName}] Session: ${message.session_id}`);
    console.log(`[${this.agentName}] Content: ${message.content.text}`);
    console.log(`[${this.agentName}] --------------------------------------`);

    /*
     * REAL UAGENTS IMPLEMENTATION:
     * 
     * await this.agent.send(
     *   targetAddress,
     *   ChatMessage.encode(message),
     *   protocol=chat_protocol_spec.digest
     * );
     */

    return session_id;
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 4: Specific Agent Implementations with ACP
// ═══════════════════════════════════════════════════════════

import { MerchantAgent, MerchantVerifyInput, MerchantVerifyOutput } from "./merchant.agent";
import { FraudAgent, FraudInput, FraudOutput } from "./fraud.agent";
import { RewardAgent, RewardInput, RewardOutput } from "./reward.agent";
import { GrowthAgent, GrowthInput, GrowthOutput } from "./growth.agent";

/**
 * MerchantACPAgent - Wraps MerchantAgent with ACP messaging
 * 
 * TYPE DEFINITIONS:
 * - ChatMessage: Contains merchant verification request
 * - ChatAcknowledgement: Confirms receipt of verification request
 * - Reply ChatMessage: Contains verification results
 */
export class MerchantACPAgent extends ACPFlow {
  private readonly merchantAgent: MerchantAgent;

  constructor(address: string) {
    super(address, "MerchantACPAgent");
    this.merchantAgent = new MerchantAgent();
  }

  protected async processChatMessage(message: ChatMessage): Promise<{
    shouldReply: boolean;
    replyText: string;
  }> {
    // Parse merchant verification request from message
    const input = this.parseMerchantRequest(message.content.text);

    if (!input) {
      return {
        shouldReply: true,
        replyText: "❌ Invalid merchant verification request format",
      };
    }

    // Run the existing MerchantAgent logic
    const result = await this.merchantAgent.run(input);

    // Format response as ChatMessage content
    const replyText = this.formatMerchantResult(result);

    return {
      shouldReply: true,
      replyText,
    };
  }

  private parseMerchantRequest(text: string): MerchantVerifyInput | null {
    try {
      // Parse JSON or structured text from the message
      // Example format: JSON with wallet, name, location, category, stakeAmount
      const parsed = JSON.parse(text);
      
      if (
        parsed.wallet &&
        parsed.name &&
        parsed.location &&
        parsed.category &&
        typeof parsed.stakeAmount === "number"
      ) {
        return parsed as MerchantVerifyInput;
      }
      return null;
    } catch {
      return null;
    }
  }

  private formatMerchantResult(result: any): string {
    const { decision, confidence, reasoning } = result;
    
    return JSON.stringify({
      isLegit: decision.isLegit,
      riskScore: decision.riskScore,
      issues: decision.issues,
      confidence,
      reasoning,
    }, null, 2);
  }
}

/**
 * FraudACPAgent - Wraps FraudAgent with ACP messaging
 * 
 * FLOW:
 * 1. Receive ChatMessage with fraud check request
 * 2. Send ChatAcknowledgement immediately
 * 3. Run FraudAgent analysis
 * 4. Send reply with fraud assessment
 */
export class FraudACPAgent extends ACPFlow {
  private readonly fraudAgent: FraudAgent;

  constructor(address: string) {
    super(address, "FraudACPAgent");
    this.fraudAgent = new FraudAgent();
  }

  protected async processChatMessage(message: ChatMessage): Promise<{
    shouldReply: boolean;
    replyText: string;
  }> {
    // Parse fraud check request
    const input = this.parseFraudRequest(message.content.text);

    if (!input) {
      return {
        shouldReply: true,
        replyText: "❌ Invalid fraud check request format",
      };
    }

    // Run the existing FraudAgent logic
    const result = await this.fraudAgent.run(input);

    // Format response
    const replyText = this.formatFraudResult(result);

    return {
      shouldReply: true,
      replyText,
    };
  }

  private parseFraudRequest(text: string): FraudInput | null {
    try {
      const parsed = JSON.parse(text);
      
      if (
        parsed.wallet &&
        typeof parsed.lat === "number" &&
        typeof parsed.lng === "number" &&
        parsed.merchantId
      ) {
        return {
          wallet: parsed.wallet,
          lat: parsed.lat,
          lng: parsed.lng,
          prevLat: parsed.prevLat,
          prevLng: parsed.prevLng,
          timeDelta: parsed.timeDelta,
          gpsAccuracy: parsed.gpsAccuracy,
          recentClaims: parsed.recentClaims || 0,
          walletClaimsToday: parsed.walletClaimsToday || 0,
          merchantId: parsed.merchantId,
          accountAge: parsed.accountAge,
        } as FraudInput;
      }
      return null;
    } catch {
      return null;
    }
  }

  private formatFraudResult(result: any): string {
    const { decision, confidence, reasoning } = result;
    
    return JSON.stringify({
      score: decision.score,
      flags: decision.flags,
      allow: decision.allow,
      confidence,
      reasoning,
    }, null, 2);
  }
}

/**
 * RewardACPAgent - Wraps RewardAgent with ACP messaging
 */
export class RewardACPAgent extends ACPFlow {
  private readonly rewardAgent: RewardAgent;

  constructor(address: string) {
    super(address, "RewardACPAgent");
    this.rewardAgent = new RewardAgent();
  }

  protected async processChatMessage(message: ChatMessage): Promise<{
    shouldReply: boolean;
    replyText: string;
  }> {
    const input = this.parseRewardRequest(message.content.text);

    if (!input) {
      return {
        shouldReply: true,
        replyText: "❌ Invalid reward optimization request format",
      };
    }

    const result = await this.rewardAgent.run(input);
    const replyText = this.formatRewardResult(result);

    return {
      shouldReply: true,
      replyText,
    };
  }

  private parseRewardRequest(text: string): RewardInput | null {
    try {
      const parsed = JSON.parse(text);
      
      if (
        parsed.merchantId &&
        typeof parsed.currentTraffic === "number" &&
        typeof input.avgTraffic === "number"
      ) {
        return {
          merchantId: parsed.merchantId,
          currentTraffic: parsed.currentTraffic,
          avgTraffic: parsed.avgTraffic || 10,
          timeOfDay: parsed.timeOfDay ?? 12,
          dayOfWeek: parsed.dayOfWeek ?? 3,
          userLevel: parsed.userLevel ?? 1,
          merchantBalance: parsed.merchantBalance ?? 100,
        } as RewardInput;
      }
      return null;
    } catch {
      return null;
    }
  }

  private formatRewardResult(result: any): string {
    const { decision, confidence, reasoning } = result;
    
    return JSON.stringify({
      multiplier: decision.multiplier,
      adjustedAmount: decision.adjustedAmount,
      reasons: decision.reasons,
      confidence,
      reasoning,
    }, null, 2);
  }
}

/**
 * GrowthACPAgent - Wraps GrowthAgent with ACP messaging
 */
export class GrowthACPAgent extends ACPFlow {
  private readonly growthAgent: GrowthAgent;

  constructor(address: string) {
    super(address, "GrowthACPAgent");
    this.growthAgent = new GrowthAgent();
  }

  protected async processChatMessage(message: ChatMessage): Promise<{
    shouldReply: boolean;
    replyText: string;
  }> {
    const input = this.parseGrowthRequest(message.content.text);

    if (!input) {
      return {
        shouldReply: true,
        replyText: "❌ Invalid growth analysis request format",
      };
    }

    const result = await this.growthAgent.run(input);
    const replyText = this.formatGrowthResult(result);

    return {
      shouldReply: true,
      replyText,
    };
  }

  private parseGrowthRequest(text: string): GrowthInput | null {
    try {
      const parsed = JSON.parse(text);
      
      if (Array.isArray(parsed.merchants) && parsed.timeRange) {
        return {
          merchants: parsed.merchants,
          timeRange: parsed.timeRange,
        } as GrowthInput;
      }
      return null;
    } catch {
      return null;
    }
  }

  private formatGrowthResult(result: any): string {
    const { decision, confidence, reasoning } = result;
    
    return JSON.stringify({
      trending: decision.trending,
      underperforming: decision.underperforming,
      heatmapWeights: decision.heatmapWeights,
      confidence,
      reasoning,
    }, null, 2);
  }
}

// ═══════════════════════════════════════════════════════════
// SECTION 5: Complete uAgents Integration Template
// ═══════════════════════════════════════════════════════════

/**
 * REAL UAGENTS IMPLEMENTATION
 * 
 * Use this template when uAgents is properly installed
 * 
 * INSTALLATION REF:
 * https://github.com/fetch-ai/uAgents
 */

/*
import { Agent, Protocol, Context } from "uagents";
import { 
  chat_protocol_spec,
  ChatMessage, 
  ChatAcknowledgement, 
  TextContent 
} from "@uagents/protocols/chat";

// ─────────────────────────────────────────────────────────────────
// Create the chat protocol instance with chat_protocol_spec
// ─────────────────────────────────────────────────────────────────
const chatProtocol = new Protocol({
  spec: chat_protocol_spec,
  name: "chat-protocol",
});

// ─────────────────────────────────────────────────────────────────
// Merchant uAgent with ACP
// ─────────────────────────────────────────────────────────────────
const merchantAgent = new Agent({
  name: "MerchantACPAgent",
  port: 8001,
});

// Handler for incoming ChatMessage
merchantAgent.on(
  chatProtocol.on("chat_message", async (ctx: Context, sender: string, msg: ChatMessage) => {
    console.log(`[${merchantAgent.name}] Received ChatMessage from ${sender}`);
    console.log(`  Session: ${msg.session_id}`);
    console.log(`  Content: ${msg.content?.text}`);

    // STEP A: Send ChatAcknowledgement promptly (required by ACP)
    const acknowledgement: ChatAcknowledgement = {
      session_id: msg.session_id,
      sender: merchantAgent.address,
      target: sender,
      acknowledged_message_id: msg.session_id,
      timestamp: Date.now(),
    };

    await ctx.send(
      sender,
      ChatAcknowledgement.encode(acknowledgement),
      protocol=chat_protocol_spec.digest
    );
    console.log(`[${merchantAgent.name}] Sent ChatAcknowledgement`);

    // STEP B: Process the request using existing MerchantAgent
    const input = JSON.parse(msg.content?.text || "{}");
    const merchantLogic = new MerchantAgent();
    const result = await merchantLogic.run(input);

    // STEP C: Send follow-up ChatMessage with the result
    const reply: ChatMessage = {
      session_id: `${msg.session_id}-reply-${Date.now()}`,
      sender: merchantAgent.address,
      target: sender,
      content: {
        text: JSON.stringify(result.decision, null, 2),
        content_type: "application/json",
      },
      timestamp: Date.now(),
    };

    await ctx.send(
      sender,
      ChatMessage.encode(reply),
      protocol=chat_protocol_spec.digest
    );
    console.log(`[${merchantAgent.name}] Sent ChatMessage reply`);
  })
);

// Include the protocol with manifest publishing (CRITICAL per task requirements)
merchantAgent.include(chatProtocol, { publish_manifest: true });

// Start the agent
merchantAgent.start();

// ─────────────────────────────────────────────────────────────────
// Fraud uAgent with ACP
// ─────────────────────────────────────────────────────────────────
const fraudAgent = new Agent({
  name: "FraudACPAgent",
  port: 8002,
});

const fraudChatProtocol = new Protocol({
  spec: chat_protocol_spec,
  name: "chat-protocol",
});

fraudAgent.on(
  fraudChatProtocol.on("chat_message", async (ctx: Context, sender: string, msg: ChatMessage) => {
    console.log(`[${fraudAgent.name}] Received ChatMessage from ${sender}`);

    // Send acknowledgement promptly
    const acknowledgement: ChatAcknowledgement = {
      session_id: msg.session_id,
      sender: fraudAgent.address,
      target: sender,
      acknowledged_message_id: msg.session_id,
      timestamp: Date.now(),
    };

    await ctx.send(
      sender,
      ChatAcknowledgement.encode(acknowledgement),
      protocol=chat_protocol_spec.digest
    );
    console.log(`[${fraudAgent.name}] Sent ChatAcknowledgement`);

    // Process fraud check using existing FraudAgent
    const input = JSON.parse(msg.content?.text || "{}");
    const fraudLogic = new FraudAgent();
    const result = await fraudLogic.run(input);

    // Send reply
    const reply: ChatMessage = {
      session_id: `${msg.session_id}-reply-${Date.now()}`,
      sender: fraudAgent.address,
      target: sender,
      content: {
        text: JSON.stringify(result.decision, null, 2),
        content_type: "application/json",
      },
      timestamp: Date.now(),
    };

    await ctx.send(
      sender,
      ChatMessage.encode(reply),
      protocol=chat_protocol_spec.digest
    );
    console.log(`[${fraudAgent.name}] Sent fraud analysis result`);
  })
);

fraudAgent.include(fraudChatProtocol, { publish_manifest: true });
fraudAgent.start();

// ─────────────────────────────────────────────────────────────────
// Coordinator uAgent (orchestrates multi-agent workflows)
// ─────────────────────────────────────────────────────────────────
const coordinatorAgent = new Agent({
  name: "CoordinatorACPAgent",
  port: 8000,
});

const coordinatorChatProtocol = new Protocol({
  spec: chat_protocol_spec,
  name: "chat-protocol",
});

// Track pending multi-agent responses
const pendingResponses: Map<string, {
  expectedReplies: number;
  receivedReplies: ChatMessage[];
}> = new Map();

coordinatorAgent.on(
  coordinatorChatProtocol.on("chat_message", async (ctx: Context, sender: string, msg: ChatMessage) => {
    console.log(`[${coordinatorAgent.name}] Received ChatMessage from ${sender}`);

    // Send acknowledgement
    const acknowledgement: ChatAcknowledgement = {
      session_id: msg.session_id,
      sender: coordinatorAgent.address,
      target: sender,
      acknowledged_message_id: msg.session_id,
      timestamp: Date.now(),
    };

    await ctx.send(
      sender,
      ChatAcknowledgement.encode(acknowledgement),
      protocol=chat_protocol_spec.digest
    );
    console.log(`[${coordinatorAgent.name}] Sent ChatAcknowledgement`);

    // Track response for multi-agent coordination
    const baseSessionId = msg.session_id.split("-reply")[0];
    const tracking = pendingResponses.get(baseSessionId);

    if (tracking) {
      tracking.receivedReplies.push(msg);
      console.log(`  [TRACKING] Received ${tracking.receivedReplies.length}/${tracking.expectedReplies} responses`);

      // Check if all expected replies received
      if (tracking.receivedReplies.length >= tracking.expectedReplies) {
        await finalizeCoordination(baseSessionId);
      }
    }
  })
);

coordinatorAgent.include(coordinatorChatProtocol, { publish_manifest: true });
coordinatorAgent.start();

async function finalizeCoordination(sessionId: string): Promise<void> {
  const tracking = pendingResponses.get(sessionId);
  if (!tracking) return;

  console.log(`\n[Coordinator] ════════════════════════════════════════════`);
  console.log(`[Coordinator] COORDINATION COMPLETE - Session: ${sessionId}`);
  console.log(`[Coordinator] ════════════════════════════════════════════`);
  
  tracking.receivedReplies.forEach((reply, index) => {
    console.log(`\n  Agent ${index + 1} Response:`);
    console.log(`    From: ${reply.sender}`);
    console.log(`    Content: ${reply.content?.text?.substring(0, 100)}...`);
  });

  pendingResponses.delete(sessionId);
}
*/

// ═══════════════════════════════════════════════════════════
// SECTION 6: Usage Examples & Testing
// ═══════════════════════════════════════════════════════════

/**
 * Demo: Single Agent Interaction
 */
export async function demoSingleAgentInteraction(): Promise<void> {
  console.log("\n═════════════════════════════════════════════════════════");
  console.log("ACP Demo: Single Agent Interaction");
  console.log("═════════════════════════════════════════════════════════\n");

  const merchantAgent = new MerchantACPAgent("agent1qf7aggzxyk2lupazwdhcr4fgadmsu7x5y6xul9dl6qfxemj");
  
  const requestMessage: ChatMessage = {
    session_id: "session-001",
    sender: "coordinator-agent-address",
    target: merchantAgent["agentAddress"],
    content: {
      text: JSON.stringify({
        wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        name: "PokeMart Downtown",
        location: { lat: 40.7128, lng: -74.0060 },
        category: "retail",
        stakeAmount: 10.5
      }),
      content_type: "application/json"
    },
    timestamp: Date.now()
  };

  await merchantAgent.handleIncomingChatMessage(requestMessage);
}

/**
 * Demo: Multi-Agent Coordination
 */
export async function demoMultiAgentCoordination(): Promise<void> {
  console.log("\n═════════════════════════════════════════════════════════");
  console.log("ACP Demo: Multi-Agent Coordination");
  console.log("═════════════════════════════════════════════════════════\n");

  // Create agents
  const merchantAgent = new MerchantACPAgent("agent1qf7aggzxyk2lupazwdhcr4fgadmsu7x5y6xul9dl6qfxemj");
  const fraudAgent = new FraudACPAgent("agent1qf7aggzw4ukc7gsvfylpxcto72cgw7d0xv5kcnhxrfdpc8");
  const coordinator = new ACPFlow("agent1qf7aggzv8r4l0j8psqyqm5kt2g5h8l9s5r4j2h7lfzadwq", "Coordinator");

  // Coordinator initiates requests to both agents
  console.log("\n[Coordinator] Initiating multi-agent fraud check...\n");

  // Request to FraudAgent
  const fraudRequestSessionId = await coordinator.sendChatMessageRequest(
    fraudAgent["agentAddress"],
    JSON.stringify({
      wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      lat: 40.7128,
      lng: -74.0060,
      prevLat: 40.7118,
      prevLng: -74.0050,
      timeDelta: 300,
      gpsAccuracy: 10,
      recentClaims: 2,
      walletClaimsToday: 1,
      merchantId: "merchant-001"
    }, null, 2)
  );

  // Request to MerchantAgent
  const merchantRequestSessionId = await coordinator.sendChatMessageRequest(
    merchantAgent["agentAddress"],
    JSON.stringify({
      wallet: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      name: "PokeMart Downtown",
      location: { lat: 40.7128, lng: -74.0060 },
      category: "retail",
      stakeAmount: 10.5
    }, null, 2)
  );

  console.log("\n[Coordinator] Requests sent. Waiting for acknowledgements and replies...\n");

  // In a real scenario, the agents would process these and send replies
  // This demonstrates the ACP flow pattern
}

/**
 * Demo: ACP Message Flow Visualization
 */
export function visualizeACPFlow(): void {
  console.log("\n═════════════════════════════════════════════════════════");
  console.log("ACP Message Flow Visualization");
  console.log("═════════════════════════════════════════════════════════\n");

  console.log(`
  AGENT A                          AGENT B
  ────────────────────────────────────────────────────────────────
  
  1. [SEND] ChatMessage
     ────────────────────────────────────────────>
     + session_id: "session-123"
     + sender: agent1q...
     + target: agent1q...
     + content: { text: "Verify this merchant..." }
     + timestamp: 1713870000000
  
  2. [RECEIVE] ChatMessage
     ✅ Message received
  
  3. [SEND] ChatAcknowledgement (IMMEDIATE - per ACP spec)
     <────────────────────────────────────────────
     + session_id: "session-123"
     + sender: agent1q...
     + target: agent1q...
     + acknowledged_message_id: "session-123"
     + timestamp: 1713870000100
  
  4. [RECEIVE] ChatAcknowledgement
     ✅ Message receipt confirmed
  
  5. [PROCESS] Business Logic
     ⚙️  Running merchant verification...
     ⏱️  Analyzing risk factors...
     📊 Computing decision...
  
  6. [SEND] ChatMessage (Reply - Optional)
     <────────────────────────────────────────────
     + session_id: "session-123-reply-100"
     + sender: agent1q...
     + target: agent1q...
     + content: { text: "{ isLegit: true, riskScore: 15 }" }
     + timestamp: 1713870020000
  
  7. [RECEIVE] ChatMessage Reply
     ✅ Verification result received
  
  ────────────────────────────────────────────────────────────────
  
  KEY ACP REQUIREMENTS:
  ✓ ChatAcknowledgement MUST be sent immediately after receiving
  ✓ ChatAcknowledgement contains the session_id being acknowledged
  ✓ Optional reply uses related session_id for conversation tracking
  ✓ All messages include sender, target, and timestamp
  
  ════════════════════════════════════════════════════════════
  `);
}

// ═══════════════════════════════════════════════════════════
// SECTION 7: Summary & Best Practices
// ═══════════════════════════════════════════════════════════

/**
 * ACP Implementation Best Practices
 * 
 * 1. IMMEDIATE ACKNOWLEDGEMENT
 *    - Send ChatAcknowledgement before any processing
 *    - This ensures sender knows message was received
 *    - Required by ACP specification
 * 
 * 2. SESSION TRACKING
 *    - Use consistent session_id across conversation threads
 *    - Related replies use derived session_ids (e.g., "{session}-reply")
 *    - Enables conversation context and debugging
 * 
 * 3. PROTOCOL REGISTRATION
 *    - Use Protocol(spec=chat_protocol_spec)
 *    - Call include(..., publish_manifest=True) on each agent
 *    - Ensures protocol discovery and compatibility
 * 
 * 4. ERROR HANDLING
 *    - Acknowledge even for invalid messages
 *    - Send error details in reply ChatMessage
 *    - Always respond to enable flow completion
 * 
 * 5. INTEGRATION WITH EXISTING AGENTS
 *    - Wrap existing AI agents (MerchantAgent, FraudAgent, etc.)
 *    - Parse incoming JSON from ChatMessage content
 *    - Format results as JSON in reply ChatMessage
 * 
 * 6. MULTI-AGENT COORDINATION
 *    - Use ChatMessage to initiate parallel requests
 *    - Track pending acknowledgements and replies
 *    - Aggregate results when all agents respond
 */

export {
  type ChatMessage,
  type ChatAcknowledgement,
  type TextContent,
};