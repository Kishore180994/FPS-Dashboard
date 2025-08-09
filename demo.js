// Demo FPS Data Dashboard JavaScript
// This is a standalone version that parses dump files locally without Google Apps Script

class FPSDashboard {
  constructor() {
    this.uploadedData = [];
    this.filteredData = [];
    this.charts = {};
    this.currentView = "recent"; // 'recent' or 'all'
    this.itemsPerPage = 10;
    this.currentPage = 1;
    this.searchTerm = "";
    this.activeFilters = new Map();
    this.selectedForComparison = new Set();
    this.comparisonCharts = {};
    this.batteryDrainMode = "total"; // 'total' or 'perMinute'

    this.activeDetailChart = 'fps';
    this.detailChartTimeScale = '1s'; // 'frame', '1s', or '5s'
    this.comparisonChartTimeScale = '1s';
    this.activeComparisonChart = 'fps'; 

    // LDAP Authentication System
    this.adminUsers = [
      "danduri@google.com",
      "nanayaw@google.com",
      "priyankd@google.com",
      "sumaanand@google.com",
      "ukrishnamurthy@google.com",
    ];
    this.currentUser = null;
    this.isAuthenticated = false;

    this.initializeEventListeners();
  }

  initializeEventListeners() {
    const fileInput = document.getElementById("fileInput");
    const clearBtn = document.getElementById("clearBtn");
    const loadDemoBtn = document.getElementById("loadDemoBtn");
    const showAllBtn = document.getElementById("showAllBtn");
    const searchInput = document.getElementById("searchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");

    // Auto-process files when selected
    fileInput.addEventListener("change", () => this.handleFileUpload());
    clearBtn.addEventListener("click", () => this.clearAllData());
    loadDemoBtn.addEventListener("click", () => this.loadDemoData());

    showAllBtn.addEventListener("click", () => this.toggleView());
    searchInput.addEventListener("input", (e) =>
      this.handleSearch(e.target.value)
    );
    clearSearchBtn.addEventListener("click", () => this.clearSearch());

    // Allow drag and drop
    const uploadSection = document.querySelector(".upload-section");
    uploadSection.addEventListener("dragover", (e) => {
      e.preventDefault();
      uploadSection.style.borderColor = "var(--primary-color)";
    });

    uploadSection.addEventListener("dragleave", (e) => {
      e.preventDefault();
      uploadSection.style.borderColor = "";
    });

    uploadSection.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadSection.style.borderColor = "";
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        this.handleFileUpload();
      }
    });
  }

  showToast(message, type = "info") {
    const toastContainer = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  showLoading() {
    document.getElementById("loadingOverlay").classList.add("show");
  }

  hideLoading() {
    document.getElementById("loadingOverlay").classList.remove("show");
  }

  async handleFileUpload() {
    const fileInput = document.getElementById("fileInput");

    if (fileInput.files.length === 0) {
      this.showToast("Please select at least one file.", "warning");
      return;
    }

    const files = Array.from(fileInput.files);
    let successCount = 0;
    let errorCount = 0;

    try {
      this.showLoading();

      // Prompt user for app names for each file
      const fileAppNames = await this.promptForAppNames(files);
      if (!fileAppNames) {
        // User cancelled
        this.hideLoading();
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const userProvidedAppName = fileAppNames[i];

        try {
          const rawData = await this.readFile(file);
          const parsedData = this.parseData(
            rawData,
            file.name,
            userProvidedAppName
          );

          if (parsedData) {
            this.uploadedData.push(parsedData);
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          errorCount++;
        }
      }

      this.updateDisplay();

      // Show summary toast
      if (successCount > 0 && errorCount === 0) {
        this.showToast(
          `Successfully processed ${successCount} file${
            successCount > 1 ? "s" : ""
          }!`,
          "success"
        );
      } else if (successCount > 0 && errorCount > 0) {
        this.showToast(
          `Processed ${successCount} file${
            successCount > 1 ? "s" : ""
          }, ${errorCount} failed.`,
          "warning"
        );
      } else {
        this.showToast(
          `Failed to process ${errorCount} file${
            errorCount > 1 ? "s" : ""
          }. Please check the format.`,
          "error"
        );
      }

      fileInput.value = ""; // Clear the input
    } catch (error) {
      console.error("Error during batch upload:", error);
      this.showToast(`Error during upload: ${error.message}`, "error");
    } finally {
      this.hideLoading();
    }
  }

  // Random app names for debugging purposes
  getRandomAppNames() {
    const randomApps = [
      "Call of Duty Mobile",
      "PUBG Mobile",
      "Genshin Impact",
      "Minecraft",
      "Fortnite",
      "Among Us",
      "Clash of Clans",
      "Clash Royale",
      "Candy Crush Saga",
      "Pokemon GO",
      "Roblox",
      "Free Fire",
      "Mobile Legends",
      "Arena of Valor",
      "Asphalt 9",
      "Real Racing 3",
      "FIFA Mobile",
      "NBA 2K Mobile",
      "Subway Surfers",
      "Temple Run",
      "Angry Birds",
      "Plants vs Zombies",
      "Monument Valley",
      "Alto's Odyssey",
      "Netflix",
      "YouTube",
      "TikTok",
      "Instagram",
      "Facebook",
      "WhatsApp",
      "Spotify",
      "Discord",
      "Zoom",
      "Google Maps",
      "Chrome Browser",
      "Gmail",
      "Google Photos",
      "Amazon Shopping",
      "Uber",
      "Airbnb",
      "PayPal",
      "Banking App",
      "Weather App",
      "Calculator",
      "Camera App",
      "Gallery App",
      "File Manager",
      "Music Player",
      "Video Player",
      "News App",
      "Shopping App",
    ];

    return randomApps;
  }

  async promptForAppNames(files) {
    return new Promise((resolve) => {
      // Create modal for app name input
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3000;
      `;

      // Get random app names for auto-fill
      const randomApps = this.getRandomAppNames();

      let modalContent = `
        <div style="
          background: var(--card-bg);
          border-radius: var(--card-radius);
          border: var(--glass-border);
          backdrop-filter: blur(var(--glass-blur));
          padding: 30px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        ">
          <h3 style="color: var(--text-primary); margin-top: 0;">Enter App Names</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">
            Please provide the app name for each uploaded file:
          </p>
          <div style="
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
          ">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
              <button id="autoFillRandom" style="
                padding: 8px 16px;
                border-radius: var(--btn-radius);
                border: none;
                background: var(--success-color);
                color: white;
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 600;
              ">🎲 Auto-fill Random</button>
              <button id="clearAll" style="
                padding: 8px 16px;
                border-radius: var(--btn-radius);
                border: 1px solid var(--border-color);
                background: transparent;
                color: var(--text-primary);
                cursor: pointer;
                font-size: 0.85rem;
                font-weight: 600;
              ">🗑️ Clear All</button>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.75rem; margin: 0; line-height: 1.3;">
              💡 <strong>Debug Mode:</strong> Use "Auto-fill Random" to quickly populate with random app names for testing purposes.
            </p>
          </div>
      `;

      // Add input for each file with random pre-filled values
      files.forEach((file, index) => {
        const randomApp =
          randomApps[Math.floor(Math.random() * randomApps.length)];
        modalContent += `
          <div style="margin-bottom: 15px;">
            <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">
              ${file.name}:
            </label>
            <input 
              type="text" 
              id="appName_${index}" 
              value="${randomApp}"
              placeholder="Enter app name (e.g., Netflix, YouTube, etc.)"
              style="
                width: 100%;
                padding: 10px;
                border-radius: var(--btn-radius);
                border: 1px solid var(--border-color);
                background: var(--input-bg-color);
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                box-sizing: border-box;
              "
            />
          </div>
        `;
      });

      modalContent += `
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button id="cancelAppNames" style="
              padding: 10px 20px;
              border-radius: var(--btn-radius);
              border: 1px solid var(--border-color);
              background: transparent;
              color: var(--text-primary);
              cursor: pointer;
            ">Cancel</button>
            <button id="confirmAppNames" style="
              padding: 10px 20px;
              border-radius: var(--btn-radius);
              border: none;
              background: var(--primary-color);
              color: white;
              cursor: pointer;
            ">Continue</button>
          </div>
        </div>
      `;

      modal.innerHTML = modalContent;
      document.body.appendChild(modal);

      // Auto-fill random button functionality
      document.getElementById("autoFillRandom").onclick = () => {
        files.forEach((file, index) => {
          const input = document.getElementById(`appName_${index}`);
          const randomApp =
            randomApps[Math.floor(Math.random() * randomApps.length)];
          input.value = randomApp;
          input.style.borderColor = "";
        });
      };

      // Clear all button functionality
      document.getElementById("clearAll").onclick = () => {
        files.forEach((file, index) => {
          const input = document.getElementById(`appName_${index}`);
          input.value = "";
          input.style.borderColor = "";
        });
      };

      // Focus first input
      setTimeout(() => {
        const firstInput = document.getElementById("appName_0");
        if (firstInput) firstInput.focus();
      }, 100);

      // Handle cancel
      document.getElementById("cancelAppNames").onclick = () => {
        document.body.removeChild(modal);
        resolve(null);
      };

      // Handle confirm
      document.getElementById("confirmAppNames").onclick = () => {
        const appNames = [];
        let allValid = true;

        for (let i = 0; i < files.length; i++) {
          const input = document.getElementById(`appName_${i}`);
          const appName = input.value.trim();

          if (!appName) {
            input.style.borderColor = "var(--error-color)";
            allValid = false;
          } else {
            input.style.borderColor = "";
            appNames.push(appName);
          }
        }

        if (!allValid) {
          // Show error message
          let errorMsg = modal.querySelector(".error-message");
          if (!errorMsg) {
            errorMsg = document.createElement("div");
            errorMsg.className = "error-message";
            errorMsg.style.cssText = `
              color: var(--error-color);
              font-size: 0.85rem;
              margin-top: 10px;
              text-align: center;
            `;
            errorMsg.textContent = "Please provide app names for all files.";
            modal.querySelector("div").appendChild(errorMsg);
          }
          return;
        }

        document.body.removeChild(modal);
        resolve(appNames);
      };

      // Handle Enter key
      modal.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          document.getElementById("confirmAppNames").click();
        }
      });
    });
  }

  readFile(file) {
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
calculatePerformanceMetrics(fpsData, refresh_period_ns, targetFPS) {
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
    

  parseData(rawData, fileName = null, userProvidedAppName = null) {
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
                const derivedAppName = this.deriveAppNameFromPackage(packageName);
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
                    appName = this.deriveAppNameFromPackage(packageName);
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
        packageName = this.extractPackageName(csvLines[0].split(",")[0]) || "Unknown Package";
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
      const targetFpsResult = this.detectTargetFPS(fpsData);
      const performanceMetrics = this.calculatePerformanceMetrics(
        fpsData,
        refreshPeriodNs,
        targetFpsResult.target
      );

      const finalAppName = userProvidedAppName || appName;

      // 4. Construct the final flat object with all requested metrics
      return {
        fileName: `Upload ${this.uploadedData.length + 1}`,
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

  extractPackageName(testId) {
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

  deriveAppNameFromPackage(packageName) {
    // Try to derive a user-friendly app name from package name
    if (!packageName || packageName === "Unknown Package") {
      return "Unknown App";
    }

    // Common package name patterns and their app names
    const packageMappings = {
      "com.netflix.mediaclient": "Netflix",
      "com.netflix.NGP.ProjectKraken": "SquidGames: Unleashed",
      "com.google.android.youtube": "YouTube",
      "com.facebook.katana": "Facebook",
      "com.instagram.android": "Instagram",
      "com.whatsapp": "WhatsApp",
      "com.spotify.music": "Spotify",
      "com.twitter.android": "Twitter",
      "com.snapchat.android": "Snapchat",
      "com.tencent.mm": "WeChat",
      "com.pubg.imobile": "PUBG Mobile",
      "com.king.candycrushsaga": "Candy Crush Saga",
      "com.supercell.clashofclans": "Clash of Clans",
      "com.mojang.minecraftpe": "Minecraft",
      "com.ea.gp.fifamobile": "FIFA Mobile",
      "com.miHoYo.GenshinImpact": "Genshin Impact",
      "com.tencent.ig": "PUBG Mobile",
      "com.garena.game.fctw": "Free Fire",
      "com.roblox.client": "Roblox",
      "com.discord": "Discord",
      "com.zhiliaoapp.musically": "TikTok",
      "com.ss.android.ugc.trill": "TikTok",
      "com.amazon.mShop.android.shopping": "Amazon",
      "com.ubercab": "Uber",
      "com.airbnb.android": "Airbnb",
      "com.paypal.android.p2pmobile": "PayPal",
      "com.microsoft.office.outlook": "Outlook",
      "com.google.android.apps.maps": "Google Maps",
      "com.google.android.gm": "Gmail",
      "com.google.android.apps.photos": "Google Photos",
      "com.android.chrome": "Chrome",
      "com.opera.browser": "Opera",
      "org.mozilla.firefox": "Firefox",
      "com.microsoft.emmx": "Edge",
    };

    // Check for exact match first
    if (packageMappings[packageName]) {
      return packageMappings[packageName];
    }

    // Try partial matches for common patterns
    const lowerPackage = packageName.toLowerCase();

    if (lowerPackage.includes("netflix")) return "Netflix";
    if (lowerPackage.includes("youtube")) return "YouTube";
    if (lowerPackage.includes("facebook")) return "Facebook";
    if (lowerPackage.includes("instagram")) return "Instagram";
    if (lowerPackage.includes("whatsapp")) return "WhatsApp";
    if (lowerPackage.includes("spotify")) return "Spotify";
    if (lowerPackage.includes("twitter")) return "Twitter";
    if (lowerPackage.includes("snapchat")) return "Snapchat";
    if (lowerPackage.includes("wechat") || lowerPackage.includes("tencent.mm"))
      return "WeChat";
    if (lowerPackage.includes("pubg")) return "PUBG Mobile";
    if (lowerPackage.includes("genshin")) return "Genshin Impact";
    if (lowerPackage.includes("minecraft")) return "Minecraft";
    if (lowerPackage.includes("discord")) return "Discord";
    if (lowerPackage.includes("tiktok") || lowerPackage.includes("musically"))
      return "TikTok";
    if (lowerPackage.includes("chrome")) return "Chrome";
    if (lowerPackage.includes("firefox")) return "Firefox";
    if (lowerPackage.includes("opera")) return "Opera";
    if (lowerPackage.includes("maps")) return "Google Maps";
    if (lowerPackage.includes("gmail")) return "Gmail";
    if (lowerPackage.includes("photos")) return "Google Photos";
    if (lowerPackage.includes("outlook")) return "Outlook";
    if (lowerPackage.includes("amazon")) return "Amazon";
    if (lowerPackage.includes("uber")) return "Uber";
    if (lowerPackage.includes("airbnb")) return "Airbnb";
    if (lowerPackage.includes("paypal")) return "PayPal";

    // If no match found, try to extract a readable name from the package
    const parts = packageName.split(".");
    if (parts.length >= 3) {
      // Take the last part and capitalize it
      const lastPart = parts[parts.length - 1];
      return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
    }

    return "Unknown App";
  }

  detectTargetFPS(frameData) {
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



  updateDisplay() {
    // Always update stats and table
    this.updateStats();
    this.updateTable();

    // Only update performance tables and charts if they should be visible
    // Check if we're in a view that should show these sections
    const performanceSection = document.getElementById("performanceSection");
    const chartsSection = document.getElementById("chartsSection");

    if (performanceSection && performanceSection.style.display !== "none") {
      this.updatePerformanceTables();
    }

    if (chartsSection && chartsSection.style.display !== "none") {
      this.updateCharts();
    }
  }

  updatePerformanceTables() {
    const performanceSection = document.getElementById("performanceSection");

    if (this.uploadedData.length === 0) {
      performanceSection.style.display = "none";
      return;
    }

    performanceSection.style.display = "block";

    // Get the most recent run for each app (always take the latest upload for each app)
    const latestRunsByApp = {};
    this.uploadedData.forEach((data) => {
      const appKey = data.appName || "Unknown App";
      if (
        !latestRunsByApp[appKey] ||
        new Date(data.timestamp) > new Date(latestRunsByApp[appKey].timestamp)
      ) {
        latestRunsByApp[appKey] = data;
      }
    });

    const latestRuns = Object.values(latestRunsByApp);

    // Sort by FPS for best and worst performing
    const sortedByFps = [...latestRuns].sort((a, b) => b.avgFps - a.avgFps);
    const bestPerforming = sortedByFps.slice(0, 5);
    const worstPerforming = sortedByFps.slice(-5).reverse();

    // Store all data for maximize functionality
    this.allBestPerforming = sortedByFps;
    this.allWorstPerforming = [...sortedByFps].reverse();

    // Create best performing table
    this.createPerformanceTable(
      "bestPerformingTable",
      bestPerforming,
      "best",
      false
    );

    // Create worst performing table
    this.createPerformanceTable(
      "worstPerformingTable",
      worstPerforming,
      "worst",
      false
    );
  }

  createPerformanceTable(containerId, data, type, isMaximized = false) {
    const container = document.getElementById(containerId);

    if (data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No data available</p>
        </div>
      `;
      return;
    }

    let tableHtml = `
      <table class="performance-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>App Name</th>
            <th>Avg FPS</th>
            <th>Device</th>
            <th>Memory (GB)</th>
          </tr>
        </thead>
        <tbody>
    `;

    data.forEach((item, index) => {
      const deviceInfo = item.deviceInfo || {};
      const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
      const model = deviceInfo["ro.product.model"] || "Unknown";
      const device = `${manufacturer} ${model}`;

      // Calculate memory in GB
      let memoryGB = "N/A";
      if (deviceInfo.MemTotal) {
        const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
        if (!isNaN(memKB)) {
          memoryGB = (memKB / (1024 * 1024)).toFixed(1);
        }
      }

      const rank = index + 1;
      const appName = item.appName || "Unknown App";
      const avgFps = item.avgFps.toFixed(1);

      tableHtml += `
        <tr>
          <td><strong>${rank}</strong></td>
          <td title="${appName}"><strong>${appName}</strong></td>
          <td><span class="fps-value ${type}"><strong>${avgFps}</strong></span></td>
          <td title="${device}">${device}</td>
          <td><strong>${memoryGB}</strong></td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    `;

    container.innerHTML = tableHtml;
  }

  showPerformanceTableModal(containerId, type) {
    const data =
      type === "best" ? this.allBestPerforming : this.allWorstPerforming;
    const title =
      type === "best" ? "🏆 Best Performing Apps" : "⚠️ Worst Performing Apps";

    this.showDataModal(data, title, type);
  }

  showDataModal(data, title, type) {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 3000;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="
        background: var(--card-bg);
        border-radius: var(--card-radius);
        border: var(--glass-border);
        backdrop-filter: blur(var(--glass-blur));
        padding: 30px;
        max-width: 90vw;
        width: 95%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h3 style="color: var(--text-primary); margin: 0;">${title}</h3>
          <div style="display: flex; gap: 10px; align-items: center;">
            <button 
              onclick="dashboard.copyModalData(this)" 
              style="
                background: var(--success-color);
                color: white;
                border: none;
                padding: 8px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
              "
              title="Copy table data"
            >
              📋
            </button>
            <button 
              onclick="dashboard.closeDataModal(this)" 
              style="
                background: transparent;
                border: 1px solid var(--border-color);
                color: var(--text-primary);
                font-size: 1.5rem;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
              "
            >
              &times;
            </button>
          </div>
        </div>
        <div style="overflow-x: auto;">
          <table class="performance-table" style="width: 100%; min-width: 600px;">
            <thead>
              <tr>
                <th>Rank</th>
                <th>App Name</th>
                <th>Avg FPS</th>
                <th>Device</th>
                <th>Memory (GB)</th>
                <th>Upload Time</th>
              </tr>
            </thead>
            <tbody>
              ${this.generateModalTableRows(data, type)}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    window.currentDataModal = modal;

    // Handle Escape key
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeDataModal();
      }
    });
  }

  generateModalTableRows(data, type) {
    let rows = "";
    data.forEach((item, index) => {
      const deviceInfo = item.deviceInfo || {};
      const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
      const model = deviceInfo["ro.product.model"] || "Unknown";
      const device = `${manufacturer} ${model}`;

      // Calculate memory in GB
      let memoryGB = "N/A";
      if (deviceInfo.MemTotal) {
        const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
        if (!isNaN(memKB)) {
          memoryGB = (memKB / (1024 * 1024)).toFixed(1);
        }
      }

      const rank = index + 1;
      const appName = item.appName || "Unknown App";
      const avgFps = item.avgFps.toFixed(1);
      const uploadTime = item.timestamp || "N/A";

      rows += `
        <tr>
          <td><strong>${rank}</strong></td>
          <td title="${appName}"><strong>${appName}</strong></td>
          <td><span class="fps-value ${type}"><strong>${avgFps}</strong></span></td>
          <td title="${device}">${device}</td>
          <td><strong>${memoryGB}</strong></td>
          <td title="${uploadTime}">${uploadTime}</td>
        </tr>
      `;
    });
    return rows;
  }

  copyModalData(button) {
    const modal = button.closest('div[style*="position: fixed"]');
    const table = modal.querySelector("table");
    if (!table) return;

    // Create rich text version
    let htmlContent =
      '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">';

    // Copy header
    const headerRow = table.querySelector("thead tr");
    if (headerRow) {
      htmlContent +=
        '<thead><tr style="background-color: #f0f0f0; font-weight: bold;">';
      headerRow.querySelectorAll("th").forEach((th) => {
        htmlContent += `<th style="padding: 8px; border: 1px solid #ccc;">${th.textContent}</th>`;
      });
      htmlContent += "</tr></thead>";
    }

    // Copy body
    const bodyRows = table.querySelectorAll("tbody tr");
    htmlContent += "<tbody>";
    bodyRows.forEach((row) => {
      htmlContent += "<tr>";
      row.querySelectorAll("td").forEach((td) => {
        const text = td.textContent;
        const isFpsValue = td.querySelector(".fps-value");
        const style = isFpsValue
          ? "padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #2563eb;"
          : "padding: 8px; border: 1px solid #ccc;";
        htmlContent += `<td style="${style}">${text}</td>`;
      });
      htmlContent += "</tr>";
    });
    htmlContent += "</tbody></table>";

    // Create plain text version
    let plainText = "";
    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll("th")).map(
        (th) => th.textContent
      );
      plainText += headers.join("\t") + "\n";
    }
    bodyRows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td")).map(
        (td) => td.textContent
      );
      plainText += cells.join("\t") + "\n";
    });

    // Copy to clipboard with rich formatting
    this.copyRichText(htmlContent, plainText, "Performance data copied!");
  }

  closeDataModal(button) {
    const modal = button
      ? button.closest('div[style*="position: fixed"]')
      : window.currentDataModal;
    if (modal && modal.parentNode) {
      document.body.removeChild(modal);
    }
    if (window.currentDataModal) {
      window.currentDataModal = null;
    }
  }

  togglePerformanceTable(containerId, type) {
    const container = document.getElementById(containerId);
    const isCurrentlyMaximized = container.dataset.maximized === "true";

    if (isCurrentlyMaximized) {
      // Show top 5
      const data =
        type === "best"
          ? this.allBestPerforming.slice(0, 5)
          : this.allWorstPerforming.slice(0, 5);
      this.createPerformanceTable(containerId, data, type, false);
      container.dataset.maximized = "false";
    } else {
      // Show all
      const data =
        type === "best" ? this.allBestPerforming : this.allWorstPerforming;
      this.createPerformanceTable(containerId, data, type, true);
      container.dataset.maximized = "true";
    }
  }

  copyPerformanceTable(containerId) {
    const table = document.querySelector(`#${containerId} table`);
    if (!table) return;

    // Create rich text version
    let htmlContent =
      '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">';

    // Copy header
    const headerRow = table.querySelector("thead tr");
    if (headerRow) {
      htmlContent +=
        '<thead><tr style="background-color: #f0f0f0; font-weight: bold;">';
      headerRow.querySelectorAll("th").forEach((th) => {
        htmlContent += `<th style="padding: 8px; border: 1px solid #ccc;">${th.textContent}</th>`;
      });
      htmlContent += "</tr></thead>";
    }

    // Copy body
    const bodyRows = table.querySelectorAll("tbody tr");
    htmlContent += "<tbody>";
    bodyRows.forEach((row) => {
      htmlContent += "<tr>";
      row.querySelectorAll("td").forEach((td) => {
        const text = td.textContent;
        const isFpsValue = td.querySelector(".fps-value");
        const style = isFpsValue
          ? "padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #2563eb;"
          : "padding: 8px; border: 1px solid #ccc;";
        htmlContent += `<td style="${style}">${text}</td>`;
      });
      htmlContent += "</tr>";
    });
    htmlContent += "</tbody></table>";

    // Create plain text version
    let plainText = "";
    if (headerRow) {
      const headers = Array.from(headerRow.querySelectorAll("th")).map(
        (th) => th.textContent
      );
      plainText += headers.join("\t") + "\n";
    }
    bodyRows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("td")).map(
        (td) => td.textContent
      );
      plainText += cells.join("\t") + "\n";
    });

    // Copy to clipboard with rich formatting
    this.copyRichText(htmlContent, plainText, "Performance table copied!");
  }

  copyRichText(htmlContent, plainText, successMessage) {
    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        const htmlBlob = new Blob([htmlContent], { type: "text/html" });
        const textBlob = new Blob([plainText], { type: "text/plain" });

        const clipboardItem = new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        });

        navigator.clipboard
          .write([clipboardItem])
          .then(() => {
            this.showToast(successMessage, "success");
          })
          .catch((err) => {
            console.error("Failed to copy rich text:", err);
            this.fallbackCopyText(plainText, successMessage);
          });
      } else {
        this.fallbackCopyText(plainText, successMessage);
      }
    } catch (error) {
      console.error("Copy failed:", error);
      this.fallbackCopyText(plainText, successMessage);
    }
  }

  copyAllPerformanceData() {
    if (this.uploadedData.length === 0) {
      this.showToast("No performance data available to copy.", "warning");
      return;
    }

    // Get the most recent run for each app
    const latestRunsByApp = {};
    this.uploadedData.forEach((data) => {
      const appKey = data.appName || "Unknown App";
      if (
        !latestRunsByApp[appKey] ||
        new Date(data.timestamp) > new Date(latestRunsByApp[appKey].timestamp)
      ) {
        latestRunsByApp[appKey] = data;
      }
    });

    const allData = Object.values(latestRunsByApp).sort(
      (a, b) => b.avgFps - a.avgFps
    );

    // Create rich text version
    let htmlContent =
      '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">';

    // Header
    htmlContent +=
      '<thead><tr style="background-color: #f0f0f0; font-weight: bold;">';
    htmlContent +=
      '<th style="padding: 8px; border: 1px solid #ccc;">Rank</th>';
    htmlContent +=
      '<th style="padding: 8px; border: 1px solid #ccc;">App Name</th>';
    htmlContent +=
      '<th style="padding: 8px; border: 1px solid #ccc;">Avg FPS</th>';
    htmlContent +=
      '<th style="padding: 8px; border: 1px solid #ccc;">Device</th>';
    htmlContent +=
      '<th style="padding: 8px; border: 1px solid #ccc;">Memory (GB)</th>';
    htmlContent +=
      '<th style="padding: 8px; border: 1px solid #ccc;">Upload Time</th>';
    htmlContent += "</tr></thead><tbody>";

    // Body
    allData.forEach((item, index) => {
      const deviceInfo = item.deviceInfo || {};
      const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
      const model = deviceInfo["ro.product.model"] || "Unknown";
      const device = `${manufacturer} ${model}`;

      // Calculate memory in GB
      let memoryGB = "N/A";
      if (deviceInfo.MemTotal) {
        const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
        if (!isNaN(memKB)) {
          memoryGB = (memKB / (1024 * 1024)).toFixed(1);
        }
      }

      const rank = index + 1;
      const appName = item.appName || "Unknown App";
      const avgFps = item.avgFps.toFixed(1);
      const uploadTime = item.timestamp || "N/A";

      htmlContent += "<tr>";
      htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;"><strong>${rank}</strong></td>`;
      htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;"><strong>${appName}</strong></td>`;
      htmlContent += `<td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #2563eb;"><strong>${avgFps}</strong></td>`;
      htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${device}</td>`;
      htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;"><strong>${memoryGB}</strong></td>`;
      htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${uploadTime}</td>`;
      htmlContent += "</tr>";
    });

    htmlContent += "</tbody></table>";

    // Create plain text version
    let plainText =
      "Rank\tApp Name\tAvg FPS\tDevice\tMemory (GB)\tUpload Time\n";
    allData.forEach((item, index) => {
      const deviceInfo = item.deviceInfo || {};
      const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
      const model = deviceInfo["ro.product.model"] || "Unknown";
      const device = `${manufacturer} ${model}`;

      let memoryGB = "N/A";
      if (deviceInfo.MemTotal) {
        const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
        if (!isNaN(memKB)) {
          memoryGB = (memKB / (1024 * 1024)).toFixed(1);
        }
      }

      const rank = index + 1;
      const appName = item.appName || "Unknown App";
      const avgFps = item.avgFps.toFixed(1);
      const uploadTime = item.timestamp || "N/A";

      plainText += `${rank}\t${appName}\t${avgFps}\t${device}\t${memoryGB}\t${uploadTime}\n`;
    });

    // Copy to clipboard with rich formatting
    this.copyRichText(htmlContent, plainText, "All performance data copied!");
  }

  fallbackCopyText(text, successMessage) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      this.showToast(successMessage, "success");
    } catch (err) {
      console.error("Fallback copy failed:", err);
      this.showToast("Failed to copy data", "error");
    }
  }

  updateStats() {
    const statsContainer = document.getElementById("statsContainer");

    if (this.uploadedData.length === 0) {
      statsContainer.style.display = "none";
      return;
    }

    statsContainer.style.display = "flex";

    // Total Runs
    const totalRuns = this.uploadedData.length;

    // Unique Games/Apps Tested
    const uniqueGames = new Set(
      this.uploadedData.map((data) => data.appName || "Unknown App")
    ).size;

    // Unique Devices (Brand + Model combination)
    const uniqueDevices = new Set(
      this.uploadedData.map((data) => {
        const deviceInfo = data.deviceInfo || {};
        const brand = deviceInfo["ro.product.manufacturer"] || "Unknown";
        const model = deviceInfo["ro.product.model"] || "Unknown";
        return `${brand} ${model}`;
      })
    ).size;

    // Average FPS Across All Runs
    const avgFpsOverall =
      this.uploadedData.reduce((sum, data) => sum + data.avgFps, 0) / totalRuns;

    // Upload Sessions Today (all uploads in current session count as today)
    const uploadsToday = this.uploadedData.length;

    // Most Recent Upload Time
    const mostRecentUpload =
      this.uploadedData.length > 0
        ? this.uploadedData[this.uploadedData.length - 1].timestamp
        : "N/A";

    document.getElementById("totalUploads").textContent = totalRuns;
    document.getElementById("totalFrames").textContent = uniqueGames;
    document.getElementById("totalTime").textContent = uniqueDevices;
    document.getElementById("avgFpsOverall").textContent =
      avgFpsOverall.toFixed(1);
    document.getElementById("uploadsToday").textContent = uploadsToday;
    document.getElementById("recentUpload").textContent = mostRecentUpload;
  }

  updateTable() {
    // Use the new checkbox-enabled table function
    updateTableWithCheckboxes();
  }

  updateCharts() {
    const chartsSection = document.getElementById("chartsSection");

    if (this.uploadedData.length === 0) {
      chartsSection.style.display = "none";
      return;
    }

    chartsSection.style.display = "block";

    // Create or update charts
    this.createFPSChart();
    this.createDeviceChart();
    this.createMemoryFpsChart();
    this.createBatteryDrainChart();
  }

  createFPSChart() {
    const ctx = document.getElementById("fpsChart").getContext("2d");

    // Destroy existing chart if it exists
    if (this.charts.fpsChart) {
      this.charts.fpsChart.destroy();
    }

    // Group data by app name and calculate average FPS
    const appFpsData = {};
    this.uploadedData.forEach((data) => {
      const appName = data.appName || "Unknown App";
      if (!appFpsData[appName]) {
        appFpsData[appName] = [];
      }
      appFpsData[appName].push(data.avgFps);
    });

    // Calculate averages for each app and sort by FPS
    const appAverages = Object.keys(appFpsData)
      .map((app) => {
        const values = appFpsData[app];
        const avgFps =
          values.reduce((sum, val) => sum + val, 0) / values.length;
        return { app, avgFps };
      })
      .sort((a, b) => b.avgFps - a.avgFps);

    // Store all data for maximize functionality
    this.allFpsChartData = appAverages;

    // Show top 5 by default
    const topApps = appAverages.slice(0, 5);
    const labels = topApps.map((item) => item.app);
    const avgFpsValues = topApps.map((item) => item.avgFps);

    this.charts.fpsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Average FPS",
            data: avgFpsValues,
            backgroundColor: "rgba(99, 102, 241, 0.6)",
            borderColor: "rgba(99, 102, 241, 1)",
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 20,
            left: 10,
            right: 10,
            top: 10,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              padding: 5,
            },
          },
          x: {
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              maxRotation: 45,
              minRotation: 0,
              padding: 10,
              font: {
                size: 11,
              },
            },
          },
        },
      },
    });

    // Add maximize/copy controls
    this.addChartControls("fpsChart", "fps");
  }

  createDeviceChart() {
    const ctx = document.getElementById("deviceChart").getContext("2d");

    // Destroy existing chart if it exists
    if (this.charts.deviceChart) {
      this.charts.deviceChart.destroy();
    }

    // Group data by device manufacturer
    const deviceData = {};
    this.uploadedData.forEach((data) => {
      const manufacturer =
        data.deviceInfo?.["ro.product.manufacturer"] || "Unknown";
      deviceData[manufacturer] = (deviceData[manufacturer] || 0) + 1;
    });

    const labels = Object.keys(deviceData);
    const values = Object.values(deviceData);

    // Generate colors for each segment
    const colors = labels.map((_, index) => {
      const hue = (index * 137.5) % 360; // Golden angle for good color distribution
      return `hsla(${hue}, 70%, 60%, 0.8)`;
    });

    this.charts.deviceChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderColor: colors.map((color) => color.replace("0.8", "1")),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 40,
            left: 10,
            right: 10,
            top: 10,
          },
        },
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "rgba(255, 255, 255, 0.8)",
              padding: 12,
              usePointStyle: true,
              boxWidth: 12,
              boxHeight: 12,
              font: {
                size: 10,
              },
              generateLabels: function (chart) {
                const data = chart.data;
                if (data.labels.length && data.datasets.length) {
                  return data.labels.map((label, index) => {
                    const dataset = data.datasets[0];
                    const backgroundColor = Array.isArray(
                      dataset.backgroundColor
                    )
                      ? dataset.backgroundColor[index]
                      : dataset.backgroundColor;

                    // Truncate long labels to prevent overflow
                    let displayLabel = label;
                    if (displayLabel && displayLabel.length > 12) {
                      displayLabel = displayLabel.substring(0, 12) + "...";
                    }

                    return {
                      text: displayLabel,
                      fillStyle: backgroundColor,
                      strokeStyle: backgroundColor,
                      lineWidth: 2,
                      hidden: false,
                      index: index,
                    };
                  });
                }
                return [];
              },
            },
            maxHeight: 100,
            fullSize: false,
          },
        },
      },
    });
  }

  createMemoryFpsChart() {
    const ctx = document.getElementById("memoryFpsChart").getContext("2d");

    // Destroy existing chart if it exists
    if (this.charts.memoryFpsChart) {
      this.charts.memoryFpsChart.destroy();
    }

    // Prepare data for bubble chart
    const bubbleData = [];
    this.uploadedData.forEach((data, index) => {
      const deviceInfo = data.deviceInfo || {};

      // Calculate memory in GB
      let memoryGB = 0;
      if (deviceInfo.MemTotal) {
        const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
        if (!isNaN(memKB)) {
          memoryGB = memKB / (1024 * 1024); // Convert KB to GB
        }
      }

      // Skip data points without valid memory or FPS data
      if (memoryGB > 0 && data.avgFps > 0) {
        // Use elapsed time for bubble size (normalize to reasonable range)
        const bubbleSize = Math.max(
          5,
          Math.min(20, data.elapsedTimeSeconds || 10)
        );

        bubbleData.push({
          x: memoryGB,
          y: data.avgFps,
          r: bubbleSize,
          label: data.appName || "Unknown App",
          device: deviceInfo["ro.product.manufacturer"] || "Unknown",
          elapsedTime: data.elapsedTimeSeconds || 0,
        });
      }
    });

    // Sort by FPS and store all data
    const sortedBubbleData = [...bubbleData].sort((a, b) => b.y - a.y);
    this.allMemoryFpsData = sortedBubbleData;

    // Show top 5 by default
    const topData = sortedBubbleData.slice(0, 5);

    // Generate colors for each bubble
    const colors = topData.map((_, index) => {
      const hue = (index * 137.5) % 360;
      return `hsla(${hue}, 70%, 60%, 0.7)`;
    });

    this.charts.memoryFpsChart = new Chart(ctx, {
      type: "bubble",
      data: {
        datasets: [
          {
            label: "Memory vs FPS",
            data: topData,
            backgroundColor: colors,
            borderColor: colors.map((color) => color.replace("0.7", "1")),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 30,
            left: 20,
            right: 20,
            top: 10,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: function (context) {
                const point = context[0].raw;
                return point.label;
              },
              label: function (context) {
                const point = context.raw;
                return [
                  `Memory: ${point.x.toFixed(2)} GB`,
                  `Avg FPS: ${point.y.toFixed(1)}`,
                  `Elapsed Time: ${point.elapsedTime.toFixed(1)}s`,
                  `Device: ${point.device}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            title: {
              display: true,
              text: "Total Memory (GB)",
              color: "rgba(255, 255, 255, 0.8)",
              padding: {
                top: 10,
              },
              font: {
                size: 12,
              },
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              padding: 5,
              font: {
                size: 11,
              },
            },
          },
          y: {
            title: {
              display: true,
              text: "Average FPS",
              color: "rgba(255, 255, 255, 0.8)",
              padding: {
                bottom: 10,
              },
              font: {
                size: 12,
              },
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              padding: 5,
              font: {
                size: 11,
              },
            },
          },
        },
      },
    });

    // Add maximize/copy controls
    this.addChartControls("memoryFpsChart", "memory");
  }

  addChartControls(chartId, chartType) {
    const chartContainer = document.getElementById(chartId).parentElement;

    // Check if controls already exist
    if (chartContainer.querySelector(".chart-controls")) {
      return;
    }

    const controlsDiv = document.createElement("div");
    controlsDiv.className = "chart-controls";
    controlsDiv.style.cssText = `
      position: absolute;
      top: 10px;
      right: 10px;
      display: flex;
      gap: 8px;
      z-index: 10;
    `;

    controlsDiv.innerHTML = `
      <button 
        onclick="dashboard.toggleChart('${chartId}', '${chartType}')" 
        style="
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 6px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
        "
        title="Show more data"
        id="${chartId}MaxBtn"
      >
        📈
      </button>
      <button 
        onclick="dashboard.copyChart('${chartId}')" 
        style="
          background: var(--success-color);
          color: white;
          border: none;
          padding: 6px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
        "
        title="Copy chart data"
      >
        📋
      </button>
    `;

    // Make chart container relative positioned
    chartContainer.style.position = "relative";
    chartContainer.appendChild(controlsDiv);
  }

  toggleChart(chartId, chartType) {
    const btn = document.getElementById(`${chartId}MaxBtn`);
    const isMaximized = btn.dataset.maximized === "true";

    if (chartType === "fps") {
      this.toggleFpsChart(isMaximized);
    } else if (chartType === "memory") {
      this.toggleMemoryChart(isMaximized);
    }

    // Update button icon and state
    if (isMaximized) {
      btn.innerHTML = "📈";
      btn.dataset.maximized = "false";
      btn.title = "Show more data";
    } else {
      btn.innerHTML = "📉";
      btn.dataset.maximized = "true";
      btn.title = "Show less data";
    }
  }

  toggleFpsChart(isMaximized) {
    const ctx = document.getElementById("fpsChart").getContext("2d");

    if (this.charts.fpsChart) {
      this.charts.fpsChart.destroy();
    }

    // Determine how many items to show
    const itemsToShow = isMaximized ? 5 : 15;
    const dataToShow = this.allFpsChartData.slice(0, itemsToShow);

    const labels = dataToShow.map((item) => item.app);
    const avgFpsValues = dataToShow.map((item) => item.avgFps);

    this.charts.fpsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Average FPS",
            data: avgFpsValues,
            backgroundColor: "rgba(99, 102, 241, 0.6)",
            borderColor: "rgba(99, 102, 241, 1)",
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 20,
            left: 10,
            right: 10,
            top: 10,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              padding: 5,
            },
          },
          x: {
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              maxRotation: 45,
              minRotation: 0,
              padding: 10,
              font: {
                size: 11,
              },
            },
          },
        },
      },
    });
  }

  toggleMemoryChart(isMaximized) {
    const ctx = document.getElementById("memoryFpsChart").getContext("2d");

    if (this.charts.memoryFpsChart) {
      this.charts.memoryFpsChart.destroy();
    }

    // Determine how many items to show
    const itemsToShow = isMaximized ? 5 : 15;
    const dataToShow = this.allMemoryFpsData.slice(0, itemsToShow);

    // Generate colors for each bubble
    const colors = dataToShow.map((_, index) => {
      const hue = (index * 137.5) % 360;
      return `hsla(${hue}, 70%, 60%, 0.7)`;
    });

    this.charts.memoryFpsChart = new Chart(ctx, {
      type: "bubble",
      data: {
        datasets: [
          {
            label: "Memory vs FPS",
            data: dataToShow,
            backgroundColor: colors,
            borderColor: colors.map((color) => color.replace("0.7", "1")),
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 30,
            left: 20,
            right: 20,
            top: 10,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: function (context) {
                const point = context[0].raw;
                return point.label;
              },
              label: function (context) {
                const point = context.raw;
                return [
                  `Memory: ${point.x.toFixed(2)} GB`,
                  `Avg FPS: ${point.y.toFixed(1)}`,
                  `Elapsed Time: ${point.elapsedTime.toFixed(1)}s`,
                  `Device: ${point.device}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            title: {
              display: true,
              text: "Total Memory (GB)",
              color: "rgba(255, 255, 255, 0.8)",
              padding: {
                top: 10,
              },
              font: {
                size: 12,
              },
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              padding: 5,
              font: {
                size: 11,
              },
            },
          },
          y: {
            title: {
              display: true,
              text: "Average FPS",
              color: "rgba(255, 255, 255, 0.8)",
              padding: {
                bottom: 10,
              },
              font: {
                size: 12,
              },
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              padding: 5,
              font: {
                size: 11,
              },
            },
          },
        },
      },
    });
  }

  createBatteryDrainChart() {
    const ctx = document.getElementById("batteryDrainChart").getContext("2d");

    // Destroy existing chart if it exists
    if (this.charts.batteryDrainChart) {
      this.charts.batteryDrainChart.destroy();
    }

    // Filter data that has battery information
    const dataWithBattery = this.uploadedData.filter((data) => {
      return (
        data.fpsBuckets &&
        data.fpsBuckets.startBattery !== undefined &&
        data.fpsBuckets.endBattery !== undefined &&
        data.fpsBuckets.startBattery > 0 &&
        data.fpsBuckets.endBattery >= 0
      );
    });

    if (dataWithBattery.length === 0) {
      // Show empty state
      const chartContainer =
        document.getElementById("batteryDrainChart").parentElement;
      chartContainer.innerHTML = `
        <div class="chart-title">
          Battery Drain by App & Device
          <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: center;">
            <button 
              id="batteryDrainToggle" 
              onclick="dashboard.toggleBatteryDrainMode()"
              style="
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
              "
              title="Toggle between total drain and drain per minute"
            >
              Switch to Per Minute
            </button>
          </div>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; height: 300px; color: var(--text-secondary);">
          <p>No battery data available in uploaded files</p>
        </div>
      `;
      return;
    }

    // Group data by app name
    const appBatteryData = {};
    dataWithBattery.forEach((data) => {
      const appName = data.appName || "Unknown App";
      const deviceInfo = data.deviceInfo || {};
      const deviceName = `${
        deviceInfo["ro.product.manufacturer"] || "Unknown"
      } ${deviceInfo["ro.product.model"] || "Unknown"}`;

      if (!appBatteryData[appName]) {
        appBatteryData[appName] = {};
      }

      const batteryDrain =
        data.fpsBuckets.startBattery - data.fpsBuckets.endBattery;
      const elapsedTimeMinutes = (data.elapsedTimeSeconds || 0) / 60;

      // Store both total drain and per-minute drain
      appBatteryData[appName][deviceName] = {
        totalDrain: Math.max(0, batteryDrain), // Ensure non-negative
        drainPerMinute:
          elapsedTimeMinutes > 0 ? batteryDrain / elapsedTimeMinutes : 0,
        avgFps: data.avgFps,
        elapsedTime: data.elapsedTimeSeconds || 0,
      };
    });

    // Determine if we're showing total drain or per-minute drain
    const isPerMinute = this.batteryDrainMode === "perMinute";
    const dataKey = isPerMinute ? "drainPerMinute" : "totalDrain";
    const yAxisLabel = isPerMinute
      ? "Battery Drain per Minute (%)"
      : "Battery Drain (%)";

    // Prepare data for grouped bar chart
    const apps = Object.keys(appBatteryData);
    const allDevices = new Set();

    // Collect all unique devices
    apps.forEach((app) => {
      Object.keys(appBatteryData[app]).forEach((device) => {
        allDevices.add(device);
      });
    });

    const devices = Array.from(allDevices);

    // If too many devices, show as heatmap instead
    if (devices.length > 8 || apps.length > 10) {
      this.createBatteryDrainHeatmap(appBatteryData, isPerMinute);
      return;
    }

    // Generate colors for each device
    const deviceColors = {};
    devices.forEach((device, index) => {
      const hue = (index * 137.5) % 360;
      deviceColors[device] = `hsl(${hue}, 70%, 60%)`;
    });

    // Create datasets for each device
    const datasets = devices.map((device) => {
      const data = apps.map((app) => {
        const appData = appBatteryData[app][device];
        return appData ? appData[dataKey] : 0;
      });

      return {
        label: device,
        data: data,
        backgroundColor: deviceColors[device] + "80",
        borderColor: deviceColors[device],
        borderWidth: 2,
        borderRadius: 4,
      };
    });

    this.charts.batteryDrainChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: apps,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 20,
            left: 10,
            right: 10,
            top: 10,
          },
        },
        plugins: {
          legend: {
            labels: {
              color: "rgba(255, 255, 255, 0.8)",
              usePointStyle: true,
              boxWidth: 12,
              font: {
                size: 10,
              },
            },
            maxHeight: 80,
          },
          tooltip: {
            callbacks: {
              title: function (context) {
                return context[0].label;
              },
              label: function (context) {
                const device = context.dataset.label;
                const app = context.label;
                const appData = appBatteryData[app][device];

                if (!appData) return "";

                const drainValue = isPerMinute
                  ? `${context.parsed.y.toFixed(2)}%/min`
                  : `${context.parsed.y.toFixed(1)}%`;

                return [
                  `${device}`,
                  `Battery Drain: ${drainValue}`,
                  `Elapsed Time: ${appData.elapsedTime.toFixed(1)}s`,
                  `Avg FPS: ${appData.avgFps.toFixed(1)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              maxRotation: 45,
              font: {
                size: 11,
              },
            },
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: yAxisLabel,
              color: "rgba(255, 255, 255, 0.8)",
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              callback: function (value) {
                return isPerMinute ? `${value.toFixed(1)}%/min` : `${value}%`;
              },
            },
          },
        },
      },
    });

    // Add chart controls
    this.addChartControls("batteryDrainChart", "battery");
  }

  createBatteryDrainHeatmap(appBatteryData, isPerMinute) {
    const ctx = document.getElementById("batteryDrainChart").getContext("2d");

    // Destroy existing chart if it exists
    if (this.charts.batteryDrainChart) {
      this.charts.batteryDrainChart.destroy();
    }

    const apps = Object.keys(appBatteryData);
    const allDevices = new Set();

    // Collect all unique devices
    apps.forEach((app) => {
      Object.keys(appBatteryData[app]).forEach((device) => {
        allDevices.add(device);
      });
    });

    const devices = Array.from(allDevices);
    const dataKey = isPerMinute ? "drainPerMinute" : "totalDrain";

    // Create heatmap data
    const heatmapData = [];
    let maxValue = 0;

    apps.forEach((app, appIndex) => {
      devices.forEach((device, deviceIndex) => {
        const appData = appBatteryData[app][device];
        const value = appData ? appData[dataKey] : 0;
        maxValue = Math.max(maxValue, value);

        heatmapData.push({
          x: appIndex,
          y: deviceIndex,
          v: value,
          app: app,
          device: device,
          appData: appData,
        });
      });
    });

    // Generate colors based on value intensity
    const colors = heatmapData.map((point) => {
      const intensity = maxValue > 0 ? point.v / maxValue : 0;
      const alpha = Math.max(0.1, intensity);
      return `rgba(239, 68, 68, ${alpha})`;
    });

    this.charts.batteryDrainChart = new Chart(ctx, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "Battery Drain",
            data: heatmapData,
            backgroundColor: colors,
            borderColor: colors.map((color) =>
              color.replace(/[\d.]+\)$/g, "1)")
            ),
            borderWidth: 1,
            pointRadius: 15,
            pointHoverRadius: 18,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            bottom: 40,
            left: 60,
            right: 20,
            top: 20,
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              title: function (context) {
                const point = context[0].raw;
                return `${point.app} on ${point.device}`;
              },
              label: function (context) {
                const point = context.raw;
                if (!point.appData) return "No data";

                const drainValue = isPerMinute
                  ? `${point.v.toFixed(2)}%/min`
                  : `${point.v.toFixed(1)}%`;

                return [
                  `Battery Drain: ${drainValue}`,
                  `Elapsed Time: ${point.appData.elapsedTime.toFixed(1)}s`,
                  `Avg FPS: ${point.appData.avgFps.toFixed(1)}`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            min: -0.5,
            max: apps.length - 0.5,
            title: {
              display: true,
              text: "Apps",
              color: "rgba(255, 255, 255, 0.8)",
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              stepSize: 1,
              callback: function (value) {
                return apps[Math.round(value)] || "";
              },
              maxRotation: 45,
              font: {
                size: 10,
              },
            },
          },
          y: {
            type: "linear",
            min: -0.5,
            max: devices.length - 0.5,
            title: {
              display: true,
              text: "Devices",
              color: "rgba(255, 255, 255, 0.8)",
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              stepSize: 1,
              callback: function (value) {
                const device = devices[Math.round(value)];
                return device && device.length > 20
                  ? device.substring(0, 20) + "..."
                  : device || "";
              },
              font: {
                size: 9,
              },
            },
          },
        },
      },
    });

    // Add chart controls
    this.addChartControls("batteryDrainChart", "battery");
  }

  toggleBatteryDrainMode() {
    // Toggle between total drain and per-minute drain
    this.batteryDrainMode =
      this.batteryDrainMode === "perMinute" ? "total" : "perMinute";

    // Update button text
    const toggleBtn = document.getElementById("batteryDrainToggle");
    if (toggleBtn) {
      toggleBtn.textContent =
        this.batteryDrainMode === "perMinute"
          ? "Switch to Total Drain"
          : "Switch to Per Minute";
    }

    // Recreate the chart with new mode
    this.createBatteryDrainChart();
  }

  copyChart(chartId) {
    const chart = this.charts[chartId.replace("Chart", "Chart")];
    if (!chart) return;

    // Get chart data
    const chartData = chart.data;
    let htmlContent =
      '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; font-family: Arial, sans-serif;">';

    // Create table from chart data
    if (chartId === "fpsChart") {
      htmlContent +=
        '<thead><tr style="background-color: #f0f0f0; font-weight: bold;">';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">App Name</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Average FPS</th>';
      htmlContent += "</tr></thead><tbody>";

      chartData.labels.forEach((label, index) => {
        const fps = chartData.datasets[0].data[index];
        htmlContent += "<tr>";
        htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${label}</td>`;
        htmlContent += `<td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #2563eb;">${fps.toFixed(
          1
        )}</td>`;
        htmlContent += "</tr>";
      });
    } else if (chartId === "memoryFpsChart") {
      htmlContent +=
        '<thead><tr style="background-color: #f0f0f0; font-weight: bold;">';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">App Name</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Memory (GB)</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Average FPS</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Elapsed Time (s)</th>';
      htmlContent += "</tr></thead><tbody>";

      chartData.datasets[0].data.forEach((point) => {
        htmlContent += "<tr>";
        htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${point.label}</td>`;
        htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${point.x.toFixed(
          2
        )}</td>`;
        htmlContent += `<td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #2563eb;">${point.y.toFixed(
          1
        )}</td>`;
        htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${point.elapsedTime.toFixed(
          1
        )}</td>`;
        htmlContent += "</tr>";
      });
    } else if (chartId === "batteryDrainChart") {
      htmlContent +=
        '<thead><tr style="background-color: #f0f0f0; font-weight: bold;">';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">App</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Device</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Battery Drain</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Avg FPS</th>';
      htmlContent +=
        '<th style="padding: 8px; border: 1px solid #ccc;">Elapsed Time (s)</th>';
      htmlContent += "</tr></thead><tbody>";

      // Handle both grouped bar chart and heatmap data
      if (chartData.datasets && chartData.datasets.length > 0) {
        if (chartData.labels) {
          // Grouped bar chart
          chartData.labels.forEach((app, appIndex) => {
            chartData.datasets.forEach((dataset) => {
              const drainValue = dataset.data[appIndex];
              if (drainValue > 0) {
                htmlContent += "<tr>";
                htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${app}</td>`;
                htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${dataset.label}</td>`;
                htmlContent += `<td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #ef4444;">${drainValue.toFixed(
                  2
                )}${
                  this.batteryDrainMode === "perMinute" ? "%/min" : "%"
                }</td>`;
                htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">N/A</td>`;
                htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">N/A</td>`;
                htmlContent += "</tr>";
              }
            });
          });
        } else {
          // Heatmap data
          chartData.datasets[0].data.forEach((point) => {
            if (point.appData) {
              htmlContent += "<tr>";
              htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${point.app}</td>`;
              htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${point.device}</td>`;
              htmlContent += `<td style="padding: 8px; border: 1px solid #ccc; font-weight: bold; color: #ef4444;">${point.v.toFixed(
                2
              )}${this.batteryDrainMode === "perMinute" ? "%/min" : "%"}</td>`;
              htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${point.appData.avgFps.toFixed(
                1
              )}</td>`;
              htmlContent += `<td style="padding: 8px; border: 1px solid #ccc;">${point.appData.elapsedTime.toFixed(
                1
              )}</td>`;
              htmlContent += "</tr>";
            }
          });
        }
      }
    }

    htmlContent += "</tbody></table>";

    // Create plain text version
    let plainText = "";
    if (chartId === "fpsChart") {
      plainText = "App Name\tAverage FPS\n";
      chartData.labels.forEach((label, index) => {
        const fps = chartData.datasets[0].data[index];
        plainText += `${label}\t${fps.toFixed(1)}\n`;
      });
    } else if (chartId === "memoryFpsChart") {
      plainText = "App Name\tMemory (GB)\tAverage FPS\tElapsed Time (s)\n";
      chartData.datasets[0].data.forEach((point) => {
        plainText += `${point.label}\t${point.x.toFixed(2)}\t${point.y.toFixed(
          1
        )}\t${point.elapsedTime.toFixed(1)}\n`;
      });
    } else if (chartId === "batteryDrainChart") {
      plainText = "App\tDevice\tBattery Drain\tAvg FPS\tElapsed Time (s)\n";
      // Handle both chart types for plain text
      if (chartData.labels) {
        chartData.labels.forEach((app, appIndex) => {
          chartData.datasets.forEach((dataset) => {
            const drainValue = dataset.data[appIndex];
            if (drainValue > 0) {
              plainText += `${app}\t${dataset.label}\t${drainValue.toFixed(2)}${
                this.batteryDrainMode === "perMinute" ? "%/min" : "%"
              }\tN/A\tN/A\n`;
            }
          });
        });
      } else {
        chartData.datasets[0].data.forEach((point) => {
          if (point.appData) {
            plainText += `${point.app}\t${point.device}\t${point.v.toFixed(2)}${
              this.batteryDrainMode === "perMinute" ? "%/min" : "%"
            }\t${point.appData.avgFps.toFixed(
              1
            )}\t${point.appData.elapsedTime.toFixed(1)}\n`;
          }
        });
      }
    }

    // Copy to clipboard with rich formatting
    this.copyRichText(htmlContent, plainText, "Chart data copied!");
  }

  async loadDemoData() {
    try {
      this.showLoading();

      // Demo file names to load
      const demoFiles = [
        "input_1.txt",
        "input_2.txt",
        "input_3.txt",
        "input_4.txt",
        "input_5.txt",
        "input_6.txt",
        "input_7.txt",
        "input_8.txt",
        "input_9.txt",
        "input_10.txt",
        "input.txt",
      ];

      let successCount = 0;
      let errorCount = 0;

      for (const fileName of demoFiles) {
        try {
          const response = await fetch(fileName);
          if (response.ok) {
            const rawData = await response.text();
            const parsedData = this.parseData(rawData, fileName);

            if (parsedData) {
              this.uploadedData.push(parsedData);
              successCount++;
            } else {
              errorCount++;
            }
          } else {
            console.warn(`Failed to load demo file: ${fileName}`);
            errorCount++;
          }
        } catch (error) {
          console.error(`Error loading demo file ${fileName}:`, error);
          errorCount++;
        }
      }

      this.updateDisplay();

      if (successCount > 0) {
        this.showToast(
          `Successfully loaded ${successCount} demo file${
            successCount > 1 ? "s" : ""
          }!`,
          "success"
        );
      } else {
        this.showToast(
          "Failed to load demo data. Please check console for errors.",
          "error"
        );
      }
    } catch (error) {
      console.error("Error loading demo data:", error);
      this.showToast(`Error loading demo data: ${error.message}`, "error");
    } finally {
      this.hideLoading();
    }
  }

  clearAllData() {
    if (this.uploadedData.length === 0) {
      this.showToast("No data to clear.", "warning");
      return;
    }

    if (confirm("Are you sure you want to clear all uploaded data?")) {
      this.uploadedData = [];
      this.filteredData = [];
      this.currentView = "recent";
      this.currentPage = 1;
      this.searchTerm = "";
      this.activeFilters.clear();

      // Destroy all charts
      Object.values(this.charts).forEach((chart) => {
        if (chart) chart.destroy();
      });
      this.charts = {};

      this.updateDisplay();
      this.updateViewControls();
      this.showToast("All data cleared successfully.", "success");

      // Clear file input as well
      document.getElementById("fileInput").value = "";
    }
  }

  toggleView() {
    if (this.currentView === "recent") {
      this.currentView = "all";
      this.currentPage = 1;
      this.applyFiltersAndSearch();
      this.updateViewControls();
      this.updateTableWithPagination();
    } else {
      this.currentView = "recent";
      this.currentPage = 1;
      this.searchTerm = "";
      this.activeFilters.clear();
      document.getElementById("searchInput").value = "";
      this.updateViewControls();
      this.updateTable();
    }
  }

  updateViewControls() {
    const showAllBtn = document.getElementById("showAllBtn");
    const resultsCount = document.getElementById("resultsCount");
    const searchFilterSection = document.getElementById("searchFilterSection");

    if (this.currentView === "recent") {
      showAllBtn.textContent = "Show All";
      resultsCount.textContent = "Showing recent 10 results";
      searchFilterSection.style.display = "none";
    } else {
      showAllBtn.textContent = "Show Recent";
      const totalResults = this.filteredData.length;
      const startIndex = (this.currentPage - 1) * this.itemsPerPage + 1;
      const endIndex = Math.min(
        this.currentPage * this.itemsPerPage,
        totalResults
      );
      resultsCount.textContent = `Showing ${startIndex}-${endIndex} of ${totalResults} results`;
      searchFilterSection.style.display = "block";
    }
  }

  handleSearch(searchTerm) {
    this.searchTerm = searchTerm.toLowerCase();
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    this.updateViewControls();
    this.updateTableWithPagination();
  }

  clearSearch() {
    this.searchTerm = "";
    this.activeFilters.clear();
    document.getElementById("searchInput").value = "";
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    this.updateViewControls();
    this.updateTableWithPagination();
    this.updateFilterChips();
  }

  applyFiltersAndSearch() {
    this.filteredData = this.uploadedData.filter((data) => {
      // Apply search filter
      if (this.searchTerm) {
        const searchableText = [
          data.appName || "",
          data.packageName || "",
          data.deviceInfo?.["ro.product.manufacturer"] || "",
          data.deviceInfo?.["ro.product.model"] || "",
          data.deviceInfo?.["ro.soc.model"] || "",
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(this.searchTerm)) {
          return false;
        }
      }

      // Apply active filters
      for (const [filterType, filterValue] of this.activeFilters) {
        switch (filterType) {
          case "manufacturer":
            if (
              (data.deviceInfo?.["ro.product.manufacturer"] || "Unknown") !==
              filterValue
            ) {
              return false;
            }
            break;
          case "app":
            if ((data.appName || "Unknown App") !== filterValue) {
              return false;
            }
            break;
          case "soc":
            if (
              (data.deviceInfo?.["ro.soc.model"] || "Unknown") !== filterValue
            ) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }

  addFilter(type, value) {
    const filterKey = `${type}:${value}`;
    this.activeFilters.set(filterKey, { type, value });
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    this.updateViewControls();
    this.updateTableWithPagination();
    this.updateFilterChips();
  }

  removeFilter(filterKey) {
    this.activeFilters.delete(filterKey);
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    this.updateViewControls();
    this.updateTableWithPagination();
    this.updateFilterChips();
  }

  updateFilterChips() {
    const filterChips = document.getElementById("filterChips");

    if (this.activeFilters.size === 0) {
      filterChips.innerHTML = "";
      return;
    }

    let chipsHtml = "";
    for (const [filterKey, filter] of this.activeFilters) {
      const displayValue =
        filter.value.length > 20
          ? filter.value.substring(0, 20) + "..."
          : filter.value;
      chipsHtml += `
        <div class="filter-chip" data-filter-key="${filterKey}">
          ${filter.type}: ${displayValue}
          <span class="remove" onclick="dashboard.removeFilter('${filterKey}')">&times;</span>
        </div>
      `;
    }
    filterChips.innerHTML = chipsHtml;
  }

  // LDAP Authentication Methods
  async showAuthenticationModal() {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3500;
      `;

      modal.innerHTML = `
        <div style="
          background: var(--card-bg);
          border-radius: var(--card-radius);
          border: var(--glass-border);
          backdrop-filter: blur(var(--glass-blur));
          padding: 30px;
          max-width: 450px;
          width: 90%;
        ">
          <h3 style="color: var(--text-primary); margin-top: 0; text-align: center;">
            🔐 Admin Authentication Required
          </h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px; text-align: center;">
            Only authorized administrators can delete analysis results.
          </p>
          <div style="margin-bottom: 15px;">
            <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">
              LDAP Email:
            </label>
            <input 
              type="email" 
              id="ldapEmail" 
              placeholder="Enter your LDAP email (e.g., danduri@company.com)"
              style="
                width: 100%;
                padding: 12px;
                border-radius: var(--btn-radius);
                border: 1px solid var(--border-color);
                background: var(--input-bg-color);
                color: var(--text-primary);
                font-family: 'Inter', sans-serif;
                box-sizing: border-box;
              "
            />
          </div>
          <div id="authError" style="
            color: var(--error-color);
            font-size: 0.85rem;
            margin-bottom: 15px;
            text-align: center;
            display: none;
          "></div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="cancelAuth" style="
              padding: 10px 20px;
              border-radius: var(--btn-radius);
              border: 1px solid var(--border-color);
              background: transparent;
              color: var(--text-primary);
              cursor: pointer;
            ">Cancel</button>
            <button id="confirmAuth" style="
              padding: 10px 20px;
              border-radius: var(--btn-radius);
              border: none;
              background: var(--primary-color);
              color: white;
              cursor: pointer;
            ">Authenticate</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Focus email input
      setTimeout(() => {
        const emailInput = document.getElementById("ldapEmail");
        if (emailInput) emailInput.focus();
      }, 100);

      // Handle cancel
      document.getElementById("cancelAuth").onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };

      // Handle authenticate
      document.getElementById("confirmAuth").onclick = () => {
        const email = document
          .getElementById("ldapEmail")
          .value.trim()
          .toLowerCase();
        const errorDiv = document.getElementById("authError");

        if (!email) {
          errorDiv.textContent = "Please enter your LDAP email.";
          errorDiv.style.display = "block";
          return;
        }

        // Check if email is in admin list
        const isAdmin = this.adminUsers.some(
          (adminEmail) => adminEmail.toLowerCase() === email
        );

        if (isAdmin) {
          this.currentUser = email;
          this.isAuthenticated = true;
          document.body.removeChild(modal);
          this.showToast(
            `Welcome ${email}! You are now authenticated.`,
            "success"
          );
          resolve(true);
        } else {
          errorDiv.textContent =
            "Access denied. You are not authorized to delete analysis results.";
          errorDiv.style.display = "block";
          document.getElementById("ldapEmail").style.borderColor =
            "var(--error-color)";
        }
      };

      // Handle Enter key
      modal.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          document.getElementById("confirmAuth").click();
        }
      });
    });
  }

  async confirmDelete(data) {
    return new Promise((resolve) => {
      const modal = document.createElement("div");
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 3500;
      `;

      const deviceInfo = data.deviceInfo || {};
      const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
        deviceInfo["ro.product.model"] || "Unknown"
      }`;

      modal.innerHTML = `
        <div style="
          background: var(--card-bg);
          border-radius: var(--card-radius);
          border: var(--glass-border);
          backdrop-filter: blur(var(--glass-blur));
          padding: 30px;
          max-width: 500px;
          width: 90%;
        ">
          <h3 style="color: var(--error-color); margin-top: 0; text-align: center;">
            ⚠️ Confirm Deletion
          </h3>
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 10px;">
              You are about to delete:
            </div>
            <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">
              <div><strong>App:</strong> ${data.appName || "Unknown App"}</div>
              <div><strong>Device:</strong> ${device}</div>
              <div><strong>Upload Time:</strong> ${
                data.timestamp || "N/A"
              }</div>
              <div><strong>Avg FPS:</strong> ${data.avgFps || "N/A"}</div>
              <div><strong>Total Frames:</strong> ${
                data.totalFrames || "N/A"
              }</div>
            </div>
          </div>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px; text-align: center;">
            This action cannot be undone. The analysis data will be permanently removed.
          </p>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="cancelDelete" style="
              padding: 10px 20px;
              border-radius: var(--btn-radius);
              border: 1px solid var(--border-color);
              background: transparent;
              color: var(--text-primary);
              cursor: pointer;
            ">Cancel</button>
            <button id="confirmDelete" style="
              padding: 10px 20px;
              border-radius: var(--btn-radius);
              border: none;
              background: var(--error-color);
              color: white;
              cursor: pointer;
            ">Delete Permanently</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Handle cancel
      document.getElementById("cancelDelete").onclick = () => {
        document.body.removeChild(modal);
        resolve(false);
      };

      // Handle confirm delete
      document.getElementById("confirmDelete").onclick = () => {
        document.body.removeChild(modal);
        resolve(true);
      };

      // Handle Escape key
      modal.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          document.body.removeChild(modal);
          resolve(false);
        }
      });
    });
  }

  async deleteAnalysisResult(dataIndex) {
    try {
      // Check if user is authenticated
      if (!this.isAuthenticated) {
        const authenticated = await this.showAuthenticationModal();
        if (!authenticated) {
          return;
        }
      }

      const data = this.uploadedData[dataIndex];
      if (!data) {
        this.showToast("Analysis result not found.", "error");
        return;
      }

      // Confirm deletion
      const confirmed = await this.confirmDelete(data);
      if (!confirmed) {
        return;
      }

      // Remove from uploadedData array
      this.uploadedData.splice(dataIndex, 1);

      // Remove from selectedForComparison if it was selected
      this.selectedForComparison.delete(dataIndex);

      // Update indices in selectedForComparison for items after the deleted one
      const updatedSelection = new Set();
      for (const index of this.selectedForComparison) {
        if (index > dataIndex) {
          updatedSelection.add(index - 1);
        } else if (index < dataIndex) {
          updatedSelection.add(index);
        }
      }
      this.selectedForComparison = updatedSelection;

      // Update all displays
      this.updateDisplay();
      this.updateViewControls();
      updateCompareControls();

      // Close detailed analysis modal if it was showing the deleted item
      if (currentAnalysisData === data) {
        closeAnalysisModal();
      }

      this.showToast(
        `Analysis result for "${
          data.appName || "Unknown App"
        }" deleted successfully.`,
        "success"
      );
    } catch (error) {
      console.error("Error deleting analysis result:", error);
      this.showToast("Failed to delete analysis result.", "error");
    }
  }

  logout() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.showToast("Logged out successfully.", "info");
  }

  updateTableWithPagination() {
    const tableContent = document.getElementById("tableContent");

    if (this.filteredData.length === 0) {
      tableContent.innerHTML = `
        <div class="empty-state">
          <h3>No results found</h3>
          <p>Try adjusting your search terms or filters.</p>
        </div>
      `;
      return;
    }

    // Calculate pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageData = this.filteredData.slice(startIndex, endIndex);

    let tableHtml = `
      <table class="dashboard-table">
        <thead>
          <tr>
            <th>App Name</th>
            <th>Package Name</th>
            <th>Avg FPS</th>
            <th>Elapsed Time (s)</th>
            <th>Refresh Rate (Hz)</th>
            <th>SoC Model</th>
            <th>Device Manufacturer</th>
            <th>Android Version</th>
            <th>Graphics Hardware</th>
            <th>SoC Manufacturer</th>
            <th>Device Brand</th>
            <th>Total Memory (GB)</th>
            <th>CPU Architecture</th>
            <th>Upload Time</th>
          </tr>
        </thead>
        <tbody>
    `;

    pageData.forEach((data) => {
      const deviceInfo = data.deviceInfo || {};

      // Extract values with fallbacks
      const appName = data.appName || "N/A";
      const packageName = data.packageName || "N/A";
      const avgFps = data.avgFps || "N/A";
      const elapsedTime = data.elapsedTimeSeconds || "N/A";
      const refreshRate = data.refreshRate || "N/A";
      const socModel = deviceInfo["ro.soc.model"] || "N/A";
      const manufacturer = deviceInfo["ro.product.manufacturer"] || "N/A";
      const androidVersion = deviceInfo["ro.build.version.release"] || "N/A";
      const eglHardware = deviceInfo["ro.hardware.egl"] || "N/A";
      const socManufacturer = deviceInfo["ro.soc.manufacturer"] || "N/A";
      const oemBrand = deviceInfo["ro.oem.brand"] || "N/A";

      // Calculate memory in GB
      let totalMemoryGB = "N/A";
      if (deviceInfo.MemTotal) {
        const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
        if (!isNaN(memKB)) {
          totalMemoryGB = (memKB / (1024 * 1024)).toFixed(2);
        }
      }

      const cpuABI = deviceInfo["ro.product.cpu.abi"] || "N/A";
      const uploadTime = data.timestamp || "N/A";

      // Make certain cells clickable to add filters or open detailed analysis
      const dataIndex = this.filteredData.indexOf(data);
      const manufacturerCell =
        manufacturer !== "N/A"
          ? `<td title="${manufacturer}" class="filterable" onclick="dashboard.addFilter('manufacturer', '${manufacturer}')">${manufacturer}</td>`
          : `<td title="${manufacturer}">${manufacturer}</td>`;

      const appNameCell =
        appName !== "N/A"
          ? `<td title="${appName}" class="filterable" style="cursor: pointer; color: var(--primary-light);">${appName}</td>`
          : `<td title="${appName}">${appName}</td>`;

      const socModelCell =
        socModel !== "N/A"
          ? `<td title="${socModel}" class="filterable" onclick="dashboard.addFilter('soc', '${socModel}')">${socModel}</td>`
          : `<td title="${socModel}">${socModel}</td>`;

      // Get the correct data index based on current view
      const actualDataIndex = this.uploadedData.indexOf(data);

      tableHtml += `
        <tr onclick="openDetailedAnalysis(dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
          ${appNameCell}
          <td title="${packageName}">${packageName}</td>
          <td>${avgFps}</td>
          <td>${elapsedTime}</td>
          <td>${refreshRate}</td>
          ${socModelCell}
          ${manufacturerCell}
          <td>${androidVersion}</td>
          <td title="${eglHardware}">${eglHardware}</td>
          <td title="${socManufacturer}">${socManufacturer}</td>
          <td title="${oemBrand}">${oemBrand}</td>
          <td>${totalMemoryGB}</td>
          <td>${cpuABI}</td>
          <td title="${uploadTime}">${uploadTime}</td>
        </tr>
      `;
    });

    tableHtml += `
        </tbody>
      </table>
    `;

    // Add pagination controls
    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    if (totalPages > 1) {
      tableHtml += `
        <div class="load-more-container">
          <button class="load-more-btn" onclick="dashboard.previousPage()" ${
            this.currentPage === 1 ? "disabled" : ""
          }>Previous</button>
          <span style="margin: 0 15px; color: var(--text-secondary);">Page ${
            this.currentPage
          } of ${totalPages}</span>
          <button class="load-more-btn" onclick="dashboard.nextPage()" ${
            this.currentPage === totalPages ? "disabled" : ""
          }>Next</button>
        </div>
      `;
    }

    tableContent.innerHTML = tableHtml;
      initializeTooltips();
  }

  nextPage() {
    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      this.updateViewControls();
      this.updateTableWithPagination();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updateViewControls();
      this.updateTableWithPagination();
    }
  }
}

