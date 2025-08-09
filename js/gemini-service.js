// Gemini AI Service Module - Handles structuring data and communication with the Gemini API.

import {
  inferAppCategory,
  calculateMemoryGB,
  calculatePercentile,
} from "./utils.js";

/**
 * Structures the performance data for a single run for the AI.
 * @param {Object} data The performance data for one analysis.
 * @param {Array<Object>} allData All uploaded data for context.
 * @returns {Object} The structured data for the API.
 */
export function structureDataForAI(data, allData) {
  const deviceInfo = data.deviceInfo || {};

  // Find similar apps on this device
  const sameDeviceApps = allData.filter((item) => {
    const itemDevice = item.deviceInfo || {};
    return (
      itemDevice["ro.product.model"] === deviceInfo["ro.product.model"] &&
      itemDevice["ro.product.manufacturer"] ===
        deviceInfo["ro.product.manufacturer"] &&
      item !== data
    );
  });

  // Find same app on different devices
  const sameAppDifferentDevices = allData.filter(
    (item) => item.packageName === data.packageName && item !== data
  );

  // Sample frame data (every 10th frame to manage token limits)
  const frameSample = data.rawFpsData
    ? data.rawFpsData.filter((_, index) => index % 10 === 0).slice(0, 50)
    : [];

  // Calculate performance percentiles
  const allFpsValues = allData.map((item) => item.avgFps).sort((a, b) => a - b);
  const currentPercentile = calculatePercentile(allFpsValues, data.avgFps);

  return {
    // Core Performance Metrics
    performance: {
      avgFps: data.avgFps,
      minFps: data.minFps,
      maxFps: data.maxFps,
      targetFPS: data.targetFPS,
      scheduled_avgFps: data.vsync_avgFps,
      scheduled_minFps: data.vsync_minFps,
      scheduled_maxFps: data.vsync_maxFps,
      avgSlowFrameExcessMs: data.avgSlowFrameExcess,
      maxSlowFrameExcessMs: data.maxSlowFrameExcess,
      slowFramesCount: data.slowFramesCount,
      slowFramePercentage: data.slowFramePercentage,
      avgJankInstabilityMs: data.avgJankInstability,
      maxJankInstabilityMs: data.maxJankInstability,
      jankInstabilityCount: data.jankInstabilityCount,
      jankInstabilityPercentage: data.jankInstabilityPercentage,
      choppinessRating: data.choppinessRating,
      performanceRating: data.performanceRating,
      elapsedTimeSeconds: data.elapsedTimeSeconds,
      totalFrames: data.totalFrames,
      refreshRate: data.refreshRate,
      performancePercentile: currentPercentile,
    },
    // App Information
    app: {
      name: data.appName,
      packageName: data.packageName,
      category: inferAppCategory(data.appName, data.packageName),
    },
    // Device Specifications
    device: {
      manufacturer: deviceInfo["ro.product.manufacturer"],
      model: deviceInfo["ro.product.model"],
      brand: deviceInfo["ro.product.brand"],
      socModel: deviceInfo["ro.soc.model"],
      socManufacturer: deviceInfo["ro.soc.manufacturer"],
      cpuArchitecture: deviceInfo["ro.product.cpu.abi"],
      totalMemoryGB: calculateMemoryGB(deviceInfo.MemTotal),
      androidVersion: deviceInfo["ro.build.version.release"],
      apiLevel: deviceInfo["ro.build.version.sdk"],
      eglHardware: deviceInfo["ro.hardware.egl"],
    },
    // Comparative Context
    context: {
      sameDevicePerformance: sameDeviceApps
        .map((item) => ({
          app: item.appName,
          avgFps: item.avgFps,
          slowFramePercentage: item.slowFramePercentage,
          jankInstabilityPercentage: item.jankInstabilityPercentage,
        }))
        .slice(0, 5),
      sameAppPerformance: sameAppDifferentDevices
        .map((item) => ({
          device: `${item.deviceInfo?.["ro.product.manufacturer"]} ${item.deviceInfo?.["ro.product.model"]}`,
          avgFps: item.avgFps,
          slowFramePercentage: item.slowFramePercentage,
          jankInstabilityPercentage: item.jankInstabilityPercentage,
          socModel: item.deviceInfo?.["ro.soc.model"],
        }))
        .slice(0, 5),
      totalDataPoints: allData.length,
      uniqueDevices: new Set(
        allData.map(
          (item) =>
            `${item.deviceInfo?.["ro.product.manufacturer"]} ${item.deviceInfo?.["ro.product.model"]}`
        )
      ).size,
      uniqueApps: new Set(allData.map((item) => item.appName)).size,
    },
    // Frame Timing Sample
    frameSample: frameSample.map((frame) => ({
      time: frame.presentationTime,
      fps: frame.instantFps,
      deltaTime: frame.deltaTime,
      latency: frame.latency,
    })),
  };
}

