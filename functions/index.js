// functions/index.js

// UPDATED: Import the specific v2 function trigger instead of the whole library
const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const { initializeApp } = require("firebase-admin/app");
const { FieldValue } = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- Initialize Services ---
initializeApp();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * This Cloud Function triggers when a new document is created in the 'fps_data' collection.
 * It generates an AI summary of the run and updates the document with it.
 */
// UPDATED: Use the modern onDocumentCreated syntax
exports.generateRunSummaryOnCreate = onDocumentCreated(
  "fps_data/{runId}",
  async (event) => {
    // 1. Get the data from the event's snapshot
    const snap = event.data;
    if (!snap) {
      console.log("No data associated with the event. Exiting.");
      return;
    }
    const runData = snap.data();
    const runId = event.params.runId;

    // SAFETY CHECK: Prevent infinite loops.
    if (runData.ai_summary) {
      console.log(`Document ${runId} already has a summary. Exiting.`);
      return;
    }

    console.log(`Generating summary for new document: ${runId}`);

    try {
      // 2. Select key data points for a concise and effective prompt
      const keyData = {
        appName: runData.appName,
        deviceModel: runData.deviceInfo?.["ro.product.model"],
        socManufacturer: runData.deviceInfo?.["ro.soc.manufacturer"],
        avgFps: runData.avgFps,
        minFps: runData.minFps,
        jankInstabilityPercentage: runData.jankInstabilityPercentage,
        slowFramePercentage: runData.slowFramePercentage,
        performanceRating: runData.performanceRating,
      };

      // 3. Create a clear prompt for the Gemini API
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `
            Please provide a concise, one-paragraph technical summary of the following mobile gaming performance run.
            Focus on the average FPS, stability (jank percentage), and overall performance rating.
            Mention the device and app name.

            Data:
            ${JSON.stringify(keyData, null, 2)}
        `;

      // 4. Call the AI model to get the summary
      const result = await model.generateContent(prompt);
      const summary = result.response.text();

      // 5. Update the original document with the new 'ai_summary' field
      return snap.ref.update({
        ai_summary: summary,
        summaryGeneratedAt: FieldValue.serverTimestamp(),
        summaryStatus: "complete",
      });
    } catch (error) {
      console.error(`Failed to generate summary for ${runId}`, error);
      return snap.ref.update({
        summaryStatus: "error",
        summaryError: error.message,
      });
    }
  }
);