// Initialize the dashboard when the page loads
let dashboard;
document.addEventListener("DOMContentLoaded", function () {
  dashboard = new FPSDashboard();

  // Initialize detailed analysis modal
  initializeDetailedAnalysis();

  // Initialize sidebar functionality
  initializeSidebar();

  // Initialize the tooltips
  initializeTooltips();
});

/**
 * Aggregates time-series data by a specified time interval.
 * @param {Array<Object>} dataPoints - Array of {x, y} objects where x is a millisecond timestamp.
 * @param {number} intervalMs - The time interval in milliseconds to group by.
 * @returns {Array<Object>} A new array of aggregated {x, y} data points.
 */
function aggregateDataByTime(dataPoints, intervalMs) {
  if (intervalMs <= 0) {
    return dataPoints; // Return original data if no aggregation is needed
  }

  const buckets = new Map();

  // Group data points into time buckets
  for (const point of dataPoints) {
    if (isNaN(point.x) || isNaN(point.y)) continue;
    
    // Calculate the start time of the bucket this point belongs to
    const bucketStartTime = Math.floor(point.x / intervalMs) * intervalMs;
    
    if (!buckets.has(bucketStartTime)) {
      buckets.set(bucketStartTime, []);
    }
    buckets.get(bucketStartTime).push(point.y);
  }

  const aggregatedData = [];
  // Calculate the average for each bucket
  for (const [timestamp, values] of buckets.entries()) {
    const sum = values.reduce((a, b) => a + b, 0);
    const average = sum / values.length;
    aggregatedData.push({
      x: timestamp,
      y: average,
    });
  }

  // Sort by timestamp
  return aggregatedData.sort((a, b) => a.x - b.x);
}