/**
 * Calls the Gemini API for a single analysis.
 * @param {string} apiKey The user's Gemini API key.
 * @param {Object} analysisData The structured data.
 * @returns {Promise<string>} The analysis text from the API.
 */
export async function callGeminiAPI(apiKey, analysisData) {
  const prompt = `You are a mobile performance analysis expert. Your task is to analyze the following performance data and explain it in simple, easy-to-understand language.

PERFORMANCE DATA:
${JSON.stringify(analysisData, null, 2)}

Please write a brief analysis focusing ONLY on these two points:

1.  **Performance Summary**: How well did the app perform overall? Was it smooth, or did it struggle? Mention the average frames per second (FPS) and how consistent it was.

2.  **Reasons for Bottlenecks**: What caused the performance problems? Explain in simple terms if the app was slow because of sudden spikes in processing (jank) or consistently slow frames.

**IMPORTANT RULES:**
- Use simple, human-friendly language. Imagine you're explaining this to a non-technical manager.
- Do NOT give any recommendations, advice, or suggestions for how to fix the issues.
- Do NOT analyze device compatibility or compare it to other apps.
- Keep the analysis concise and focused only on the performance and the reasons for any slowdowns found in the data provided.
- Avoid complex technical terms. For example, instead of "high slow frame percentage," say "the app frequently dropped below its target speed."`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `API Error: ${response.status} - ${
        errorData.error?.message || "Unknown error"
      }`
    );
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error("Invalid response format from Gemini API");
  }

  return data.candidates[0].content.parts[0].text;
}

/**
 * Structures comparison data for the AI.
 * @param {Array<Object>} selectedData Array of data objects to compare.
 * @param {Array<Object>} allData All uploaded data for global context.
 * @returns {Object} The structured data for the comparison API.
 */
export function structureComparisonDataForAI(selectedData, allData) {
  return {
    apps: selectedData.map((data, index) => {
      const deviceInfo = data.deviceInfo || {};
      const validAvgFpsValues = selectedData
        .map((d) => d.avgFps)
        .filter((val) => typeof val === "number");
      const fpsRanking =
        validAvgFpsValues.length > 0 && typeof data.avgFps === "number"
          ? validAvgFpsValues.sort((a, b) => b - a).indexOf(data.avgFps) + 1
          : "N/A";

      return {
        index: index + 1,
        name: data.appName,
        packageName: data.packageName,
        category: inferAppCategory(data.appName, data.packageName),
        performance: {
          avgFps: data.avgFps,
          minFps: data.minFps,
          maxFps: data.maxFps,
          targetFPS: data.targetFPS,
          scheduled_avgFps: data.vsync_avgFps,
          scheduled_minFps: data.vsync_minFps,
          scheduled_maxFps: data.vsync_maxFps,
          avgSlowFrameExcessMs: data.avgSlowFrameExcess,
          maxSlowFrameExcessMs: data.maxSlowFrameExcess,
          slowFramesCount: data.slowFramesCount,
          slowFramePercentage: data.slowFramePercentage,
          avgJankInstabilityMs: data.avgJankInstability,
          maxJankInstabilityMs: data.maxJankInstability,
          jankInstabilityCount: data.jankInstabilityCount,
          jankInstabilityPercentage: data.jankInstabilityPercentage,
          choppinessRating: data.choppinessRating,
          performanceRating: data.performanceRating,
          elapsedTimeSeconds: data.elapsedTimeSeconds,
          totalFrames: data.totalFrames,
          fpsRankingInComparison: fpsRanking,
        },
        device: {
          manufacturer: deviceInfo["ro.product.manufacturer"],
          model: deviceInfo["ro.product.model"],
          socModel: deviceInfo["ro.soc.model"],
          socManufacturer: deviceInfo["ro.soc.manufacturer"],
          totalMemoryGB: calculateMemoryGB(deviceInfo.MemTotal),
          androidVersion: deviceInfo["ro.build.version.release"],
          cpuArchitecture: deviceInfo["ro.product.cpu.abi"],
        },
      };
    }),
    statistics: {
      bestPerformer: {
        app: selectedData.reduce((best, current) =>
          current.avgFps > best.avgFps ? current : best
        ).appName,
        avgFps: Math.max(...selectedData.map((d) => d.avgFps)),
      },
      worstPerformer: {
        app: selectedData.reduce((worst, current) =>
          current.avgFps < worst.avgFps ? current : worst
        ).appName,
        avgFps: Math.min(...selectedData.map((d) => d.avgFps)),
      },
      performanceSpread:
        Math.max(...selectedData.map((d) => d.avgFps)) -
        Math.min(...selectedData.map((d) => d.avgFps)),
      averageSlowFramePercentageAcrossApps:
        selectedData.reduce((sum, d) => sum + (d.slowFramePercentage || 0), 0) /
        selectedData.length,
      averageJankInstabilityPercentageAcrossApps:
        selectedData.reduce(
          (sum, d) => sum + (d.jankInstabilityPercentage || 0),
          0
        ) / selectedData.length,
      uniqueDevices: new Set(
        selectedData.map(
          (d) =>
            `${d.deviceInfo?.["ro.product.manufacturer"]} ${d.deviceInfo?.["ro.product.model"]}`
        )
      ).size,
      uniqueSoCs: new Set(
        selectedData.map((d) => d.deviceInfo?.["ro.soc.model"])
      ).size,
    },
    context: {
      totalDataPoints: allData.length,
      globalAverageFps:
        allData.reduce((sum, d) => sum + d.avgFps, 0) / allData.length,
      selectedAppsRepresent: `${(
        (selectedData.length / allData.length) *
        100
      ).toFixed(1)}% of total data`,
    },
  };
}

