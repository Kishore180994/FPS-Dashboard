// backfill.js

const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
// IMPORTANT: Make sure your API key is available as an environment variable
// You can set this in your terminal before running: export GEMINI_API_KEY="YOUR_KEY"
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable not set.");
}

// Load your service account key
const serviceAccount = require("./service-account.json");

// --- INITIALIZE SERVICES ---
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- MAIN SCRIPT LOGIC ---
async function backfillSummaries() {
  console.log("Fetching all documents from 'fps_data' collection...");
  const snapshot = await db.collection("fps_data").get();

  if (snapshot.empty) {
    console.log("No documents found. Nothing to do.");
    return;
  }

  console.log(`Found ${snapshot.docs.length} total documents.`);
  const docsToProcess = snapshot.docs.filter((doc) => !doc.data().ai_summary);
  console.log(`Found ${docsToProcess.length} documents that need a summary.`);

  let processedCount = 0;
  for (const doc of docsToProcess) {
    const runData = doc.data();
    const runId = doc.id;

    try {
      console.log(`Processing document ${runId}...`);

      // The final, most comprehensive keyData object
      const keyData = {
        // Performance Results
        avgFps: runData.avgFps,
        minFps: runData.minFps,
        jankInstabilityPercentage: runData.jankInstabilityPercentage,
        slowFramePercentage: runData.slowFramePercentage,

        // Application & Test Info
        appName: runData.appName,
        appVersion: runData.appVersion,
        elapsedTimeSeconds: runData.elapsedTimeSeconds,

        // Device & OEM Identity
        oemBrand: runData.deviceInfo?.["ro.oem.brand"],
        deviceModel: runData.deviceInfo?.["ro.product.model"],

        // Core Hardware Specs
        socManufacturer: runData.deviceInfo?.["ro.soc.manufacturer"],
        socModel: runData.deviceInfo?.["ro.soc.model"],
        cpuAbi: runData.deviceInfo?.["ro.product.cpu.abi"], // e.g., "x86_64" or "arm64-v8a"
        ramTotal: runData.deviceInfo?.MemTotal,

        // Graphics & OS Environment
        androidVersion: runData.deviceInfo?.["ro.build.version.release"],
        kernelVersion: runData.deviceInfo?.["ro.kernel.version"],
        buildFingerprint: runData.deviceInfo?.["ro.build.fingerprint"],
      };

      // The final, most effective prompt

      const prompt = `
  You are a Lead Performance Engineer creating an analysis report for driver and OS engineering partners. Your summary must be insightful, concise, and professional.

  **Tone and Style:**
  - Write like a human expert providing a performance analysis.
  - Synthesize the data into a fluent, professional narrative.
  - Do not list specs. Instead, reference them contextually as evidence for your analysis.

  **Analysis Structure:**
  1.  **Opening Statement:** Start with a high-level assessment of the app's performance on the specified device hardware.
  2.  **Performance Deep Dive:** Analyze the framerate and stability. Use the avgFps, minFps, and jank/slow frame percentages as evidence to describe the user experience (e.g., 'generally smooth with noticeable stutters', 'severely choppy').
  3.  **Hardware Correlation & Hypothesis:** This is the most critical part. Form a hypothesis connecting the performance to the device's hardware (SoC, **CPU architecture**, RAM, OS version, etc.). For example, "The frequent jank on this **x86_64** device, despite its i3-N305 SoC and 16GB of RAM, points towards a potential issue in the ARM emulation layer or a driver-level issue specific to this architecture."
  4.  **Actionable Recommendation:** Conclude with a clear, one-sentence recommended next step for the engineering team.

  **IMPORTANT:** Your primary goal is to form a hypothesis that links the performance metrics to the hardware specs.

  **Test Run Data:**
  ${JSON.stringify(keyData, null, 2)}
`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text();

      await doc.ref.update({
        ai_summary: summary,
        summaryGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
        summaryStatus: "Success",
        summaryError: "",
      });

      processedCount++;
      console.log(
        `  -> Successfully updated document ${runId}. (${processedCount}/${docsToProcess.length})`
      );
    } catch (error) {
      console.error(`  -> Failed to process document ${runId}:`, error.message);
      // Optionally update the doc with an error status
      await doc.ref.update({ summaryStatus: "backfill_error" });
    }

    // Add a short delay to avoid hitting API rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\nBackfill complete! Processed ${processedCount} documents.`);
}

backfillSummaries().catch(console.error);