function setComparisonTimeScale(scale) {
    if (!dashboard) return;

    // Update the state for the comparison chart
    dashboard.comparisonChartTimeScale = scale;

    // Update the button visuals inside the comparison modal
    document.querySelectorAll('#comparisonTimeScaleControls .timescale-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`#comparisonTimeScaleControls .timescale-btn[onclick="setComparisonTimeScale('${scale}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Instead of calling a specific chart function, call the main controller function.
    // It already knows which chart is active from dashboard.activeComparisonChart
    // and will correctly destroy and recreate the right one (FPS or Jank).
    showComparisonChart(dashboard.activeComparisonChart);
}

function showComparisonChart(chartType) {
    if (!dashboard) return;

    dashboard.activeComparisonChart = chartType;

    // Update button active states
    document.querySelectorAll('#comparisonModal .chart-toggle-btn').forEach(btn => btn.classList.remove('active'));
    // Construct the button ID dynamically
    const btnId = `comp${chartType.charAt(0).toUpperCase() + chartType.slice(1)}ChartBtn`;
    document.getElementById(btnId).classList.add('active');

    // Show/Hide canvases
    document.getElementById('comparisonFpsChart').style.display = (chartType === 'fps') ? 'block' : 'none';
    document.getElementById('comparisonSlowFrameChart').style.display = (chartType === 'slowFrame') ? 'block' : 'none';
    document.getElementById('comparisonInstabilityChart').style.display = (chartType === 'instability') ? 'block' : 'none';
    
    // Timescale controls are visible for all timeline charts
    document.getElementById('comparisonTimeScaleControls').style.display = 'flex';

    // Get selected data and create the appropriate chart
    const selectedData = Array.from(dashboard.selectedForComparison).map(
        (index) => dashboard.uploadedData[index]
    );

    if (chartType === 'fps') {
        createComparisonFpsChart(selectedData);
    } else if (chartType === 'slowFrame') {
        createComparisonSlowFrameChart(selectedData);
    } else if (chartType === 'instability') {
        createComparisonInstabilityChart(selectedData);
    }
}

function createComparisonSlowFrameChart(selectedData) {
    const ctx = document.getElementById('comparisonSlowFrameChart').getContext('2d');

    if (dashboard.comparisonCharts.slowFrameChart) {
        dashboard.comparisonCharts.slowFrameChart.destroy();
    }

    const colors = selectedData.map((_, index) => {
        const hue = (index * 137.5) % 360;
        return `hsl(${hue}, 70%, 60%)`;
    });
    
    const intervalMap = { 'frame': 0, '1s': 1000, '5s': 5000 };
    const intervalMs = intervalMap[dashboard.comparisonChartTimeScale];

    const datasets = selectedData.map((data, index) => {
        if (!data.perFrameSlowFrameExcess) return null;
        
        const startTimeNs = data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;
        const createTimeData = (values) => {
             const dataArray = values.length < data.rawFpsData.length ? data.rawFpsData.slice(1) : data.rawFpsData;
             return values.map((value, frameIndex) => {
                if (frameIndex >= dataArray.length) return null;
                const timestampNs = dataArray[frameIndex].presentationTime;
                return { x: (timestampNs - startTimeNs) / 1000000, y: value };
            }).filter(p => p !== null && !isNaN(p.y));
        };
        
        const slowFrameDataPoints = createTimeData(data.perFrameSlowFrameExcess);
        
        return {
            label: `${data.appName || 'Unknown'} - Slow Frame`,
            data: aggregateDataByTime(slowFrameDataPoints, intervalMs),
            borderColor: colors[index],
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0,
            fill: false
        };
    }).filter(ds => ds !== null);

    dashboard.comparisonCharts.slowFrameChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { labels: { color: "rgba(255, 255, 255, 0.8)", usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        title: (context) => `Time: ${new Date(context[0].parsed.x).toISOString().substr(14, 5)}s`,
                        label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ms`,
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Time (mm:ss)', color: 'rgba(255, 255, 255, 0.8)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        callback: (value) => {
                            const totalSeconds = Math.floor(value / 1000);
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = totalSeconds % 60;
                            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'Slow Frame Excess (ms)', color: 'rgba(255, 255, 255, 0.8)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.8)' },
                    beginAtZero: true
                }
            }
        }
    });
}

function createComparisonInstabilityChart(selectedData) {
    const ctx = document.getElementById('comparisonInstabilityChart').getContext('2d');

    if (dashboard.comparisonCharts.instabilityChart) {
        dashboard.comparisonCharts.instabilityChart.destroy();
    }

    const colors = selectedData.map((_, index) => {
        const hue = (index * 137.5) % 360;
        return `hsl(${hue}, 70%, 60%)`;
    });
    
    const intervalMap = { 'frame': 0, '1s': 1000, '5s': 5000 };
    const intervalMs = intervalMap[dashboard.comparisonChartTimeScale];

    const datasets = selectedData.map((data, index) => {
        if (!data.perFrameInstability) return null;
        
        const startTimeNs = data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;
        const createTimeData = (values) => {
             const dataArray = values.length < data.rawFpsData.length ? data.rawFpsData.slice(1) : data.rawFpsData;
             return values.map((value, frameIndex) => {
                if (frameIndex >= dataArray.length) return null;
                const timestampNs = dataArray[frameIndex].presentationTime;
                return { x: (timestampNs - startTimeNs) / 1000000, y: value };
            }).filter(p => p !== null && !isNaN(p.y));
        };
        
        const instabilityDataPoints = createTimeData(data.perFrameInstability);
        
        return {
            label: `${data.appName || 'Unknown'} - Instability`,
            data: aggregateDataByTime(instabilityDataPoints, intervalMs),
            borderColor: colors[index],
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0,
            fill: false
        };
    }).filter(ds => ds !== null);

    dashboard.comparisonCharts.instabilityChart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { labels: { color: "rgba(255, 255, 255, 0.8)", usePointStyle: true } },
                tooltip: {
                    callbacks: {
                        title: (context) => `Time: ${new Date(context[0].parsed.x).toISOString().substr(14, 5)}s`,
                        label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ms`,
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Time (mm:ss)', color: 'rgba(255, 255, 255, 0.8)' },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.8)',
                        callback: (value) => {
                            const totalSeconds = Math.floor(value / 1000);
                            const minutes = Math.floor(totalSeconds / 60);
                            const seconds = totalSeconds % 60;
                            return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                        }
                    }
                },
                y: {
                    title: { display: true, text: 'Instability (ms)', color: 'rgba(255, 255, 255, 0.8)' },
                    ticks: { color: 'rgba(255, 255, 255, 0.8)' },
                    beginAtZero: true
                }
            }
        }
    });
}

