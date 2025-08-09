// Data Parsing and Metrics Calculation Module

import { deriveAppNameFromPackage } from './utils.js';

/**
 * Reads a file and returns its content as text.
 * @param {File} file The file to read.
 * @returns {Promise<string>} The content of the file.
 */
export function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

/**
 * Calculates a comprehensive set of performance metrics and returns them in a structured, nested object.
 *
 * @param {Array<Object>} fpsData Array of frame data. Each object MUST have 'presentationTime' and 'vsyncTime'.
 * @param {number} refresh_period_ns The device's refresh period in nanoseconds (e.g., 16666666).
 * @param {number} targetFPS The performance target (e.g., 60), used for rating and jank calculations.
 * @returns {Object} A comprehensive, nested object with all requested performance metrics.
 */
export function calculatePerformanceMetrics(fpsData, refresh_period_ns, targetFPS) {
    if (!fpsData || fpsData.length < 2) {
        return { error: "Insufficient frame data. At least 2 frames are required." };
    }

    // --- INTERNAL HELPER: The Python-style calculation engine ---
    /**
     * This is the corrected helper function.
     * It now calculates the average by averaging all the per-frame instantaneous FPS values,
     * which is more sensitive and robustly matches the Python script's full data analysis.
     */
    const _calculateFpsMetricsForTimestamps = (timestamps_ns) => {
        let frameTimes_ms = [];
        let instantaneousFps = [];

        // First, calculate the instantaneous FPS for every single frame transition
        for (let i = 1; i < timestamps_ns.length; i++) {
            const renderTime_ns = timestamps_ns[i] - timestamps_ns[i-1];
            if (renderTime_ns <= 0 || isNaN(renderTime_ns)) {
                frameTimes_ms.push(NaN);
                instantaneousFps.push(NaN);
                continue;
            }
            const renderTime_ms = renderTime_ns / 1000000;
            frameTimes_ms.push(renderTime_ms);
            instantaneousFps.push(1000 / renderTime_ms);
        }

        const validFps = instantaneousFps.filter(f => !isNaN(f) && isFinite(f));
        const validFrameTimes = frameTimes_ms.filter(t => !isNaN(t) && isFinite(t));

        // Calculate the average of the entire list of instantaneous FPS values.
        const averageFPS = validFps.length > 0 ? validFps.reduce((a, b) => a + b, 0) / validFps.length : 0;
        
        // The rest of the metrics are calculated as before
        const avgFrameTime = validFrameTimes.length > 0 ? validFrameTimes.reduce((a, b) => a + b, 0) / validFrameTimes.length : 0;
        const minFrameTime = validFrameTimes.length > 0 ? Math.min(...validFrameTimes) : 0;
        const maxFrameTime = validFrameTimes.length > 0 ? Math.max(...validFrameTimes) : 0;
        
        const minFPS = validFps.length > 0 ? Math.min(...validFps) : 0;
        const maxFPS = validFps.length > 0 ? Math.max(...validFps) : 0;

        return {
            avgFPS: parseFloat(averageFPS.toFixed(2)),
            minFPS: parseFloat(minFPS.toFixed(2)),
            maxFPS: parseFloat(maxFPS.toFixed(2)),
            avgFrameTimeMs: parseFloat(avgFrameTime.toFixed(2)),
            minFrameTimeMs: parseFloat(minFrameTime.toFixed(2)),
            maxFrameTimeMs: parseFloat(maxFrameTime.toFixed(2)),
            perFrameActualFrameTimesMs: frameTimes_ms.map(val => isNaN(val) ? val : parseFloat(val.toFixed(2))),
            perFrameInstantaneousFps: instantaneousFps.map(val => isNaN(val) ? val : parseFloat(val.toFixed(2))),
        };
    };

    // --- 1. Run Calculations for Both Timestamp Sources ---
    const presentationTimeMetrics = _calculateFpsMetricsForTimestamps(fpsData.map(f => f.presentationTime));
    const vsyncTimeMetrics = _calculateFpsMetricsForTimestamps(fpsData.map(f => f.vsyncTime));
    
    // --- 2. Custom Jank & Rating Analysis (based on REAL presentationTime data) ---
    const actualFrameTimes_ms = presentationTimeMetrics.perFrameActualFrameTimesMs;
    const total_frames_rendered = actualFrameTimes_ms.length;

    const targetFrameTimeMs = 1000 / targetFPS;
    const slowFrameThresholdMs = targetFrameTimeMs * 1.5;
    const instabilityThresholdFactor = 1.3;

    let slowFrameExcessValues = [];
    let instabilityValues = [];
    let slowFramesCount = 0;
    let totalSlowFrameExcess = 0;
    let jankInstabilityCount = 0;
    let totalJankInstability = 0;

    for (let i = 0; i < actualFrameTimes_ms.length; i++) {
        if (isNaN(actualFrameTimes_ms[i])) {
            slowFrameExcessValues.push(NaN);
            instabilityValues.push(NaN);
            continue;
        }
        const currentFrameTime = actualFrameTimes_ms[i];
        let slowFrameExcess = 0;
        let instability = 0;

        if (currentFrameTime > slowFrameThresholdMs) {
            slowFramesCount++;
            slowFrameExcess = currentFrameTime - slowFrameThresholdMs;
            totalSlowFrameExcess += slowFrameExcess;
        }
        slowFrameExcessValues.push(slowFrameExcess);

        if (i > 0 && !isNaN(actualFrameTimes_ms[i - 1])) {
            const previousFrameTime = actualFrameTimes_ms[i - 1];
            if (currentFrameTime > previousFrameTime * instabilityThresholdFactor) {
                jankInstabilityCount++;
                instability = currentFrameTime - previousFrameTime;
                totalJankInstability += instability;
            }
        }
        instabilityValues.push(instability);
    }
    
    const slowFramePercentage = total_frames_rendered > 0 ? (slowFramesCount / total_frames_rendered) * 100 : 0;
    const avgSlowFrameExcess = slowFramesCount > 0 ? totalSlowFrameExcess / slowFramesCount : 0;
    const jankInstabilityPercentage = total_frames_rendered > 0 ? (jankInstabilityCount / total_frames_rendered) * 100 : 0;
    const avgJankInstability = jankInstabilityCount > 0 ? totalJankInstability / jankInstabilityCount : 0;
    
    const validSlowFrameExcess = slowFrameExcessValues.filter(v => !isNaN(v) && v > 0);
    const maxSlowFrameExcess = validSlowFrameExcess.length > 0 ? Math.max(...validSlowFrameExcess) : 0;
    const validInstability = instabilityValues.filter(v => !isNaN(v) && v > 0);
    const maxJankInstability = validInstability.length > 0 ? Math.max(...validInstability) : 0;

    const performanceRating = presentationTimeMetrics.avgFPS >= targetFPS * 0.9 ? 'Excellent' : presentationTimeMetrics.avgFPS >= targetFPS * 0.7 ? 'Good' : 'Poor';
    const choppinessRating = jankInstabilityPercentage <= 5 ? 'Smooth' : jankInstabilityPercentage <= 15 ? 'Moderate' : 'Choppy';

    // --- 3. Assemble the Final, Nested Report ---
    return {
        // General Session Info
        deviceRefreshRate: parseFloat((1000000000 / refresh_period_ns).toFixed(2)),
        totalFrames: total_frames_rendered,

        // FPS metrics based on REAL frame display times (actual user experience)
        presentationTimeFps: presentationTimeMetrics,

        // FPS metrics based on SCHEDULED frame display times (ideal performance)
        vsyncTimeFps: vsyncTimeMetrics,

        // Custom Jank Metrics and Ratings (based on presentationTime)
        jankAnalysis: {
            // Slow Frame Jank
            slowFramesCount: slowFramesCount,
            slowFramePercentage: parseFloat(slowFramePercentage.toFixed(1)),
            avgSlowFrameExcess: parseFloat(avgSlowFrameExcess.toFixed(2)),
            maxSlowFrameExcess: parseFloat(maxSlowFrameExcess.toFixed(2)),
            
            // Instability Jank
            jankInstabilityCount: jankInstabilityCount,
            jankInstabilityPercentage: parseFloat(jankInstabilityPercentage.toFixed(1)),
            avgJankInstability: parseFloat(avgJankInstability.toFixed(2)),
            maxJankInstability: parseFloat(maxJankInstability.toFixed(2)),

            // Qualitative Ratings
            performanceRating: performanceRating,
            choppinessRating: choppinessRating,

            // Time-series arrays for jank charting
            perFrameSlowFrameExcess: slowFrameExcessValues.map(val => isNaN(val) ? val : parseFloat(val.toFixed(2))),
            perFrameInstability: instabilityValues.map(val => isNaN(val) ? val : parseFloat(val.toFixed(2))),
        }
    };
}
    
