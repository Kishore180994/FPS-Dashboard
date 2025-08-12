// Gemini AI Service Module - Handles structuring data and communication with the Gemini API.

/**
 * Calls the Gemini API using an agentic, multi-turn loop.
 * This allows the model to "think, plan, and execute" by making multiple, sequential tool calls
 * until it has enough information to formulate a final answer.
 *
 * @param {string} apiKey The user's Gemini API key.
 * @param {Object} options The options for the API call.
 * @param {string} options.prompt The user's initial prompt and conversation context.
 * @param {Array<Object>} options.functions The list of available tools for the AI.
 * @param {Function} options.functionHandler The local function to execute tool calls.
 * @param {Function} options.onStream A callback function to handle incoming text chunks for the UI.
 * @param {Function} [options.onToolCall] Optional callback to announce a tool call to the UI.
 * @param {Function} [options.onThought] Optional callback to announce the AI's thought process.
 * @returns {Promise<string>} A promise that resolves with the full, final text from the AI.
 */
export async function callGeminiAPI(
  apiKey,
  { prompt, functions, functionHandler, onStream, onToolCall, onThought }
) {
  // Use a modern, capable model that is good with tool use and following instructions.
  const model = "gemini-2.5-flash";
  const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

  // Start the conversation history with the user's first message.
  const conversationHistory = [{ role: "user", parts: [{ text: prompt }] }];
  let turnCount = 0;
  const MAX_TURNS = 10; // Safety break to prevent infinite loops

  try {
    let fullFinalText = "";

    // This loop allows for multiple turns of tool calls.
    while (turnCount < MAX_TURNS) {
      turnCount++;
      const requestBody = {
        contents: conversationHistory,
        tools: [{ functionDeclarations: functions }],
      };

      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `API Error: ${response.status} - ${
            errorData.error?.message || "Unknown error"
          }`
        );
      }

      // Process the streamed response from the model.
      const { fullText, functionCall, thought } = await processStream(
        response,
        onStream
      );
      fullFinalText = fullText;

      if (thought && onThought) {
        onThought(thought);
      }

      // If the model returned a function call, execute it.
      if (functionCall) {
        if (onToolCall) {
          onToolCall(functionCall);
        }

        conversationHistory.push({ role: "model", parts: [{ functionCall }] });
        const functionResult = await functionHandler(
          functionCall.name,
          functionCall.args
        );

        conversationHistory.push({
          role: "tool",
          parts: [
            {
              functionResponse: {
                name: functionCall.name,
                response: { result: functionResult },
              },
            },
          ],
        });

        // Continue the loop to let the model process the tool's result.
      } else {
        // If there's no function call, the model is providing the final answer. Break the loop.
        break;
      }
    }

    return fullFinalText;
  } catch (error) {
    console.error("Error in callGeminiAPI:", error);
    onStream(`\n\n**An error occurred:** ${error.message}`);
    throw error;
  }
}

/**
 * **UPDATED:** Helper function to process a ReadableStream from the Gemini API.
 * Now parses "Thought:" lines and separates them from the main text stream.
 * @returns {Promise<{fullText: string, functionCall: Object|null, thought: string|null}>}
 */
async function processStream(response, onStream) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let functionCall = null;
  let thought = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let continueProcessing = true;
    while (continueProcessing) {
      const result = findAndParseFirstJsonObject(buffer);

      if (result && result.jsonObject) {
        const { jsonObject, remainingBuffer } = result;

        if (jsonObject.candidates?.[0]?.content?.parts?.[0]) {
          const part = jsonObject.candidates[0].content.parts[0];

          if (part.text) {
            // **NEW LOGIC:** Check if the text is a thought or part of the final answer.
            const thoughtMatch = part.text.match(/Thought:\s*(.*)/);
            if (thoughtMatch && thoughtMatch[1]) {
              thought = thoughtMatch[1].trim();
            } else {
              // It's part of the final answer, so stream it to the UI.
              fullText += part.text;
              if (onStream) {
                onStream(part.text);
              }
            }
          } else if (part.functionCall) {
            functionCall = part.functionCall;
          }
        }

        buffer = remainingBuffer;
        continueProcessing = buffer.includes("{");
      } else {
        continueProcessing = false;
      }
    }
  }

  return { fullText, functionCall, thought };
}

/**
 * Finds the first complete JSON object in a string buffer by tracking curly braces.
 * @param {string} buffer The string buffer to search.
 * @returns {{jsonObject: Object, remainingBuffer: string}|null}
 */
function findAndParseFirstJsonObject(buffer) {
  const startIndex = buffer.indexOf("{");
  if (startIndex === -1) return null;

  let braceCount = 0;
  let endIndex = -1;
  for (let i = startIndex; i < buffer.length; i++) {
    if (buffer[i] === "{") braceCount++;
    else if (buffer[i] === "}") braceCount--;
    if (braceCount === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) return null;

  const objectString = buffer.substring(startIndex, endIndex + 1);
  const remainingBuffer = buffer.substring(endIndex + 1);

  try {
    const jsonObject = JSON.parse(objectString);
    return { jsonObject, remainingBuffer };
  } catch (e) {
    console.warn(
      "Could not parse a malformed JSON object from stream:",
      objectString
    );
    return { jsonObject: null, remainingBuffer };
  }
}