// Sidebar functionality
function initializeSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const mainContent = document.getElementById("mainContent");
  const toggleIcon = document.getElementById("toggleIcon");
  const navItems = document.querySelectorAll(".nav-item");

  // Toggle sidebar
  function toggleSidebar() {
    const isOpen = sidebar.classList.contains("open");

    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
    sidebarToggle.classList.add("open");
    toggleIcon.textContent = "✕";

    // On desktop, shift main content
    if (window.innerWidth > 768) {
      mainContent.classList.add("shifted");
    }
  }

  function closeSidebar() {
    sidebar.classList.remove("open");
    sidebarOverlay.classList.remove("show");
    sidebarToggle.classList.remove("open");
    toggleIcon.textContent = "☰";
    mainContent.classList.remove("shifted");
  }

  // Event listeners
  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarOverlay.addEventListener("click", closeSidebar);

  // Handle navigation items
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      handleNavigation(view);

      // Update active state
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Close sidebar on mobile after selection
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 768) {
      mainContent.classList.remove("shifted");
    } else if (sidebar.classList.contains("open")) {
      mainContent.classList.add("shifted");
    }
  });

  // Close sidebar on escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) {
      closeSidebar();
    }
  });
}

// Handle navigation between different views
function handleNavigation(view) {
  // Hide all main content sections first
  const uploadSection = document.querySelector(".upload-section");
  const statsSection = document.getElementById("statsContainer");
  const performanceSection = document.getElementById("performanceSection");
  const analysisSection = document.querySelector(".analysis-section");
  const chartsSection = document.getElementById("chartsSection");

  // Hide dedicated view sections
  document.getElementById("allGamesSection").style.display = "none";
  document.getElementById("allDevicesSection").style.display = "none";
  document.getElementById("appChartsSection").style.display = "none";

  switch (view) {
    case "input-analysis":
      showInputAnalysisView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection
      );
      break;
    case "dashboard":
      showDashboardView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection
      );
      break;
    case "games":
      showAllGamesView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection
      );
      break;
    case "devices":
      showAllDevicesView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection
      );
      break;
    case "charts":
      showAppChartsView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection
      );
      break;
    default:
      showInputAnalysisView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection
      );
  }
}

function showInputAnalysisView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection
) {
  // Show upload section and analysis results only
  if (uploadSection) uploadSection.style.display = "block";
  if (analysisSection) analysisSection.style.display = "block";

  // Hide dashboard sections completely
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";

  // Show the current view section (main dashboard)
  document.getElementById("currentViewSection").style.display = "block";

  // Reset to recent view
  dashboard.currentView = "recent";
  dashboard.currentPage = 1;
  dashboard.searchTerm = "";
  dashboard.activeFilters.clear();

  // Clear search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  // Update displays but skip performance tables and charts
  dashboard.updateViewControls();
  dashboard.updateTable();
  dashboard.updateFilterChips();
  // Don't call dashboard.updateDisplay() here as it would show performance sections

  // Show toast
  dashboard.showToast(
    "Switched to Input & Analysis - upload files and view results",
    "info"
  );
}

function showDashboardView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection
) {
  // Hide upload section and analysis results
  if (uploadSection) uploadSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";

  // Show dashboard sections only
  if (statsSection) statsSection.style.display = "flex";
  if (performanceSection) performanceSection.style.display = "block";
  if (chartsSection) chartsSection.style.display = "block";

  // Hide the current view section (main dashboard)
  document.getElementById("currentViewSection").style.display = "none";

  // Update dashboard sections with current data
  if (dashboard.uploadedData.length > 0) {
    dashboard.updateStats();
    dashboard.updatePerformanceTables();
    dashboard.updateCharts();
  }

  // Show toast
  dashboard.showToast(
    "Switched to Dashboard - performance charts and statistics",
    "info"
  );
}

function showCurrentView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection
) {
  // Show original dashboard sections
  if (uploadSection) uploadSection.style.display = "block";
  if (statsSection) statsSection.style.display = "flex";
  if (performanceSection) performanceSection.style.display = "block";
  if (analysisSection) analysisSection.style.display = "block";
  if (chartsSection) chartsSection.style.display = "block";

  // Show the current view section (main dashboard)
  document.getElementById("currentViewSection").style.display = "block";

  // Reset to recent view
  dashboard.currentView = "recent";
  dashboard.currentPage = 1;
  dashboard.searchTerm = "";
  dashboard.activeFilters.clear();

  // Clear search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  // Update displays
  dashboard.updateViewControls();
  dashboard.updateTable();
  dashboard.updateFilterChips();

  // Show toast
  dashboard.showToast(
    "Switched to Current View - showing recent uploads",
    "info"
  );
}

function showAllGamesView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection
) {
  // Hide original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";

  // Hide the current view section (main dashboard)
  document.getElementById("currentViewSection").style.display = "none";

  // Show games section
  document.getElementById("allGamesSection").style.display = "block";

  // Get all unique package names (since this dashboard is for games only)
  const uniqueGames = getUniqueGames();

  // Update games view
  updateGamesView(uniqueGames);

  // Show toast with count
  dashboard.showToast(
    `Found ${uniqueGames.length} unique game${
      uniqueGames.length !== 1 ? "s" : ""
    }`,
    "info"
  );
}

function showAllDevicesView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection
) {
  // Hide original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";

  // Hide the current view section (main dashboard)
  document.getElementById("currentViewSection").style.display = "none";

  // Show devices section
  document.getElementById("allDevicesSection").style.display = "block";

  // Sort by device manufacturer and model
  const devicesData = [...dashboard.uploadedData].sort((a, b) => {
    const deviceA = `${
      a.deviceInfo?.["ro.product.manufacturer"] || "Unknown"
    } ${a.deviceInfo?.["ro.product.model"] || "Unknown"}`;
    const deviceB = `${
      b.deviceInfo?.["ro.product.manufacturer"] || "Unknown"
    } ${b.deviceInfo?.["ro.product.model"] || "Unknown"}`;

    return deviceA.localeCompare(deviceB);
  });

  // Update devices view
  updateDevicesView(devicesData);

  // Show toast with device count
  const uniqueDevices = new Set(
    dashboard.uploadedData.map(
      (data) =>
        `${data.deviceInfo?.["ro.product.manufacturer"] || "Unknown"} ${
          data.deviceInfo?.["ro.product.model"] || "Unknown"
        }`
    )
  ).size;

  dashboard.showToast(
    `Found ${uniqueDevices} unique device${uniqueDevices !== 1 ? "s" : ""}`,
    "info"
  );
}

// Update games view with dedicated functionality
function updateGamesView(gamesData) {
  // Update games stats
  updateGamesStats(gamesData);

  // Update games table
  updateGamesTable(gamesData);

  // Setup games search functionality
  setupGamesSearch(gamesData);
}

function updateGamesStats(gamesData) {
  if (gamesData.length === 0) {
    document.getElementById("totalGames").textContent = "0";
    document.getElementById("avgGamesFps").textContent = "0";
    document.getElementById("bestGameFps").textContent = "0";
    document.getElementById("worstGameFps").textContent = "0";
    document.getElementById("gameGenres").textContent = "0";
    document.getElementById("gamesDevices").textContent = "0";
    return;
  }

  const totalGames = gamesData.length;
  const avgFps = (
    gamesData.reduce((sum, data) => sum + data.avgFps, 0) / totalGames
  ).toFixed(1);
  const bestFps = Math.max(...gamesData.map((data) => data.avgFps)).toFixed(1);
  const worstFps = Math.min(...gamesData.map((data) => data.avgFps)).toFixed(1);

  // Count unique game categories
  const gameCategories = new Set(
    gamesData.map((data) => inferAppCategory(data.appName, data.packageName))
  ).size;

  // Count unique devices used for gaming
  const uniqueDevices = new Set(
    gamesData.map(
      (data) =>
        `${data.deviceInfo?.["ro.product.manufacturer"] || "Unknown"} ${
          data.deviceInfo?.["ro.product.model"] || "Unknown"
        }`
    )
  ).size;

  document.getElementById("totalGames").textContent = totalGames;
  document.getElementById("avgGamesFps").textContent = avgFps;
  document.getElementById("bestGameFps").textContent = bestFps;
  document.getElementById("worstGameFps").textContent = worstFps;
  document.getElementById("gameGenres").textContent = gameCategories;
  document.getElementById("gamesDevices").textContent = uniqueDevices;

  document.getElementById(
    "gamesResultsCount"
  ).textContent = `Showing ${totalGames} gaming app${
    totalGames !== 1 ? "s" : ""
  }`;
}

function updateGamesTable(gamesData) {
  const tableContent = document.getElementById("gamesTableContent");

  if (gamesData.length === 0) {
    tableContent.innerHTML = `
      <div class="empty-state">
        <h3>No gaming data available</h3>
        <p>Upload gaming performance data to see analysis here.</p>
      </div>
    `;
    return;
  }

  let tableHtml = `
    <table class="dashboard-table">
      <thead>
        <tr>
          <th>Game Name</th>
          <th>Package Name</th>
          <th>Category</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  gamesData.forEach((data) => {
    const gameName = data.appName || "Unknown Game";
    const packageName = data.packageName || "Unknown Package";
    const category = inferAppCategory(data.appName, data.packageName);

    tableHtml += `
      <tr>
        <td onclick="showAllAppInstances('${gameName.replace(
          /'/g,
          "\\'"
        )}');" title="${gameName}" style="color: var(--primary-light); cursor: pointer; text-decoration: underline;"><strong>${gameName}</strong></td>
        <td title="${packageName}">${packageName}</td>
        <td><span style="background: var(--primary-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${category}</span></td>
        <td>
          <button 
            class="delete-btn" 
            onclick="deleteAllGameInstances('${gameName.replace(/'/g, "\\'")}')"
            title="Delete all results for this game"
            style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.75rem;
              font-weight: 600;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='var(--error-color)'"
          >
            🗑️ Delete All
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  tableContent.innerHTML = tableHtml;
}

// Helper functions for getting unique games and devices
function getUniqueGames() {
  // Get all unique package names (since this dashboard is for games only)
  const uniquePackageNames = new Set();
  const uniqueGames = [];

  dashboard.uploadedData.forEach((data) => {
    const packageName = data.packageName || "Unknown Package";
    if (!uniquePackageNames.has(packageName)) {
      uniquePackageNames.add(packageName);
      uniqueGames.push(data);
    }
  });

  return uniqueGames;
}

function getUniqueDevices() {
  // Get all unique devices (using OEM brand as requested)
  const uniqueDeviceKeys = new Set();
  const uniqueDevices = [];

  dashboard.uploadedData.forEach((data) => {
    const deviceInfo = data.deviceInfo || {};
    const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
    const model = deviceInfo["ro.product.model"] || "Unknown";
    const deviceKey = `${manufacturer}_${model}`;

    if (!uniqueDeviceKeys.has(deviceKey)) {
      uniqueDeviceKeys.add(deviceKey);
      uniqueDevices.push(data);
    }
  });

  return uniqueDevices;
}

// Update devices view with dedicated functionality
function updateDevicesView(devicesData) {
  // Update devices stats
  updateDevicesStats(devicesData);

  // Update devices table
  updateDevicesTable(devicesData);

  // Setup devices search functionality
  setupDevicesSearch(devicesData);
}

function updateDevicesStats(devicesData) {
  if (devicesData.length === 0) {
    document.getElementById("totalDevices").textContent = "0";
    document.getElementById("avgDevicesFps").textContent = "0";
    document.getElementById("bestDeviceFps").textContent = "0";
    document.getElementById("worstDeviceFps").textContent = "0";
    document.getElementById("deviceBrands").textContent = "0";
    document.getElementById("socModels").textContent = "0";
    return;
  }

  // Count unique devices
  const uniqueDevices = new Set(
    devicesData.map(
      (data) =>
        `${data.deviceInfo?.["ro.product.manufacturer"] || "Unknown"} ${
          data.deviceInfo?.["ro.product.model"] || "Unknown"
        }`
    )
  ).size;

  const avgFps = (
    devicesData.reduce((sum, data) => sum + data.avgFps, 0) / devicesData.length
  ).toFixed(1);
  const bestFps = Math.max(...devicesData.map((data) => data.avgFps)).toFixed(
    1
  );
  const worstFps = Math.min(...devicesData.map((data) => data.avgFps)).toFixed(
    1
  );

  // Count unique brands
  const uniqueBrands = new Set(
    devicesData.map(
      (data) => data.deviceInfo?.["ro.product.manufacturer"] || "Unknown"
    )
  ).size;

  // Count unique SoC models
  const uniqueSoCs = new Set(
    devicesData.map((data) => data.deviceInfo?.["ro.soc.model"] || "Unknown")
  ).size;

  document.getElementById("totalDevices").textContent = uniqueDevices;
  document.getElementById("avgDevicesFps").textContent = avgFps;
  document.getElementById("bestDeviceFps").textContent = bestFps;
  document.getElementById("worstDeviceFps").textContent = worstFps;
  document.getElementById("deviceBrands").textContent = uniqueBrands;
  document.getElementById("socModels").textContent = uniqueSoCs;

  document.getElementById("devicesResultsCount").textContent = `Showing ${
    devicesData.length
  } test${devicesData.length !== 1 ? "s" : ""} across ${uniqueDevices} device${
    uniqueDevices !== 1 ? "s" : ""
  }`;
}

function updateDevicesTable(devicesData) {
  const tableContent = document.getElementById("devicesTableContent");

  if (devicesData.length === 0) {
    tableContent.innerHTML = `
      <div class="empty-state">
        <h3>No device data available</h3>
        <p>Upload performance data to see device analysis here.</p>
      </div>
    `;
    return;
  }

  // Get unique devices only
  const uniqueDevices = getUniqueDevices();

  let tableHtml = `
    <table class="dashboard-table">
      <thead>
        <tr>
          <th>Device</th>
          <th>OEM</th>
          <th>Manufacturer</th>
          <th>RAM (GB)</th>
          <th>CPU/SoC</th>
          <th>Architecture</th>
          <th>ABI</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  uniqueDevices.forEach((data) => {
    const deviceInfo = data.deviceInfo || {};

    const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
    const model = deviceInfo["ro.product.model"] || "Unknown";
    const device = `${manufacturer} ${model}`;
    const oem =
      deviceInfo["ro.oem.brand"] ||
      deviceInfo["ro.product.brand"] ||
      manufacturer;
    const soc = deviceInfo["ro.soc.model"] || "N/A";
    const cpuAbi = deviceInfo["ro.product.cpu.abi"] || "N/A";

    let memoryGB = "N/A";
    if (deviceInfo.MemTotal) {
      const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
      if (!isNaN(memKB)) {
        memoryGB = (memKB / (1024 * 1024)).toFixed(1);
      }
    }

    // Extract architecture from ABI
    let architecture = "N/A";
    if (cpuAbi !== "N/A") {
      if (cpuAbi.includes("arm64") || cpuAbi.includes("aarch64")) {
        architecture = "ARM64";
      } else if (cpuAbi.includes("arm")) {
        architecture = "ARM32";
      } else if (cpuAbi.includes("x86_64")) {
        architecture = "x86_64";
      } else if (cpuAbi.includes("x86")) {
        architecture = "x86";
      } else {
        architecture = cpuAbi.split("-")[0] || "N/A";
      }
    }

    tableHtml += `
      <tr>
        <td onclick="showDeviceDetails('${device.replace(
          /'/g,
          "\\'"
        )}');" title="${device}" style="color: var(--primary-light); cursor: pointer; text-decoration: underline;"><strong>${device}</strong></td>
        <td><strong>${oem}</strong></td>
        <td>${manufacturer}</td>
        <td><strong>${memoryGB}</strong></td>
        <td title="${soc}">${soc}</td>
        <td><strong>${architecture}</strong></td>
        <td title="${cpuAbi}">${cpuAbi}</td>
        <td>
          <button 
            class="delete-btn" 
            onclick="deleteAllDeviceInstances('${device.replace(/'/g, "\\'")}')"
            title="Delete all results for this device"
            style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.75rem;
              font-weight: 600;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='var(--error-color)'"
          >
            🗑️ Delete All
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  tableContent.innerHTML = tableHtml;
}

// Setup search functionality for games view
function setupGamesSearch(gamesData) {
  const searchInput = document.getElementById("gamesSearchInput");
  const clearBtn = document.getElementById("clearGamesSearchBtn");

  // Remove existing event listeners
  searchInput.replaceWith(searchInput.cloneNode(true));
  clearBtn.replaceWith(clearBtn.cloneNode(true));

  // Get new references
  const newSearchInput = document.getElementById("gamesSearchInput");
  const newClearBtn = document.getElementById("clearGamesSearchBtn");

  newSearchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredGames = gamesData.filter((data) => {
      const appName = (data.appName || "").toLowerCase();
      const packageName = (data.packageName || "").toLowerCase();
      const category = inferAppCategory(
        data.appName,
        data.packageName
      ).toLowerCase();

      return (
        appName.includes(searchTerm) ||
        packageName.includes(searchTerm) ||
        category.includes(searchTerm)
      );
    });

    updateGamesTable(filteredGames);
    document.getElementById("gamesResultsCount").textContent = `Showing ${
      filteredGames.length
    } of ${gamesData.length} gaming app${
      filteredGames.length !== 1 ? "s" : ""
    }`;
  });

  newClearBtn.addEventListener("click", () => {
    newSearchInput.value = "";
    updateGamesTable(gamesData);
    document.getElementById("gamesResultsCount").textContent = `Showing ${
      gamesData.length
    } gaming app${gamesData.length !== 1 ? "s" : ""}`;
  });
}

// Setup search functionality for devices view
function setupDevicesSearch(devicesData) {
  const searchInput = document.getElementById("devicesSearchInput");
  const clearBtn = document.getElementById("clearDevicesSearchBtn");

  // Remove existing event listeners
  searchInput.replaceWith(searchInput.cloneNode(true));
  clearBtn.replaceWith(clearBtn.cloneNode(true));

  // Get new references
  const newSearchInput = document.getElementById("devicesSearchInput");
  const newClearBtn = document.getElementById("clearDevicesSearchBtn");

  newSearchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredDevices = devicesData.filter((data) => {
      const deviceInfo = data.deviceInfo || {};
      const manufacturer = (
        deviceInfo["ro.product.manufacturer"] || ""
      ).toLowerCase();
      const model = (deviceInfo["ro.product.model"] || "").toLowerCase();
      const brand = (deviceInfo["ro.product.brand"] || "").toLowerCase();
      const soc = (deviceInfo["ro.soc.model"] || "").toLowerCase();

      return (
        manufacturer.includes(searchTerm) ||
        model.includes(searchTerm) ||
        brand.includes(searchTerm) ||
        soc.includes(searchTerm)
      );
    });

    updateDevicesTable(filteredDevices);
    const uniqueDevices = new Set(
      filteredDevices.map(
        (data) =>
          `${data.deviceInfo?.["ro.product.manufacturer"] || "Unknown"} ${
            data.deviceInfo?.["ro.product.model"] || "Unknown"
          }`
      )
    ).size;
    document.getElementById("devicesResultsCount").textContent = `Showing ${
      filteredDevices.length
    } test${
      filteredDevices.length !== 1 ? "s" : ""
    } across ${uniqueDevices} device${uniqueDevices !== 1 ? "s" : ""}`;
  });

  newClearBtn.addEventListener("click", () => {
    newSearchInput.value = "";
    updateDevicesTable(devicesData);
    const uniqueDevices = new Set(
      devicesData.map(
        (data) =>
          `${data.deviceInfo?.["ro.product.manufacturer"] || "Unknown"} ${
            data.deviceInfo?.["ro.product.model"] || "Unknown"
          }`
      )
    ).size;
    document.getElementById("devicesResultsCount").textContent = `Showing ${
      devicesData.length
    } test${
      devicesData.length !== 1 ? "s" : ""
    } across ${uniqueDevices} device${uniqueDevices !== 1 ? "s" : ""}`;
  });
}

// Helper function to identify gaming apps
function isGamingApp(appName, packageName) {
  const name = (appName || "").toLowerCase();
  const pkg = (packageName || "").toLowerCase();

  // Known gaming packages and patterns
  const gamingPatterns = [
    "unity",
    "unreal",
    "cocos",
    "godot", // Game engines
    "supercell",
    "king.com",
    "rovio",
    "gameloft",
    "ea.gp", // Gaming companies
    "mihoyo",
    "tencent.ig",
    "garena",
    "roblox",
    "mojang", // Gaming companies
    "pubg",
    "fortnite",
    "minecraft",
    "clash",
    "candy",
    "angry",
    "pokemon",
    "mario",
    "sonic",
    "zelda",
    "final.fantasy",
    "call.of.duty",
    "battlefield",
    "apex",
    "valorant",
    "overwatch",
    "league.of.legends",
    "dota",
    "counter.strike",
    "gta",
    "assassins.creed",
    "far.cry",
    "watch.dogs",
    "splinter.cell",
  ];

  return gamingPatterns.some(
    (pattern) => name.includes(pattern) || pkg.includes(pattern)
  );
}