/**
 * Main function to parse raw text data from a dump file.
 * @param {string} rawData The raw text from the file.
 * @param {string} fileName The name of the file.
 * @param {string} userProvidedAppName An app name provided by the user.
 * @param {number} uploadIndex The index of the current upload.
 * @returns {Object|null} The parsed data object or null on failure.
 */
export function parseData(rawData, fileName = null, userProvidedAppName = null, uploadIndex) {
  try {
    const lines = rawData
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    if (lines.length === 0) {
      throw new Error("File is empty");
    }

    // 1. Extract Refresh Rate (Hz) for display and Refresh Period (ns) for calculation
    let refreshRate = 60.0;
    let refreshPeriodNs = 1_000_000_000 / 60;
    const refreshRateMatch = lines[0].match(/Refresh Period: (\d+) ns \((\d+\.\d+) Hz\)/);
    if (refreshRateMatch) {
        refreshPeriodNs = parseInt(refreshRateMatch[1], 10);
        refreshRate = parseFloat(refreshRateMatch[2]);
    } else {
        console.warn("Could not find Refresh Period in file header. Falling back to 60 Hz.");
    }

    let csvStartIndex = lines.findIndex((line) =>
      line.includes("Test ID,Presentation Time")
    );
    if (csvStartIndex === -1)
      throw new Error("Could not find CSV data in file");

    const csvLines = lines.slice(csvStartIndex + 1);
    const lastLine = lines[lines.length - 1];

    // 2. Full logic for parsing App/Device Info and FPS Buckets from the summary line
    let fpsData = [];
    let deviceInfo = {};
    let appName = "Unknown App";
    let packageName = "Unknown Package";
    let fpsBuckets = null; // This will be populated by the logic below

    if (lastLine.includes("{") && lastLine.includes("}")) {
      try {
          const jsonStart = lastLine.indexOf("{");
          if (jsonStart !== -1) {
              const csvPart = lastLine.substring(0, jsonStart);
              const csvParts = csvPart.split(",");
              packageName = csvParts[2]?.trim() || "Unknown Package";
              const csvAppName = csvParts[3]?.trim();
              const derivedAppName = deriveAppNameFromPackage(packageName);
              appName = !csvAppName || csvAppName === "Unknown App" ? derivedAppName : csvAppName;
              let jsonStr = lastLine.substring(jsonStart);
              if (jsonStr.startsWith('"') && jsonStr.endsWith('"')) {
                  jsonStr = jsonStr.slice(1, -1);
              }
              const lastBraceIndex = jsonStr.lastIndexOf("}");
              if (lastBraceIndex !== -1) {
                  jsonStr = jsonStr.substring(0, lastBraceIndex + 1);
              }
              jsonStr = jsonStr.replace(/:\s*""/g, ': "EMPTY_STRING_PLACEHOLDER"').replace(/""/g, '"').replace(/EMPTY_STRING_PLACEHOLDER/g, "");
              deviceInfo = JSON.parse(jsonStr);
              if (deviceInfo.appName && deviceInfo.appName !== "Unknown App" && appName === "Unknown App") {
                  appName = deviceInfo.appName;
              } else if (appName === "Unknown App" && packageName !== "Unknown Package") {
                  appName = deriveAppNameFromPackage(packageName);
              }

              if (csvParts.length >= 24) { // As per your original logic
                  try {
                      const bucketStartIndex = 3;
                      fpsBuckets = {
                          bucket_0_3: parseInt(csvParts[bucketStartIndex]) || 0,
                          bucket_3_5: parseInt(csvParts[bucketStartIndex + 1]) || 0,
                          bucket_5_7: parseInt(csvParts[bucketStartIndex + 2]) || 0,
                          bucket_7_9: parseInt(csvParts[bucketStartIndex + 3]) || 0,
                          bucket_9_11: parseInt(csvParts[bucketStartIndex + 4]) || 0,
                          bucket_11_13: parseInt(csvParts[bucketStartIndex + 5]) || 0,
                          bucket_13_16: parseInt(csvParts[bucketStartIndex + 6]) || 0,
                          bucket_16_19: parseInt(csvParts[bucketStartIndex + 7]) || 0,
                          bucket_19_22: parseInt(csvParts[bucketStartIndex + 8]) || 0,
                          bucket_22_26: parseInt(csvParts[bucketStartIndex + 9]) || 0,
                          bucket_26_35: parseInt(csvParts[bucketStartIndex + 10]) || 0,
                          bucket_35_50: parseInt(csvParts[bucketStartIndex + 11]) || 0,
                          bucket_50_70: parseInt(csvParts[bucketStartIndex + 12]) || 0,
                          bucket_70_plus: parseInt(csvParts[bucketStartIndex + 13]) || 0,
                          avgFps: parseFloat(csvParts[bucketStartIndex + 14]) || 0,
                          elapsedTime: parseFloat(csvParts[bucketStartIndex + 15]) || 0,
                          totalFrames: parseInt(csvParts[bucketStartIndex + 16]) || 0,
                          startBattery: parseInt(csvParts[bucketStartIndex + 17]) || 0,
                          endBattery: parseInt(csvParts[bucketStartIndex + 18]) || 0,
                          batteryDrain: parseInt(csvParts[bucketStartIndex + 19]) || 0,
                          refreshRate: parseFloat(csvParts[bucketStartIndex + 20]) || 60.0,
                      };
                  } catch (e) {
                      console.warn("Failed to parse FPS buckets from summary line:", e);
                      fpsBuckets = null;
                  }
              }
          }
      } catch (e) {
          console.warn("Failed to parse device info from last line:", e);
      }
    }

    // Fallback for package name if summary line parsing fails
    if (packageName === "Unknown Package" && csvLines.length > 0) {
      packageName = extractPackageName(csvLines[0].split(",")[0]) || "Unknown Package";
    }

    const dataLines = lastLine.includes("{") ? csvLines.slice(0, -1) : csvLines;
    for (const line of dataLines) {
      const parts = line.split(",");
      if (parts.length >= 6) {

      const [
          testId,
          scheduledTime, // Column 2 is the "Presentation Time" from header, which is SCHEDULED
          fenceTime,
          actualTime,    // Column 4 is the "Vsync Time" from header, which is ACTUAL
          deltaTime,
          instantFps,
          latency = 0,
        ] = parts;
      

      fpsData.push({
          testId,
          presentationTime: parseFloat(actualTime),    // Assign ACTUAL time to presentationTime
          fenceTime: parseFloat(fenceTime),
          vsyncTime: parseFloat(scheduledTime),      // Assign SCHEDULED time to vsyncTime
          deltaTime: parseFloat(deltaTime),
          instantFps: parseFloat(instantFps),
          latency: parseFloat(latency),
        });
      
      }
    }

    if (fpsData.length === 0)
      throw new Error("No valid FPS data found in file");

    // 3. Call the updated calculatePerformanceMetrics function
    const targetFpsResult = detectTargetFPS(fpsData);
    const performanceMetrics = calculatePerformanceMetrics(
      fpsData,
      refreshPeriodNs,
      targetFpsResult.target
    );

    const finalAppName = userProvidedAppName || appName;

    // 4. Construct the final flat object with all requested metrics
    return {
      fileName: `Upload ${uploadIndex + 1}`,
      timestamp: new Date().toLocaleString(),
      appName: finalAppName,
      packageName,
      refreshRate, // Hz value
      totalFrames: performanceMetrics.totalFrames,
      elapsedTimeSeconds: (performanceMetrics.presentationTimeFps.avgFrameTimeMs * performanceMetrics.totalFrames) / 1000,
      deviceInfo,
      rawFpsData: fpsData,
      fpsBuckets, // Parsed from summary line
      targetFPS: targetFpsResult.target,
      targetFpsConfidence: targetFpsResult.confidence,
      targetFpsScore: targetFpsResult.score,

      // --- Main Metrics (from Presentation Time - Real User Experience) ---
      avgFps: performanceMetrics.presentationTimeFps.avgFPS,
      minFps: performanceMetrics.presentationTimeFps.minFPS,
      maxFps: performanceMetrics.presentationTimeFps.maxFPS,
      avgFrameTime: performanceMetrics.presentationTimeFps.avgFrameTimeMs,
      minFrameTime: performanceMetrics.presentationTimeFps.minFrameTimeMs,
      maxFrameTime: performanceMetrics.presentationTimeFps.maxFrameTimeMs,

      // --- Jank & Rating Metrics (from Presentation Time) ---
      slowFramesCount: performanceMetrics.jankAnalysis.slowFramesCount,
      slowFramePercentage: performanceMetrics.jankAnalysis.slowFramePercentage,
      avgSlowFrameExcess: performanceMetrics.jankAnalysis.avgSlowFrameExcess,
      maxSlowFrameExcess: performanceMetrics.jankAnalysis.maxSlowFrameExcess,
      jankInstabilityCount: performanceMetrics.jankAnalysis.jankInstabilityCount,
      jankInstabilityPercentage: performanceMetrics.jankAnalysis.jankInstabilityPercentage,
      avgJankInstability: performanceMetrics.jankAnalysis.avgJankInstability,
      maxJankInstability: performanceMetrics.jankAnalysis.maxJankInstability,
      performanceRating: performanceMetrics.jankAnalysis.performanceRating,
      choppinessRating: performanceMetrics.jankAnalysis.choppinessRating,

      // --- Comparison Metrics (from Vsync Time - Scheduled Performance) ---
      vsync_avgFps: performanceMetrics.vsyncTimeFps.avgFPS,
      vsync_minFps: performanceMetrics.vsyncTimeFps.minFPS,
      vsync_maxFps: performanceMetrics.vsyncTimeFps.maxFPS,
      vsync_avgFrameTime: performanceMetrics.vsyncTimeFps.avgFrameTimeMs,
      vsync_minFrameTime: performanceMetrics.vsyncTimeFps.minFrameTimeMs,
      vsync_maxFrameTime: performanceMetrics.vsyncTimeFps.maxFrameTimeMs,
      
      // --- Time-series arrays for charting ---
      perFrameActualFrameTimesMs: performanceMetrics.presentationTimeFps.perFrameActualFrameTimesMs,
      perFrameInstantaneousFps: performanceMetrics.presentationTimeFps.perFrameInstantaneousFps,
      perFrameSlowFrameExcess: performanceMetrics.jankAnalysis.perFrameSlowFrameExcess,
      perFrameInstability: performanceMetrics.jankAnalysis.perFrameInstability,
    };
  } catch (error) {
    console.error("Parse error:", error);
    throw new Error(`Failed to parse data: ${error.message}`);
  }
}

