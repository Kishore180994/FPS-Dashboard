// Chatbot UI Module - Handles the user interface for the FPS Dashboard chatbot section.

import { chatbotService } from "./chatbot-service.js";
import * as UIManager from "./ui-manager.js";

/**
 * Manages all DOM manipulation and user interaction for the chatbot interface.
 * It is responsible for displaying user messages, AI "thinking" steps, and the final streamed response.
 */
export class ChatbotUI {
  constructor() {
    this.isActive = false;
    this.messageContainer = null;
    this.inputField = null;
    this.sendButton = null;
  }

  initialize() {
    this.setupElementReferences();
    this.setupEventListeners();
    this.loadConversationHistory();
    console.log("Chatbot UI initialized successfully");
  }

  setupElementReferences() {
    this.messageContainer = document.getElementById("chatMessages");
    this.inputField = document.getElementById("chatInput");
    this.sendButton = document.getElementById("sendBtn");
  }

  setupEventListeners() {
    this.sendButton.addEventListener("click", () => this.sendMessage());
    this.inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.inputField.addEventListener("input", () => this.autoResizeTextarea());
    document
      .getElementById("newChatBtn")
      ?.addEventListener("click", () => this.startNewChat());
  }

  async sendMessage() {
    const message = this.inputField.value.trim();
    if (!message) return;

    this.setInputState(false);
    this.addMessage("user", message);
    this.inputField.value = "";
    this.autoResizeTextarea();

    try {
      await chatbotService.processMessage(message);
    } catch (error) {
      console.error("Critical error during message processing:", error);
      this.addMessage(
        "assistant",
        "A critical error occurred. Please see the console for details.",
        { isError: true }
      );
    }
    this.setInputState(true);
  }

  // ========== UI RENDERING METHODS ==========