function setTimeScale(scale) {
  if (!dashboard) return;

  dashboard.detailChartTimeScale = scale;

  // Update button active states
  document.querySelectorAll('.timescale-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.querySelector(`.timescale-btn[onclick="setTimeScale('${scale}')"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }

  // Re-render the currently active chart to apply the new scale
  showChart(dashboard.activeDetailChart);
}

// Detailed Analysis Modal functionality
let detailCharts = {};
let currentAnalysisData = null;

function initializeDetailedAnalysis() {
  const modal = document.getElementById("analysisModal");
  const closeBtn = document.getElementById("closeModalBtn");
  const fpsChartBtn = document.getElementById("fpsChartBtn");
  const jankChartBtn = document.getElementById("jankChartBtn");
  const combinedChartBtn = document.getElementById("combinedChartBtn");

  // Close modal events
  closeBtn.addEventListener("click", closeAnalysisModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAnalysisModal();
  });

  // Chart toggle events
  fpsChartBtn.addEventListener("click", () => showChart("fps"));
  jankChartBtn.addEventListener("click", () => showChart("jank"));
  combinedChartBtn.addEventListener("click", () => showChart("combined"));

  const fpsBucketsChartBtn = document.getElementById("fpsBucketsChartBtn");
  fpsBucketsChartBtn.addEventListener("click", () => showChart("fpsBuckets"));

  // ESC key to close modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeAnalysisModal();
    }
  });
}

function openDetailedAnalysis(data) {
  currentAnalysisData = data;
  const modal = document.getElementById("analysisModal");
  const title = document.getElementById("analysisModalTitle");

  title.textContent = `${data.appName || "Unknown App"} - Detailed Analysis`;

  // Clear AI analysis from previous app
  clearAIAnalysis();

  // Populate app overview
  populateAppOverview(data);

  // Populate device details
  populateDeviceDetails(data);

  // Find similar results
  populateSimilarResults(data);

  // Show FPS chart by default
  showChart("fps");

  // Show modal
  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeAnalysisModal() {
  const modal = document.getElementById("analysisModal");
  modal.classList.remove("show");
  document.body.style.overflow = "";

  // Destroy charts to free memory
  Object.values(detailCharts).forEach((chart) => {
    if (chart) chart.destroy();
  });
  detailCharts = {};
}

function showChart(chartType) {
  if (dashboard) {
    dashboard.activeDetailChart = chartType;
  }
  // Update button states
  document.querySelectorAll(".chart-toggle-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  document.getElementById(`${chartType}ChartBtn`).classList.add("active");

  // Hide all charts
  document.getElementById("detailFpsChart").style.display = "none";
  document.getElementById("detailJankChart").style.display = "none";
  document.getElementById("detailCombinedChart").style.display = "none";
  document.getElementById("detailFpsBucketsChart").style.display = "none";

  // Show selected chart
  const chartCanvas = document.getElementById(
    `detail${chartType.charAt(0).toUpperCase() + chartType.slice(1)}Chart`
  );
  chartCanvas.style.display = "block";

  // Destroy existing chart if it exists to prevent memory leaks/re-rendering issues
  if (detailCharts[chartType]) {
    detailCharts[chartType].destroy();
    detailCharts[chartType] = null; // Clear reference
  }

  // Create chart
  createDetailChart(chartType);
}



// --- MODIFIED: Replace the entire function ---
function createDetailChart(chartType) {
  if (!currentAnalysisData || !currentAnalysisData.perFrameInstantaneousFps) return;

  const data = currentAnalysisData;

  // --- IMPORTANT: Prepare data with MILLISECOND timestamps for the time scale ---
  const startTimeNs = data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;
  
  const createTimeData = (values) => {
    // We need to handle the fact that the perFrame arrays have one less element than rawFpsData
    const dataArray = values.length < data.rawFpsData.length ? data.rawFpsData.slice(1) : data.rawFpsData;
    
    return values.map((value, index) => {
      if (index >= dataArray.length) return null; // Safety check
      const timestampNs = dataArray[index].presentationTime;
      return {
        x: (timestampNs - startTimeNs) / 1000000, // Convert to MS from start
        y: value
      };
    }).filter(p => p !== null && !isNaN(p.y));
  };
  
  const fpsDataPoints = createTimeData(data.perFrameInstantaneousFps.map(fps => Math.min(fps, 200)));
  const jankDataPoints = createTimeData(data.perFrameSlowFrameExcess);
  const instabilityDataPoints = createTimeData(data.perFrameInstability);

  // --- AGGREGATE DATA BASED ON SELECTED TIMESPAN ---
  const intervalMap = { 'frame': 0, '1s': 1000, '5s': 5000 };
  const intervalMs = intervalMap[dashboard.detailChartTimeScale];

  const aggregatedFps = aggregateDataByTime(fpsDataPoints, intervalMs);
  const aggregatedJank = aggregateDataByTime(jankDataPoints, intervalMs);
  const aggregatedInstability = aggregateDataByTime(instabilityDataPoints, intervalMs);

  let chartConfig;

  switch (chartType) {
    case "fps":
      chartConfig = createFpsChartConfig(aggregatedFps, data.targetFPS);
      break;
    case "jank":
      chartConfig = createJankChartConfig(aggregatedJank, aggregatedInstability);
      break;
    case "combined":
      chartConfig = createCombinedChartConfig(aggregatedFps, aggregatedJank, aggregatedInstability, data.targetFPS);
      break;
    case "fpsBuckets":
      chartConfig = createFpsBucketsChartConfig(data.fpsBuckets);
      break;
  }

  const canvasId = `detail${chartType.charAt(0).toUpperCase() + chartType.slice(1)}Chart`;
  const ctx = document.getElementById(canvasId).getContext("2d");

  if (detailCharts[chartType]) {
    detailCharts[chartType].destroy();
  }
  
  detailCharts[chartType] = new Chart(ctx, chartConfig);
}

// Helper function to apply smoothing filter (remains unchanged)
function applySmoothingFilter(data, windowSize) {
  if (windowSize <= 1) return data;

  const smoothed = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(data.length - 1, i + halfWindow);

    let sum = 0;
    let count = 0;

    for (let j = start; j <= end; j++) {
      sum += data[j];
      count++;
    }

    smoothed[i] = sum / count;
  }

  return smoothed;
}

function createFpsChartConfig(fpsData, targetFPS) {
  const targetFpsLine = fpsData.length > 0
    ? [{x: fpsData[0].x, y: targetFPS}, {x: fpsData[fpsData.length - 1].x, y: targetFPS}]
    : [];

  return {
    type: "line",
    data: {
      datasets: [
        {
          label: "Actual FPS",
          data: fpsData,
          borderColor: "rgba(99, 102, 241, 1)",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 1,
          pointHoverRadius: 4,
        },
        {
          label: `Target FPS (${targetFPS})`,
          data: targetFpsLine,
          borderColor: "rgba(34, 197, 94, 0.8)",
          backgroundColor: "transparent",
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: "rgba(255, 255, 255, 0.8)" } },
        tooltip: {
            callbacks: {
                title: function(context) {
                    const totalSeconds = context[0].parsed.x / 1000;
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    return `Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            },
        // Inside the options.plugins.tooltip.callbacks object for createFpsChartConfig
        label: function (context) {
                    if (context.dataset.label.includes('Target')) {
                        return `Target: ${context.parsed.y} FPS`;
                    }
                    return `Actual FPS: ${context.parsed.y.toFixed(1)}`;
                }
            },
        },
      },
      scales: {
        x: {
            type: 'linear',
            title: {
                display: true,
                text: "Time (mm:ss)",
                color: "rgba(255, 255, 255, 0.8)",
            },
            grid: { color: "rgba(255, 255, 255, 0.1)" },
            ticks: {
                color: "rgba(255, 255, 255, 0.8)",
                // Custom formatter to show milliseconds as mm:ss
                callback: function(value, index, ticks) {
                    const totalSeconds = Math.floor(value / 1000);
                    const minutes = Math.floor(totalSeconds / 60);
                    const seconds = totalSeconds % 60;
                    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            },
        },
        y: {
          title: { display: true, text: "FPS", color: "rgba(255, 255, 255, 0.8)" },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: { color: "rgba(255, 255, 255, 0.8)" },
          beginAtZero: true,
        },
      },
    },
  };
}

function createJankChartConfig(slowFrameData, instabilityData) {
  return {
    type: "line",
    data: {
      datasets: [
        {
          label: "Slow Frame Excess (ms)", // Label for slow frames
          data: slowFrameData,
          borderColor: "rgba(255, 99, 132, 1)", // Red color for slow frames
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1,
          yAxisID: 'y'
        },
        {
          label: "Jank Instability (ms)", // Label for jank instability
          data: instabilityData,
          borderColor: "rgba(54, 162, 235, 1)", // Blue color for instability
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1,
          yAxisID: 'y'
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        title: {
          display: true,
          text: "Jank Analysis (Slow Frames & Instability)",
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              return `Time: ${context[0].label}s`;
            },
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ms`;
            },
          },
        },
      },
      // Replace the entire 'scales' object inside createJankChartConfig

scales: {
    x: {
        type: 'linear',
        title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
        },
        grid: {
            color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            callback: function(value, index, ticks) {
                const totalSeconds = Math.floor(value / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        },
    },
    y: {
        title: {
            display: true,
            text: "Jank (ms)",
            color: "rgba(255, 255, 255, 0.8)",
        },
        grid: {
            color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
            color: "rgba(255, 255, 255, 0.8)",
        },
        beginAtZero: true,
    },
},
    },
  };
}

function createCombinedChartConfig(fpsData, jankData, instabilityData, targetFPS) {
  const targetFpsLine = fpsData.length > 0
    ? [{x: fpsData[0].x, y: targetFPS}, {x: fpsData[fpsData.length - 1].x, y: targetFPS}]
    : [];
  const datasets = [
    {
      label: "Actual FPS",
      data: fpsData,
      borderColor: "rgba(99, 102, 241, 1)",
      backgroundColor: "rgba(99, 102, 241, 0.1)",
      borderWidth: 2,
      fill: false,
      tension: 0.1,
      yAxisID: "y",
      pointRadius: 1,
      pointHoverRadius: 4,
    },
    {
      label: `Target FPS (${targetFPS})`,
      data: targetFpsLine,
      borderColor: "rgba(34, 197, 94, 0.8)",
      backgroundColor: "transparent",
      borderWidth: 1,
      borderDash: [5, 5],
      fill: false,
      tension: 0,
      yAxisID: "y",
      pointRadius: 0,
      pointHoverRadius: 0,
    },
    {
      label: "Slow Frame Excess (ms)",
      data: jankData,
      borderColor: "rgba(239, 68, 68, 1)",
      backgroundColor: "rgba(239, 68, 68, 0.1)",
      borderWidth: 2,
      fill: false,
      tension: 0.1,
      yAxisID: "y1",
      pointRadius: 1,
      pointHoverRadius: 4,
    },
  ];

  // Optional: Add a separate line for Jank Instability if desired
  if (instabilityData && instabilityData.some(val => val > 0)) { // Only add if there's actual instability data
      datasets.push({
          label: "Jank Instability (ms)",
          data: instabilityData,
          borderColor: "rgba(255, 165, 0, 1)", // Orange color for instability
          backgroundColor: "rgba(255, 165, 0, 0.1)",
          borderWidth: 2,
          fill: false,
          tension: 0.1,
          yAxisID: "y1",
          pointRadius: 1,
          pointHoverRadius: 4,
      });
  }


  return {
    type: "line",
    data: {
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
          },
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              return `Time: ${context[0].label}s`;
            },
            label: function (context) {
              if (context.dataset.yAxisID === "y") { // FPS axis
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`;
              } else { // Jank/Instability axis
                return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}ms`;
              }
            },
          },
        },
      },
      // Replace the entire 'scales' object inside createCombinedChartConfig

scales: {
    x: {
        type: 'linear',
        title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
        },
        grid: {
            color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            callback: function(value, index, ticks) {
                const totalSeconds = Math.floor(value / 1000);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        },
    },
    y: {
        type: "linear",
        display: true,
        position: "left",
        title: {
            display: true,
            text: "FPS",
            color: "rgba(99, 102, 241, 1)",
        },
        grid: {
            color: "rgba(255, 255, 255, 0.1)",
        },
        ticks: {
            color: "rgba(99, 102, 241, 1)",
        },
        min: 0,
    },
    y1: {
        type: "linear",
        display: true,
        position: "right",
        title: {
            display: true,
            text: "Frame Excess (ms)",
            color: "rgba(239, 68, 68, 1)",
        },
        grid: {
            drawOnChartArea: false, // only show the grid for the main y-axis
        },
        ticks: {
            color: "rgba(239, 68, 68, 1)",
        },
        min: 0,
    },
},
    },
  };
}
      
// createFpsBucketsChartConfig remains unchanged as it already uses parsed data
function createFpsBucketsChartConfig(fpsBuckets) {
  if (!fpsBuckets) {
    return {
      type: "bar",
      data: {
        labels: ["No Data"],
        datasets: [
          {
            label: "FPS Distribution",
            data: [0],
            backgroundColor: "rgba(99, 102, 241, 0.6)",
            borderColor: "rgba(99, 102, 241, 1)",
            borderWidth: 2,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: "rgba(255, 255, 255, 0.8)",
            },
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                return `Frames: ${context.parsed.y}`;
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "FPS Range",
              color: "rgba(255, 255, 255, 0.8)",
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
            },
          },
          y: {
            title: {
              display: true,
              text: "Number of Frames",
              color: "rgba(255, 255, 255, 0.8)",
            },
            grid: {
              color: "rgba(255, 255, 255, 0.1)",
            },
            ticks: {
              color: "rgba(255, 255, 255, 0.8)",
            },
            beginAtZero: true,
          },
        },
      },
    };
  }

  const labels = [
    "0-3 FPS",
    "3-5 FPS",
    "5-7 FPS",
    "7-9 FPS",
    "9-11 FPS",
    "11-13 FPS",
    "13-16 FPS",
    "16-19 FPS",
    "19-22 FPS",
    "22-26 FPS",
    "26-35 FPS",
    "35-50 FPS",
    "50-70 FPS",
    "70+ FPS",
  ];

  const data = [
    fpsBuckets.bucket_0_3,
    fpsBuckets.bucket_3_5,
    fpsBuckets.bucket_5_7,
    fpsBuckets.bucket_7_9,
    fpsBuckets.bucket_9_11,
    fpsBuckets.bucket_11_13,
    fpsBuckets.bucket_13_16,
    fpsBuckets.bucket_16_19,
    fpsBuckets.bucket_19_22,
    fpsBuckets.bucket_22_26,
    fpsBuckets.bucket_26_35,
    fpsBuckets.bucket_35_50,
    fpsBuckets.bucket_50_70,
    fpsBuckets.bucket_70_plus,
  ];

  const colors = [
    "rgba(239, 68, 68, 0.8)", // 0-10: Red (very poor)
    "rgba(245, 101, 101, 0.8)", // 10-15: Light red (poor)
    "rgba(251, 146, 60, 0.8)", // 15-20: Orange (below average)
    "rgba(252, 211, 77, 0.8)", // 20-25: Yellow (average)
    "rgba(163, 230, 53, 0.8)", // 25-30: Light green (good)
    "rgba(34, 197, 94, 0.8)", // 30-40: Green (very good)
    "rgba(16, 185, 129, 0.8)", // 40-50: Teal (excellent)
    "rgba(99, 102, 241, 0.8)", // 50-60: Blue (outstanding)
    "rgba(139, 92, 246, 0.8)", // 60+: Purple (exceptional)
  ];

  return {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Frame Count",
          data: data,
          backgroundColor: colors,
          borderColor: colors.map((color) => color.replace("0.8", "1")),
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
          },
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              return context[0].label;
            },
            label: function (context) {
              const total = data.reduce((sum, val) => sum + val, 0);
              const percentage =
                total > 0 ? ((context.parsed.y / total) * 100).toFixed(1) : 0;
              return [
                `Frames: ${context.parsed.y}`,
                `Percentage: ${percentage}%`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "FPS Range",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            maxRotation: 45,
          },
        },
        y: {
          title: {
            display: true,
            text: "Number of Frames",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
          },
          beginAtZero: true,
        },
      },
    },
  };
}

function populateAppOverview(data) {
  const deviceInfo = data.deviceInfo || {};

  // Populate app overview fields
  document.getElementById("overviewAppName").textContent =
    data.appName || "Unknown App";
  document.getElementById("overviewPackageName").textContent =
    data.packageName || "Unknown Package";

  // Add avg FPS and elapsed time
  document.getElementById("overviewAvgFPS").textContent = data.avgFps
    ? `${data.avgFps} FPS`
    : "N/A";
  document.getElementById("overviewElapsedTime").textContent =
    data.elapsedTimeSeconds ? `${data.elapsedTimeSeconds}s` : "N/A";

  // Device hardware (use OEM brand)
  document.getElementById("overviewDeviceHardware").textContent =
    deviceInfo["ro.oem.brand"] || "Unknown";

  // Device brand (manufacturer)
  document.getElementById("overviewDeviceBrand").textContent =
    deviceInfo["ro.product.manufacturer"] || "Unknown";

  // RAM (convert from kB to GB)
  let ramDisplay = "Unknown";
  if (deviceInfo.MemTotal) {
    const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
    if (!isNaN(memKB)) {
      const memGB = (memKB / (1024 * 1024)).toFixed(1);
      ramDisplay = `${memGB} GB`;
    }
  }
  document.getElementById("overviewRAM").textContent = ramDisplay;

  // SoC Model
  document.getElementById("overviewSoCModel").textContent =
    deviceInfo["ro.soc.model"] || "Unknown";
}

function populateDeviceDetails(data) {
  const tbody = document.getElementById("deviceDetailsBody");
  const deviceInfo = data.deviceInfo || {};

  // Calculate memory in GB for better display
  let memoryDisplay = "N/A";
  if (deviceInfo.MemTotal) {
    const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
    if (!isNaN(memKB)) {
      const memGB = (memKB / (1024 * 1024)).toFixed(1);
      memoryDisplay = `${memGB} GB (${deviceInfo.MemTotal})`;
    } else {
      memoryDisplay = deviceInfo.MemTotal;
    }
  }

  // Use improved brand logic
  const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
  const brand = deviceInfo["ro.product.brand"] || "N/A";
  const oemBrand =
    deviceInfo["ro.oem.brand"] ||
    deviceInfo["ro.product.brand"] ||
    manufacturer;

  // Define the properties to display
  const properties = [
    { key: "appName", label: "App Name", value: data.appName || "N/A" },
    {
      key: "packageName",
      label: "Package Name",
      value: data.packageName || "N/A",
    },
    { key: "avgFps", label: "Average FPS", value: data.avgFps || "N/A" },
    { key: "minFps", label: "Minimum FPS", value: data.minFps || "N/A" },
    { key: "maxFps", label: "Maximum FPS", value: data.maxFps || "N/A" },
    
    { key: "vsync_avgFps", label: "Scheduled Avg FPS", value: data.vsync_avgFps || "N/A" },
    { key: "vsync_minFps", label: "Scheduled Min FPS", value: data.vsync_minFps || "N/A" },
    { key: "vsync_maxFps", label: "Scheduled Max FPS", value: data.vsync_maxFps || "N/A" },
    
    {
      key: "totalFrames",
      label: "Total Frames",
      value: data.totalFrames || "N/A",
    },
    
      {
      key: "elapsedTime",
      label: "Elapsed Time (s)",
      value: data.elapsedTimeSeconds || "N/A",
    },
    {
      key: "refreshRate",
      label: "Refresh Rate (Hz)",
      value: data.refreshRate || "N/A",
    },
    {
      key: "manufacturer",
      label: "Manufacturer",
      value: manufacturer,
    },
    {
      key: "model",
      label: "Device Model",
      value: deviceInfo["ro.product.model"] || "N/A",
    },
    {
      key: "brand",
      label: "Product Brand",
      value: brand,
    },
    {
      key: "oemBrand",
      label: "OEM Brand",
      value: oemBrand,
    },
    {
      key: "androidVersion",
      label: "Android Version",
      value: deviceInfo["ro.build.version.release"] || "N/A",
    },
    {
      key: "apiLevel",
      label: "API Level",
      value: deviceInfo["ro.build.version.sdk"] || "N/A",
    },
    {
      key: "socModel",
      label: "SoC Model",
      value: deviceInfo["ro.soc.model"] || "N/A",
    },
    {
      key: "socManufacturer",
      label: "SoC Manufacturer",
      value: deviceInfo["ro.soc.manufacturer"] || "N/A",
    },
    {
      key: "cpuAbi",
      label: "CPU Architecture",
      value: deviceInfo["ro.product.cpu.abi"] || "N/A",
    },
    {
      key: "memTotal",
      label: "Total Memory",
      value: memoryDisplay,
    },
    {
      key: "eglHardware",
      label: "Graphics Hardware",
      value: deviceInfo["ro.hardware.egl"] || "N/A",
    },
    {
      key: "buildFingerprint",
      label: "Build Fingerprint",
      value: deviceInfo["ro.build.fingerprint"] || "N/A",
    },
  ];

  let tableHtml = "";
  properties.forEach((prop) => {
    tableHtml += `
      <tr>
        <td>${prop.label}</td>
        <td>${prop.value}</td>
      </tr>
    `;
  });

  tbody.innerHTML = tableHtml;
}

function populateSimilarResults(data) {
  const grid = document.getElementById("similarResultsGrid");
  const section = document.getElementById("similarResultsSection");

  // Find similar results (same package name, excluding current data)
  const similarResults = dashboard.uploadedData.filter(
    (item) => item.packageName === data.packageName && item !== data
  );

  if (similarResults.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  let gridHtml = "";
  similarResults.forEach((result) => {
    const deviceInfo = result.deviceInfo || {};
    const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
    const model = deviceInfo["ro.product.model"] || "Unknown";
    const device = `${manufacturer} ${model}`;

    gridHtml += `
      <div class="similar-result-card" onclick="openDetailedAnalysis(dashboard.uploadedData[${dashboard.uploadedData.indexOf(
        result
      )}])">
        <div class="similar-result-title">${
          result.appName || "Unknown App"
        }</div>
        <div class="similar-result-details">
          <div>Device: ${device}</div>
          <div>Upload: ${result.timestamp}</div>
          <div>Frames: ${result.totalFrames || "N/A"}</div>
          <div>Duration: ${result.elapsedTimeSeconds || "N/A"}s</div>
        </div>
        <div class="similar-result-fps">${result.avgFps || "N/A"} FPS</div>
      </div>
    `;
  });

  grid.innerHTML = gridHtml;
}

// AI Analysis functions
async function generateAIAnalysis() {
  const loadingElement = document.getElementById("aiAnalysisLoading");
  const resultElement = document.getElementById("aiAnalysisResult");
  const analyzeBtn = document.getElementById("aiAnalyzeBtn");
  const copyBtn = document.getElementById("copyAnalysisBtn");

  // Check if API key is configured
  const apiKey = localStorage.getItem("geminiApiKey");
  if (!apiKey) {
    resultElement.innerHTML = `
      <div style="color: var(--warning-color); font-weight: 600; margin-bottom: 10px;">
        🔧 AI Analysis Not Configured
      </div>
      <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
        Please configure your Gemini API key first by clicking "Configure API".
      </p>
    `;
    copyBtn.style.display = "none";
    return;
  }

  if (!currentAnalysisData) {
    resultElement.innerHTML = `
      <div style="color: var(--error-color); font-weight: 600; margin-bottom: 10px;">
        ❌ No Data Available
      </div>
      <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
        No performance data available for analysis.
      </p>
    `;
    copyBtn.style.display = "none";
    return;
  }

  // Show loading state
  loadingElement.style.display = "flex";
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  copyBtn.style.display = "none";

  try {
    // Structure the data for AI analysis
    const analysisData = structureDataForAI(currentAnalysisData);

    // Store the input data for viewing
    lastAnalysisInputData = analysisData;

    // Make API call to Gemini
    const analysis = await callGeminiAPI(apiKey, analysisData);

    // Format the analysis with rich text
    const formattedAnalysis = formatAnalysisText(analysis);

    // Display results
    resultElement.innerHTML = `
      <div style="color: var(--success-color); font-weight: 600; margin-bottom: 15px;">
        🤖 AI Performance Analysis
      </div>
      ${formattedAnalysis}
    `;

    // Show copy button and view input data button
    copyBtn.style.display = "inline-block";
    document.getElementById("viewInputDataBtn").style.display = "inline-block";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    resultElement.innerHTML = `
      <div style="color: var(--error-color); font-weight: 600; margin-bottom: 10px;">
        ❌ Analysis Failed
      </div>
      <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
        Error: ${error.message}
      </p>
    `;
    copyBtn.style.display = "none";
  } finally {
    loadingElement.style.display = "none";
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Generate AI Analysis";
  }
}

function structureDataForAI(data) {
  // Get comparative context from dashboard data
  const allData = dashboard.uploadedData;
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
  // Note: Assuming 'avgFps' is consistently available across allData items
  // and represents the average FPS for that entry.
  const allFpsValues = allData.map((item) => item.avgFps).sort((a, b) => a - b);
  const currentPercentile = calculatePercentile(allFpsValues, data.avgFps);

  return {
    // Core Performance Metrics
    performance: {
      avgFps: data.avgFps, // Average FPS over the duration
      minFps: data.minFps, // Minimum instantaneous FPS recorded
      maxFps: data.maxFps, // Maximum instantaneous FPS recorded
      targetFPS: data.targetFPS, // The intended target FPS (e.g., 30 for devs)
      scheduled_avgFps: data.vsync_avgFps,
      scheduled_minFps: data.vsync_minFps,
      scheduled_maxFps: data.vsync_maxFps,
      // Removed targetFpsConfidence as it's not calculated
      
      // Metrics for Slow Frames (frames exceeding a general threshold)
      avgSlowFrameExcessMs: data.avgSlowFrameExcess, // Average excess time (ms) for slow frames
      maxSlowFrameExcessMs: data.maxSlowFrameExcess, // Maximum excess time (ms) for any single slow frame
      slowFramesCount: data.slowFramesCount, // Total count of frames identified as "slow"
      slowFramePercentage: data.slowFramePercentage, // Percentage of total frames identified as "slow"

      // Metrics for Jank Instability (sudden, significant frame time spikes)
      avgJankInstabilityMs: data.avgJankInstability, // Average time (ms) of sudden frame time increases
      maxJankInstabilityMs: data.maxJankInstability, // Maximum time (ms) of any single jank instability spike
      jankInstabilityCount: data.jankInstabilityCount, // Total count of frames exhibiting jank instability
      jankInstabilityPercentage: data.jankInstabilityPercentage, // Percentage of total frames exhibiting jank instability
      choppinessRating: data.choppinessRating, // Qualitative rating for overall choppiness based on jank instability

      performanceRating: data.performanceRating, // Overall qualitative performance rating
      elapsedTimeSeconds: data.elapsedTimeSeconds, // Total duration of the test in seconds
      totalFrames: data.totalFrames, // Total number of frames recorded
      refreshRate: data.refreshRate, // Device screen refresh rate
      performancePercentile: currentPercentile, // Current run's average FPS percentile among all uploaded data
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
          slowFramePercentage: item.slowFramePercentage, // Use the specific slow frame percentage
          jankInstabilityPercentage: item.jankInstabilityPercentage, // Use the specific jank instability percentage
        }))
        .slice(0, 5),

      sameAppPerformance: sameAppDifferentDevices
        .map((item) => ({
          device: `${item.deviceInfo?.["ro.product.manufacturer"]} ${item.deviceInfo?.["ro.product.model"]}`,
          avgFps: item.avgFps,
          slowFramePercentage: item.slowFramePercentage, // Use the specific slow frame percentage
          jankInstabilityPercentage: item.jankInstabilityPercentage, // Use the specific jank instability percentage
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
      fps: frame.instantFps, // Correctly references 'instantFps' from raw data
      deltaTime: frame.deltaTime,
      latency: frame.latency,
    })),
  };
}