/**
 * Helper to extract a package name from a test ID string.
 * @param {string} testId The test ID.
 * @returns {string|null} The extracted package name or null.
 */
export function extractPackageName(testId) {
  // Try to extract package name from test ID if it follows a pattern
  // This is a best guess based on common patterns
  if (testId && testId.includes(".")) {
    const parts = testId.split(".");
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(".");
    }
  }
  return null;
}

/**
 * Detects the target FPS from frame data based on performance patterns.
 * @param {Array<Object>} frameData Array of frame data objects.
 * @returns {Object} An object with the detected target, confidence, and score.
 */
export function detectTargetFPS(frameData) {
  // Possible target FPS values
  const possibleTargets = [30];

  // Extract delta times and FPS values
  const deltaTimes = frameData
    .map((frame) => frame.deltaTime)
    .filter((dt) => !isNaN(dt));
  const fpsValues = frameData
    .map((frame) => frame.instantFps)
    .filter((fps) => !isNaN(fps));

  if (deltaTimes.length === 0) {
    return {
      target: 30,
      confidence: "LOW",
      score: 0,
      reason: "No valid frame data",
    };
  }

  // Calculate statistics
  const avgDeltaTime = deltaTimes.reduce((a, b) => a + b) / deltaTimes.length;
  const avgFPS = fpsValues.reduce((a, b) => a + b) / fpsValues.length;

  // Target likelihood scoring
  const targetScores = possibleTargets.map((target) => {
    const expectedDelta = 1000 / target;

    // Score based on how close actual performance is to reasonable range
    let score = 0;

    // Performance ratio scoring (0.4-0.8 range is reasonable)
    const ratio = avgFPS / target;
    if (ratio >= 0.4 && ratio <= 0.8) {
      score += 50; // Good performance range
    } else if (ratio >= 0.2 && ratio <= 1.0) {
      score += 25; // Acceptable range
    }

    // Delta time consistency scoring
    const deltaMatches = deltaTimes.filter(
      (delta) => delta >= expectedDelta * 0.8 && delta <= expectedDelta * 2.5
    ).length;
    const deltaScore = (deltaMatches / deltaTimes.length) * 30;
    score += deltaScore;

    // Realistic performance gap scoring
    if (ratio >= 0.5 && ratio <= 0.8) {
      score += 20; // Realistic underperformance
    }

    return {
      target,
      score,
      ratio,
      expectedDelta,
      deltaMatches,
      deltaMatchPercentage: (
        (deltaMatches / deltaTimes.length) *
        100
      ).toFixed(1),
    };
  });

  // Find best target
  const bestTarget = targetScores.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  // Determine confidence level
  let confidence = "LOW";
  if (bestTarget.score >= 70) confidence = "HIGH";
  else if (bestTarget.score >= 50) confidence = "MEDIUM";

  return {
    target: bestTarget.target,
    confidence: confidence,
    score: bestTarget.score,
    performanceRatio: bestTarget.ratio,
    avgFPS: avgFPS,
    avgDeltaTime: avgDeltaTime,
    allScores: targetScores,
  };
}