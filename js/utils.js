// Utility Functions Module - A collection of helper functions used across the application.

/**
 * Aggregates time-series data by a specified time interval.
 * @param {Array<Object>} dataPoints - Array of {x, y} objects where x is a millisecond timestamp.
 * @param {number} intervalMs - The time interval in milliseconds to group by.
 * @returns {Array<Object>} A new array of aggregated {x, y} data points.
 */
export function aggregateDataByTime(dataPoints, intervalMs) {
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

/**
 * Derives a user-friendly app name from a package name.
 * @param {string} packageName The package name.
 * @returns {string} A user-friendly app name.
 */
export function deriveAppNameFromPackage(packageName) {
  if (!packageName || packageName === "Unknown Package") {
    return "Unknown App";
  }

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

  if (packageMappings[packageName]) {
    return packageMappings[packageName];
  }

  const lowerPackage = packageName.toLowerCase();
  if (lowerPackage.includes("netflix")) return "Netflix";
  if (lowerPackage.includes("youtube")) return "YouTube";
  if (lowerPackage.includes("pubg")) return "PUBG Mobile";
  if (lowerPackage.includes("genshin")) return "Genshin Impact";
  if (lowerPackage.includes("minecraft")) return "Minecraft";
  if (lowerPackage.includes("discord")) return "Discord";
  if (lowerPackage.includes("tiktok")) return "TikTok";
  if (lowerPackage.includes("chrome")) return "Chrome";

  const parts = packageName.split(".");
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
  }

  return "Unknown App";
}

/**
 * Formats a file name to a readable app name by converting various naming conventions
 * (snake_case, camelCase, kebab-case, PascalCase) to Title Case.
 * @param {string} fileName - The file name to format
 * @returns {string} - Formatted app name in Title Case
 */
export function formatFileNameToAppName(fileName) {
  if (!fileName) return "Unknown App";

  // Remove file extension if present
  let name = fileName.replace(/\.[^/.]+$/, "");

  // Handle different naming conventions
  let words = [];

  // Split on underscores, hyphens, and spaces
  if (name.includes("_") || name.includes("-") || name.includes(" ")) {
    words = name.split(/[_\-\s]+/);
  }
  // Handle camelCase and PascalCase
  else {
    // Split on capital letters (camelCase/PascalCase)
    words = name.split(/(?=[A-Z])/).filter((word) => word.length > 0);
  }

  // If no splits occurred, treat as single word
  if (words.length === 0) {
    words = [name];
  }

  // Convert each word to title case
  const titleCaseWords = words.map((word) => {
    if (!word) return "";

    // Handle common abbreviations that should stay uppercase
    const upperCaseWords = [
      "FPS",
      "GPU",
      "CPU",
      "API",
      "UI",
      "UX",
      "AI",
      "ML",
      "AR",
      "VR",
      "HD",
      "QR",
    ];
    const upperWord = word.toUpperCase();
    if (upperCaseWords.includes(upperWord)) {
      return upperWord;
    }

    // Handle Roman numerals (I, II, III, IV, V, etc.)
    if (/^[IVX]+$/i.test(word)) {
      return word.toUpperCase();
    }

    // Regular title case
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

  return titleCaseWords.join(" ").trim() || "Unknown App";
}

/**
 * Infers a general category for an app based on its name and package.
 * @param {string} appName The name of the app.
 * @param {string} packageName The package name.
 * @returns {string} The inferred category.
 */
export function inferAppCategory(appName, packageName) {
  const name = (appName || "").toLowerCase();
  const pkg = (packageName || "").toLowerCase();

  if (
    name.includes("game") ||
    pkg.includes("game") ||
    pkg.includes("unity") ||
    name.includes("racing")
  ) {
    return "Gaming";
  }
  if (name.includes("benchmark") || name.includes("test")) {
    return "Benchmark";
  }
  if (
    name.includes("video") ||
    name.includes("media") ||
    name.includes("stream")
  ) {
    return "Media";
  }
  if (
    name.includes("browser") ||
    name.includes("chrome") ||
    name.includes("firefox")
  ) {
    return "Browser";
  }
  return "Productivity";
}

/**
 * Calculates memory in GB from a string like "123456 kB".
 * @param {string} memTotal The memory string from device info.
 * @returns {string|null} Memory in GB as a string with one decimal place, or null.
 */
export function calculateMemoryGB(memTotal) {
  if (!memTotal) return null;
  const memKB = parseFloat(memTotal.replace(" kB", ""));
  return isNaN(memKB) ? null : (memKB / (1024 * 1024)).toFixed(1);
}

/**
 * Calculates the percentile of a value in a sorted array.
 * @param {Array<number>} sortedArray The sorted array of numbers.
 * @param {number} value The value to find the percentile for.
 * @returns {number} The percentile (0-100).
 */
export function calculatePercentile(sortedArray, value) {
  const index = sortedArray.findIndex((v) => v >= value);
  if (index === -1) return 100;
  return Math.round((index / sortedArray.length) * 100);
}

/**
 * Formats markdown-like text from the AI into HTML.
 * @param {string} text The raw text from the AI.
 * @returns {string} The formatted HTML string.
 */
export function formatAnalysisText(text) {
  let formatted = text
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
    .replace(/`(.*?)`/g, "<code>$1</code>")
    .replace(/^- (.*$)/gim, "<li>$1</li>")
    .replace(/^\d+\. (.*$)/gim, "<li>$1</li>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>");

  formatted = "<p>" + formatted + "</p>";
  formatted = formatted
    .replace(/<p>(<li>.*?<\/li>)<\/p>/gs, "<ul>$1</ul>")
    .replace(/<\/li><br><li>/g, "</li><li>")
    .replace(/<p><\/p>/g, "");

  return formatted;
}

/**
 * Copies rich text (HTML) and a plain text fallback to the clipboard.
 * @param {string} htmlContent The HTML content to copy.
 * @param {string} plainText The plain text fallback.
 * @param {string} successMessage The message to show in a toast on success.
 */
export function copyRichText(htmlContent, plainText, successMessage) {
  const dashboard = window.dashboard;
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
          dashboard.showToast(successMessage, "success");
        })
        .catch(() => {
          fallbackCopyText(plainText, successMessage);
        });
    } else {
      fallbackCopyText(plainText, successMessage);
    }
  } catch (error) {
    fallbackCopyText(plainText, successMessage);
  }
}

/**
 * A fallback function to copy plain text to the clipboard using a temporary textarea.
 * @param {string} text The text to copy.
 * @param {string} successMessage The message to show in a toast on success.
 */
export function fallbackCopyText(text, successMessage) {
  const dashboard = window.dashboard;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    dashboard.showToast(successMessage, "success");
  } catch (err) {
    dashboard.showToast("Failed to copy data", "error");
  }
}