function inferAppCategory(appName, packageName) {
  const name = (appName || "").toLowerCase();
  const pkg = (packageName || "").toLowerCase();

  // Gaming indicators
  if (
    name.includes("game") ||
    name.includes("play") ||
    pkg.includes("game") ||
    pkg.includes("unity") ||
    name.includes("racing") ||
    name.includes("action") ||
    name.includes("rpg") ||
    name.includes("fps")
  ) {
    return "Gaming";
  }

  // Benchmark indicators
  if (
    name.includes("benchmark") ||
    name.includes("test") ||
    name.includes("antutu") ||
    name.includes("geekbench") ||
    name.includes("3dmark")
  ) {
    return "Benchmark";
  }

  // Media/Video indicators
  if (
    name.includes("video") ||
    name.includes("media") ||
    name.includes("player") ||
    name.includes("stream")
  ) {
    return "Media";
  }

  // Browser indicators
  if (
    name.includes("browser") ||
    name.includes("chrome") ||
    name.includes("firefox") ||
    name.includes("safari")
  ) {
    return "Browser";
  }

  return "Productivity";
}

function calculateMemoryGB(memTotal) {
  if (!memTotal) return null;
  const memKB = parseFloat(memTotal.replace(" kB", ""));
  return isNaN(memKB) ? null : (memKB / (1024 * 1024)).toFixed(1);
}

function calculatePercentile(sortedArray, value) {
  const index = sortedArray.findIndex((v) => v >= value);
  if (index === -1) return 100;
  return Math.round((index / sortedArray.length) * 100);
}

async function callGeminiAPI(apiKey, analysisData) {
  const prompt = `You are a mobile performance analysis expert. Analyze this performance data and provide insights:

PERFORMANCE DATA:
${JSON.stringify(analysisData, null, 2)}

Please provide a comprehensive analysis covering:

1. **Performance Assessment**: Overall performance rating and key metrics interpretation
2. **Bottleneck Analysis**: Identify likely performance bottlenecks (CPU, GPU, memory, thermal)
3. **Device-App Compatibility**: How well-suited this device is for this app
4. **Comparative Analysis**: How this performance compares to similar devices/apps
5. **Optimization Recommendations**: Specific suggestions for improvement
6. **Technical Insights**: Frame timing patterns and jank analysis

Format your response in clear sections with actionable insights. Be specific about technical details while remaining accessible.`;

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

function showAIConfig() {
  // Create a simple modal for API configuration
  const configModal = document.createElement("div");
  configModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
  `;

  configModal.innerHTML = `
    <div style="
      background: var(--card-bg);
      border-radius: var(--card-radius);
      border: var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      padding: 30px;
      max-width: 500px;
      width: 90%;
    ">
      <h3 style="color: var(--text-primary); margin-top: 0;">Configure Gemini AI</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">
        Enter your Google Gemini API key to enable AI-powered performance analysis.
      </p>
      <input 
        type="password" 
        id="geminiApiKey" 
        placeholder="Enter your Gemini API key..."
        style="
          width: 100%;
          padding: 12px;
          border-radius: var(--btn-radius);
          border: 1px solid var(--border-color);
          background: var(--input-bg-color);
          color: var(--text-primary);
          font-family: 'Inter', sans-serif;
          margin-bottom: 20px;
          box-sizing: border-box;
        "
      />
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="closeAIConfig()" style="
          padding: 10px 20px;
          border-radius: var(--btn-radius);
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-primary);
          cursor: pointer;
        ">Cancel</button>
        <button onclick="saveAIConfig()" style="
          padding: 10px 20px;
          border-radius: var(--btn-radius);
          border: none;
          background: var(--primary-color);
          color: white;
          cursor: pointer;
        ">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(configModal);
  window.currentConfigModal = configModal;
}

function closeAIConfig() {
  if (window.currentConfigModal) {
    document.body.removeChild(window.currentConfigModal);
    window.currentConfigModal = null;
  }
}

function saveAIConfig() {
  const apiKey = document.getElementById("geminiApiKey").value.trim();

  if (!apiKey) {
    alert("Please enter a valid API key.");
    return;
  }

  // Store API key (in a real implementation, this should be stored securely)
  localStorage.setItem("geminiApiKey", apiKey);

  // Show success message
  dashboard.showToast("Gemini API key saved successfully!", "success");

  // Close modal
  closeAIConfig();

  // Update the AI analysis result to show it's now configured
  const resultElement = document.getElementById("aiAnalysisResult");
  resultElement.innerHTML = `
    <div style="color: var(--success-color); font-weight: 600; margin-bottom: 10px;">
      ✅ AI Analysis Ready
    </div>
    <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
      Gemini API is now configured. Click "Generate AI Analysis" to get intelligent 
      insights about performance patterns, bottlenecks, and optimization recommendations.
    </p>
  `;
}

// Compare Feature Functions
function toggleAppSelection(dataIndex, checkbox) {
  if (checkbox.checked) {
    dashboard.selectedForComparison.add(dataIndex);
  } else {
    dashboard.selectedForComparison.delete(dataIndex);
  }
  updateCompareControls();
}

function updateCompareControls() {
  const compareControls = document.getElementById("compareControls");
  const selectedCount = document.getElementById("selectedCount");
  const compareBtn = document.getElementById("compareBtn");

  if (dashboard.selectedForComparison.size >= 2) {
    compareControls.classList.add("show");
    selectedCount.textContent = `${dashboard.selectedForComparison.size} selected`;
    compareBtn.disabled = false;
  } else {
    compareControls.classList.remove("show");
    compareBtn.disabled = true;
  }
}

function openComparisonModal() {
  if (dashboard.selectedForComparison.size < 2) {
    dashboard.showToast("Please select at least 2 apps to compare.", "warning");
    return;
  }

  const modal = document.getElementById("comparisonModal");

  // Set higher z-index to ensure it appears above other modals
  modal.style.zIndex = "4000";

  // Get selected data
  const selectedData = Array.from(dashboard.selectedForComparison).map(
    (index) => dashboard.uploadedData[index]
  );

  // Populate comparison modal sections
  populateSelectedApps(selectedData);
  createComparisonBarChart(selectedData);
  createComparisonMetricsTable(selectedData);
  createComparisonFpsBucketsCharts(selectedData);

  // --- MODIFIED PART ---
  // Initialize the view by showing the FPS chart by default.
  // This function also handles creating the chart itself.
  showComparisonChart('fps');
  // --- END OF MODIFICATION ---

  // Clear any previous comparison AI analysis
  clearComparisonAIAnalysis();

  // Show modal
  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  // Initialize close button
  const closeBtn = document.getElementById("closeComparisonBtn");
  closeBtn.onclick = closeComparisonModal;
}

function closeComparisonModal() {
  const modal = document.getElementById("comparisonModal");
  modal.classList.remove("show");
  document.body.style.overflow = "";

  // Destroy all comparison charts to free memory
  Object.values(dashboard.comparisonCharts).forEach((chart) => {
    if (chart) chart.destroy();
  });
  dashboard.comparisonCharts = {};

  // Reset the active chart state for the next time the modal is opened
  if (dashboard) {
    dashboard.activeComparisonChart = 'fps';
  }
}

function populateSelectedApps(selectedData) {
  const container = document.getElementById("selectedAppsList");

  // Generate colors for each app
  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  let html = "";
  selectedData.forEach((data, index) => {
    const color = colors[index];
    html += `
      <div class="selected-app-chip">
        <span class="app-color-indicator" style="background-color: ${color};"></span>
        <span>${data.appName || "Unknown App"}</span>
        <button class="remove-app-btn" onclick="removeFromComparison(${dashboard.uploadedData.indexOf(
          data
        )})">&times;</button>
      </div>
    `;
  });

  container.innerHTML = html;
}

function removeFromComparison(dataIndex) {
  dashboard.selectedForComparison.delete(dataIndex);
  updateCompareControls();

  if (dashboard.selectedForComparison.size < 2) {
    closeComparisonModal();
    dashboard.showToast("Comparison closed - minimum 2 apps required.", "info");
  } else {
    // Refresh the comparison with remaining apps
    openComparisonModal();
  }
}

function createComparisonCharts(selectedData) {
  createComparisonFpsChart(selectedData);
  createComparisonBarChart(selectedData);
  createComparisonFpsBucketsCharts(selectedData);
}

function createComparisonFpsChart(selectedData) {
  const ctx = document.getElementById("comparisonFpsChart").getContext("2d");

  if (dashboard.comparisonCharts.fpsChart) {
    dashboard.comparisonCharts.fpsChart.destroy();
  }

  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  const intervalMap = { 'frame': 0, '1s': 1000, '5s': 5000 };
  const intervalMs = intervalMap[dashboard.comparisonChartTimeScale];

  const datasets = selectedData.map((data, index) => {
      if (!data.perFrameInstantaneousFps || data.perFrameInstantaneousFps.length === 0) {
        return null;
      }
      
      const startTimeNs = data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;
      
      const dataPoints = data.perFrameInstantaneousFps.map((fps, frameIndex) => {
          if (frameIndex + 1 >= data.rawFpsData.length) return null;
          const timestampNs = data.rawFpsData[frameIndex + 1].presentationTime;
          return {
              x: (timestampNs - startTimeNs) / 1000000,
              y: Math.min(fps, 200)
          };
      }).filter(p => p !== null && !isNaN(p.y));

      const aggregatedData = aggregateDataByTime(dataPoints, intervalMs);

      return {
        label: data.appName || "Unknown App",
        data: aggregatedData,
        borderColor: colors[index],
        backgroundColor: colors[index] + "20",
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 3,
      };
    })
    .filter((dataset) => dataset !== null);

  dashboard.comparisonCharts.fpsChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            title: function(context) {
                if (!context[0]) return '';
                const totalSeconds = context[0].parsed.x / 1000;
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                return `Time: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            },
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} FPS`;
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear', // Use a linear scale for duration
          title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
              color: "rgba(255, 255, 255, 0.8)",
              // Custom formatter to show milliseconds as mm:ss
              callback: function(value, index, ticks) {
                  const totalSeconds = Math.floor(value / 1000);
                  const minutes = Math.floor(totalSeconds / 60);
                  const seconds = totalSeconds % 60;
                  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              }
          },
        },
        y: {
          title: {
            display: true,
            text: "FPS",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: { color: "rgba(255, 255, 255, 0.8)" },
          beginAtZero: true,
        },
      },
    },
  });
}

function createComparisonBarChart(selectedData) {
  const ctx = document.getElementById("comparisonBarChart").getContext("2d");

  // Destroy existing chart
  if (dashboard.comparisonCharts.barChart) {
    dashboard.comparisonCharts.barChart.destroy();
  }

  // Generate colors for each app
  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  const labels = selectedData.map((data) => data.appName || "Unknown App");
  const avgFpsData = selectedData.map((data) => data.avgFps || 0);
  const minFpsData = selectedData.map((data) => data.minFps || 0);
  const maxFpsData = selectedData.map((data) => data.maxFps || 0);

  dashboard.comparisonCharts.barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Average FPS",
          data: avgFpsData,
          backgroundColor: colors.map((color) => color + "80"),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 4,
        },
        {
          label: "Min FPS",
          data: minFpsData,
          backgroundColor: colors.map((color) => color + "40"),
          borderColor: colors.map((color) => color + "80"),
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Max FPS",
          data: maxFpsData,
          backgroundColor: colors.map((color) => color + "60"),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(
                1
              )} FPS`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            maxRotation: 45,
          },
        },
        y: {
          title: {
            display: true,
            text: "FPS",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
          },
          beginAtZero: true,
        },
      },
    },
  });
}

function createComparisonMetricsTable(selectedData) {
  const tbody = document.getElementById("comparisonMetricsBody");

  // Generate colors for each app
  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  let html = "";
  selectedData.forEach((data, index) => {
    const deviceInfo = data.deviceInfo || {};
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    const color = colors[index];

    html += `
      <tr>
        <td>
          <span class="app-color-indicator" style="background-color: ${color};"></span>
          ${data.appName || "Unknown App"}
        </td>
        <td title="${device}">${device}</td>
        <td>${data.avgFps ? data.avgFps.toFixed(1) : "N/A"}</td>
        <td>${data.vsync_avgFps ? data.vsync_avgFps.toFixed(1) : "N/A"}</td>
        <td>${data.minFps ? data.minFps.toFixed(1) : "N/A"}</td>
        <td>${data.maxFps ? data.maxFps.toFixed(1) : "N/A"}</td>
        <td>${
          // Display Slow Frame Percentage
          data.slowFramePercentage ? data.slowFramePercentage.toFixed(1) + "%" : "N/A"
        }</td>
        <td>${
          // Display Jank Instability Percentage
          data.jankInstabilityPercentage ? data.jankInstabilityPercentage.toFixed(1) + "%" : "N/A"
        }</td>
        <td>${
          data.elapsedTimeSeconds ? data.elapsedTimeSeconds.toFixed(1) : "N/A"
        }</td>
        <td>${data.totalFrames || "N/A"}</td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function createComparisonFpsBucketsCharts(selectedData) {
  const container = document.getElementById("comparisonFpsBucketsContainer");

  // Clear existing content
  container.innerHTML = "";

  // Filter data that has FPS buckets
  const dataWithBuckets = selectedData.filter((data) => data.fpsBuckets);

  if (dataWithBuckets.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <p>No FPS bucket data available for comparison</p>
      </div>
    `;
    return;
  }

  // Generate colors for each app
  const colors = dataWithBuckets.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  // Create individual charts for each app
  dataWithBuckets.forEach((data, index) => {
    const chartId = `fpsBucketsChart_${index}`;
    const color = colors[index];

    // Create chart container
    const chartContainer = document.createElement("div");
    chartContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    chartContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
        <span class="app-color-indicator" style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%;"></span>
        <h4 style="margin: 0; color: var(--text-primary); font-size: 1rem;">${
          data.appName || "Unknown App"
        }</h4>
      </div>
      <div style="height: 300px; position: relative;">
        <canvas id="${chartId}"></canvas>
      </div>
    `;

    container.appendChild(chartContainer);

    // Create the chart
    const ctx = document.getElementById(chartId).getContext("2d");
    const chartConfig = createFpsBucketsChartConfig(data.fpsBuckets);

    // Override colors to match the app's color scheme
    if (chartConfig.data.datasets[0]) {
      const baseColor = color;
      chartConfig.data.datasets[0].backgroundColor = [
        baseColor + "60", // 0-10: Semi-transparent
        baseColor + "70", // 10-15
        baseColor + "80", // 15-20
        baseColor + "90", // 20-25
        baseColor + "A0", // 25-30
        baseColor + "B0", // 30-40
        baseColor + "C0", // 40-50
        baseColor + "D0", // 50-60
        baseColor + "E0", // 60+
      ];
      chartConfig.data.datasets[0].borderColor = baseColor;
    }

    // Store chart reference for cleanup
    dashboard.comparisonCharts[`fpsBuckets_${index}`] = new Chart(
      ctx,
      chartConfig
    );
  });
}

// Rich text formatting function
function formatAnalysisText(text) {
  // Convert markdown-like formatting to HTML
  let formatted = text
    // Headers
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")

    // Bold text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")

    // Italic text
    .replace(/\*(.*?)\*/g, "<em>$1</em>")

    // Code blocks
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")

    // Inline code
    .replace(/`(.*?)`/g, "<code>$1</code>")

    // Bullet points
    .replace(/^- (.*$)/gim, "<li>$1</li>")

    // Numbers lists
    .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")

    // Line breaks
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  // Wrap in paragraphs and handle lists
  formatted = "<p>" + formatted + "</p>";

  // Fix list formatting
  formatted = formatted
    .replace(/<p>(<li>.*?<\/li>)<\/p>/gs, "<ul>$1</ul>")
    .replace(/<\/li><br><li>/g, "</li><li>")
    .replace(/<p><\/p>/g, "");

  // Clean up empty paragraphs and fix spacing
  formatted = formatted
    .replace(/<p><br><\/p>/g, "")
    .replace(/<p><\/p>/g, "")
    .replace(/<br><\/p>/g, "</p>")
    .replace(/<p><br>/g, "<p>");

  return formatted;
}

// Clear AI analysis when switching between apps
function clearAIAnalysis() {
  const resultElement = document.getElementById("aiAnalysisResult");
  const copyBtn = document.getElementById("copyAnalysisBtn");

  if (resultElement) {
    resultElement.innerHTML = `
      <div style="color: var(--text-secondary); font-style: italic;">
        Click "Generate AI Analysis" to get intelligent insights about this app's performance.
      </div>
    `;
  }

  if (copyBtn) {
    copyBtn.style.display = "none";
  }
}

// Clear comparison AI analysis
function clearComparisonAIAnalysis() {
  const resultElement = document.getElementById("comparisonAiAnalysisResult");
  const copyBtn = document.getElementById("copyComparisonAnalysisBtn");

  if (resultElement) {
    resultElement.innerHTML = `
      <div style="color: var(--text-secondary); font-style: italic;">
        Click "Generate AI Analysis" to get intelligent insights about the performance comparison between selected apps.
      </div>
    `;
  }

  if (copyBtn) {
    copyBtn.style.display = "none";
  }
}

// Store the last analysis input data for viewing
let lastAnalysisInputData = null;
let lastComparisonAnalysisInputData = null;

// Show input data modal
function showInputData() {
  if (!lastAnalysisInputData) {
    dashboard.showToast("No input data available to display.", "warning");
    return;
  }

  // Create modal for displaying input data
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--card-bg);
      border-radius: var(--card-radius);
      border: var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      padding: 30px;
      max-width: 800px;
      width: 95%;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;">📄 AI Analysis Input Data</h3>
        <button onclick="closeInputDataModal()" style="
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          font-size: 1.5rem;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        ">&times;</button>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">
        This is the structured data that was provided to the AI for analysis:
      </p>
      <div style="
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-family: 'Roboto Mono', monospace;
        font-size: 0.8rem;
        line-height: 1.4;
        color: var(--text-primary);
        white-space: pre-wrap;
        overflow-x: auto;
      ">${JSON.stringify(lastAnalysisInputData, null, 2)}</div>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button onclick="copyInputData()" style="
          padding: 10px 20px;
          border-radius: var(--btn-radius);
          border: none;
          background: var(--success-color);
          color: white;
          cursor: pointer;
          font-weight: 600;
        ">📋 Copy JSON</button>
        <button onclick="closeInputDataModal()" style="
          padding: 10px 20px;
          border-radius: var(--btn-radius);
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-primary);
          cursor: pointer;
          font-weight: 600;
        ">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentInputDataModal = modal;

  // Handle Escape key
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeInputDataModal();
    }
  });
}

// Close input data modal
function closeInputDataModal() {
  if (window.currentInputDataModal) {
    document.body.removeChild(window.currentInputDataModal);
    window.currentInputDataModal = null;
  }
}

// Copy input data to clipboard
function copyInputData() {
  if (!lastAnalysisInputData) return;

  const jsonString = JSON.stringify(lastAnalysisInputData, null, 2);

  try {
    // Use the modern Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          dashboard.showToast("Input data copied to clipboard!", "success");
        })
        .catch((err) => {
          console.error("Failed to copy:", err);
          fallbackCopyText(jsonString);
        });
    } else {
      fallbackCopyText(jsonString);
    }
  } catch (error) {
    console.error("Copy failed:", error);
    dashboard.showToast("Failed to copy input data", "error");
  }
}

// Show comparison input data modal
function showComparisonInputData() {
  if (!lastComparisonAnalysisInputData) {
    dashboard.showToast(
      "No comparison input data available to display.",
      "warning"
    );
    return;
  }

  // Create modal for displaying comparison input data
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--card-bg);
      border-radius: var(--card-radius);
      border: var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      padding: 30px;
      max-width: 800px;
      width: 95%;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;">📄 AI Comparison Analysis Input Data</h3>
        <button onclick="closeComparisonInputDataModal()" style="
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          font-size: 1.5rem;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        ">&times;</button>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">
        This is the structured comparison data that was provided to the AI for analysis:
      </p>
      <div style="
        background: rgba(0, 0, 0, 0.3);
        border-radius: 8px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-family: 'Roboto Mono', monospace;
        font-size: 0.8rem;
        line-height: 1.4;
        color: var(--text-primary);
        white-space: pre-wrap;
        overflow-x: auto;
      ">${JSON.stringify(lastComparisonAnalysisInputData, null, 2)}</div>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button onclick="copyComparisonInputData()" style="
          padding: 10px 20px;
          border-radius: var(--btn-radius);
          border: none;
          background: var(--success-color);
          color: white;
          cursor: pointer;
          font-weight: 600;
        ">📋 Copy JSON</button>
        <button onclick="closeComparisonInputDataModal()" style="
          padding: 10px 20px;
          border-radius: var(--btn-radius);
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-primary);
          cursor: pointer;
          font-weight: 600;
        ">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentComparisonInputDataModal = modal;

  // Handle Escape key
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeComparisonInputDataModal();
    }
  });
}

// Close comparison input data modal
function closeComparisonInputDataModal() {
  if (window.currentComparisonInputDataModal) {
    document.body.removeChild(window.currentComparisonInputDataModal);
    window.currentComparisonInputDataModal = null;
  }
}

// Copy comparison input data to clipboard
function copyComparisonInputData() {
  if (!lastComparisonAnalysisInputData) return;

  const jsonString = JSON.stringify(lastComparisonAnalysisInputData, null, 2);

  try {
    // Use the modern Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          dashboard.showToast(
            "Comparison input data copied to clipboard!",
            "success"
          );
        })
        .catch((err) => {
          console.error("Failed to copy:", err);
          fallbackCopyText(jsonString);
        });
    } else {
      fallbackCopyText(jsonString);
    }
  } catch (error) {
    console.error("Copy failed:", error);
    dashboard.showToast("Failed to copy comparison input data", "error");
  }
}

// Fallback copy function for plain text
function fallbackCopyText(text) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    dashboard.showToast("Input data copied to clipboard!", "success");
  } catch (err) {
    console.error("Fallback copy failed:", err);
    dashboard.showToast("Failed to copy input data", "error");
  }
}

// Generate AI analysis for comparison
async function generateComparisonAIAnalysis() {
  const loadingElement = document.getElementById("comparisonAiAnalysisLoading");
  const resultElement = document.getElementById("comparisonAiAnalysisResult");
  const analyzeBtn = document.getElementById("comparisonAiAnalyzeBtn");
  const copyBtn = document.getElementById("copyComparisonAnalysisBtn");

  // Check if API key is configured
  const apiKey = localStorage.getItem("geminiApiKey");
  if (!apiKey) {
    resultElement.innerHTML = `
      <div style="color: var(--warning-color); font-weight: 600; margin-bottom: 10px;">
        🔧 AI Analysis Not Configured
      </div>
      <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
        Please configure your Gemini API key first by clicking "Configure API".
      </p>
    `;
    copyBtn.style.display = "none";
    return;
  }

  // Get selected data for comparison
  const selectedData = Array.from(dashboard.selectedForComparison).map(
    (index) => dashboard.uploadedData[index]
  );

  if (selectedData.length < 2) {
    resultElement.innerHTML = `
      <div style="color: var(--error-color); font-weight: 600; margin-bottom: 10px;">
        ❌ Insufficient Data
      </div>
      <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
        At least 2 apps must be selected for comparison analysis.
      </p>
    `;
    copyBtn.style.display = "none";
    return;
  }

  // Show loading state
  loadingElement.style.display = "flex";
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  copyBtn.style.display = "none";

  try {
    // Structure the comparison data for AI analysis
    const comparisonData = structureComparisonDataForAI(selectedData);

    // Store the input data for viewing
    lastComparisonAnalysisInputData = comparisonData;

    // Make API call to Gemini
    const analysis = await callGeminiComparisonAPI(apiKey, comparisonData);

    // Format the analysis with rich text
    const formattedAnalysis = formatAnalysisText(analysis);

    // Display results
    resultElement.innerHTML = `
      <div style="color: var(--success-color); font-weight: 600; margin-bottom: 15px;">
        🤖 AI Comparison Analysis
      </div>
      ${formattedAnalysis}
    `;

    // Show copy button and view input data button
    copyBtn.style.display = "inline-block";
    document.getElementById("viewComparisonInputDataBtn").style.display =
      "inline-block";
  } catch (error) {
    console.error("AI Comparison Analysis Error:", error);
    resultElement.innerHTML = `
      <div style="color: var(--error-color); font-weight: 600; margin-bottom: 10px;">
        ❌ Analysis Failed
      </div>
      <p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">
        Error: ${error.message}
      </p>
    `;
    copyBtn.style.display = "none";
  } finally {
    loadingElement.style.display = "none";
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Generate AI Analysis";
  }
}