/**
 * Calls the Gemini API for a comparison analysis.
 * @param {string} apiKey The user's Gemini API key.
 * @param {Object} comparisonData The structured comparison data.
 * @returns {Promise<string>} The comparison analysis text from the API.
 */
export async function callGeminiComparisonAPI(apiKey, comparisonData) {
  const prompt = `You are a performance analyst generating a factual summary of app testing results.

Your job is to analyze the COMPARISON DATA below and write a clear, concise report. This will be used by the Developer Relations and QA teams to communicate performance behavior to developers. Only include **facts based on the data**. Do not assume anything beyond what's shown.

===================
COMPARISON DATA:
${JSON.stringify(comparisonData, null, 2)}
===================

From the data, generate a structured analysis with the following:

1. **Top Performer**
   - App name and (if available) device
   - Mention key metrics like average FPS
   - Include the hardware specs (CPU model, RAM) for that run

2. **Lowest Performer**
   - App name and (if available) device
   - Mention FPS and hardware specs

3. **Minimum Viable Spec (minSpec)**
   - Based on acceptable performance, list the **lowest hardware spec** (CPU, RAM) where apps still ran smoothly
   - Use actual values from the data (e.g., “Snapdragon 732G, 4GB RAM”)
   - Only include if there is enough data to clearly identify this

4. **Unfit Devices**
   - List devices where multiple apps underperformed
   - Mention possible reasons (e.g., low RAM, outdated SoC), based strictly on provided data

5. **Consistently Good Apps**
   - Apps that performed well across most or all devices
   - Include performance indicators

6. **Apps Needing Attention**
   - Apps that had frequent lags, stutters, or unstable frame rates
   - Clearly mention which ones, with supporting facts

7. **Notable Patterns**
   - Mention any device-specific issues, FPS spikes/drops, or unexpected trends visible in the data

**Guidelines:**
- Be **factual and to the point**. Use non-technical, clear language.
- Do **not** suggest any fixes or guesses.
- Do **not** use words like “could”, “should”, or “might”.
- Only use the COMPARISON DATA. No assumptions.
- The output should be easy to share with developers or non-technical stakeholders.

Respond only with the analysis text. Do not add notes or headings outside the requested structure.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `API Error: ${response.status} - ${
        errorData.error?.message || "Unknown error"
      }`
    );
  }

  const data = await response.json();

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error("Invalid response format from Gemini API");
  }

  return data.candidates[0].content.parts[0].text;
}
