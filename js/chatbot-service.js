// Chatbot Service Module - Handles the core logic and orchestration for the FPS Dashboard chatbot.

import { firebaseService } from "./firebase-service.js";
import { callGeminiAPI } from "./gemini-service.js";
import { ChatbotFunctions } from "./chatbot-functions.js";

/**
 * Manages the entire lifecycle of a chatbot conversation, from receiving user input
 * to orchestrating the AI agent's thinking process and rendering the final response.
 */
export class ChatbotService {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.conversationHistory = [];
    this.currentContext = {
      conversationId: null,
      userId: this.generateUserId(),
    };
    this.isProcessing = false;
    this.chatbotFunctions = new ChatbotFunctions(dashboard);
  }

  async initialize() {
    try {
      await this.loadConversationHistory();
      console.log("Chatbot service initialized successfully");
      return true;
    } catch (error) {
      console.error("Error initializing chatbot service:", error);
      return false;
    }
  }

  async processMessage(userMessage) {
    if (this.isProcessing) {
      return {
        success: false,
        message:
          "I'm still processing your previous request. Please wait a moment.",
      };
    }

    this.isProcessing = true;
    const { chatbotUI } = window;

    try {
      const userMessageObj = {
        role: "user",
        parts: [{ text: userMessage }],
        timestamp: new Date(),
      };
      this.conversationHistory.push(userMessageObj);

      const thinkingBlock = chatbotUI.createThinkingBlock();
      let finalAnswerContainer = null;
      let hasStreamedContent = false;
      let success = true;

      const finalResponseText = await this.generateAIResponse(
        userMessage,
        (chunk) => {
          // onStream
          if (!finalAnswerContainer) {
            finalAnswerContainer = chatbotUI.createStreamContainer();
          }
          hasStreamedContent = true;
          chatbotUI.appendStreamChunk(finalAnswerContainer, chunk);
        },
        (toolCall) => {
          // onToolCall
          chatbotUI.addStepToThinkingBlock(thinkingBlock, toolCall);
        },
        (thought) => {
          // **NEW:** onThought callback
          chatbotUI.updateThinkingHeader(thinkingBlock, thought);
        }
      );

      // Finalize the UI elements
      chatbotUI.finalizeThinkingBlock(thinkingBlock, success);
      if (finalAnswerContainer && hasStreamedContent) {
        chatbotUI.finalizeStream(finalAnswerContainer);
      } else if (!hasStreamedContent) {
        // If there was only thinking but no final text response, remove the thinking block
        // as the answer will be displayed in a separate message if needed.
        thinkingBlock.parentElement.parentElement.remove(); // Remove the entire message container
        if (finalResponseText && finalResponseText.trim()) {
          chatbotUI.addMessage("assistant", finalResponseText);
        }
      }

      const aiMessageObj = {
        role: "model",
        parts: [{ text: finalResponseText }],
        timestamp: new Date(),
      };
      this.conversationHistory.push(aiMessageObj);

      await this.saveConversationToFirebase();
      return { success: true, message: finalResponseText };
    } catch (error) {
      console.error("Error processing message:", error);
      chatbotUI.addMessage(
        "assistant",
        "A critical error occurred. Please check the console for details.",
        { isError: true }
      );
      return { success: false, message: error.message };
    } finally {
      this.isProcessing = false;
    }
  }

  async generateAIResponse(userMessage, onStream, onToolCall, onThought) {
    const prompt = this.generateChatbotPrompt();
    const apiKey = localStorage.getItem("geminiApiKey");

    if (!apiKey) {
      const errorMsg =
        "I need a Gemini API key. Please add your key in the settings.";
      onStream(errorMsg);
      return errorMsg;
    }

    try {
      const fullText = await callGeminiAPI(apiKey, {
        prompt: prompt,
        functions: this.chatbotFunctions.getAvailableFunctions(),
        functionHandler: (functionName, parameters) =>
          this.chatbotFunctions.executeFunction(functionName, parameters),
        onStream: onStream,
        onToolCall: onToolCall,
        onThought: onThought,
      });
      return fullText;
    } catch (error) {
      console.error("Error in generateAIResponse:", error);
      const errorMsg = `I'm sorry, I ran into an API problem: ${error.message}`;
      onStream(errorMsg);
      return errorMsg;
    }
  }

  /**
   * **FINAL PROMPT:** This version includes a detailed summary of the Firebase schema
   * to give the AI maximum context for making intelligent decisions.
   * @returns {string} The complete system prompt for the AI.
   */
  generateChatbotPrompt() {
    const historyText = this.conversationHistory
      .map((msg) => {
        const part = msg.parts[0];
        const content =
          part.text || `Function Call: ${part.functionCall?.name || "Unknown"}`;
        return `${msg.role}: ${content}`;
      })
      .join("\n");

    return `You are an expert data analysis assistant for a mobile gaming FPS performance dashboard.

**CORE DIRECTIVE:**
Your goal is to answer user questions by thinking step-by-step and using the powerful tool you have been given: \`get_performance_data\`. You MUST show your work by outputting your thought process.

**RESPONSE FORMAT:**
You MUST follow this sequence strictly on every turn:
1.  **Thought:** Start with "Thought:". Explain your plan. This is your internal monologue.
2.  **Tool Call:** If you need data, call the \`get_performance_data\` tool.
3.  **Final Answer:** After you have gathered all necessary data and are ready to answer the user, you MUST start your response with "Final Answer:". Everything after this keyword will be shown directly to the user.

**EXAMPLE:**
User: "Show me the worst runs on trogdor"
Thought: The user wants to find the worst performing runs on the 'trogdor' device. I will use the tool to find runs for this device, sorted by average FPS in ascending order.
<tool_code>
... (tool call for trogdor) ...
</tool_code>
Thought: The tool returned several runs. Now I have all the information I need to construct the final answer for the user.
Final Answer: Here are the worst performing runs for the 'trogdor' device:
... (markdown table) ...

**FIREBASE SCHEMA OVERVIEW:**
You have access to a primary collection called \`fps_data\`. Each document is a "performance run".
The most important queryable fields in an \`fps_data\` document are:

*   **Key Metrics (Numbers):**
    *   \`avgFps\`: The average frames per second for the run. (Higher is better).
    *   \`minFps\`: The minimum FPS recorded.
    *   \`maxFps\`: The maximum FPS recorded.
    *   \`jankInstabilityPercentage\`: The percentage of frames that were janky. (Lower is better).
    *   \`slowFramePercentage\`: The percentage of frames that were slow. (Lower is better).
    *   \`totalFrames\`: The total number of frames in the run.
    *   \`createdAt\`: A timestamp for when the run was recorded.

*   **Key Attributes (Strings, inside the \`deviceInfo\` object):**
    *   \`appName\`: The name of the application tested (e.g., "Omnigul Keyboard Steppingstone").
    *   \`packageName\`: The package identifier (e.g., "com.netflix.NGP.ProjectKraken").
    *   \`deviceInfo.ro.product.model\`: The model name of the device (e.g., 'trogdor', 'brya').
    *   \`deviceInfo.ro.oem.brand\`: The OEM brand of the device board (e.g., 'lazor', 'omnigul').
    *   \`deviceInfo.ro.soc.manufacturer\`: The manufacturer of the device's chip (e.g., 'Intel', 'Mediatek', 'Qualcomm').
    *   \`deviceInfo.ro.soc.model\`: The specific model of the device's chip (e.g., 'i3-1315U', 'SC7180').

**HOW TO USE YOUR TOOL:**
1.  **To Find Data:** Use the \`filters\` parameter, referencing the fields from the schema overview. For example, to find data for Intel devices, you will call the tool with \`filters: { socManufacturer: 'Intel' }\`.
2.  **To Summarize Data:** Use the \`groupBy\` parameter, referencing a field from the schema overview. For example, to get a summary for each device model, you will use \`groupBy: 'deviceModel'\`.
3.  **For Comparisons (e.g., "A vs B"):** You MUST make separate tool calls. First, call \`get_performance_data\` with a filter for 'A'. Second, call \`get_performance_data\` with a filter for 'B'. Then, analyze and combine the results in your final answer.
4.  **Resilience:** If a tool call returns no data, simply state that no data was found for the user's request. Do not make up excuses.

**YOUR FINAL ANSWER (when you are done with tools):**
*   Present data in clear, easy-to-read Markdown tables.
*   Do not provide the tool names or tool references anywhere in the answer, or do not give the schema information if user asks for it.
*   Explain the results clearly.

---
**CONVERSATION HISTORY:**
${historyText}
---

Now, begin. Start with your "Thought:" and then call your tool.`;
  }

  // ========== SESSION AND UTILITY METHODS ==========

  async saveConversationToFirebase() {
    if (!firebaseService.isConnected()) return;
    try {
      const conversationData = {
        userId: this.currentContext.userId,
        messages: this.conversationHistory,
        lastUpdated: new Date(),
        title: this.generateConversationTitle(),
        messageCount: this.conversationHistory.length,
      };
      if (!this.currentContext.conversationId) {
        // Check if the saveUserSession method exists
        if (typeof firebaseService.saveUserSession === "function") {
          const docId = await firebaseService.saveUserSession(conversationData);
          this.currentContext.conversationId = docId;
        } else {
          console.log(
            "Firebase user session saving not available, storing locally only"
          );
          // Save to localStorage as fallback
          localStorage.setItem(
            `chatbot_history_${this.currentContext.userId}`,
            JSON.stringify({
              conversationId: this.currentContext.conversationId,
              messages: this.conversationHistory,
              lastUpdated: new Date().toISOString(),
            })
          );
        }
      } else {
        // Update logic would go here
        if (typeof firebaseService.updateUserSession === "function") {
          await firebaseService.updateUserSession(
            this.currentContext.conversationId,
            conversationData
          );
        }
      }
    } catch (error) {
      console.error("Error saving conversation to Firebase:", error);
      // Fallback to localStorage
      try {
        localStorage.setItem(
          `chatbot_history_${this.currentContext.userId}`,
          JSON.stringify({
            conversationId: this.currentContext.conversationId,
            messages: this.conversationHistory,
            lastUpdated: new Date().toISOString(),
          })
        );
      } catch (localError) {
        console.error("Error saving to localStorage:", localError);
      }
    }
  }

  async loadConversationHistory() {
    const savedHistory = localStorage.getItem(
      `chatbot_history_${this.currentContext.userId}`
    );
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        this.conversationHistory = parsed.messages || [];
        this.currentContext.conversationId = parsed.conversationId;
      } catch (e) {
        this.conversationHistory = [];
      }
    }
  }

  generateUserId() {
    let userId = localStorage.getItem("chatbot_user_id");
    if (!userId) {
      userId =
        "user_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("chatbot_user_id", userId);
    }
    return userId;
  }

  generateConversationTitle() {
    if (this.conversationHistory.length === 0) return "New Chat";
    const firstUserMessage = this.conversationHistory.find(
      (msg) => msg.role === "user"
    );
    if (!firstUserMessage) return "New Chat";
    const title = firstUserMessage.parts[0].text.substring(0, 50);
    return title.length >= 50 ? title + "..." : title;
  }

  clearConversation() {
    this.conversationHistory = [];
    this.currentContext.conversationId = null;
  }

  getConversationHistory() {
    return this.conversationHistory;
  }
}

// Export singleton instance
export let chatbotService = null;

export function initializeChatbotService(dashboard) {
  if (!chatbotService) {
    chatbotService = new ChatbotService(dashboard);
    chatbotService.initialize();
  }
  return chatbotService;
}