// Structure comparison data for AI analysis
function structureComparisonDataForAI(selectedData) {
  // Get all data for context
  const allData = dashboard.uploadedData;

  // Calculate comparative metrics
  const comparisonMetrics = {
    apps: selectedData.map((data, index) => {
      const deviceInfo = data.deviceInfo || {};

      // Calculate performance ranking among selected apps
      // Ensure avgFps exists before sorting and indexOf
      const validAvgFpsValues = selectedData.map((d) => d.avgFps).filter(val => typeof val === 'number');
      const fpsRanking =
        validAvgFpsValues.length > 0 && typeof data.avgFps === 'number'
          ? validAvgFpsValues
              .sort((a, b) => b - a)
              .indexOf(data.avgFps) + 1
          : 'N/A'; // Handle cases where avgFps might be missing

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
          
          // Updated to use specific jank metrics
          avgSlowFrameExcessMs: data.avgSlowFrameExcess, // Average excess time (ms) for slow frames
          maxSlowFrameExcessMs: data.maxSlowFrameExcess, // Maximum excess time (ms) for any single slow frame
          slowFramesCount: data.slowFramesCount, // Total count of frames identified as "slow"
          slowFramePercentage: data.slowFramePercentage, // Percentage of total frames identified as "slow"

          avgJankInstabilityMs: data.avgJankInstability, // Average time (ms) of sudden frame time increases
          maxJankInstabilityMs: data.maxJankInstability, // Maximum time (ms) of any single jank instability spike
          jankInstabilityCount: data.jankInstabilityCount, // Total count of frames exhibiting jank instability
          jankInstabilityPercentage: data.jankInstabilityPercentage, // Percentage of total frames exhibiting jank instability
          choppinessRating: data.choppinessRating, // Qualitative rating for overall choppiness

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

    // Overall comparison statistics
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
      
      // Updated to average both types of jank percentages
      averageSlowFramePercentageAcrossApps:
        selectedData.reduce((sum, d) => sum + (d.slowFramePercentage || 0), 0) /
        selectedData.length,
      averageJankInstabilityPercentageAcrossApps:
        selectedData.reduce((sum, d) => sum + (d.jankInstabilityPercentage || 0), 0) /
        selectedData.length,
      
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

    // Context from all data
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

  return comparisonMetrics;
}

// Call Gemini API for comparison analysis
async function callGeminiComparisonAPI(apiKey, comparisonData) {
  const prompt = `You are a mobile performance analysis expert. Analyze this app performance comparison data and provide comprehensive insights:

COMPARISON DATA:
${JSON.stringify(comparisonData, null, 2)}

Please provide a detailed comparison analysis covering:

1. **Performance Ranking & Overview**: Rank the apps by performance and provide overall assessment
2. **Device Impact Analysis**: How different devices/SoCs affect performance across apps
3. **App-Specific Insights**: Performance characteristics unique to each app category/type
4. **Bottleneck Identification**: Identify what's limiting performance for each app
5. **Cross-App Performance Patterns**: Common performance trends and outliers
6. **Hardware Optimization**: Which hardware configurations work best for which app types
7. **Recommendations**: Specific optimization suggestions for each app and device combination

Focus on actionable insights and technical details. Highlight significant performance differences and their likely causes.`;

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

// Copy analysis content with rich formatting
function copyAnalysisContent() {
  const resultElement = document.getElementById("aiAnalysisResult");
  const copyBtn = document.getElementById("copyAnalysisBtn");

  if (!resultElement) return;

  try {
    // Get the HTML content
    const htmlContent = resultElement.innerHTML;

    // Create a temporary element to get plain text version
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    // Create rich text blob for clipboard
    const htmlBlob = new Blob([htmlContent], { type: "text/html" });
    const textBlob = new Blob([plainText], { type: "text/plain" });

    // Use the modern Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.write) {
      const clipboardItem = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });

      navigator.clipboard
        .write([clipboardItem])
        .then(() => {
          // Show success feedback
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "✅ Copied!";
          copyBtn.style.background = "var(--success-color)";

          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = "var(--success-color)";
          }, 2000);

          dashboard.showToast("Analysis copied with formatting!", "success");
        })
        .catch((err) => {
          console.error("Failed to copy rich text:", err);
          fallbackCopy(plainText);
        });
    } else {
      // Fallback to plain text copy
      fallbackCopy(plainText);
    }
  } catch (error) {
    console.error("Copy failed:", error);
    dashboard.showToast("Failed to copy analysis", "error");
  }
}

// Copy comparison analysis content with rich formatting
function copyComparisonAnalysisContent() {
  const resultElement = document.getElementById("comparisonAiAnalysisResult");
  const copyBtn = document.getElementById("copyComparisonAnalysisBtn");

  if (!resultElement) return;

  try {
    // Get the HTML content
    const htmlContent = resultElement.innerHTML;

    // Create a temporary element to get plain text version
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    // Create rich text blob for clipboard
    const htmlBlob = new Blob([htmlContent], { type: "text/html" });
    const textBlob = new Blob([plainText], { type: "text/plain" });

    // Use the modern Clipboard API if available
    if (navigator.clipboard && navigator.clipboard.write) {
      const clipboardItem = new ClipboardItem({
        "text/html": htmlBlob,
        "text/plain": textBlob,
      });

      navigator.clipboard
        .write([clipboardItem])
        .then(() => {
          // Show success feedback
          const originalText = copyBtn.textContent;
          copyBtn.textContent = "✅ Copied!";
          copyBtn.style.background = "var(--success-color)";

          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = "var(--success-color)";
          }, 2000);

          dashboard.showToast(
            "Comparison analysis copied with formatting!",
            "success"
          );
        })
        .catch((err) => {
          console.error("Failed to copy rich text:", err);
          fallbackCopyComparison(plainText);
        });
    } else {
      // Fallback to plain text copy
      fallbackCopyComparison(plainText);
    }
  } catch (error) {
    console.error("Copy failed:", error);
    dashboard.showToast("Failed to copy comparison analysis", "error");
  }
}

// Fallback copy function for comparison analysis
function fallbackCopyComparison(text) {
  const copyBtn = document.getElementById("copyComparisonAnalysisBtn");

  try {
    // Create a temporary textarea
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);

    // Select and copy
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    // Show success feedback
    const originalText = copyBtn.textContent;
    copyBtn.textContent = "✅ Copied!";
    copyBtn.style.background = "var(--success-color)";

    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = "var(--success-color)";
    }, 2000);

    dashboard.showToast("Comparison analysis copied as plain text", "success");
  } catch (err) {
    console.error("Fallback copy failed:", err);
    dashboard.showToast("Failed to copy comparison analysis", "error");
  }
}

// Fallback copy function for plain text
function fallbackCopy(text) {
  const copyBtn = document.getElementById("copyAnalysisBtn");

  try {
    // Create a temporary textarea
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);

    // Select and copy
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);

    // Show success feedback
    const originalText = copyBtn.textContent;
    copyBtn.textContent = "✅ Copied!";
    copyBtn.style.background = "var(--success-color)";

    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.style.background = "var(--success-color)";
    }, 2000);

    dashboard.showToast("Analysis copied as plain text", "success");
  } catch (err) {
    console.error("Fallback copy failed:", err);
    dashboard.showToast("Failed to copy analysis", "error");
  }
}

// Functions to show all instances of apps and devices
function showAllAppInstances(appName) {
  // First, find the package name for this app
  const appData = dashboard.uploadedData.find(
    (data) => data.appName === appName
  );
  if (!appData) {
    dashboard.showToast(`No data found for ${appName}`, "warning");
    return;
  }

  const packageName = appData.packageName;

  // Filter all data for this specific package (to get all instances of the same app)
  const appInstances = dashboard.uploadedData.filter(
    (data) => data.packageName === packageName
  );

  if (appInstances.length === 0) {
    dashboard.showToast(`No instances found for ${appName}`, "warning");
    return;
  }

  // Create modal to show all instances
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--card-bg);
      border-radius: var(--card-radius);
      border: var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      padding: 30px;
      max-width: 95vw;
      width: 95%;
      max-height: 80vh;
      overflow-y: auto;
      position: relative;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;">🎮 All Instances of "${appName}"</h3>
        <button 
          onclick="closeAppInstancesModal(this)" 
          style="
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            font-size: 1.5rem;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          &times;
        </button>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">
        Found ${appInstances.length} instance${
    appInstances.length !== 1 ? "s" : ""
  } of this app (${packageName}) across different devices and test sessions. Select multiple items to compare or delete them.
      </p>
      <div style="overflow-x: auto;">
        ${generateAppInstancesTable(appInstances)}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentDeviceInstancesModal = modal;

  // Update modal controls when checkboxes change
  updateModalCompareControls();

  // Handle Escape key
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDeviceInstancesModal();
    }
  });
}

function showAllDeviceInstances(deviceName) {
  // Filter all data for this specific device
  const deviceInstances = dashboard.uploadedData.filter((data) => {
    const deviceInfo = data.deviceInfo || {};
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    return device === deviceName;
  });

  if (deviceInstances.length === 0) {
    dashboard.showToast(`No instances found for ${deviceName}`, "warning");
    return;
  }

  // Create modal to show all instances
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--card-bg);
      border-radius: var(--card-radius);
      border: var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      padding: 30px;
      max-width: 95vw;
      width: 95%;
      max-height: 80vh;
      overflow-y: auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;">📱 All Tests on "${deviceName}"</h3>
        <button 
          onclick="closeDeviceInstancesModal(this)" 
          style="
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            font-size: 1.5rem;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          &times;
        </button>
      </div>
      <p style="color: var(--text-secondary); margin-bottom: 20px;">
        Found ${deviceInstances.length} test${
    deviceInstances.length !== 1 ? "s" : ""
  } performed on this device across different apps and sessions.
      </p>
      <div style="overflow-x: auto;">
        ${generateDeviceInstancesTable(deviceInstances)}
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentDeviceInstancesModal = modal;

  // Handle Escape key
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDeviceInstancesModal();
    }
  });
}

function generateAppInstancesTable(instances) {
  let tableHtml = `
    <table class="dashboard-table" style="min-width: 800px;">
      <thead>
        <tr>
          <th>Select</th>
          <th>Device</th>
          <th>SoC</th>
          <th>Memory (GB)</th>
          <th>Android Ver</th>
          <th>Avg FPS</th>
          <th>Min FPS</th>
          <th>Max FPS</th>
          <th>Slow Frame %</th>
          <th>Jank Instability %</th>
          <th>Duration (s)</th>
          <th>Upload Time</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  instances.forEach((data) => {
    const deviceInfo = data.deviceInfo || {};
    const actualDataIndex = dashboard.uploadedData.indexOf(data);
    const isSelected = dashboard.selectedForComparison.has(actualDataIndex);

    const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
    const model = deviceInfo["ro.product.model"] || "Unknown";
    const device = `${manufacturer} ${model}`;
    const soc = deviceInfo["ro.soc.model"] || "N/A";
    const androidVersion = deviceInfo["ro.build.version.release"] || "N/A";

    let memoryGB = "N/A";
    if (deviceInfo.MemTotal) {
      const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
      if (!isNaN(memKB)) {
        memoryGB = (memKB / (1024 * 1024)).toFixed(1);
      }
    }

    const avgFps = data.avgFps ? data.avgFps.toFixed(1) : "N/A";
    const minFps = data.minFps ? data.minFps.toFixed(1) : "N/A";
    const maxFps = data.maxFps ? data.maxFps.toFixed(1) : "N/A";
    
    const slowFramePercentage = data.slowFramePercentage
      ? data.slowFramePercentage.toFixed(1) + "%"
      : "N/A";
    const jankInstabilityPercentage = data.jankInstabilityPercentage
      ? data.jankInstabilityPercentage.toFixed(1) + "%"
      : "N/A";

    const duration = data.elapsedTimeSeconds
      ? data.elapsedTimeSeconds.toFixed(1)
      : "N/A";
    const uploadTime = data.timestamp || "N/A";

    tableHtml += `
      <tr onclick="closeAppInstancesModal(); openDetailedAnalysis(dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-checkbox" 
                 ${isSelected ? "checked" : ""} 
                 onchange="toggleAppSelectionInModal(${actualDataIndex}, this)" />
        </td>
        <td title="${device}"><strong>${device}</strong></td>
        <td title="${soc}">${soc}</td>
        <td><strong>${memoryGB}</strong></td>
        <td>${androidVersion}</td>
        <td><strong>${avgFps}</strong></td>
        <td>${minFps}</td>
        <td>${maxFps}</td>
        <td>${slowFramePercentage}</td> <!-- DISPLAY SLOW FRAME PERCENTAGE -->
        <td>${jankInstabilityPercentage}</td> <!-- DISPLAY JANK INSTABILITY PERCENTAGE -->
        <td>${duration}</td>
        <td title="${uploadTime}">${uploadTime}</td>
        <td onclick="event.stopPropagation();">
          <button 
            class="delete-btn" 
            onclick="dashboard.deleteAnalysisResult(${actualDataIndex})"
            title="Delete this analysis result"
            style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.75rem;
              font-weight: 600;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='var(--error-color)'"
          >
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  return tableHtml;
}

function generateDeviceInstancesTable(instances) {
  let tableHtml = `
    <table class="dashboard-table" style="min-width: 800px;">
      <thead>
        <tr>
          <th>Select</th>
          <th>App Name</th>
          <th>Category</th>
          <th>Avg FPS</th>
          <th>Min FPS</th>
          <th>Max FPS</th>
          <th>Slow Frame %</th> <!-- NEW HEADER -->
          <th>Jank Instability %</th> <!-- NEW HEADER -->
          <th>Duration (s)</th>
          <th>Upload Time</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  instances.forEach((data) => {
    const actualDataIndex = dashboard.uploadedData.indexOf(data);
    const isSelected = dashboard.selectedForComparison.has(actualDataIndex);

    const appName = data.appName || "Unknown App";
    const category = inferAppCategory(data.appName, data.packageName);
    const avgFps = data.avgFps ? data.avgFps.toFixed(1) : "N/A";
    const minFps = data.minFps ? data.minFps.toFixed(1) : "N/A";
    const maxFps = data.maxFps ? data.maxFps.toFixed(1) : "N/A";
    
    const slowFramePercentage = data.slowFramePercentage
      ? data.slowFramePercentage.toFixed(1) + "%"
      : "N/A";
    const jankInstabilityPercentage = data.jankInstabilityPercentage
      ? data.jankInstabilityPercentage.toFixed(1) + "%"
      : "N/A";

    const duration = data.elapsedTimeSeconds
      ? data.elapsedTimeSeconds.toFixed(1)
      : "N/A";
    const uploadTime = data.timestamp || "N/A";

    tableHtml += `
      <tr onclick="closeDeviceInstancesModal(); openDetailedAnalysis(dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-checkbox" 
                 ${isSelected ? "checked" : ""} 
                 onchange="toggleAppSelectionInModal(${actualDataIndex}, this)" />
        </td>
        <td title="${appName}" style="color: var(--primary-light);"><strong>${appName}</strong></td>
        <td><span style="background: var(--primary-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${category}</span></td>
        <td><strong>${avgFps}</strong></td>
        <td>${minFps}</td>
        <td>${maxFps}</td>
        <td>${slowFramePercentage}</td> <!-- DISPLAY SLOW FRAME PERCENTAGE -->
        <td>${jankInstabilityPercentage}</td> <!-- DISPLAY JANK INSTABILITY PERCENTAGE -->
        <td>${duration}</td>
        <td title="${uploadTime}">${uploadTime}</td>
        <td onclick="event.stopPropagation();">
          <button 
            class="delete-btn" 
            onclick="dashboard.deleteAnalysisResult(${actualDataIndex})"
            title="Delete this analysis result"
            style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.75rem;
              font-weight: 600;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='var(--error-color)'"
          >
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  return tableHtml;
}

function closeAppInstancesModal(button) {
  const modal = button
    ? button.closest('div[style*="position: fixed"]')
    : window.currentAppInstancesModal;
  if (modal && modal.parentNode) {
    document.body.removeChild(modal);
  }
  if (window.currentAppInstancesModal) {
    window.currentAppInstancesModal = null;
  }
}

function closeDeviceInstancesModal(button) {
  const modal = button
    ? button.closest('div[style*="position: fixed"]')
    : window.currentDeviceInstancesModal;
  if (modal && modal.parentNode) {
    document.body.removeChild(modal);
  }
  if (window.currentDeviceInstancesModal) {
    window.currentDeviceInstancesModal = null;
  }
}

// Functions to delete all instances of games and devices
async function deleteAllGameInstances(gameName) {
  try {
    // Check if user is authenticated
    if (!dashboard.isAuthenticated) {
      const authenticated = await dashboard.showAuthenticationModal();
      if (!authenticated) {
        return;
      }
    }

    // Find all instances of this game
    const gameInstances = dashboard.uploadedData.filter(
      (data) => data.appName === gameName
    );

    if (gameInstances.length === 0) {
      dashboard.showToast(`No instances found for ${gameName}`, "warning");
      return;
    }

    // Confirm deletion
    const confirmed = await confirmDeleteAllInstances(
      gameName,
      gameInstances.length,
      "game"
    );
    if (!confirmed) {
      return;
    }

    // Remove all instances
    dashboard.uploadedData = dashboard.uploadedData.filter(
      (data) => data.appName !== gameName
    );

    // Update selected for comparison
    const updatedSelection = new Set();
    dashboard.selectedForComparison.forEach((index) => {
      const newIndex = dashboard.uploadedData.findIndex(
        (data, i) => i === index
      );
      if (newIndex !== -1) {
        updatedSelection.add(newIndex);
      }
    });
    dashboard.selectedForComparison = updatedSelection;

    // Update all displays
    dashboard.updateDisplay();
    dashboard.updateViewControls();
    updateCompareControls();

    // Refresh the current view
    const uniqueGames = getUniqueGames();
    updateGamesView(uniqueGames);

    dashboard.showToast(
      `All ${gameInstances.length} instance${
        gameInstances.length !== 1 ? "s" : ""
      } of "${gameName}" deleted successfully.`,
      "success"
    );
  } catch (error) {
    console.error("Error deleting game instances:", error);
    dashboard.showToast("Failed to delete game instances.", "error");
  }
}

async function deleteAllDeviceInstances(deviceName) {
  try {
    // Check if user is authenticated
    if (!dashboard.isAuthenticated) {
      const authenticated = await dashboard.showAuthenticationModal();
      if (!authenticated) {
        return;
      }
    }

    // Find all instances for this device
    const deviceInstances = dashboard.uploadedData.filter((data) => {
      const deviceInfo = data.deviceInfo || {};
      const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
        deviceInfo["ro.product.model"] || "Unknown"
      }`;
      return device === deviceName;
    });

    if (deviceInstances.length === 0) {
      dashboard.showToast(`No instances found for ${deviceName}`, "warning");
      return;
    }

    // Confirm deletion
    const confirmed = await confirmDeleteAllInstances(
      deviceName,
      deviceInstances.length,
      "device"
    );
    if (!confirmed) {
      return;
    }

    // Remove all instances
    dashboard.uploadedData = dashboard.uploadedData.filter((data) => {
      const deviceInfo = data.deviceInfo || {};
      const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
        deviceInfo["ro.product.model"] || "Unknown"
      }`;
      return device !== deviceName;
    });

    // Update selected for comparison
    const updatedSelection = new Set();
    dashboard.selectedForComparison.forEach((index) => {
      const newIndex = dashboard.uploadedData.findIndex(
        (data, i) => i === index
      );
      if (newIndex !== -1) {
        updatedSelection.add(newIndex);
      }
    });
    dashboard.selectedForComparison = updatedSelection;

    // Update all displays
    dashboard.updateDisplay();
    dashboard.updateViewControls();
    updateCompareControls();

    // Refresh the current view
    const devicesData = [...dashboard.uploadedData].sort((a, b) => {
      const deviceA = `${
        a.deviceInfo?.["ro.product.manufacturer"] || "Unknown"
      } ${a.deviceInfo?.["ro.product.model"] || "Unknown"}`;
      const deviceB = `${
        b.deviceInfo?.["ro.product.manufacturer"] || "Unknown"
      } ${b.deviceInfo?.["ro.product.model"] || "Unknown"}`;
      return deviceA.localeCompare(deviceB);
    });
    updateDevicesView(devicesData);

    dashboard.showToast(
      `All ${deviceInstances.length} instance${
        deviceInstances.length !== 1 ? "s" : ""
      } for "${deviceName}" deleted successfully.`,
      "success"
    );
  } catch (error) {
    console.error("Error deleting device instances:", error);
    dashboard.showToast("Failed to delete device instances.", "error");
  }
}

async function confirmDeleteAllInstances(name, count, type) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 3500;
    `;

    modal.innerHTML = `
      <div style="
        background: var(--card-bg);
        border-radius: var(--card-radius);
        border: var(--glass-border);
        backdrop-filter: blur(var(--glass-blur));
        padding: 30px;
        max-width: 500px;
        width: 90%;
      ">
        <h3 style="color: var(--error-color); margin-top: 0; text-align: center;">
          ⚠️ Confirm Bulk Deletion
        </h3>
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 10px;">
            You are about to delete all data for:
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">
            <div><strong>${
              type === "game" ? "Game" : "Device"
            }:</strong> ${name}</div>
            <div><strong>Total instances:</strong> ${count}</div>
          </div>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px; text-align: center;">
          This action cannot be undone. All ${count} test result${
      count !== 1 ? "s" : ""
    } will be permanently removed.
        </p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancelDeleteAll" style="
            padding: 10px 20px;
            border-radius: var(--btn-radius);
            border: 1px solid var(--border-color);
            background: transparent;
            color: var(--text-primary);
            cursor: pointer;
          ">Cancel</button>
          <button id="confirmDeleteAll" style="
            padding: 10px 20px;
            border-radius: var(--btn-radius);
            border: none;
            background: var(--error-color);
            color: white;
            cursor: pointer;
          ">Delete All ${count} Result${count !== 1 ? "s" : ""}</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle cancel
    document.getElementById("cancelDeleteAll").onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };

    // Handle confirm delete
    document.getElementById("confirmDeleteAll").onclick = () => {
      document.body.removeChild(modal);
      resolve(true);
    };

    // Handle Escape key
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.body.removeChild(modal);
        resolve(false);
      }
    });
  });
}

// Function to show device details with test results
function showDeviceDetails(deviceName) {
  // Filter all data for this specific device
  const deviceInstances = dashboard.uploadedData.filter((data) => {
    const deviceInfo = data.deviceInfo || {};
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    return device === deviceName;
  });

  if (deviceInstances.length === 0) {
    dashboard.showToast(`No data found for ${deviceName}`, "warning");
    return;
  }

  // Get device info from the first instance (all should be the same device)
  const deviceInfo = deviceInstances[0].deviceInfo || {};

  // Create modal to show device details and test results
  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 3000;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--card-bg);
      border-radius: var(--card-radius);
      border: var(--glass-border);
      backdrop-filter: blur(var(--glass-blur));
      padding: 30px;
      max-width: 95vw;
      width: 95%;
      max-height: 90vh;
      overflow-y: auto;
    ">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;">📱 ${deviceName} - Device Details</h3>
        <button 
          onclick="closeDeviceDetailsModal(this)" 
          style="
            background: transparent;
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            font-size: 1.5rem;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          &times;
        </button>
      </div>

      <!-- Device Specifications Grid -->
      <div style="margin-bottom: 30px;">
        <h4 style="color: var(--text-primary); margin-bottom: 15px;">🔧 Device Specifications</h4>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        ">
          ${generateDeviceSpecsGrid(deviceInfo)}
        </div>
      </div>

      <!-- Performance Summary -->
      <div style="margin-bottom: 30px;">
        <h4 style="color: var(--text-primary); margin-bottom: 15px;">📊 Performance Summary</h4>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-bottom: 20px;
        ">
          ${generateDevicePerformanceStats(deviceInstances)}
        </div>
      </div>

      <!-- Test Results -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="color: var(--text-primary); margin: 0;">🧪 Test Results (${
            deviceInstances.length
          } tests)</h4>
          <div style="display: flex; gap: 10px;">
            <input 
              type="text" 
              id="deviceTestsSearch" 
              placeholder="Search tests..."
              style="
                padding: 8px 12px;
                border-radius: var(--btn-radius);
                border: 1px solid var(--border-color);
                background: var(--input-bg-color);
                color: var(--text-primary);
                font-size: 0.9rem;
                width: 200px;
              "
            />
            <button 
              onclick="clearDeviceTestsSearch()" 
              style="
                padding: 8px 12px;
                border-radius: var(--btn-radius);
                border: 1px solid var(--border-color);
                background: transparent;
                color: var(--text-primary);
                cursor: pointer;
                font-size: 0.9rem;
              "
            >
              Clear
            </button>
          </div>
        </div>
        <div style="overflow-x: auto;" id="deviceTestsTableContainer">
          ${generateDeviceTestsTable(deviceInstances)}
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentDeviceDetailsModal = modal;

  // Setup search functionality
  setupDeviceTestsSearch(deviceInstances);

  // Handle Escape key
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDeviceDetailsModal();
    }
  });
}