  addMessage(type, content, options = {}) {
    const messageDiv = this.createMessageContainer(type, options.isError);
    const messageText = messageDiv.querySelector(".message-text");
    messageText.innerHTML = this.formatAIResponse(content);
    this.addTimestamp(messageText.parentElement);
    this.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  /**
   * **NEW:** Creates the main container for the entire thinking process.
   * This is called once at the beginning of the AI's turn.
   * @returns {HTMLElement} The main thinking block element.
   */
  createThinkingBlock() {
    const messageDiv = this.createMessageContainer("assistant");
    const contentDiv = messageDiv.querySelector(".message-content");
    contentDiv.innerHTML = `
      <div class="thinking-process">
        <div class="thinking-header">
          <span class="spinner"></span>
          <span class="thinking-status">Thinking...</span>
        </div>
        <div class="thinking-steps"></div>
      </div>
    `;
    this.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
    return messageDiv.querySelector(".thinking-process");
  }

  /**
   * **NEW:** Updates the main status text of the thinking block.
   * Used to show the AI's high-level thought process.
   * @param {HTMLElement} thinkingBlock - The container from createThinkingBlock.
   * @param {string} thought - The thought process text from the AI.
   */
  updateThinkingHeader(thinkingBlock, thought) {
    if (!thinkingBlock) return;
    const statusEl = thinkingBlock.querySelector(".thinking-status");
    if (statusEl) {
      statusEl.textContent = thought;
    }
  }

  /**
   * **NEW:** Adds a collapsible "tool use" step to the thinking block.
   * @param {HTMLElement} thinkingBlock - The container from createThinkingBlock.
   * @param {object} toolCall - The function call object from the Gemini API.
   */
  addStepToThinkingBlock(thinkingBlock, toolCall) {
    if (!thinkingBlock) return;
    const stepsContainer = thinkingBlock.querySelector(".thinking-steps");
    if (!stepsContainer) return;

    const details = document.createElement("details");
    details.className = "thinking-step";

    const summary = document.createElement("summary");
    summary.innerHTML = `Tool: <strong>${toolCall.name}</strong>`;

    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(toolCall.args, null, 2);

    details.appendChild(summary);
    details.appendChild(pre);
    stepsContainer.appendChild(details);
    this.scrollToBottom();
  }

  /**
   * **NEW:** Finalizes the thinking block, changing the icon to success/failure.
   * @param {HTMLElement} thinkingBlock - The container from createThinkingBlock.
   * @param {boolean} success - Whether the overall process was successful.
   */
  finalizeThinkingBlock(thinkingBlock, success) {
    if (!thinkingBlock) return;
    const headerEl = thinkingBlock.querySelector(".thinking-header");
    if (headerEl) {
      headerEl.querySelector(".spinner")?.remove();
      const icon = success ? "✅" : "❌";
      headerEl.insertAdjacentHTML(
        "afterbegin",
        `<span class="final-icon">${icon}</span>`
      );
    }
  }

  /**
   * **IMPROVED:** Adds a "Thinking..." block to the UI when the AI decides to use a tool.
   * This provides transparency into the agent's reasoning process.
   * @param {object} toolCall - The function call object from the Gemini API.
   */
  addThinkingStep(toolCall) {
    const details = document.createElement("details");
    details.className = "thinking-step";

    const summary = document.createElement("summary");

    // Create a more informative thinking message based on the function being called
    let thinkingMessage = "Thinking...";
    if (toolCall.name === "get_performance_data") {
      const args = toolCall.args || {};
      if (args.filters && args.filters.socManufacturer) {
        thinkingMessage = `Analyzing performance data for ${args.filters.socManufacturer} devices`;
      } else if (args.groupBy) {
        thinkingMessage = `Summarizing performance data grouped by ${args.groupBy}`;
      } else {
        thinkingMessage = "Querying performance database";
      }
    }

    summary.innerHTML = `▶ ${thinkingMessage}`;

    const pre = document.createElement("pre");
    pre.style.fontSize = "12px";
    pre.style.color = "#666";
    pre.style.marginTop = "8px";

    // Show a cleaner version of the parameters
    const cleanArgs = { ...toolCall.args };
    if (cleanArgs.filters && Object.keys(cleanArgs.filters).length === 0) {
      delete cleanArgs.filters;
    }
    pre.textContent = JSON.stringify(cleanArgs, null, 2);

    details.appendChild(summary);
    details.appendChild(pre);

    const messageDiv = this.createMessageContainer("assistant");
    const contentDiv = messageDiv.querySelector(".message-content");
    // Clear any default text and append the thinking step
    contentDiv.innerHTML = "";
    contentDiv.appendChild(details);

    this.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
  }

  createStreamContainer() {
    const messageDiv = this.createMessageContainer("assistant");
    const messageText = messageDiv.querySelector(".message-text");
    messageText.innerHTML = '<span class="typing-cursor"></span>';
    this.messageContainer.appendChild(messageDiv);
    this.scrollToBottom();
    return messageText;
  }

  appendStreamChunk(element, chunk) {
    if (!element) return;
    const cursor = element.querySelector(".typing-cursor");
    if (cursor) cursor.remove();
    element.innerHTML += chunk;
    this.scrollToBottom();
  }

  finalizeStream(element) {
    if (!element) return;
    const cursor = element.querySelector(".typing-cursor");
    if (cursor) cursor.remove();
    if (element.innerHTML.trim() === "") {
      // If the stream is empty, it means the agent only used tools without a final text response.
      // We can remove the empty stream container.
      element.closest(".message.assistant-message")?.remove();
    } else {
      element.innerHTML = this.formatAIResponse(element.innerHTML);
      this.addTimestamp(element.parentElement);
    }
  }

  // ========== HELPER AND UTILITY METHODS ==========

  createMessageContainer(type, isError = false) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${type}-message`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = type === "user" ? "👤" : "🤖";

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    const messageText = document.createElement("div");
    messageText.className = "message-text";
    if (isError) messageText.classList.add("error-message");

    messageContent.appendChild(messageText);
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    return messageDiv;
  }

  addTimestamp(messageContentEl) {
    if (!messageContentEl) return;
    const oldTimestamp = messageContentEl.querySelector(".message-timestamp");
    if (oldTimestamp) oldTimestamp.remove();

    const timestamp = document.createElement("div");
    timestamp.className = "message-timestamp";
    timestamp.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    messageContentEl.appendChild(timestamp);
  }

  formatAIResponse(content) {
    let html = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = html
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
    html = html.replace(
      /```([\s\S]*?)```/g,
      (_match, code) => `<pre><code>${code.trim()}</code></pre>`
    );
    html = html.replace(/`(.*?)`/g, "<code>$1</code>");
    html = html
      .replace(/^\s*\n\*/gm, "<ul>\n*")
      .replace(/^(\*.+)\s*\n([^*])/gm, "$1\n</ul>\n$2")
      .replace(/^\s*\*\s(.+)/gm, "<li>$1</li>");
    html = html.replace(
      /\|(.+)\|\n\|([\- |]+)\|\n((?:\|.*\|\n?)*)/g,
      (match, header, _separator, body) => {
        const headerCells = header
          .split("|")
          .map((h) => h.trim())
          .filter(Boolean);
        const headerRow = `<tr>${headerCells
          .map((h) => `<th>${h}</th>`)
          .join("")}</tr>`;
        const bodyRows = body
          .trim()
          .split("\n")
          .map((row) => {
            const rowCells = row
              .split("|")
              .map((c) => c.trim())
              .filter(Boolean);
            return `<tr>${rowCells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
          })
          .join("");
        return `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>`;
      }
    );
    return html.replace(/\n/g, "<br>");
  }

  setInputState(enabled) {
    this.inputField.disabled = !enabled;
    this.sendButton.disabled = !enabled || !this.inputField.value.trim();
    if (enabled) this.inputField.focus();
  }

  autoResizeTextarea() {
    this.inputField.style.height = "auto";
    this.inputField.style.height = `${Math.min(
      this.inputField.scrollHeight,
      120
    )}px`;
    this.setInputState(true);
  }

  scrollToBottom() {
    this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
  }

  startNewChat() {
    if (
      this.messageContainer.innerHTML === "" ||
      confirm("Start a new chat? This will clear the current conversation.")
    ) {
      this.messageContainer.innerHTML = "";
      if (chatbotService) chatbotService.clearConversation();
      this.inputField.value = "";
      this.setInputState(true);
      UIManager.showToast("New chat started.", "success");
    }
  }

  loadConversationHistory() {
    if (!chatbotService) return;
    const history = chatbotService.getConversationHistory();
    this.messageContainer.innerHTML = "";
    history.forEach((message) => {
      const content = message.parts[0].text || "Tool call executed";
      this.addMessage(message.role === "model" ? "assistant" : "user", content);
    });
  }

  activate() {
    this.isActive = true;
    setTimeout(() => {
      if (this.inputField) this.inputField.focus();
    }, 150);
  }

  deactivate() {
    this.isActive = false;
  }
}

export let chatbotUI = null;
export function initializeChatbotUI() {
  if (!chatbotUI) {
    chatbotUI = new ChatbotUI();
    chatbotUI.initialize();
    window.chatbotUI = chatbotUI;
  }
  return chatbotUI;
}