function generateDeviceSpecsGrid(deviceInfo) {
  const specs = [
    {
      label: "Manufacturer",
      value: deviceInfo["ro.product.manufacturer"] || "Unknown",
    },
    { label: "Model", value: deviceInfo["ro.product.model"] || "Unknown" },
    { label: "Brand", value: deviceInfo["ro.product.brand"] || "Unknown" },
    { label: "OEM Brand", value: deviceInfo["ro.oem.brand"] || "Unknown" },
    { label: "SoC Model", value: deviceInfo["ro.soc.model"] || "Unknown" },
    {
      label: "SoC Manufacturer",
      value: deviceInfo["ro.soc.manufacturer"] || "Unknown",
    },
    {
      label: "CPU Architecture",
      value: deviceInfo["ro.product.cpu.abi"] || "Unknown",
    },
    {
      label: "Total Memory",
      value: deviceInfo.MemTotal
        ? `${(
            parseFloat(deviceInfo.MemTotal.replace(" kB", "")) /
            (1024 * 1024)
          ).toFixed(1)} GB`
        : "Unknown",
    },
    {
      label: "Android Version",
      value: deviceInfo["ro.build.version.release"] || "Unknown",
    },
    {
      label: "API Level",
      value: deviceInfo["ro.build.version.sdk"] || "Unknown",
    },
    {
      label: "Graphics Hardware",
      value: deviceInfo["ro.hardware.egl"] || "Unknown",
    },
    {
      label: "Build Fingerprint",
      value: deviceInfo["ro.build.fingerprint"] || "Unknown",
    },
  ];

  return specs
    .map(
      (spec) => `
    <div style="
      background: rgba(255, 255, 255, 0.03);
      border-radius: 6px;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    ">
      <div style="
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
        font-weight: 600;
      ">${spec.label}</div>
      <div style="
        font-size: 0.85rem;
        color: var(--text-primary);
        font-weight: 500;
        word-break: break-word;
        line-height: 1.3;
      " title="${spec.value}">${spec.value}</div>
    </div>
  `
    )
    .join("");
}

function generateDevicePerformanceStats(deviceInstances) {
  // Ensure we have data to avoid division by zero or errors with empty arrays
  if (!deviceInstances || deviceInstances.length === 0) {
    return `<p style="color: var(--text-secondary); text-align: center;">No device instances selected for stats.</p>`;
  }

  const avgFps = (
    deviceInstances.reduce((sum, data) => sum + data.avgFps, 0) /
    deviceInstances.length
  ).toFixed(1);

  const bestFps = Math.max(
    ...deviceInstances.map((data) => data.avgFps)
  ).toFixed(1);

  const worstFps = Math.min(
    ...deviceInstances.map((data) => data.avgFps)
  ).toFixed(1);

  const avgSlowFramePercentage = (
    deviceInstances.reduce((sum, data) => sum + (data.slowFramePercentage || 0), 0) /
    deviceInstances.length
  ).toFixed(1);

  const avgJankInstabilityPercentage = (
    deviceInstances.reduce((sum, data) => sum + (data.jankInstabilityPercentage || 0), 0) /
    deviceInstances.length
  ).toFixed(1);

  const totalTestTime = deviceInstances
    .reduce((sum, data) => sum + (data.elapsedTimeSeconds || 0), 0)
    .toFixed(1);

  const uniqueApps = new Set(deviceInstances.map((data) => data.appName)).size;

  const stats = [
    { label: "Avg FPS", value: avgFps, color: "var(--primary-light)" },
    { label: "Best FPS", value: bestFps, color: "var(--success-color)" },
    { label: "Worst FPS", value: worstFps, color: "var(--error-color)" },
    {
      label: "Avg Slow Frame %", // Updated label
      value: avgSlowFramePercentage + "%", // Updated value
      color: "var(--warning-color)", // Using warning color for general jank
    },
    {
      label: "Avg Jank Instability %", // New label
      value: avgJankInstabilityPercentage + "%", // New value
      color: "var(--warning-color-dark)", // A slightly darker warning color for distinction
    },
    {
      label: "Total Test Time",
      value: totalTestTime + "s",
      color: "var(--text-primary)",
    },
    { label: "Apps Tested", value: uniqueApps, color: "var(--accent-light)" },
  ];

  return stats
    .map(
      (stat) => `
    <div style="
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
    ">
      <div style="
        font-size: 1.2rem;
        font-weight: 700;
        color: ${stat.color};
        margin-bottom: 5px;
      ">${stat.value}</div>
      <div style="
        font-size: 0.75rem;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-weight: 600;
      ">${stat.label}</div>
    </div>
  `
    )
    .join("");
}

function generateDeviceTestsTable(instances) {
  let tableHtml = `
    <table class="dashboard-table" style="min-width: 800px;">
      <thead>
        <tr>
          <th>Select</th>
          <th>App Name</th>
          <th>Category</th>
          <th>Avg FPS</th>
          <th>Min FPS</th>
          <th>Max FPS</th>
          <th>Slow Frame %</th> <!-- NEW HEADER -->
          <th>Jank Instability %</th> <!-- NEW HEADER -->
          <th>Duration (s)</th>
          <th>Total Frames</th>
          <th>Upload Time</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="deviceTestsTableBody">
  `;

  instances.forEach((data) => {
    const actualDataIndex = dashboard.uploadedData.indexOf(data);
    const isSelected = dashboard.selectedForComparison.has(actualDataIndex);

    const appName = data.appName || "Unknown App";
    const category = inferAppCategory(data.appName, data.packageName);
    const avgFps = data.avgFps ? data.avgFps.toFixed(1) : "N/A";
    const minFps = data.minFps ? data.minFps.toFixed(1) : "N/A";
    const maxFps = data.maxFps ? data.maxFps.toFixed(1) : "N/A";
    
    const slowFramePercentage = data.slowFramePercentage
      ? data.slowFramePercentage.toFixed(1) + "%"
      : "N/A";
    const jankInstabilityPercentage = data.jankInstabilityPercentage
      ? data.jankInstabilityPercentage.toFixed(1) + "%"
      : "N/A";

    const duration = data.elapsedTimeSeconds
      ? data.elapsedTimeSeconds.toFixed(1)
      : "N/A";
    const totalFrames = data.totalFrames || "N/A";
    const uploadTime = data.timestamp || "N/A";

    tableHtml += `
      <tr onclick="closeDeviceDetailsModal(); openDetailedAnalysis(dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-checkbox" 
                 ${isSelected ? "checked" : ""} 
                 onchange="toggleAppSelection(${actualDataIndex}, this)" />
        </td>
        <td title="${appName}" style="color: var(--primary-light);"><strong>${appName}</strong></td>
        <td><span style="background: var(--primary-color); color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${category}</span></td>
        <td><strong>${avgFps}</strong></td>
        <td>${minFps}</td>
        <td>${maxFps}</td>
        <td>${slowFramePercentage}</td> <!-- DISPLAY SLOW FRAME PERCENTAGE -->
        <td>${jankInstabilityPercentage}</td> <!-- DISPLAY JANK INSTABILITY PERCENTAGE -->
        <td>${duration}</td>
        <td>${totalFrames}</td>
        <td title="${uploadTime}">${uploadTime}</td>
        <td onclick="event.stopPropagation();">
          <button 
            class="delete-btn" 
            onclick="dashboard.deleteAnalysisResult(${actualDataIndex})"
            title="Delete this analysis result"
            style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.75rem;
              font-weight: 600;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='var(--error-color)'"
          >
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  return tableHtml;
}

function setupDeviceTestsSearch(allInstances) {
  const searchInput = document.getElementById("deviceTestsSearch");

  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredInstances = allInstances.filter((data) => {
      const appName = (data.appName || "").toLowerCase();
      const packageName = (data.packageName || "").toLowerCase();
      const category = inferAppCategory(
        data.appName,
        data.packageName
      ).toLowerCase();

      return (
        appName.includes(searchTerm) ||
        packageName.includes(searchTerm) ||
        category.includes(searchTerm)
      );
    });

    // Update table with filtered results
    const tableContainer = document.getElementById("deviceTestsTableContainer");
    tableContainer.innerHTML = generateDeviceTestsTable(filteredInstances);
  });
}

function clearDeviceTestsSearch() {
  const searchInput = document.getElementById("deviceTestsSearch");
  searchInput.value = "";

  // Trigger input event to refresh table
  searchInput.dispatchEvent(new Event("input"));
}

function closeDeviceDetailsModal(button) {
  const modal = button
    ? button.closest('div[style*="position: fixed"]')
    : window.currentDeviceDetailsModal;
  if (modal && modal.parentNode) {
    document.body.removeChild(modal);
  }
  if (window.currentDeviceDetailsModal) {
    window.currentDeviceDetailsModal = null;
  }
}

// Function to handle app selection in modal instances
function toggleAppSelectionInModal(dataIndex, checkbox) {
  if (checkbox.checked) {
    dashboard.selectedForComparison.add(dataIndex);
  } else {
    dashboard.selectedForComparison.delete(dataIndex);
  }
  updateCompareControls();
  updateModalCompareControls();
}

// Update compare controls - unified across all views
function updateModalCompareControls() {
  // Remove any existing global compare controls
  const existingGlobalControls = document.getElementById(
    "globalCompareControls"
  );
  if (existingGlobalControls) {
    existingGlobalControls.remove();
  }

  // Add global floating controls if items are selected
  if (dashboard.selectedForComparison.size >= 2) {
    const controlsDiv = document.createElement("div");
    controlsDiv.id = "globalCompareControls";
    controlsDiv.className = "global-compare-controls";
    controlsDiv.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      z-index: 4000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-end;
    `;

    // Get selected data for display
    const selectedData = Array.from(dashboard.selectedForComparison).map(
      (index) => dashboard.uploadedData[index]
    );

    controlsDiv.innerHTML = `
      <div id="selectedItemsContainer" style="
        background: rgba(255, 255, 255, 0.1);
        border-radius: 15px;
        border: 1px solid var(--border-color);
        margin-bottom: 10px;
        overflow: hidden;
        transition: all 0.3s ease;
      ">
        <div id="selectedCountHeader" onclick="toggleSelectedItemsList()" style="
          color: var(--text-primary);
          padding: 6px 12px;
          font-size: 0.8rem;
          text-align: center;
          cursor: pointer;
          user-select: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
        ">
          <span>${dashboard.selectedForComparison.size} selected</span>
          <span id="expandIcon" style="font-size: 0.7rem; transition: transform 0.3s ease;">▼</span>
        </div>
        <div id="selectedItemsList" style="
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease;
          background: rgba(0, 0, 0, 0.2);
        ">
          <div style="padding: 10px;">
            ${selectedData
              .map((data, index) => {
                const actualIndex = dashboard.uploadedData.indexOf(data);
                const appName = data.appName || "Unknown App";
                const deviceInfo = data.deviceInfo || {};
                const device = `${
                  deviceInfo["ro.product.manufacturer"] || "Unknown"
                } ${deviceInfo["ro.product.model"] || "Unknown"}`;

                return `
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 5px 0;
                  border-bottom: ${
                    index < selectedData.length - 1
                      ? "1px solid rgba(255, 255, 255, 0.1)"
                      : "none"
                  };
                ">
                  <div style="flex: 1; min-width: 0;">
                    <div style="
                      color: var(--text-primary);
                      font-size: 0.75rem;
                      font-weight: 600;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    " title="${appName}">${appName}</div>
                    <div style="
                      color: var(--text-secondary);
                      font-size: 0.65rem;
                      white-space: nowrap;
                      overflow: hidden;
                      text-overflow: ellipsis;
                    " title="${device}">${device}</div>
                  </div>
                  <button onclick="removeFromGlobalSelection(${actualIndex})" style="
                    background: var(--error-color);
                    color: white;
                    border: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 0.7rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-left: 8px;
                    flex-shrink: 0;
                  " title="Remove from selection">×</button>
                </div>
              `;
              })
              .join("")}
          </div>
        </div>
      </div>
      <button
        onclick="openComparisonModal()"
        style="
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 25px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
          width: 100%;
          margin-bottom: 10px;
        "
        onmouseover="this.style.background='var(--primary-dark)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(99, 102, 241, 0.5)';"
        onmouseout="this.style.background='var(--primary-color)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(99, 102, 241, 0.4)';"
      >
        📊 Compare Apps
      </button>
      <button
        onclick="deleteSelectedInstances()"
        style="
          background: var(--error-color);
          color: white;
          border: none;
          padding: 12px 20px;
          border-radius: 25px;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 0.9rem;
          width: 100%;
        "
        onmouseover="this.style.background='#dc2626'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(239, 68, 68, 0.5)';"
        onmouseout="this.style.background='var(--error-color)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(239, 68, 68, 0.4)';"
      >
        🗑️ Delete Selected
      </button>
    `;

    // Append to body so it's global across all views
    document.body.appendChild(controlsDiv);
  }
}

// Function to delete selected instances
async function deleteSelectedInstances() {
  if (dashboard.selectedForComparison.size === 0) {
    dashboard.showToast("No items selected for deletion.", "warning");
    return;
  }

  try {
    // Check if user is authenticated
    if (!dashboard.isAuthenticated) {
      const authenticated = await dashboard.showAuthenticationModal();
      if (!authenticated) {
        return;
      }
    }

    // Get selected data
    const selectedIndices = Array.from(dashboard.selectedForComparison);
    const selectedData = selectedIndices.map(
      (index) => dashboard.uploadedData[index]
    );

    // Confirm deletion
    const confirmed = await confirmDeleteSelectedInstances(selectedData);
    if (!confirmed) {
      return;
    }

    // Sort indices in descending order to avoid index shifting issues
    const sortedIndices = selectedIndices.sort((a, b) => b - a);

    // Remove selected items
    sortedIndices.forEach((index) => {
      dashboard.uploadedData.splice(index, 1);
    });

    // Clear selection
    dashboard.selectedForComparison.clear();

    // Update all displays
    dashboard.updateDisplay();
    dashboard.updateViewControls();
    updateCompareControls();

    // Close modals and refresh views
    closeAppInstancesModal();
    closeDeviceInstancesModal();
    closeDeviceDetailsModal();

    // Refresh current view if we're in games or devices view
    const currentSection = document.getElementById("allGamesSection");
    if (currentSection && currentSection.style.display !== "none") {
      const uniqueGames = getUniqueGames();
      updateGamesView(uniqueGames);
    }

    const devicesSection = document.getElementById("allDevicesSection");
    if (devicesSection && devicesSection.style.display !== "none") {
      const devicesData = [...dashboard.uploadedData].sort((a, b) => {
        const deviceA = `${
          a.deviceInfo?.["ro.product.manufacturer"] || "Unknown"
        } ${a.deviceInfo?.["ro.product.model"] || "Unknown"}`;
        const deviceB = `${
          b.deviceInfo?.["ro.product.manufacturer"] || "Unknown"
        } ${b.deviceInfo?.["ro.product.model"] || "Unknown"}`;
        return deviceA.localeCompare(deviceB);
      });
      updateDevicesView(devicesData);
    }

    dashboard.showToast(
      `Successfully deleted ${selectedIndices.length} selected item${
        selectedIndices.length !== 1 ? "s" : ""
      }.`,
      "success"
    );
  } catch (error) {
    console.error("Error deleting selected instances:", error);
    dashboard.showToast("Failed to delete selected instances.", "error");
  }
}

// Confirm deletion of selected instances
async function confirmDeleteSelectedInstances(selectedData) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 3500;
    `;

    // Create summary of selected items
    const appsSummary = {};
    const devicesSummary = {};

    selectedData.forEach((data) => {
      const appName = data.appName || "Unknown App";
      const deviceInfo = data.deviceInfo || {};
      const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
        deviceInfo["ro.product.model"] || "Unknown"
      }`;

      appsSummary[appName] = (appsSummary[appName] || 0) + 1;
      devicesSummary[device] = (devicesSummary[device] || 0) + 1;
    });

    const appsText = Object.entries(appsSummary)
      .map(([app, count]) => `${app} (${count} test${count !== 1 ? "s" : ""})`)
      .join(", ");

    const devicesText = Object.entries(devicesSummary)
      .map(
        ([device, count]) =>
          `${device} (${count} test${count !== 1 ? "s" : ""})`
      )
      .join(", ");

    modal.innerHTML = `
      <div style="
        background: var(--card-bg);
        border-radius: var(--card-radius);
        border: var(--glass-border);
        backdrop-filter: blur(var(--glass-blur));
        padding: 30px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      ">
        <h3 style="color: var(--error-color); margin-top: 0; text-align: center;">
          ⚠️ Confirm Bulk Deletion
        </h3>
        <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 15px;">
            You are about to delete ${
              selectedData.length
            } selected test result${selectedData.length !== 1 ? "s" : ""}:
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4; margin-bottom: 10px;">
            <div><strong>Apps:</strong> ${appsText}</div>
          </div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;">
            <div><strong>Devices:</strong> ${devicesText}</div>
          </div>
        </div>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px; text-align: center;">
          This action cannot be undone. All selected test results will be permanently removed.
        </p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancelDeleteSelected" style="
            padding: 10px 20px;
            border-radius: var(--btn-radius);
            border: 1px solid var(--border-color);
            background: transparent;
            color: var(--text-primary);
            cursor: pointer;
          ">Cancel</button>
          <button id="confirmDeleteSelected" style="
            padding: 10px 20px;
            border-radius: var(--btn-radius);
            border: none;
            background: var(--error-color);
            color: white;
            cursor: pointer;
          ">Delete ${selectedData.length} Result${
      selectedData.length !== 1 ? "s" : ""
    }</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle cancel
    document.getElementById("cancelDeleteSelected").onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };

    // Handle confirm delete
    document.getElementById("confirmDeleteSelected").onclick = () => {
      document.body.removeChild(modal);
      resolve(true);
    };

    // Handle Escape key
    modal.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.body.removeChild(modal);
        resolve(false);
      }
    });
  });
}

// Function to toggle the selected items list in modal
function toggleSelectedItemsList() {
  const selectedItemsList = document.getElementById("selectedItemsList");
  const expandIcon = document.getElementById("expandIcon");

  if (!selectedItemsList || !expandIcon) return;

  const isExpanded =
    selectedItemsList.style.maxHeight !== "0px" &&
    selectedItemsList.style.maxHeight !== "";

  if (isExpanded) {
    // Collapse
    selectedItemsList.style.maxHeight = "0";
    expandIcon.style.transform = "rotate(0deg)";
  } else {
    // Expand
    selectedItemsList.style.maxHeight = "200px"; // Adjust as needed
    expandIcon.style.transform = "rotate(180deg)";
  }
}

// Function to remove item from modal selection
function removeFromModalSelection(dataIndex) {
  dashboard.selectedForComparison.delete(dataIndex);

  // Update checkboxes in the modal
  const checkboxes = document.querySelectorAll(".compare-checkbox");
  checkboxes.forEach((checkbox) => {
    const onchangeAttr = checkbox.getAttribute("onchange");
    if (onchangeAttr && onchangeAttr.includes(`${dataIndex},`)) {
      checkbox.checked = false;
    }
  });

  // Update controls
  updateCompareControls();
  updateModalCompareControls();

  // If less than 2 items selected, close comparison modal if open
  if (dashboard.selectedForComparison.size < 2) {
    const comparisonModal = document.getElementById("comparisonModal");
    if (comparisonModal && comparisonModal.classList.contains("show")) {
      closeComparisonModal();
      dashboard.showToast(
        "Comparison closed - minimum 2 apps required.",
        "info"
      );
    }
  }
}

// Function to remove item from global selection (unified function)
function removeFromGlobalSelection(dataIndex) {
  dashboard.selectedForComparison.delete(dataIndex);

  // Update checkboxes across all views
  const checkboxes = document.querySelectorAll(".compare-checkbox");
  checkboxes.forEach((checkbox) => {
    const onchangeAttr = checkbox.getAttribute("onchange");
    if (onchangeAttr && onchangeAttr.includes(`${dataIndex},`)) {
      checkbox.checked = false;
    }
  });

  // Update all controls
  updateCompareControls();
  updateModalCompareControls();

  // If less than 2 items selected, close comparison modal if open
  if (dashboard.selectedForComparison.size < 2) {
    const comparisonModal = document.getElementById("comparisonModal");
    if (comparisonModal && comparisonModal.classList.contains("show")) {
      closeComparisonModal();
      dashboard.showToast(
        "Comparison closed - minimum 2 apps required.",
        "info"
      );
    }
  }
}

function initializeTooltips() {
    const tooltipElement = document.getElementById('globalTooltip');
    const targets = document.querySelectorAll('[data-tooltip]');

    targets.forEach(target => {
        target.addEventListener('mouseenter', (event) => {
            const tooltipText = target.getAttribute('data-tooltip');
            if (!tooltipText) return;

            tooltipElement.textContent = tooltipText;

            const targetRect = event.target.getBoundingClientRect();
            
            // Position tooltip above the element
            const top = targetRect.top - tooltipElement.offsetHeight - 10; // 10px buffer
            const left = targetRect.left + (targetRect.width / 2) - (tooltipElement.offsetWidth / 2);

            tooltipElement.style.top = `${top}px`;
            tooltipElement.style.left = `${left}px`;
            
            tooltipElement.classList.add('show');
        });

        target.addEventListener('mouseleave', () => {
            tooltipElement.classList.remove('show');
        });
    });
}

function updateTableWithCheckboxes() {
  const tableContent = document.getElementById("tableContent");

  if (dashboard.uploadedData.length === 0) {
    tableContent.innerHTML = `
      <div class="empty-state">
        <h3>No data available</h3>
        <p>Upload your first dump file to see the analysis results here.</p>
      </div>
    `;
    return;
  }

  let dataToShow =
    dashboard.currentView === "recent"
      ? dashboard.uploadedData.slice(-10).reverse()
      : dashboard.filteredData;

  if (dashboard.currentView === "all") {
    const startIndex = (dashboard.currentPage - 1) * dashboard.itemsPerPage;
    const endIndex = startIndex + dashboard.itemsPerPage;
    dataToShow = dataToShow.slice(startIndex, endIndex);
  }

  let tableHtml = `
    <table class="dashboard-table">
      <thead>
        <tr>
          <th>Select</th>
          <th>App Name</th>
          <th>Package Name</th>
          
           <th data-tooltip="Represents actual user experience. Calculated from the hardware V-sync timestamp (\`frame.vsync\`).">
  Avg FPS
</th>
<th data-tooltip="Represents ideal/intended performance. Calculated from the scheduled draw timestamp (\`frame.draw\`).">
  Scheduled Avg FPS
</th>
          
          <th>Elapsed Time (s)</th>
          <th>Refresh Rate (Hz)</th>
          <th>SoC Model</th>
          <th>Device Manufacturer</th>
          <th>Android Version</th>
          <th>Graphics Hardware</th>
          <th>SoC Manufacturer</th>
          <th>Device Brand</th>
          <th>Total Memory (GB)</th>
          <th>CPU Architecture</th>
          <th>Upload Time</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  dataToShow.forEach((data) => {
    const deviceInfo = data.deviceInfo || {};
    const actualDataIndex = dashboard.uploadedData.indexOf(data);
    const isSelected = dashboard.selectedForComparison.has(actualDataIndex);

    const appName = data.appName || "N/A";
    const packageName = data.packageName || "N/A";
    
    const avgFps = data.avgFps ? data.avgFps.toFixed(2) : "N/A";
    const scheduledAvgFps = data.vsync_avgFps ? data.vsync_avgFps.toFixed(2) : "N/A";
    
    const elapsedTime = data.elapsedTimeSeconds ? data.elapsedTimeSeconds.toFixed(2) : "N/A";
    const refreshRate = data.refreshRate || "N/A";
    const socModel = deviceInfo["ro.soc.model"] || "N/A";
    const manufacturer = deviceInfo["ro.product.manufacturer"] || "N/A";
    const androidVersion = deviceInfo["ro.build.version.release"] || "N/A";
    const eglHardware = deviceInfo["ro.hardware.egl"] || "N/A";
    const socManufacturer = deviceInfo["ro.soc.manufacturer"] || "N/A";
    const oemBrand = deviceInfo["ro.oem.brand"] || "N/A";
    let totalMemoryGB = "N/A";
    if (deviceInfo.MemTotal) {
      const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
      if (!isNaN(memKB)) {
        totalMemoryGB = (memKB / (1024 * 1024)).toFixed(2);
      }
    }
    const cpuABI = deviceInfo["ro.product.cpu.abi"] || "N/A";
    const uploadTime = data.timestamp || "N/A";

    tableHtml += `
      <tr onclick="openDetailedAnalysis(dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-checkbox" 
                 ${isSelected ? "checked" : ""} 
                 onchange="toggleAppSelection(${actualDataIndex}, this)" />
        </td>
        <td title="${appName}" style="color: var(--primary-light);">${appName}</td>
        <td title="${packageName}">${packageName}</td>
        
        <!-- MODIFIED: Add the new cell for scheduled FPS -->
        <td><strong>${avgFps}</strong></td>
        <td>${scheduledAvgFps}</td>
        
        <td>${elapsedTime}</td>
        <td>${refreshRate}</td>
        <td title="${socModel}">${socModel}</td>
        <td title="${manufacturer}">${manufacturer}</td>
        <td>${androidVersion}</td>
        <td title="${eglHardware}">${eglHardware}</td>
        <td title="${socManufacturer}">${socManufacturer}</td>
        <td title="${oemBrand}">${oemBrand}</td>
        <td>${totalMemoryGB}</td>
        <td>${cpuABI}</td>
        <td title="${uploadTime}">${uploadTime}</td>
        <td onclick="event.stopPropagation();">
          <button 
            class="delete-btn" 
            onclick="dashboard.deleteAnalysisResult(${actualDataIndex})"
            title="Delete this analysis result"
            style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.75rem;
              font-weight: 600;
              transition: all 0.2s ease;
            "
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='var(--error-color)'"
          >
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `
      </tbody>
    </table>
  `;

  // Pagination controls (unchanged)
  if (dashboard.currentView === "all") {
    const totalPages = Math.ceil(
      dashboard.filteredData.length / dashboard.itemsPerPage
    );
    if (totalPages > 1) {
      tableHtml += `
        <div class="load-more-container">
          <button class="load-more-btn" onclick="dashboard.previousPage()" ${
            dashboard.currentPage === 1 ? "disabled" : ""
          }>Previous</button>
          <span style="margin: 0 15px; color: var(--text-secondary);">Page ${
            dashboard.currentPage
          } of ${totalPages}</span>
          <button class="load-more-btn" onclick="dashboard.nextPage()" ${
            dashboard.currentPage === totalPages ? "disabled" : ""
          }>Next</button>
        </div>
      `;
    }
  }

  tableContent.innerHTML = tableHtml;
    initializeTooltips();
}
