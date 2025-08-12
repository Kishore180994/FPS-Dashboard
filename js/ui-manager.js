// UI Management Module - Handles all DOM manipulation and user interface updates.

import * as ChartService from "./chart-service.js";
import * as GeminiService from "./gemini-service.js";
import * as HotlistManager from "./hotlist-manager.js";
import {
  formatFileNameToAppName,
  formatAnalysisText,
  copyRichText,
  fallbackCopyText,
  inferAppCategory,
} from "./utils.js";

// --- Globals for UI State ---
let detailCharts = {};
let currentAnalysisData = null;
let lastAnalysisInputData = null;
let lastComparisonAnalysisInputData = null;

// Make lastComparisonAnalysisInputData globally accessible
window.lastComparisonAnalysisInputData = lastComparisonAnalysisInputData;

// --- Toasts and Loaders ---

export function showToast(message, type = "info") {
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

export function showLoading() {
  document.getElementById("loadingOverlay").classList.add("show");
}

export function hideLoading() {
  document.getElementById("loadingOverlay").classList.remove("show");
}

// --- Main UI Updates ---

export function updateViewControls(dashboard) {
  const showAllBtn = document.getElementById("showAllBtn");
  const resultsCount = document.getElementById("resultsCount");
  const searchFilterSection = document.getElementById("searchFilterSection");

  if (dashboard.currentView === "recent") {
    showAllBtn.textContent = "Show All";
    resultsCount.textContent = `Showing recent ${
      dashboard.uploadedData.slice(-10).length
    } results`;
    searchFilterSection.style.display = "none";
  } else {
    showAllBtn.textContent = "Show Recent";
    const totalResults = dashboard.filteredData.length;
    const startIndex = (dashboard.currentPage - 1) * dashboard.itemsPerPage + 1;
    const endIndex = Math.min(
      dashboard.currentPage * dashboard.itemsPerPage,
      totalResults
    );
    resultsCount.textContent = `Showing ${
      totalResults > 0 ? startIndex : 0
    }-${endIndex} of ${totalResults} results`;
    searchFilterSection.style.display = "block";
  }
}

export function updateStats(uploadedData) {
  const statsContainer = document.getElementById("statsContainer");

  if (uploadedData.length === 0) {
    statsContainer.style.display = "none";
    return;
  }
  statsContainer.style.display = "flex";

  const totalRuns = uploadedData.length;
  const uniqueGames = new Set(
    uploadedData.map((data) => data.appName || "Unknown App")
  ).size;
  const uniqueDevices = new Set(
    uploadedData.map((data) => {
      const deviceInfo = data.deviceInfo || {};
      const brand = deviceInfo["ro.product.manufacturer"] || "Unknown";
      const model = deviceInfo["ro.product.model"] || "Unknown";
      return `${brand} ${model}`;
    })
  ).size;

  const avgFpsOverall =
    totalRuns > 0
      ? uploadedData.reduce((sum, data) => sum + data.avgFps, 0) / totalRuns
      : 0;
  const uploadsToday = uploadedData.length;
  const mostRecentUpload =
    uploadedData.length > 0
      ? uploadedData[uploadedData.length - 1].timestamp
      : "N/A";

  document.getElementById("totalUploads").textContent = totalRuns;
  document.getElementById("totalFrames").textContent = uniqueGames;
  document.getElementById("totalTime").textContent = uniqueDevices;
  document.getElementById("avgFpsOverall").textContent =
    avgFpsOverall.toFixed(1);
  document.getElementById("uploadsToday").textContent = uploadsToday;
  document.getElementById("recentUpload").textContent = mostRecentUpload;
}

export function updateFilterChips(dashboard) {
  const filterChips = document.getElementById("filterChips");

  if (dashboard.activeFilters.size === 0) {
    filterChips.innerHTML = "";
    return;
  }

  let chipsHtml = "";
  for (const [filterKey, filter] of dashboard.activeFilters) {
    const displayValue =
      filter.value.length > 20
        ? filter.value.substring(0, 20) + "..."
        : filter.value;
    chipsHtml += `
      <div class="filter-chip" data-filter-key="${filterKey}">
        ${filter.type}: ${displayValue}
        <span class="remove" onclick="window.dashboard.removeFilter('${filterKey}')">×</span>
      </div>
    `;
  }
  filterChips.innerHTML = chipsHtml;
}

// --- Table Rendering ---

export function updateTableWithCheckboxes(dashboard) {
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
          <th style="text-align: center;">
            <input type="checkbox" id="selectAllCheckbox" onchange="toggleAllSelection(this.checked)" style="width: 16px; height: 16px; accent-color: var(--primary-color);" title="Select/Deselect All" />
          </th>
          <th>App Name</th>
          <th>Package Name</th>
          <th data-tooltip="Represents actual user experience. Calculated from the hardware V-sync timestamp ('frame.vsync').">
            Avg FPS
          </th>
          <th data-tooltip="Represents ideal/intended performance. Calculated from the scheduled draw timestamp ('frame.draw').">
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
    const scheduledAvgFps = data.vsync_avgFps
      ? data.vsync_avgFps.toFixed(2)
      : "N/A";
    const elapsedTime = data.elapsedTimeSeconds
      ? data.elapsedTimeSeconds.toFixed(2)
      : "N/A";
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
      <tr onclick="window.openDetailedAnalysis(window.dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-checkbox" 
                 ${isSelected ? "checked" : ""} 
                 onchange="window.toggleAppSelection(${actualDataIndex}, this)" />
        </td>
        <td title="${appName}" style="color: var(--primary-light);">${appName}</td>
        <td title="${packageName}">${packageName}</td>
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
            onclick="event.stopPropagation(); window.dashboard.deleteAnalysisResult(${actualDataIndex})"
            title="Delete this analysis result"
            style="background: var(--error-color); color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; font-weight: 600; transition: all 0.2s ease;"
            onmouseover="this.style.background='#dc2626'"
            onmouseout="this.style.background='var(--error-color)'"
          >
            🗑️ Delete
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `</tbody></table>`;

  if (dashboard.currentView === "all") {
    const totalPages = Math.ceil(
      dashboard.filteredData.length / dashboard.itemsPerPage
    );
    if (totalPages > 1) {
      tableHtml += `
        <div class="load-more-container">
          <button class="load-more-btn" onclick="window.dashboard.previousPage()" ${
            dashboard.currentPage === 1 ? "disabled" : ""
          }>Previous</button>
          <span style="margin: 0 15px; color: var(--text-secondary);">Page ${
            dashboard.currentPage
          } of ${totalPages}</span>
          <button class="load-more-btn" onclick="window.dashboard.nextPage()" ${
            dashboard.currentPage === totalPages ? "disabled" : ""
          }>Next</button>
        </div>
      `;
    }
  }

  tableContent.innerHTML = tableHtml;
  initializeTooltips();
}

export function updatePerformanceTables(dashboard) {
  const performanceSection = document.getElementById("performanceSection");

  if (dashboard.uploadedData.length === 0) {
    performanceSection.style.display = "none";
    return;
  }
  performanceSection.style.display = "block";

  const latestRunsByApp = {};
  dashboard.uploadedData.forEach((data) => {
    const appKey = data.appName || "Unknown App";
    if (
      !latestRunsByApp[appKey] ||
      new Date(data.timestamp) > new Date(latestRunsByApp[appKey].timestamp)
    ) {
      latestRunsByApp[appKey] = data;
    }
  });

  const latestRuns = Object.values(latestRunsByApp);
  const sortedByFps = [...latestRuns].sort((a, b) => b.avgFps - a.avgFps);

  dashboard.allBestPerforming = sortedByFps;
  dashboard.allWorstPerforming = [...sortedByFps].reverse();

  createPerformanceTable(
    "bestPerformingTable",
    sortedByFps.slice(0, 5),
    "best"
  );
  createPerformanceTable(
    "worstPerformingTable",
    [...sortedByFps].reverse().slice(0, 5),
    "worst"
  );
}

export function createPerformanceTable(containerId, data, type) {
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

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
}

// --- Modal Management ---

export async function promptForAppNames(files) {
  return new Promise(async (resolve) => {
    // Get existing hotlists
    const allHotlists = HotlistManager.getAllHotlists();

    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
        display: flex; justify-content: center; align-items: center; z-index: 3000;
      `;

    let modalContent = `
        <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                     padding: 30px; max-width: 600px; width: 95%; max-height: 85vh; overflow-y: auto;">
          <h3 style="color: var(--text-primary); margin-top: 0;">Enter App Names & Select Hotlists</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">Please provide the app name for each uploaded file and optionally assign them to hotlists:</p>
          
          <!-- Global Hotlist Selection -->
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <h4 style="color: var(--text-primary); margin: 0 0 10px 0; font-size: 0.95rem;">🏷️ Assign to Hotlists (applies to all files)</h4>
            <div id="globalHotlistSelection" style="margin-bottom: 10px;">
              ${
                allHotlists.length > 0
                  ? `
                <div style="position: relative;">
                  <input type="text" id="hotlistSearch" placeholder="🔍 Search hotlists..." 
                         style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; font-size: 0.85rem; box-sizing: border-box; margin-bottom: 10px;"
                         oninput="filterHotlistOptions()" />
                  <div id="hotlistOptions" style="max-height: 150px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px; background: var(--input-bg-color);">
                    ${allHotlists
                      .map(
                        (hotlist) => `
                      <div class="hotlist-option" data-name="${hotlist.name.toLowerCase()}" data-description="${(
                          hotlist.description || ""
                        ).toLowerCase()}" style="padding: 8px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); cursor: pointer; transition: background-color 0.2s ease;" onmouseover="this.style.backgroundColor='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.backgroundColor='transparent'" onclick="toggleHotlistSelection('${
                          hotlist.id
                        }', this)">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <input type="checkbox" id="hotlist_${
                            hotlist.id
                          }" style="width: 16px; height: 16px; accent-color: var(--primary-color);" onchange="event.stopPropagation()" />
                          <div style="flex: 1;">
                            <div style="color: var(--text-primary); font-weight: 500; font-size: 0.85rem;">🏷️ ${
                              hotlist.name
                            }</div>
                            ${
                              hotlist.description
                                ? `<div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 2px;">${hotlist.description}</div>`
                                : ""
                            }
                          </div>
                        </div>
                      </div>
                    `
                      )
                      .join("")}
                  </div>
                </div>
              `
                  : `
                <div style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 20px;">
                  No hotlists available. You can create hotlists after uploading files.
                </div>
              `
              }
            </div>
            <div style="display: flex; gap: 10px; margin-top: 10px;">
              <button id="clearAllHotlists" style="padding: 6px 12px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Clear All</button>
              <button id="selectAllHotlists" style="padding: 6px 12px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer; font-size: 0.8rem;">Select All</button>
            </div>
          </div>

          <!-- App Names Section -->
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid rgba(255, 255, 255, 0.1);">
            <div style="display: flex; gap: 10px; margin-bottom: 10px;">
              <button id="clearAll" style="padding: 8px 16px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer; font-size: 0.85rem; font-weight: 600;">🗑️ Clear All</button>
            </div>
            <p style="color: var(--text-secondary); font-size: 0.75rem; margin: 0; line-height: 1.3;">💡 <strong>Smart Formatting:</strong> App names are automatically formatted from file names. You can edit them if needed.</p>
          </div>`;

    files.forEach((file, index) => {
      const formattedAppName = formatFileNameToAppName(file.name);
      modalContent += `
          <div style="margin-bottom: 15px;">
            <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">${file.name}:</label>
            <input type="text" id="appName_${index}" value="${formattedAppName}" placeholder="Enter app name (e.g., Netflix, YouTube, etc.)"
                   style="width: 100%; padding: 10px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; box-sizing: border-box;" />
          </div>`;
    });

    modalContent += `
          <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
            <button id="cancelAppNames" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
            <button id="confirmAppNames" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Continue</button>
          </div>
        </div>`;
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);

    // Add hotlist filtering functionality
    window.filterHotlistOptions = function () {
      const searchInput = document.getElementById("hotlistSearch");
      const hotlistOptions = document.querySelectorAll(".hotlist-option");

      if (!searchInput || !hotlistOptions) return;

      const searchTerm = searchInput.value.toLowerCase().trim();

      hotlistOptions.forEach((option) => {
        const name = option.getAttribute("data-name") || "";
        const description = option.getAttribute("data-description") || "";

        const matches =
          name.includes(searchTerm) || description.includes(searchTerm);
        option.style.display = matches ? "block" : "none";
      });
    };

    // Add hotlist selection functionality
    window.toggleHotlistSelection = function (hotlistId, element) {
      const checkbox = document.getElementById(`hotlist_${hotlistId}`);
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
      }
    };

    document.getElementById("clearAll").onclick = () => {
      files.forEach((_, index) => {
        document.getElementById(`appName_${index}`).value = "";
      });
    };

    document.getElementById("clearAllHotlists").onclick = () => {
      allHotlists.forEach((hotlist) => {
        const checkbox = document.getElementById(`hotlist_${hotlist.id}`);
        if (checkbox) checkbox.checked = false;
      });
    };

    document.getElementById("selectAllHotlists").onclick = () => {
      allHotlists.forEach((hotlist) => {
        const checkbox = document.getElementById(`hotlist_${hotlist.id}`);
        if (checkbox) checkbox.checked = true;
      });
    };

    document.getElementById("cancelAppNames").onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };

    document.getElementById("confirmAppNames").onclick = () => {
      const appNames = [];
      const selectedHotlists = [];

      // Validate app names
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

      // Get selected hotlists
      allHotlists.forEach((hotlist) => {
        const checkbox = document.getElementById(`hotlist_${hotlist.id}`);
        if (checkbox && checkbox.checked) {
          selectedHotlists.push(hotlist.id);
        }
      });

      if (allValid) {
        document.body.removeChild(modal);
        resolve({ appNames, selectedHotlists });
      }
    };
  });
}

export function updateTableWithPagination(dashboard) {
  const tableContent = document.getElementById("tableContent");

  if (dashboard.filteredData.length === 0) {
    tableContent.innerHTML = `
      <div class="empty-state">
        <h3>No results found</h3>
        <p>Try adjusting your search terms or filters.</p>
      </div>
    `;
    return;
  }

  const startIndex = (dashboard.currentPage - 1) * dashboard.itemsPerPage;
  const endIndex = startIndex + dashboard.itemsPerPage;
  const pageData = dashboard.filteredData.slice(startIndex, endIndex);

  let tableHtml = `
    <table class="dashboard-table">
      <thead>
        <tr>
          <th style="text-align: center;">
            <input type="checkbox" id="selectAllCheckbox" onchange="toggleAllSelection(this.checked)" style="width: 16px; height: 16px; accent-color: var(--primary-color);" title="Select/Deselect All" />
          </th>
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
    const actualDataIndex = dashboard.uploadedData.indexOf(data);
    const isSelected = dashboard.selectedForComparison.has(actualDataIndex);

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

    let totalMemoryGB = "N/A";
    if (deviceInfo.MemTotal) {
      const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
      if (!isNaN(memKB)) {
        totalMemoryGB = (memKB / (1024 * 1024)).toFixed(2);
      }
    }

    const cpuABI = deviceInfo["ro.product.cpu.abi"] || "N/A";
    const uploadTime = data.timestamp || "N/A";

    const manufacturerCell =
      manufacturer !== "N/A"
        ? `<td title="${manufacturer}" class="filterable" onclick="window.dashboard.addFilter('manufacturer', '${manufacturer}')">${manufacturer}</td>`
        : `<td title="${manufacturer}">${manufacturer}</td>`;

    const appNameCell =
      appName !== "N/A"
        ? `<td title="${appName}" class="filterable" style="cursor: pointer; color: var(--primary-light);" onclick="window.openDetailedAnalysis(window.dashboard.uploadedData[${actualDataIndex}])">${appName}</td>`
        : `<td title="${appName}">${appName}</td>`;

    const socModelCell =
      socModel !== "N/A"
        ? `<td title="${socModel}" class="filterable" onclick="window.dashboard.addFilter('soc', '${socModel}')">${socModel}</td>`
        : `<td title="${socModel}">${socModel}</td>`;

    tableHtml += `
      <tr onclick="window.openDetailedAnalysis(window.dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="compare-checkbox" 
                 ${isSelected ? "checked" : ""} 
                 onchange="window.toggleAppSelection(${actualDataIndex}, this)" />
        </td>
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

  tableHtml += `</tbody></table>`;

  const totalPages = Math.ceil(
    dashboard.filteredData.length / dashboard.itemsPerPage
  );
  if (totalPages > 1) {
    tableHtml += `
      <div class="load-more-container">
        <button class="load-more-btn" onclick="window.dashboard.previousPage()" ${
          dashboard.currentPage === 1 ? "disabled" : ""
        }>Previous</button>
        <span style="margin: 0 15px; color: var(--text-secondary);">Page ${
          dashboard.currentPage
        } of ${totalPages}</span>
        <button class="load-more-btn" onclick="window.dashboard.nextPage()" ${
          dashboard.currentPage === totalPages ? "disabled" : ""
        }>Next</button>
      </div>
    `;
  }

  tableContent.innerHTML = tableHtml;
  initializeTooltips();
}

export async function showAuthenticationModal(dashboard) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
          display: flex; justify-content: center; align-items: center; z-index: 3500;
      `;
    modal.innerHTML = `
        <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                     padding: 30px; max-width: 450px; width: 90%;">
          <h3 style="color: var(--text-primary); margin-top: 0; text-align: center;">🔐 Admin Authentication Required</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px; text-align: center;">
            Only authorized administrators can delete analysis results.
          </p>
          <div style="margin-bottom: 15px;">
            <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">LDAP Email:</label>
            <input type="email" id="ldapEmail" placeholder="Enter your LDAP email"
                   style="width: 100%; padding: 12px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; box-sizing: border-box;" />
          </div>
          <div id="authError" style="color: var(--error-color); font-size: 0.85rem; margin-bottom: 15px; text-align: center; display: none;"></div>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="cancelAuth" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
            <button id="confirmAuth" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Authenticate</button>
          </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById("cancelAuth").onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };
    document.getElementById("confirmAuth").onclick = () => {
      const email = document
        .getElementById("ldapEmail")
        .value.trim()
        .toLowerCase();
      if (dashboard.adminUsers.includes(email)) {
        dashboard.currentUser = email;
        dashboard.isAuthenticated = true;
        document.body.removeChild(modal);
        showToast(`Authenticated as ${email}.`, "success");
        resolve(true);
      } else {
        document.getElementById("authError").textContent =
          "Access denied. You are not an authorized administrator.";
        document.getElementById("authError").style.display = "block";
      }
    };
  });
}

export async function confirmDelete(data) {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
          position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
          display: flex; justify-content: center; align-items: center; z-index: 3500;
      `;
    const deviceInfo = data.deviceInfo || {};
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    modal.innerHTML = `
        <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                     padding: 30px; max-width: 500px; width: 90%;">
          <h3 style="color: var(--error-color); margin-top: 0; text-align: center;">⚠️ Confirm Deletion</h3>
          <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 10px;">You are about to delete:</div>
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
            <button id="cancelDelete" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
            <button id="confirmDeleteBtn" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--error-color); color: white; cursor: pointer;">Delete Permanently</button>
          </div>
        </div>`;
    document.body.appendChild(modal);

    document.getElementById("cancelDelete").onclick = () => {
      document.body.removeChild(modal);
      resolve(false);
    };
    document.getElementById("confirmDeleteBtn").onclick = () => {
      document.body.removeChild(modal);
      resolve(true);
    };
  });
}

// --- Detailed Analysis Modal ---

export function initializeDetailedAnalysis() {
  const modal = document.getElementById("analysisModal");
  if (!modal) return;
  const closeBtn = document.getElementById("closeModalBtn");

  closeBtn.addEventListener("click", closeAnalysisModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeAnalysisModal();
  });

  document
    .querySelectorAll("#analysisModal .chart-toggle-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const chartType = e.currentTarget.id
          .replace("ChartBtn", "")
          .replace("fps", "fps")
          .replace("jank", "jank")
          .replace("combined", "combined")
          .replace("fpsBuckets", "fpsBuckets");
        showChart(chartType);
      });
    });

  document.querySelectorAll("#analysisModal .timescale-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const scale = e.currentTarget.dataset.scale;
      setTimeScale(scale);
    });
  });

  document
    .getElementById("aiAnalyzeBtn")
    .addEventListener("click", () => generateAIAnalysis());
  document
    .getElementById("copyAnalysisBtn")
    .addEventListener("click", () => copyAnalysisContent());
  document
    .getElementById("viewInputDataBtn")
    .addEventListener("click", () => showInputData());
  document
    .getElementById("aiConfigBtn")
    .addEventListener("click", () => showAIConfig());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("show")) {
      closeAnalysisModal();
    }
  });
}

export function openDetailedAnalysis(data) {
  currentAnalysisData = data;
  const modal = document.getElementById("analysisModal");

  // Find the title element (it might be in the wrapper now)
  let titleElement = document.getElementById("analysisModalTitle");
  if (!titleElement) {
    // If not found, look for it in the wrapper
    const wrapper = document.getElementById("titleHotlistWrapper");
    if (wrapper) {
      titleElement = wrapper.querySelector("h2");
    }
  }

  if (titleElement) {
    titleElement.textContent = `${
      data.appName || "Unknown App"
    } - Detailed Analysis`;
  }

  clearAIAnalysis();
  populateAppOverview(data);
  populateDeviceDetails(data);
  populateSimilarResults(data);
  populateRunHotlists(data);
  showChart("fps"); // Default chart

  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

export function closeAnalysisModal() {
  const modal = document.getElementById("analysisModal");
  modal.classList.remove("show");
  document.body.style.overflow = "";
  Object.values(detailCharts).forEach((chart) => chart?.destroy());
  detailCharts = {};
  currentAnalysisData = null;
}

export function showChart(chartType) {
  const dashboard = window.dashboard;
  if (dashboard) {
    dashboard.activeDetailChart = chartType;
  }

  // Update chart toggle buttons
  document
    .querySelectorAll("#analysisModal .chart-toggle-btn")
    .forEach((btn) => btn.classList.remove("active"));

  const chartBtn = document.getElementById(`${chartType}ChartBtn`);
  if (chartBtn) {
    chartBtn.classList.add("active");
  }

  // Hide all chart canvases in the analysis modal
  document.getElementById("detailFpsChart").style.display = "none";
  document.getElementById("detailJankChart").style.display = "none";
  document.getElementById("detailCombinedChart").style.display = "none";
  document.getElementById("detailFpsBucketsChart").style.display = "none";

  // Show the selected chart canvas
  const chartCanvas = document.getElementById(
    `detail${chartType.charAt(0).toUpperCase() + chartType.slice(1)}Chart`
  );
  if (chartCanvas) {
    chartCanvas.style.display = "block";
    if (currentAnalysisData && dashboard) {
      ChartService.createDetailChart(
        chartType,
        currentAnalysisData,
        dashboard.detailChartTimeScale,
        detailCharts
      );
    }
  }
}

export function setTimeScale(scale) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  dashboard.detailChartTimeScale = scale;

  document.querySelectorAll("#analysisModal .timescale-btn").forEach((btn) => {
    btn.classList.remove("active");
  });
  const activeBtn = document.querySelector(
    `#analysisModal .timescale-btn[data-scale='${scale}']`
  );
  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  showChart(dashboard.activeDetailChart);
}

function populateAppOverview(data) {
  const deviceInfo = data.deviceInfo || {};
  document.getElementById("overviewAppName").textContent =
    data.appName || "Unknown App";
  document.getElementById("overviewPackageName").textContent =
    data.packageName || "Unknown Package";
  document.getElementById("overviewAvgFPS").textContent = data.avgFps
    ? `${data.avgFps} FPS`
    : "N/A";
  document.getElementById("overviewElapsedTime").textContent =
    data.elapsedTimeSeconds ? `${data.elapsedTimeSeconds}s` : "N/A";
  document.getElementById("overviewDeviceHardware").textContent =
    deviceInfo["ro.oem.brand"] || "Unknown";
  document.getElementById("overviewDeviceBrand").textContent =
    deviceInfo["ro.product.manufacturer"] || "Unknown";
  let ramDisplay = "Unknown";
  if (deviceInfo.MemTotal) {
    const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
    if (!isNaN(memKB)) {
      ramDisplay = `${(memKB / (1024 * 1024)).toFixed(1)} GB`;
    }
  }
  document.getElementById("overviewRAM").textContent = ramDisplay;
  document.getElementById("overviewSoCModel").textContent =
    deviceInfo["ro.soc.model"] || "Unknown";
}

function populateDeviceDetails(data) {
  const tbody = document.getElementById("deviceDetailsBody");
  const deviceInfo = data.deviceInfo || {};
  let memoryDisplay = "N/A";
  if (deviceInfo.MemTotal) {
    memoryDisplay = `${(
      parseFloat(deviceInfo.MemTotal.replace(" kB", "")) /
      (1024 * 1024)
    ).toFixed(1)} GB`;
  }

  const properties = [
    { label: "App Name", value: data.appName || "N/A" },
    { label: "Package Name", value: data.packageName || "N/A" },
    { label: "Average FPS", value: data.avgFps || "N/A" },
    { label: "Minimum FPS", value: data.minFps || "N/A" },
    { label: "Maximum FPS", value: data.maxFps || "N/A" },
    { label: "Scheduled Avg FPS", value: data.vsync_avgFps || "N/A" },
    { label: "Scheduled Min FPS", value: data.vsync_minFps || "N/A" },
    { label: "Scheduled Max FPS", value: data.vsync_maxFps || "N/A" },
    { label: "Total Frames", value: data.totalFrames || "N/A" },
    { label: "Elapsed Time (s)", value: data.elapsedTimeSeconds || "N/A" },
    { label: "Refresh Rate (Hz)", value: data.refreshRate || "N/A" },
    {
      label: "Manufacturer",
      value: deviceInfo["ro.product.manufacturer"] || "N/A",
    },
    { label: "Device Model", value: deviceInfo["ro.product.model"] || "N/A" },
    { label: "Product Brand", value: deviceInfo["ro.product.brand"] || "N/A" },
    { label: "OEM Brand", value: deviceInfo["ro.oem.brand"] || "N/A" },
    {
      label: "Android Version",
      value: deviceInfo["ro.build.version.release"] || "N/A",
    },
    { label: "API Level", value: deviceInfo["ro.build.version.sdk"] || "N/A" },
    { label: "SoC Model", value: deviceInfo["ro.soc.model"] || "N/A" },
    {
      label: "SoC Manufacturer",
      value: deviceInfo["ro.soc.manufacturer"] || "N/A",
    },
    {
      label: "CPU Architecture",
      value: deviceInfo["ro.product.cpu.abi"] || "N/A",
    },
    { label: "Total Memory", value: memoryDisplay },
    {
      label: "Graphics Hardware",
      value: deviceInfo["ro.hardware.egl"] || "N/A",
    },
    {
      label: "Build Fingerprint",
      value: deviceInfo["ro.build.fingerprint"] || "N/A",
    },
  ];

  tbody.innerHTML = properties
    .map((prop) => `<tr><td>${prop.label}</td><td>${prop.value}</td></tr>`)
    .join("");
}

function populateSimilarResults(data) {
  const grid = document.getElementById("similarResultsGrid");
  const section = document.getElementById("similarResultsSection");
  const dashboard = window.dashboard;

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
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    const resultIndex = dashboard.uploadedData.indexOf(result);
    gridHtml += `
        <div class="similar-result-card" onclick="window.openDetailedAnalysis(window.dashboard.uploadedData[${resultIndex}])">
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

function populateRunHotlists(data) {
  // Find the run index for this data
  const dashboard = window.dashboard;
  const runIndex = dashboard.uploadedData.indexOf(data);

  if (runIndex === -1) return;

  // Get hotlists from the data itself first, then fallback to hotlist manager
  let runHotlists = [];
  let assignedHotlistIds = [];

  if (data.hotlistIds && Array.isArray(data.hotlistIds)) {
    // Use hotlist IDs stored in the data record
    const allHotlists = dashboard.getAllHotlists();
    runHotlists = data.hotlistIds
      .map((hotlistId) => allHotlists.find((h) => h.id === hotlistId))
      .filter(Boolean); // Remove any undefined hotlists
    assignedHotlistIds = data.hotlistIds;
  } else {
    // Fallback to hotlist manager method
    runHotlists = dashboard.getHotlistsForRun(runIndex);
    assignedHotlistIds = runHotlists.map((h) => h.id);
  }

  const allHotlists = dashboard.getAllHotlists();

  // Sort unassigned hotlists by usage frequency (most used first)
  const suggestedHotlists = allHotlists
    .filter((h) => !assignedHotlistIds.includes(h.id))
    .sort((a, b) => (b.runIds?.length || 0) - (a.runIds?.length || 0))
    .slice(0, 5); // Show top 5 most used hotlists

  // Check if wrapper already exists (from openDetailedAnalysis)
  let hotlistContainer = document.getElementById("runHotlistChips");

  if (!hotlistContainer) {
    // If no wrapper exists yet, we need to create the structure
    const modalTitle = document.getElementById("analysisModalTitle");
    if (!modalTitle) return;

    // Create a wrapper div for title and hotlist with flex column
    const wrapperDiv = document.createElement("div");
    wrapperDiv.id = "titleHotlistWrapper";
    wrapperDiv.style.cssText = `
      display: flex;
      flex-direction: column;
      width: calc(100% - 60px);
      margin-right: 60px;
    `;

    // Move the title into the wrapper
    const titleClone = modalTitle.cloneNode(true);
    const parentNode = modalTitle.parentNode;
    if (parentNode) {
      parentNode.insertBefore(wrapperDiv, modalTitle);
      modalTitle.remove();
      wrapperDiv.appendChild(titleClone);
    }

    // Create the hotlist chips container
    hotlistContainer = document.createElement("div");
    hotlistContainer.id = "runHotlistChips";
    hotlistContainer.style.cssText = `
      margin: 8px 0 12px 0;
      padding: 8px;
      border: 1px dashed rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.01);
      width: 100%;
    `;

    // Add the hotlist container to the wrapper
    wrapperDiv.appendChild(hotlistContainer);
  }

  // Update the hotlist container content
  let containerHtml = `
    <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
      <!-- Plus button at the beginning -->
      <button onclick="showHotlistSelectionPopup(${runIndex})" style="
        background: rgba(255, 255, 255, 0.05);
        border: 1px dashed rgba(255, 255, 255, 0.3);
        color: var(--text-secondary);
        padding: 3px 8px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 0.7rem;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.color='var(--text-primary)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.color='var(--text-secondary)'">
        ➕ Add
      </button>
  `;

  // Add assigned hotlists
  runHotlists.forEach((hotlist) => {
    containerHtml += `
      <span style="
        background: var(--primary-color);
        color: white;
        padding: 3px 8px;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      ">
        ${hotlist.name}
        <button onclick="removeHotlistFromRun('${hotlist.id}', ${runIndex})" style="
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-weight: bold;
          padding: 0;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          transition: all 0.2s ease;
        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='none'" title="Remove from hotlist">
          ×
        </button>
      </span>
    `;
  });

  // Add suggested hotlists (grayed out and clickable)
  suggestedHotlists.forEach((hotlist) => {
    containerHtml += `
      <button onclick="addHotlistToRun('${hotlist.id}', ${runIndex})" style="
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: var(--text-secondary);
        padding: 3px 8px;
        border-radius: 12px;
        cursor: pointer;
        font-size: 0.7rem;
        font-weight: 400;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.3s ease;
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.color='var(--text-primary)'; this.style.borderColor='var(--primary-color)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'; this.style.color='var(--text-secondary)'; this.style.borderColor='rgba(255, 255, 255, 0.15)'" title="Click to add this hotlist">
        ${hotlist.name}
      </button>
    `;
  });

  containerHtml += `</div>`;
  hotlistContainer.innerHTML = containerHtml;
}

// --- AI Analysis UI ---

export async function generateAIAnalysis() {
  const loadingElement = document.getElementById("aiAnalysisLoading");
  const resultElement = document.getElementById("aiAnalysisResult");
  const analyzeBtn = document.getElementById("aiAnalyzeBtn");
  const copyBtn = document.getElementById("copyAnalysisBtn");

  const apiKey = localStorage.getItem("geminiApiKey");
  if (!apiKey) {
    resultElement.innerHTML = `<div style="color: var(--warning-color); font-weight: 600; margin-bottom: 10px;">🔧 AI Analysis Not Configured</div><p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">Please configure your Gemini API key first by clicking "Configure API".</p>`;
    copyBtn.style.display = "none";
    return;
  }
  if (!currentAnalysisData) {
    resultElement.innerHTML = `<div style="color: var(--error-color); font-weight: 600; margin-bottom: 10px;">❌ No Data Available</div><p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">No performance data available for analysis.</p>`;
    copyBtn.style.display = "none";
    return;
  }

  loadingElement.style.display = "flex";
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  copyBtn.style.display = "none";

  try {
    const analysisData = GeminiService.structureDataForAI(
      currentAnalysisData,
      window.dashboard.uploadedData
    );
    lastAnalysisInputData = analysisData;
    const analysis = await GeminiService.callGeminiAPI(apiKey, analysisData);
    resultElement.innerHTML = `<div style="color: var(--success-color); font-weight: 600; margin-bottom: 15px;">🤖 AI Performance Analysis</div>${formatAnalysisText(
      analysis
    )}`;
    copyBtn.style.display = "inline-block";
    document.getElementById("viewInputDataBtn").style.display = "inline-block";
  } catch (error) {
    console.error("AI Analysis Error:", error);
    resultElement.innerHTML = `<div style="color: var(--error-color); font-weight: 600; margin-bottom: 10px;">❌ Analysis Failed</div><p style="margin: 0; font-size: 0.85rem; line-height: 1.4;">Error: ${error.message}</p>`;
    copyBtn.style.display = "none";
  } finally {
    loadingElement.style.display = "none";
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Generate AI Analysis";
  }
}

export function clearAIAnalysis() {
  const resultElement = document.getElementById("aiAnalysisResult");
  const copyBtn = document.getElementById("copyAnalysisBtn");
  if (resultElement) {
    resultElement.innerHTML = `<div style="color: var(--text-secondary); font-style: italic;">Click "Generate AI Analysis" to get intelligent insights about this app's performance.</div>`;
  }
  if (copyBtn) {
    copyBtn.style.display = "none";
  }
}

export function showAIConfig() {
  // Check if modal already exists and remove it
  const existingModal = document.getElementById("aiConfigModal");
  if (existingModal) {
    existingModal.remove();
  }

  const configModal = document.createElement("div");
  configModal.id = "aiConfigModal";
  configModal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
      display: flex; justify-content: center; align-items: center; z-index: 3000;
    `;
  configModal.innerHTML = `
      <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                   padding: 30px; max-width: 500px; width: 90%;">
        <h3 style="color: var(--text-primary); margin-top: 0;">Configure Gemini AI</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">
          Enter your Google Gemini API key to enable AI-powered performance analysis.
        </p>
        <input type="password" id="geminiApiKeyInput" placeholder="Enter your Gemini API key..."
               style="width: 100%; padding: 12px; border-radius: var(--btn-radius); border: 1px solid var(--border-color);
                      background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif;
                      margin-bottom: 20px; box-sizing: border-box;" />
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="cancelAIConfig" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
          <button id="saveAIConfig" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Save</button>
        </div>
      </div>
    `;
  document.body.appendChild(configModal);

  const close = () => {
    const modal = document.getElementById("aiConfigModal");
    if (modal) {
      modal.remove();
    }
  };

  document.getElementById("cancelAIConfig").onclick = close;
  document.getElementById("saveAIConfig").onclick = () => {
    const apiKey = document.getElementById("geminiApiKeyInput").value.trim();
    if (apiKey) {
      localStorage.setItem("geminiApiKey", apiKey);
      showToast("Gemini API key saved successfully!", "success");
      close();
    } else {
      alert("Please enter a valid API key.");
    }
  };

  // Add escape key handler
  const handleEscape = (e) => {
    if (e.key === "Escape") {
      close();
      document.removeEventListener("keydown", handleEscape);
    }
  };
  document.addEventListener("keydown", handleEscape);
}

// --- Hotlist Table Pagination and Selection Functions ---

function changeHotlistTablePage(newPage) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  dashboard.hotlistTablePage = newPage;
  updateHotlistRunsTable(dashboard);
}

function updateHotlistTableItemsPerPage(itemsPerPage) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  dashboard.hotlistTableItemsPerPage = parseInt(itemsPerPage);
  dashboard.hotlistTablePage = 1; // Reset to first page
  updateHotlistRunsTable(dashboard);
}

function toggleAllHotlistRunsSelection(checked) {
  const checkboxes = document.querySelectorAll(".hotlist-run-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = checked;
  });
  updateHotlistRunsSelection();
}

function updateHotlistRunsSelection() {
  const checkboxes = document.querySelectorAll(".hotlist-run-checkbox");
  const checkedBoxes = document.querySelectorAll(
    ".hotlist-run-checkbox:checked"
  );
  const selectAllCheckbox = document.getElementById("selectAllHotlistRuns");
  const bulkActions = document.getElementById("hotlistBulkActions");
  const selectedCount = document.getElementById("selectedHotlistRunsCount");

  // Update select all checkbox state
  if (selectAllCheckbox) {
    if (checkedBoxes.length === 0) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    } else if (checkedBoxes.length === checkboxes.length) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = true;
    } else {
      selectAllCheckbox.indeterminate = true;
      selectAllCheckbox.checked = false;
    }
  }

  // Show/hide bulk actions
  if (bulkActions && selectedCount) {
    if (checkedBoxes.length > 0) {
      bulkActions.style.display = "block";
      selectedCount.textContent = `${checkedBoxes.length} runs selected`;
    } else {
      bulkActions.style.display = "none";
    }
  }
}

function clearHotlistRunsSelection() {
  const checkboxes = document.querySelectorAll(".hotlist-run-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateHotlistRunsSelection();
}

function bulkAssignHotlists() {
  const checkedBoxes = document.querySelectorAll(
    ".hotlist-run-checkbox:checked"
  );
  if (checkedBoxes.length === 0) {
    showToast("No runs selected", "warning");
    return;
  }

  const selectedRunIndices = Array.from(checkedBoxes).map((checkbox) =>
    parseInt(checkbox.getAttribute("data-run-index"))
  );

  const dashboard = window.dashboard;
  const allHotlists = dashboard.getAllHotlists();

  if (allHotlists.length === 0) {
    showToast("No hotlists available. Create a hotlist first.", "warning");
    return;
  }

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000;
  `;

  let hotlistsHtml = allHotlists
    .map(
      (hotlist) => `
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); margin-bottom: 10px;">
        <input type="checkbox" id="bulk_hotlist_${
          hotlist.id
        }" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
        <label for="bulk_hotlist_${
          hotlist.id
        }" style="flex: 1; color: var(--text-primary); cursor: pointer;">
          <strong>🏷️ ${hotlist.name}</strong>
          ${
            hotlist.description
              ? `<br><span style="color: var(--text-secondary); font-size: 0.8rem;">${hotlist.description}</span>`
              : ""
          }
        </label>
      </div>
    `
    )
    .join("");

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 30px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <h3 style="color: var(--text-primary); margin-top: 0;">Bulk Assign Hotlists</h3>
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 5px;">Selected Runs:</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${selectedRunIndices.length} runs selected for hotlist assignment
        </div>
      </div>
      <div style="margin-bottom: 20px;">
        <h4 style="color: var(--text-primary); margin-bottom: 15px;">Select Hotlists to Assign:</h4>
        ${hotlistsHtml}
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancelBulkAssignment" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button id="saveBulkAssignment" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Assign to Selected Runs</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelBulkAssignment").onclick = () => {
    document.body.removeChild(modal);
  };

  document.getElementById("saveBulkAssignment").onclick = () => {
    const selectedHotlists = [];
    allHotlists.forEach((hotlist) => {
      const checkbox = document.getElementById(`bulk_hotlist_${hotlist.id}`);
      if (checkbox && checkbox.checked) {
        selectedHotlists.push(hotlist.id);
      }
    });

    if (selectedHotlists.length === 0) {
      showToast("Please select at least one hotlist", "warning");
      return;
    }

    // Assign selected hotlists to all selected runs
    let assignmentCount = 0;
    selectedRunIndices.forEach((runIndex) => {
      selectedHotlists.forEach((hotlistId) => {
        dashboard.addRunToHotlist(hotlistId, runIndex);
        assignmentCount++;
      });
    });

    showToast(
      `Successfully assigned ${selectedHotlists.length} hotlists to ${selectedRunIndices.length} runs!`,
      "success"
    );
    document.body.removeChild(modal);
    clearHotlistRunsSelection();
    updateHotlistRunsTable(dashboard);
  };
}

export function showInputData() {
  if (!lastAnalysisInputData) {
    showToast("No input data available to display.", "warning");
    return;
  }
  const modal = document.createElement("div");
  // ... modal creation logic from original file ...
  document.body.appendChild(modal);
}

// --- Comparison Modal ---

export function updateCompareControls(dashboard) {
  const compareControls = document.getElementById("compareControls");
  const selectedCount = document.getElementById("selectedCount");
  const compareBtn = document.getElementById("compareBtn");
  const deleteBtn = document.getElementById("deleteSelectedBtn");

  if (dashboard.selectedForComparison.size >= 1) {
    compareControls.classList.add("show");
    selectedCount.textContent = `${dashboard.selectedForComparison.size} selected`;

    // Enable/disable buttons based on selection count
    if (dashboard.selectedForComparison.size >= 2) {
      compareBtn.disabled = false;
      compareBtn.style.display = "flex";
    } else {
      compareBtn.disabled = true;
      compareBtn.style.display = "none";
    }

    // Always show delete button when items are selected
    if (deleteBtn) {
      deleteBtn.style.display = "flex";
    }
  } else {
    compareControls.classList.remove("show");
    compareBtn.disabled = true;
    if (deleteBtn) {
      deleteBtn.style.display = "none";
    }
  }
}

export function openComparisonModal(dashboard) {
  if (dashboard.selectedForComparison.size < 2) {
    showToast("Please select at least 2 apps to compare.", "warning");
    return;
  }

  const modal = document.getElementById("comparisonModal");
  modal.style.zIndex = "4000";

  const selectedData = Array.from(dashboard.selectedForComparison).map(
    (index) => dashboard.uploadedData[index]
  );

  populateSelectedApps(selectedData, dashboard);
  ChartService.createComparisonBarChart(selectedData, dashboard);
  createComparisonMetricsTable(selectedData);
  ChartService.createComparisonFpsBucketsCharts(selectedData, dashboard);

  showComparisonChart("fps", dashboard);
  clearComparisonAIAnalysis();

  modal.classList.add("show");
  document.body.style.overflow = "hidden";

  const closeBtn = document.getElementById("closeComparisonBtn");
  closeBtn.onclick = () => closeComparisonModal(dashboard);
}

export function closeComparisonModal(dashboard) {
  const modal = document.getElementById("comparisonModal");
  modal.classList.remove("show");
  document.body.style.overflow = "";

  if (dashboard && dashboard.comparisonCharts) {
    Object.values(dashboard.comparisonCharts).forEach((chart) => {
      if (chart) chart.destroy();
    });
    dashboard.comparisonCharts = {};
  }

  if (dashboard) {
    dashboard.activeComparisonChart = "fps";
  }
}

export function showComparisonChart(chartType, dashboard) {
  if (!dashboard) return;

  dashboard.activeComparisonChart = chartType;

  document
    .querySelectorAll("#comparisonModal .chart-toggle-btn")
    .forEach((btn) => btn.classList.remove("active"));

  // Map chart types to correct button IDs
  let btnId;
  if (chartType === "fps") {
    btnId = "compFpsChartBtn";
  } else if (chartType === "slowframe") {
    btnId = "compSlowFrameChartBtn";
  } else if (chartType === "instability") {
    btnId = "compInstabilityChartBtn";
  }

  const btn = document.getElementById(btnId);
  if (btn) {
    btn.classList.add("active");
  }

  document.getElementById("comparisonFpsChart").style.display =
    chartType === "fps" ? "block" : "none";
  document.getElementById("comparisonSlowFrameChart").style.display =
    chartType === "slowframe" ? "block" : "none";
  document.getElementById("comparisonInstabilityChart").style.display =
    chartType === "instability" ? "block" : "none";

  document.getElementById("comparisonTimeScaleControls").style.display = "flex";

  const selectedData = Array.from(dashboard.selectedForComparison).map(
    (index) => dashboard.uploadedData[index]
  );

  if (chartType === "fps") {
    ChartService.createComparisonFpsChart(selectedData, dashboard);
  } else if (chartType === "slowframe") {
    ChartService.createComparisonSlowFrameChart(selectedData, dashboard);
  } else if (chartType === "instability") {
    ChartService.createComparisonInstabilityChart(selectedData, dashboard);
  }
}

export function setComparisonTimeScale(scale, dashboard) {
  if (!dashboard) return;

  dashboard.comparisonChartTimeScale = scale;

  document
    .querySelectorAll("#comparisonTimeScaleControls .timescale-btn")
    .forEach((btn) => {
      btn.classList.remove("active");
    });
  const activeBtn = document.querySelector(
    `#comparisonTimeScaleControls .timescale-btn[data-scale="${scale}"]`
  );
  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  showComparisonChart(dashboard.activeComparisonChart, dashboard);
}

function populateSelectedApps(selectedData, dashboard) {
  const container = document.getElementById("selectedAppsList");

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

function createComparisonMetricsTable(selectedData) {
  const tbody = document.getElementById("comparisonMetricsBody");

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
                <td>${
                  data.vsync_avgFps ? data.vsync_avgFps.toFixed(1) : "N/A"
                }</td>
                <td>${data.minFps ? data.minFps.toFixed(1) : "N/A"}</td>
                <td>${data.maxFps ? data.maxFps.toFixed(1) : "N/A"}</td>
                <td>${
                  data.slowFramePercentage
                    ? data.slowFramePercentage.toFixed(1) + "%"
                    : "N/A"
                }</td>
                <td>${
                  data.jankInstabilityPercentage
                    ? data.jankInstabilityPercentage.toFixed(1) + "%"
                    : "N/A"
                }</td>
                <td>${
                  data.elapsedTimeSeconds
                    ? data.elapsedTimeSeconds.toFixed(1)
                    : "N/A"
                }</td>
                <td>${data.totalFrames || "N/A"}</td>
            </tr>
        `;
  });

  tbody.innerHTML = html;
}

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

// --- AI Comparison Analysis ---

export async function generateComparisonAIAnalysis() {
  const loadingElement = document.getElementById("comparisonAiAnalysisLoading");
  const resultElement = document.getElementById("comparisonAiAnalysisResult");
  const analyzeBtn = document.getElementById("comparisonAiAnalyzeBtn");
  const copyBtn = document.getElementById("copyComparisonAnalysisBtn");

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

  const dashboard = window.dashboard;
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

  loadingElement.style.display = "flex";
  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing...";
  copyBtn.style.display = "none";

  try {
    const comparisonData = GeminiService.structureComparisonDataForAI(
      selectedData,
      dashboard.uploadedData
    );
    lastComparisonAnalysisInputData = comparisonData;
    window.lastComparisonAnalysisInputData = comparisonData;
    const analysis = await GeminiService.callGeminiComparisonAPI(
      apiKey,
      comparisonData
    );
    const formattedAnalysis = formatAnalysisText(analysis);

    resultElement.innerHTML = `
      <div style="color: var(--success-color); font-weight: 600; margin-bottom: 15px;">
        🤖 AI Comparison Analysis
      </div>
      ${formattedAnalysis}
    `;

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

export function copyAnalysisContent() {
  const resultElement = document.getElementById("aiAnalysisResult");
  const copyBtn = document.getElementById("copyAnalysisBtn");

  if (!resultElement) return;

  try {
    const htmlContent = resultElement.innerHTML;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    copyRichText(htmlContent, plainText, "Analysis copied with formatting!");
  } catch (error) {
    console.error("Copy failed:", error);
    showToast("Failed to copy analysis", "error");
  }
}

export function copyComparisonAnalysisContent() {
  const resultElement = document.getElementById("comparisonAiAnalysisResult");
  const copyBtn = document.getElementById("copyComparisonAnalysisBtn");

  if (!resultElement) return;

  try {
    const htmlContent = resultElement.innerHTML;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";

    copyRichText(
      htmlContent,
      plainText,
      "Comparison analysis copied with formatting!"
    );
  } catch (error) {
    console.error("Copy failed:", error);
    showToast("Failed to copy comparison analysis", "error");
  }
}

export function showComparisonInputData() {
  if (!lastComparisonAnalysisInputData) {
    showToast("No comparison input data available to display.", "warning");
    return;
  }

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000; padding: 20px;
  `;

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 30px; max-width: 800px; width: 95%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;">📄 AI Comparison Analysis Input Data</h3>
        <button onclick="closeComparisonInputDataModal()" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); font-size: 1.5rem; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">
        This is the structured comparison data that was provided to the AI for analysis:
      </p>
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 20px; border: 1px solid rgba(255, 255, 255, 0.1); font-family: 'Roboto Mono', monospace; font-size: 0.8rem; line-height: 1.4; color: var(--text-primary); white-space: pre-wrap; overflow-x: auto;">${JSON.stringify(
        lastComparisonAnalysisInputData,
        null,
        2
      )}</div>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button onclick="copyComparisonInputData()" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--success-color); color: white; cursor: pointer; font-weight: 600;">📋 Copy JSON</button>
        <button onclick="closeComparisonInputDataModal()" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer; font-weight: 600;">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentComparisonInputDataModal = modal;

  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeComparisonInputDataModal();
    }
  });
}

function closeComparisonInputDataModal() {
  if (window.currentComparisonInputDataModal) {
    document.body.removeChild(window.currentComparisonInputDataModal);
    window.currentComparisonInputDataModal = null;
  }
}

function copyComparisonInputData() {
  if (!lastComparisonAnalysisInputData) return;

  const jsonString = JSON.stringify(lastComparisonAnalysisInputData, null, 2);

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          showToast("Comparison input data copied to clipboard!", "success");
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
    showToast("Failed to copy comparison input data", "error");
  }
}

export function initializeComparisonModal() {
  const modal = document.getElementById("comparisonModal");
  if (!modal) return;

  document
    .getElementById("closeComparisonBtn")
    .addEventListener("click", closeComparisonModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeComparisonModal();
  });

  document
    .querySelectorAll("#comparisonModal .chart-toggle-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const chartType = e.currentTarget.id
          .replace("comp", "")
          .replace("ChartBtn", "")
          .toLowerCase();
        showComparisonChart(chartType, window.dashboard);
      });
    });

  document
    .querySelectorAll("#comparisonTimeScaleControls .timescale-btn")
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const scale = e.currentTarget.dataset.scale;
        setComparisonTimeScale(scale, window.dashboard);
      });
    });
}

// --- Tooltips ---
export function initializeTooltips() {
  const tooltipElement = document.getElementById("globalTooltip");
  if (!tooltipElement) return;

  const targets = document.querySelectorAll("[data-tooltip]");

  targets.forEach((target) => {
    target.addEventListener("mouseenter", (event) => {
      const tooltipText = target.getAttribute("data-tooltip");
      if (!tooltipText) return;

      tooltipElement.textContent = tooltipText;
      const targetRect = event.target.getBoundingClientRect();

      const top = targetRect.top - tooltipElement.offsetHeight - 10;
      const left =
        targetRect.left + targetRect.width / 2 - tooltipElement.offsetWidth / 2;

      tooltipElement.style.top = `${top}px`;
      tooltipElement.style.left = `${left}px`;

      tooltipElement.classList.add("show");
    });

    target.addEventListener("mouseleave", () => {
      tooltipElement.classList.remove("show");
    });
  });
}

// --- Hotlist Management UI ---

export async function updateHotlistsView(dashboard) {
  // Only update if we're in the hotlists section
  const mainContent = document.getElementById("mainContent");
  if (!mainContent || !mainContent.classList.contains("hotlists-view")) {
    return;
  }

  await updateHotlistsContainer(dashboard);
  updateHotlistFilterButtons(dashboard);
  updateHotlistRunsTable(dashboard);
}

async function updateHotlistsContainer(dashboard) {
  const container = document.getElementById("enhancedHotlistsContainer");

  // Show loading state
  container.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid var(--primary-color); border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite; margin-bottom: 15px;"></div>
      <div style="color: var(--text-secondary);">Loading hotlists from Firebase...</div>
    </div>
  `;

  try {
    // Load hotlists from Firebase collections
    const { firebaseService } = await import("./firebase-service.js");
    const hotlistCollections = await firebaseService.getAllHotlists();

    // Also get local hotlists for comparison
    const localHotlists = dashboard.getAllHotlists();

    // Combine Firebase hotlists with local ones, prioritizing Firebase data
    const allHotlists = [...hotlistCollections];

    // Add any local hotlists that aren't in Firebase
    localHotlists.forEach((localHotlist) => {
      const existsInFirebase = hotlistCollections.some(
        (fbHotlist) =>
          fbHotlist.name === localHotlist.name ||
          fbHotlist.id === localHotlist.id
      );
      if (!existsInFirebase) {
        allHotlists.push(localHotlist);
      }
    });

    if (allHotlists.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No hotlists created yet</h3>
          <p>Create your first hotlist to organize and filter your performance runs.</p>
        </div>
      `;
      return;
    }

    // Use the combined hotlists for display
    const hotlists = allHotlists;

    // Initialize pagination state if not exists
    if (!dashboard.hotlistPagination) {
      dashboard.hotlistPagination = {
        currentPage: 1,
        itemsPerPage: 50,
        isLoading: false,
        hasMore: true,
      };
    }

    const pagination = dashboard.hotlistPagination;
    const totalItems = hotlists.length;
    const startIndex = 0;
    const endIndex = Math.min(
      pagination.currentPage * pagination.itemsPerPage,
      totalItems
    );
    const displayedHotlists = hotlists.slice(startIndex, endIndex);

    pagination.hasMore = endIndex < totalItems;

    // Add search functionality
    let html = `
    <div style="margin-bottom: 15px;">
      <input type="text" id="hotlistSearchInput" placeholder="🔍 Search hotlists by name or description..." 
             style="width: 100%; padding: 10px 15px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; font-size: 0.9rem; box-sizing: border-box;"
             oninput="filterHotlistTable()" />
    </div>
    
    <div id="hotlistTableContainer" style="max-height: 70vh; overflow-y: auto; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px;">
      <table class="dashboard-table" style="margin: 0;">
        <thead style="position: sticky; top: 0; background: var(--card-bg); z-index: 10;">
          <tr>
            <th style="width: 40px; text-align: center;">
              <input type="checkbox" id="selectAllHotlists" onchange="toggleAllHotlistsSelection(this.checked)" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
            </th>
            <th style="width: 25%; min-width: 150px;">Name</th>
            <th style="width: 35%; min-width: 200px;">Description</th>
            <th style="width: 10%; text-align: center;">Runs</th>
            <th style="width: 15%; text-align: center;">Created</th>
            <th style="width: 15%; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody id="hotlistTableBody">
  `;

    displayedHotlists.forEach((hotlist) => {
      // Calculate run count using both hotlist manager and direct FPS data references
      let runCount = hotlist.runIds ? hotlist.runIds.length : 0;

      // Also count runs that have this hotlist ID in their hotlistIds array
      if (dashboard && dashboard.uploadedData) {
        const directReferences = dashboard.uploadedData.filter(
          (data) =>
            data.hotlistIds &&
            Array.isArray(data.hotlistIds) &&
            data.hotlistIds.includes(hotlist.id)
        ).length;

        // Use the higher count (in case of sync issues, we want to show the actual count)
        runCount = Math.max(runCount, directReferences);
      }

      const createdDate = new Date(hotlist.createdAt).toLocaleDateString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }
      );

      html += `
      <tr class="hotlist-row" data-name="${hotlist.name.toLowerCase()}" data-description="${(
        hotlist.description || ""
      ).toLowerCase()}" style="cursor: pointer; transition: background-color 0.2s ease;" onmouseover="this.style.backgroundColor='rgba(255, 255, 255, 0.05)'" onmouseout="this.style.backgroundColor='transparent'" onclick="window.dashboard.setHotlistFilter('${
        hotlist.id
      }')">
        <td onclick="event.stopPropagation();" style="text-align: center;">
          <input type="checkbox" class="hotlist-checkbox" data-hotlist-id="${
            hotlist.id
          }" onchange="updateHotlistSelection()" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
        </td>
        <td style="padding: 8px 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1rem;">🏷️</span>
            <div>
              <div style="color: var(--text-primary); font-weight: 600; font-size: 0.9rem; line-height: 1.2;">${
                hotlist.name
              }</div>
            </div>
          </div>
        </td>
        <td style="padding: 8px 12px;">
          <div style="color: var(--text-secondary); font-size: 0.85rem; line-height: 1.3; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${
            hotlist.description || "No description provided"
          }">
            ${
              hotlist.description ||
              '<em style="color: var(--text-secondary); opacity: 0.7;">No description provided</em>'
            }
          </div>
        </td>
        <td style="text-align: center; padding: 8px 12px;">
          <span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 600;">
            ${runCount}
          </span>
        </td>
        <td style="text-align: center; padding: 8px 12px;">
          <span style="color: var(--text-secondary); font-size: 0.8rem;">
            ${createdDate}
          </span>
        </td>
        <td onclick="event.stopPropagation();" style="text-align: center; padding: 8px 12px;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button onclick="window.dashboard.setHotlistFilter('${
              hotlist.id
            }')" style="
              background: var(--success-color);
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.7rem;
              font-weight: 600;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='var(--success-color)'" title="Filter runs by this hotlist">
              🔍
            </button>
            <button onclick="editHotlist('${hotlist.id}')" style="
              background: var(--primary-color);
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.7rem;
              font-weight: 600;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='var(--primary-dark)'" onmouseout="this.style.background='var(--primary-color)'" title="Edit hotlist">
              ✏️
            </button>
            <button onclick="deleteHotlistConfirm('${hotlist.id}')" style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 4px 8px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.7rem;
              font-weight: 600;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='var(--error-color)'" title="Delete hotlist">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `;
    });

    html += `
        </tbody>
      </table>
    </div>
    
    <!-- Bulk Actions -->
    <div id="hotlistBulkActions" style="display: none; margin-top: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <span id="selectedHotlistsCount" style="color: var(--text-secondary); font-size: 0.9rem;">0 hotlists selected</span>
        <button onclick="bulkEditHotlists()" style="
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        ">
          ✏️ Edit Selected
        </button>
        <button onclick="bulkDeleteHotlists()" style="
          background: var(--error-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        ">
          🗑️ Delete Selected
        </button>
        <button onclick="clearHotlistSelection()" style="
          background: var(--secondary-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        ">
          Clear Selection
        </button>
      </div>
    </div>
    
    <!-- Pagination Info -->
    <div id="hotlistPaginationInfo" style="
      margin-top: 15px; 
      padding: 10px; 
      text-align: center; 
      color: var(--text-secondary); 
      font-size: 0.85rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    ">
      Showing ${endIndex} of ${totalItems} hotlists
      ${
        pagination.hasMore
          ? '<div style="margin-top: 5px; color: var(--primary-color);">Scroll down to load more...</div>'
          : ""
      }
    </div>
    
    <div id="hotlistLoadingIndicator" style="
      display: none;
      text-align: center;
      padding: 15px;
      color: var(--primary-color);
      font-size: 0.8rem;
    ">
      <div style="display: inline-block; width: 16px; height: 16px; border: 2px solid var(--primary-color); border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite; margin-right: 8px;"></div>
      Loading more hotlists...
    </div>
  `;

    container.innerHTML = html;

    // Set up infinite scroll on table container
    setupHotlistInfiniteScroll(dashboard);
  } catch (error) {
    console.error("Error loading hotlists data:", error);
    container.innerHTML = `
      <div class="empty-state">
        <h3>Error loading hotlists data</h3>
        <p>Failed to load data from Firebase. Please try again.</p>
        <button onclick="updateHotlistsContainer(window.dashboard)" style="
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 10px;
        ">Retry</button>
      </div>
    `;
  }
}

function setupHotlistInfiniteScroll(dashboard) {
  const gridContainer = document.getElementById("hotlistsGrid");
  if (!gridContainer || dashboard.hotlistScrollListenerAdded) return;

  dashboard.hotlistScrollListenerAdded = true;

  gridContainer.addEventListener("scroll", () => {
    const { scrollTop, scrollHeight, clientHeight } = gridContainer;
    const pagination = dashboard.hotlistPagination;

    // Check if we're near the bottom (within 100px)
    if (
      scrollTop + clientHeight >= scrollHeight - 100 &&
      pagination.hasMore &&
      !pagination.isLoading
    ) {
      loadMoreHotlists(dashboard);
    }
  });
}

function loadMoreHotlists(dashboard) {
  const pagination = dashboard.hotlistPagination;
  const loadingIndicator = document.getElementById("hotlistLoadingIndicator");

  if (pagination.isLoading || !pagination.hasMore) return;

  pagination.isLoading = true;
  if (loadingIndicator) loadingIndicator.style.display = "block";

  // Simulate loading delay for smooth UX
  setTimeout(() => {
    pagination.currentPage++;
    pagination.isLoading = false;
    if (loadingIndicator) loadingIndicator.style.display = "none";

    // Re-render with more items
    updateHotlistsContainer(dashboard);
  }, 300);
}

function updateHotlistFilterButtons(dashboard) {
  const container = document.getElementById("hotlistFilterButtons");
  const hotlists = dashboard.getAllHotlists();
  const currentFilter = HotlistManager.getCurrentHotlistFilter();

  let html = `
    <button class="btn btn-secondary ${
      !currentFilter ? "active" : ""
    }" onclick="window.dashboard.clearHotlistFilter()">
      Show All
    </button>
  `;

  hotlists.forEach((hotlist) => {
    const isActive = currentFilter === hotlist.id;
    const runCount = hotlist.runIds.length;

    html += `
      <button class="btn btn-secondary ${
        isActive ? "active" : ""
      }" onclick="window.dashboard.setHotlistFilter('${hotlist.id}')" style="
        ${
          isActive
            ? "background: var(--primary-color); color: white; border-color: var(--primary-color);"
            : ""
        }
      ">
        🏷️ ${hotlist.name} (${runCount})
      </button>
    `;
  });

  container.innerHTML = html;
}

function updateHotlistRunsTable(dashboard) {
  const container = document.getElementById("hotlistRunsTableContent");
  const currentFilter = HotlistManager.getCurrentHotlistFilter();

  let dataToShow;
  if (currentFilter) {
    dataToShow = HotlistManager.getRunsForHotlist(
      currentFilter,
      dashboard.uploadedData
    );
  } else {
    dataToShow = dashboard.uploadedData;
  }

  if (dataToShow.length === 0) {
    const message = currentFilter
      ? "No runs found for this hotlist"
      : "No runs available";
    const description = currentFilter
      ? "This hotlist doesn't have any runs assigned to it yet."
      : "Upload performance data and assign hotlists to see filtered results here.";

    container.innerHTML = `
      <div class="empty-state">
        <h3>${message}</h3>
        <p>${description}</p>
      </div>
    `;
    return;
  }

  // Initialize pagination if not set
  if (!dashboard.hotlistTablePage) dashboard.hotlistTablePage = 1;
  if (!dashboard.hotlistTableItemsPerPage)
    dashboard.hotlistTableItemsPerPage = 10;

  // Calculate pagination
  const totalItems = dataToShow.length;
  const totalPages = Math.ceil(totalItems / dashboard.hotlistTableItemsPerPage);
  const startIndex =
    (dashboard.hotlistTablePage - 1) * dashboard.hotlistTableItemsPerPage;
  const endIndex = startIndex + dashboard.hotlistTableItemsPerPage;
  const pageData = dataToShow.slice(startIndex, endIndex);

  // Pagination controls
  let paginationHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <span style="color: var(--text-secondary); font-size: 0.9rem;">
          Showing ${startIndex + 1}-${Math.min(
    endIndex,
    totalItems
  )} of ${totalItems} runs
        </span>
        <div style="display: flex; align-items: center; gap: 8px;">
          <label style="color: var(--text-secondary); font-size: 0.9rem;">Items per page:</label>
          <select onchange="updateHotlistTableItemsPerPage(this.value)" style="
            background: var(--input-bg-color);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 0.9rem;
          ">
            <option value="10" ${
              dashboard.hotlistTableItemsPerPage === 10 ? "selected" : ""
            }>10</option>
            <option value="20" ${
              dashboard.hotlistTableItemsPerPage === 20 ? "selected" : ""
            }>20</option>
            <option value="50" ${
              dashboard.hotlistTableItemsPerPage === 50 ? "selected" : ""
            }>50</option>
            <option value="100" ${
              dashboard.hotlistTableItemsPerPage === 100 ? "selected" : ""
            }>100</option>
          </select>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px;">
        <button onclick="changeHotlistTablePage(${
          dashboard.hotlistTablePage - 1
        })" 
                ${dashboard.hotlistTablePage === 1 ? "disabled" : ""} 
                style="
                  background: var(--primary-color);
                  color: white;
                  border: none;
                  padding: 6px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 0.8rem;
                  ${
                    dashboard.hotlistTablePage === 1
                      ? "opacity: 0.5; cursor: not-allowed;"
                      : ""
                  }
                ">
          ← Previous
        </button>
        <span style="color: var(--text-secondary); font-size: 0.9rem;">
          Page ${dashboard.hotlistTablePage} of ${totalPages}
        </span>
        <button onclick="changeHotlistTablePage(${
          dashboard.hotlistTablePage + 1
        })" 
                ${dashboard.hotlistTablePage === totalPages ? "disabled" : ""} 
                style="
                  background: var(--primary-color);
                  color: white;
                  border: none;
                  padding: 6px 12px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-size: 0.8rem;
                  ${
                    dashboard.hotlistTablePage === totalPages
                      ? "opacity: 0.5; cursor: not-allowed;"
                      : ""
                  }
                ">
          Next →
        </button>
      </div>
    </div>
  `;

  let tableHtml = `
    ${paginationHtml}
    <table class="dashboard-table">
      <thead>
        <tr>
          <th>
            <input type="checkbox" id="selectAllHotlistRuns" onchange="toggleAllHotlistRunsSelection(this.checked)" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
          </th>
          <th>App Name</th>
          <th>Package Name</th>
          <th>Avg FPS</th>
          <th>Device</th>
          <th>Upload Time</th>
          <th>Hotlists</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  pageData.forEach((data) => {
    const actualDataIndex = dashboard.uploadedData.indexOf(data);
    const deviceInfo = data.deviceInfo || {};
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    const runHotlists = dashboard.getHotlistsForRun(actualDataIndex);

    let hotlistsDisplay = "";
    if (runHotlists.length > 0) {
      hotlistsDisplay = runHotlists
        .map(
          (h) => `
        <span style="
          background: var(--primary-color);
          color: white;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 0.7rem;
          margin-right: 4px;
          display: inline-block;
          margin-bottom: 2px;
        ">🏷️ ${h.name}</span>
      `
        )
        .join("");
    } else {
      hotlistsDisplay =
        '<span style="color: var(--text-secondary); font-size: 0.8rem;">No hotlists</span>';
    }

    tableHtml += `
      <tr onclick="window.openDetailedAnalysis(window.dashboard.uploadedData[${actualDataIndex}])" style="cursor: pointer;">
        <td onclick="event.stopPropagation();">
          <input type="checkbox" class="hotlist-run-checkbox" data-run-index="${actualDataIndex}" onchange="updateHotlistRunsSelection()" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
        </td>
        <td title="${
          data.appName || "N/A"
        }" style="color: var(--primary-light);">${data.appName || "N/A"}</td>
        <td title="${data.packageName || "N/A"}">${
      data.packageName || "N/A"
    }</td>
        <td><strong>${
          data.avgFps ? data.avgFps.toFixed(2) : "N/A"
        }</strong></td>
        <td title="${device}">${device}</td>
        <td title="${data.timestamp || "N/A"}">${data.timestamp || "N/A"}</td>
        <td onclick="event.stopPropagation();" style="max-width: 200px;">${hotlistsDisplay}</td>
        <td onclick="event.stopPropagation();">
          <button onclick="showHotlistAssignmentModal(${actualDataIndex})" style="
            background: var(--success-color);
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.7rem;
            font-weight: 600;
            margin-right: 4px;
          ">
            🏷️ Assign
          </button>
        </td>
      </tr>
    `;
  });

  tableHtml += `</tbody></table>`;

  // Add bulk actions if any runs are selected
  tableHtml += `
    <div id="hotlistBulkActions" style="display: none; margin-top: 15px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
      <div style="display: flex; align-items: center; gap: 15px;">
        <span id="selectedHotlistRunsCount" style="color: var(--text-secondary); font-size: 0.9rem;">0 runs selected</span>
        <button onclick="bulkAssignHotlists()" style="
          background: var(--success-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        ">
          🏷️ Bulk Assign Hotlists
        </button>
        <button onclick="clearHotlistRunsSelection()" style="
          background: var(--error-color);
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
        ">
          Clear Selection
        </button>
      </div>
    </div>
  `;

  container.innerHTML = tableHtml;
}

export function initializeHotlistsSection() {
  const createBtn = document.getElementById("createHotlistBtn");
  const cancelBtn = document.getElementById("cancelHotlistBtn");
  const saveBtn = document.getElementById("saveHotlistBtn");
  const creationSection = document.getElementById("hotlistCreationSection");

  if (createBtn) {
    createBtn.addEventListener("click", () => {
      creationSection.style.display = "block";
      document.getElementById("hotlistNameInput").focus();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      creationSection.style.display = "none";
      clearHotlistForm();
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const name = document.getElementById("hotlistNameInput").value.trim();
      const description = document
        .getElementById("hotlistDescriptionInput")
        .value.trim();

      if (!name) {
        showToast("Please enter a hotlist name", "warning");
        return;
      }

      try {
        window.dashboard.createHotlist(name, description);
        creationSection.style.display = "none";
        clearHotlistForm();
      } catch (error) {
        // Error is already handled in dashboard.createHotlist
      }
    });
  }

  // Add global functions for hotlist management
  window.editHotlist = editHotlist;
  window.deleteHotlistConfirm = deleteHotlistConfirm;
  window.showHotlistAssignmentModal = showHotlistAssignmentModal;
  window.populateRunHotlists = populateRunHotlists;
  window.closeComparisonInputDataModal = closeComparisonInputDataModal;
  window.copyComparisonInputData = copyComparisonInputData;

  // Add global functions for hotlist table pagination and selection
  window.changeHotlistTablePage = changeHotlistTablePage;
  window.updateHotlistTableItemsPerPage = updateHotlistTableItemsPerPage;
  window.toggleAllHotlistRunsSelection = toggleAllHotlistRunsSelection;
  window.updateHotlistRunsSelection = updateHotlistRunsSelection;
  window.clearHotlistRunsSelection = clearHotlistRunsSelection;
  window.bulkAssignHotlists = bulkAssignHotlists;
}

// --- All Games View ---

export async function updateGamesView(uploadedData) {
  const container = document.getElementById("allGamesContent");
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid var(--primary-color); border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite; margin-bottom: 15px;"></div>
      <div style="color: var(--text-secondary);">Loading games data from Firebase...</div>
    </div>
  `;

  try {
    // Load package name collections from Firebase
    const { firebaseService } = await import("./firebase-service.js");
    const packageCollections = await firebaseService.getAllPackageNames();

    if (packageCollections.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No games data available</h3>
          <p>Upload performance data to see game analysis here.</p>
        </div>
      `;
      return;
    }

    // Sort by total records (most tested games first)
    const sortedGames = packageCollections.sort(
      (a, b) => b.totalRecords - a.totalRecords
    );

    let html = `
      <div style="margin-bottom: 20px;">
        <h2 style="color: var(--text-primary); margin-bottom: 10px;">🎮 All Games Performance</h2>
        <p style="color: var(--text-secondary);">Comprehensive performance analysis for all tested games (${
          sortedGames.length
        } games, ${sortedGames.reduce(
      (sum, game) => sum + game.totalRecords,
      0
    )} total runs)</p>
      </div>
      <div style="display: grid; gap: 15px;">
    `;

    sortedGames.forEach((game, index) => {
      const rank = index + 1;

      html += `
        <div class="game-card" style="
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="
                  background: var(--primary-color);
                  color: white;
                  padding: 4px 8px;
                  border-radius: 12px;
                  font-size: 0.8rem;
                  font-weight: 600;
                ">#${rank}</span>
                <h3 style="color: var(--text-primary); margin: 0; font-size: 1.2rem; font-weight: 600;">
                  🎮 ${game.appName}
                </h3>
              </div>
              <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
                ${game.packageName}
              </p>
            </div>
            <div style="text-align: right;">
              <div style="
                font-size: 1.5rem;
                font-weight: bold;
                color: var(--primary-color);
              ">
                ${game.totalRecords}
              </div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">Total Runs</div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px;">
            <div style="text-align: center;">
              <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
                game.fpsDataReferences.length
              }</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">Firebase Records</div>
            </div>
            <div style="text-align: center;">
              <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${new Date(
                game.createdAt
              ).toLocaleDateString()}</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">First Tested</div>
            </div>
            <div style="text-align: center;">
              <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${new Date(
                game.updatedAt
              ).toLocaleDateString()}</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">Last Updated</div>
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <span style="color: var(--text-secondary); font-size: 0.8rem;">
              Package: ${game.packageName}
            </span>
            <div style="display: flex; gap: 8px;">
              <button onclick="filterByGame('${game.appName}')" style="
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
                transition: all 0.2s ease;
              " onmouseover="this.style.background='var(--primary-dark)'" onmouseout="this.style.background='var(--primary-color)'">
                🔍 View Runs
              </button>
              <button onclick="viewGameDetails('${game.packageName}')" style="
                background: var(--success-color);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
                transition: all 0.2s ease;
              " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='var(--success-color)'">
                📊 Details
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += "</div>";
    container.innerHTML = html;
  } catch (error) {
    console.error("Error loading games data:", error);
    container.innerHTML = `
      <div class="empty-state">
        <h3>Error loading games data</h3>
        <p>Failed to load data from Firebase. Please try again.</p>
        <button onclick="updateGamesView([])" style="
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 10px;
        ">Retry</button>
      </div>
    `;
  }
}

// --- All Devices View ---

export async function updateDevicesView(uploadedData) {
  const container = document.getElementById("allDevicesContent");
  if (!container) return;

  // Show loading state
  container.innerHTML = `
    <div style="text-align: center; padding: 40px;">
      <div style="display: inline-block; width: 32px; height: 32px; border: 3px solid var(--primary-color); border-radius: 50%; border-top-color: transparent; animation: spin 1s linear infinite; margin-bottom: 15px;"></div>
      <div style="color: var(--text-secondary);">Loading devices data from Firebase...</div>
    </div>
  `;

  try {
    // Load device collections from Firebase
    const { firebaseService } = await import("./firebase-service.js");
    const deviceCollections = await firebaseService.getAllDevices();

    if (deviceCollections.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <h3>No device data available</h3>
          <p>Upload performance data to see device analysis here.</p>
        </div>
      `;
      return;
    }

    // Sort by total records (most tested devices first)
    const sortedDevices = deviceCollections.sort(
      (a, b) => b.totalRecords - a.totalRecords
    );

    let html = `
      <div style="margin-bottom: 20px;">
        <h2 style="color: var(--text-primary); margin-bottom: 10px;">📱 All Devices Performance</h2>
        <p style="color: var(--text-secondary);">Comprehensive performance analysis for all tested devices (${
          sortedDevices.length
        } devices, ${sortedDevices.reduce(
      (sum, device) => sum + device.totalRecords,
      0
    )} total runs)</p>
      </div>
      <div style="display: grid; gap: 15px;">
    `;

    sortedDevices.forEach((device, index) => {
      const rank = index + 1;

      html += `
        <div class="device-card" style="
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.3s ease;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                <span style="
                  background: var(--primary-color);
                  color: white;
                  padding: 4px 8px;
                  border-radius: 12px;
                  font-size: 0.8rem;
                  font-weight: 600;
                ">#${rank}</span>
                <h3 style="color: var(--text-primary); margin: 0; font-size: 1.2rem; font-weight: 600;">
                  📱 ${device.oemBrand}
                </h3>
              </div>
              <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
                Models: ${device.deviceModels.join(", ")}
              </p>
            </div>
            <div style="text-align: right;">
              <div style="
                font-size: 1.5rem;
                font-weight: bold;
                color: var(--primary-color);
              ">
                ${device.totalRecords}
              </div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">Total Runs</div>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px;">
            <div style="text-align: center;">
              <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
                device.deviceModels.length
              }</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">Device Models</div>
            </div>
            <div style="text-align: center;">
              <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
                device.socModels.length
              }</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">SoC Variants</div>
            </div>
            <div style="text-align: center;">
              <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${new Date(
                device.createdAt
              ).toLocaleDateString()}</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">First Tested</div>
            </div>
            <div style="text-align: center;">
              <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${new Date(
                device.updatedAt
              ).toLocaleDateString()}</div>
              <div style="color: var(--text-secondary); font-size: 0.8rem;">Last Updated</div>
            </div>
          </div>
          
          <div style="margin-bottom: 15px;">
            <div style="color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 5px;">SoC Models:</div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${device.socModels
                .map(
                  (soc) => `
                <span style="
                  background: rgba(255, 255, 255, 0.1);
                  color: var(--text-primary);
                  padding: 2px 6px;
                  border-radius: 8px;
                  font-size: 0.7rem;
                  font-weight: 500;
                ">${soc}</span>
              `
                )
                .join("")}
            </div>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
            <span style="color: var(--text-secondary); font-size: 0.8rem;">
              ${device.fpsDataReferences.length} Firebase Records
            </span>
            <div style="display: flex; gap: 8px;">
              <button onclick="filterByDeviceBrand('${
                device.oemBrand
              }')" style="
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
                transition: all 0.2s ease;
              " onmouseover="this.style.background='var(--primary-dark)'" onmouseout="this.style.background='var(--primary-color)'">
                🔍 View Runs
              </button>
              <button onclick="viewDeviceDetails('${device.oemBrand}')" style="
                background: var(--success-color);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.8rem;
                font-weight: 600;
                transition: all 0.2s ease;
              " onmouseover="this.style.background='#059669'" onmouseout="this.style.background='var(--success-color)'">
                📊 Details
              </button>
            </div>
          </div>
        </div>
      `;
    });

    html += "</div>";
    container.innerHTML = html;
  } catch (error) {
    console.error("Error loading devices data:", error);
    container.innerHTML = `
      <div class="empty-state">
        <h3>Error loading devices data</h3>
        <p>Failed to load data from Firebase. Please try again.</p>
        <button onclick="updateDevicesView([])" style="
          background: var(--primary-color);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          margin-top: 10px;
        ">Retry</button>
      </div>
    `;
  }
}

// Global filter functions
window.filterByGame = function (gameName) {
  const dashboard = window.dashboard;
  if (dashboard) {
    // Switch to input-analysis view and apply filter
    document.querySelector('[data-view="input-analysis"]').click();
    setTimeout(() => {
      dashboard.addFilter("appName", gameName);
    }, 100);
  }
};

window.filterByDevice = function (manufacturer, model) {
  const dashboard = window.dashboard;
  if (dashboard) {
    // Switch to input-analysis view and apply filter
    document.querySelector('[data-view="input-analysis"]').click();
    setTimeout(() => {
      dashboard.addFilter("manufacturer", manufacturer);
    }, 100);
  }
};

window.filterByDeviceBrand = function (oemBrand) {
  const dashboard = window.dashboard;
  if (dashboard) {
    // Switch to input-analysis view and apply filter
    document.querySelector('[data-view="input-analysis"]').click();
    setTimeout(() => {
      dashboard.addFilter("brand", oemBrand);
    }, 100);
  }
};

window.viewGameDetails = function (packageName) {
  const dashboard = window.dashboard;
  if (dashboard) {
    // Switch to input-analysis view and apply filter
    document.querySelector('[data-view="input-analysis"]').click();
    setTimeout(() => {
      dashboard.addFilter("packageName", packageName);
    }, 100);
  }
};

window.viewDeviceDetails = function (oemBrand) {
  const dashboard = window.dashboard;
  if (dashboard) {
    // Switch to input-analysis view and apply filter
    document.querySelector('[data-view="input-analysis"]').click();
    setTimeout(() => {
      dashboard.addFilter("brand", oemBrand);
    }, 100);
  }
};

function clearHotlistForm() {
  document.getElementById("hotlistNameInput").value = "";
  document.getElementById("hotlistDescriptionInput").value = "";
}

function editHotlist(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000;
  `;

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 30px; max-width: 500px; width: 90%;">
      <h3 style="color: var(--text-primary); margin-top: 0;">Edit Hotlist</h3>
      <div style="margin-bottom: 15px;">
        <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">Hotlist Name:</label>
        <input type="text" id="editHotlistName" value="${hotlist.name}" placeholder="Enter hotlist name"
               style="width: 100%; padding: 10px 15px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; box-sizing: border-box;" />
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">Description:</label>
        <textarea id="editHotlistDescription" placeholder="Enter description for this hotlist"
                  style="width: 100%; padding: 10px 15px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; min-height: 80px; resize: vertical; box-sizing: border-box;">${hotlist.description}</textarea>
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancelEditHotlist" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button id="saveEditHotlist" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Save Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelEditHotlist").onclick = () => {
    document.body.removeChild(modal);
  };

  document.getElementById("saveEditHotlist").onclick = async () => {
    const name = document.getElementById("editHotlistName").value.trim();
    const description = document
      .getElementById("editHotlistDescription")
      .value.trim();

    if (!name) {
      showToast("Please enter a hotlist name", "warning");
      return;
    }

    try {
      await HotlistManager.updateHotlist(hotlistId, { name, description });
      showToast("Hotlist updated successfully!", "success");
      updateHotlistsView(window.dashboard);
      document.body.removeChild(modal);
    } catch (error) {
      showToast(error.message, "error");
    }
  };
}

function deleteHotlistConfirm(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  if (
    confirm(
      `Are you sure you want to delete the hotlist "${hotlist.name}"? This action cannot be undone.`
    )
  ) {
    window.dashboard.deleteHotlist(hotlistId);
  }
}

function showHotlistAssignmentModal(runIndex) {
  const dashboard = window.dashboard;
  const runData = dashboard.uploadedData[runIndex];
  if (!runData) return;

  const allHotlists = dashboard.getAllHotlists();
  const runHotlists = dashboard.getHotlistsForRun(runIndex);
  const runHotlistIds = runHotlists.map((h) => h.id);

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000;
  `;

  let hotlistsHtml = "";
  if (allHotlists.length === 0) {
    hotlistsHtml =
      '<p style="color: var(--text-secondary); text-align: center; margin: 20px 0;">No hotlists available. Create a hotlist first.</p>';
  } else {
    hotlistsHtml = allHotlists
      .map((hotlist) => {
        const isAssigned = runHotlistIds.includes(hotlist.id);
        return `
        <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); margin-bottom: 10px;">
          <input type="checkbox" id="hotlist_${hotlist.id}" ${
          isAssigned ? "checked" : ""
        } style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
          <label for="hotlist_${
            hotlist.id
          }" style="flex: 1; color: var(--text-primary); cursor: pointer;">
            <strong>🏷️ ${hotlist.name}</strong>
            ${
              hotlist.description
                ? `<br><span style="color: var(--text-secondary); font-size: 0.8rem;">${hotlist.description}</span>`
                : ""
            }
          </label>
        </div>
      `;
      })
      .join("");
  }

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 30px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <h3 style="color: var(--text-primary); margin-top: 0;">Assign Hotlists</h3>
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 5px;">Run Details:</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          <div><strong>App:</strong> ${runData.appName || "Unknown App"}</div>
          <div><strong>Package:</strong> ${
            runData.packageName || "Unknown Package"
          }</div>
          <div><strong>Avg FPS:</strong> ${runData.avgFps || "N/A"}</div>
        </div>
      </div>
      <div style="margin-bottom: 20px;">
        <h4 style="color: var(--text-primary); margin-bottom: 15px;">Select Hotlists:</h4>
        ${hotlistsHtml}
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancelAssignment" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button id="saveAssignment" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Save Assignment</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelAssignment").onclick = () => {
    document.body.removeChild(modal);
  };

  document.getElementById("saveAssignment").onclick = () => {
    // Get current assignments
    const newAssignments = [];
    allHotlists.forEach((hotlist) => {
      const checkbox = document.getElementById(`hotlist_${hotlist.id}`);
      if (checkbox && checkbox.checked) {
        newAssignments.push(hotlist.id);
      }
    });

    // Update assignments
    allHotlists.forEach((hotlist) => {
      const wasAssigned = runHotlistIds.includes(hotlist.id);
      const isNowAssigned = newAssignments.includes(hotlist.id);

      if (!wasAssigned && isNowAssigned) {
        dashboard.addRunToHotlist(hotlist.id, runIndex);
      } else if (wasAssigned && !isNowAssigned) {
        dashboard.removeRunFromHotlist(hotlist.id, runIndex);
      }
    });

    showToast("Hotlist assignments updated!", "success");
    document.body.removeChild(modal);
  };
}

// --- Firebase View ---

export function updateFirebaseView(dashboard) {
  // Update Firebase status indicators
  updateFirebaseStatus(dashboard);

  // Set up Firebase event listeners if not already done
  setupFirebaseEventListeners(dashboard);

  // Update Firebase data table
  updateFirebaseDataTable(dashboard);
}

function updateFirebaseStatus(dashboard) {
  const status = dashboard.getFirebaseStatus();

  // Update connection status
  const connectionStatus = document.getElementById("firebaseConnectionStatus");
  if (connectionStatus) {
    connectionStatus.textContent = status.connected ? "🟢" : "🔴";
  }

  // Update auto-save status
  const autoSaveStatus = document.getElementById("firebaseAutoSaveStatus");
  if (autoSaveStatus) {
    autoSaveStatus.textContent = status.autoSave ? "✅" : "❌";
  }

  // Update data counts
  const localDataCount = document.getElementById("firebaseLocalDataCount");
  if (localDataCount) {
    localDataCount.textContent = status.localDataCount;
  }

  const syncedCount = document.getElementById("firebaseSyncedCount");
  if (syncedCount) {
    syncedCount.textContent = status.firebaseMappedCount;
  }

  // Update last sync time
  const lastSync = document.getElementById("firebaseLastSync");
  if (lastSync) {
    const lastSyncTime = localStorage.getItem("firebaseLastSync");
    if (lastSyncTime) {
      const date = new Date(lastSyncTime);
      lastSync.textContent = date.toLocaleString();
    } else {
      lastSync.textContent = "Never";
    }
  }

  // Update toggle button text
  const toggleBtn = document.getElementById("toggleAutoSaveBtn");
  if (toggleBtn) {
    toggleBtn.textContent = status.autoSave ? "Disable" : "Enable";
    toggleBtn.className = status.autoSave ? "clear-btn" : "upload-btn";
  }
}

function setupFirebaseEventListeners(dashboard) {
  // Prevent duplicate event listeners
  if (window.firebaseEventListenersSetup) return;
  window.firebaseEventListenersSetup = true;

  // Auto-save toggle
  const toggleAutoSaveBtn = document.getElementById("toggleAutoSaveBtn");
  if (toggleAutoSaveBtn) {
    toggleAutoSaveBtn.addEventListener("click", () => {
      dashboard.toggleFirebaseAutoSave();
      updateFirebaseStatus(dashboard);
    });
  }

  // Manual sync
  const manualSyncBtn = document.getElementById("manualSyncBtn");
  const syncFirebaseBtn = document.getElementById("syncFirebaseBtn");

  const handleSync = async () => {
    await dashboard.syncWithFirebase();
    updateFirebaseStatus(dashboard);
    updateFirebaseDataTable(dashboard);
    localStorage.setItem("firebaseLastSync", new Date().toISOString());
  };

  if (manualSyncBtn) {
    manualSyncBtn.addEventListener("click", handleSync);
  }
  if (syncFirebaseBtn) {
    syncFirebaseBtn.addEventListener("click", handleSync);
  }

  // Load from Firebase
  const loadFromFirebaseBtn = document.getElementById("loadFromFirebaseBtn");
  if (loadFromFirebaseBtn) {
    loadFromFirebaseBtn.addEventListener("click", async () => {
      if (
        confirm(
          "This will replace all local data with data from Firebase. Continue?"
        )
      ) {
        await dashboard.loadDataFromFirebase();
        updateFirebaseStatus(dashboard);
        updateFirebaseDataTable(dashboard);
        localStorage.setItem("firebaseLastSync", new Date().toISOString());
      }
    });
  }

  // Clear local data
  const clearLocalDataBtn = document.getElementById("clearLocalDataBtn");
  if (clearLocalDataBtn) {
    clearLocalDataBtn.addEventListener("click", () => {
      if (
        confirm(
          "This will clear all local data. Firebase data will remain safe. Continue?"
        )
      ) {
        dashboard.clearAllData();
        updateFirebaseStatus(dashboard);
        updateFirebaseDataTable(dashboard);
      }
    });
  }

  // Refresh status
  const refreshFirebaseDataBtn = document.getElementById(
    "refreshFirebaseDataBtn"
  );
  if (refreshFirebaseDataBtn) {
    refreshFirebaseDataBtn.addEventListener("click", () => {
      updateFirebaseStatus(dashboard);
      updateFirebaseDataTable(dashboard);
      showToast("Firebase status refreshed", "info");
    });
  }

  // Export Firebase data
  const exportFirebaseDataBtn = document.getElementById(
    "exportFirebaseDataBtn"
  );
  if (exportFirebaseDataBtn) {
    exportFirebaseDataBtn.addEventListener("click", async () => {
      try {
        dashboard.showLoading();
        const firebaseData =
          (await dashboard.firebaseService?.loadAllFPSData()) || [];

        if (firebaseData.length === 0) {
          showToast("No Firebase data to export", "warning");
          return;
        }

        const dataStr = JSON.stringify(firebaseData, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(dataBlob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `firebase-fps-data-${
          new Date().toISOString().split("T")[0]
        }.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast("Firebase data exported successfully", "success");
      } catch (error) {
        console.error("Export error:", error);
        showToast("Failed to export Firebase data", "error");
      } finally {
        dashboard.hideLoading();
      }
    });
  }

  // View sync logs
  const viewFirebaseLogsBtn = document.getElementById("viewFirebaseLogsBtn");
  if (viewFirebaseLogsBtn) {
    viewFirebaseLogsBtn.addEventListener("click", () => {
      showFirebaseLogs();
    });
  }
}

function updateFirebaseDataTable(dashboard) {
  const container = document.getElementById("firebaseDataTableContent");
  if (!container) return;

  const status = dashboard.getFirebaseStatus();

  if (status.localDataCount === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No data available</h3>
        <p>Upload data or sync with Firebase to see cloud storage contents here.</p>
      </div>
    `;
    return;
  }

  // Show local data with Firebase sync status
  let tableHtml = `
    <table class="dashboard-table">
      <thead>
        <tr>
          <th>App Name</th>
          <th>Package Name</th>
          <th>Avg FPS</th>
          <th>Device</th>
          <th>Upload Time</th>
          <th>Firebase Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  dashboard.uploadedData.forEach((data, index) => {
    const deviceInfo = data.deviceInfo || {};
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    const isSynced = dashboard.firebaseDataIds.has(index);
    const firebaseId = dashboard.firebaseDataIds.get(index);

    tableHtml += `
      <tr>
        <td title="${
          data.appName || "N/A"
        }" style="color: var(--primary-light);">${data.appName || "N/A"}</td>
        <td title="${data.packageName || "N/A"}">${
      data.packageName || "N/A"
    }</td>
        <td><strong>${
          data.avgFps ? data.avgFps.toFixed(2) : "N/A"
        }</strong></td>
        <td title="${device}">${device}</td>
        <td title="${data.timestamp || "N/A"}">${data.timestamp || "N/A"}</td>
        <td>
          ${
            isSynced
              ? `<span style="color: var(--success-color); font-weight: 600;">✅ Synced</span><br><span style="color: var(--text-secondary); font-size: 0.7rem;">${firebaseId}</span>`
              : `<span style="color: var(--warning-color); font-weight: 600;">⏳ Local Only</span>`
          }
        </td>
        <td>
          ${
            !isSynced
              ? `<button onclick="syncSingleRecord(${index})" style="
                background: var(--success-color);
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.7rem;
                font-weight: 600;
                margin-right: 4px;
              ">
                🔄 Sync
              </button>`
              : `<button onclick="viewFirebaseRecord('${firebaseId}')" style="
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.7rem;
                font-weight: 600;
                margin-right: 4px;
              ">
                👁️ View
              </button>`
          }
        </td>
      </tr>
    `;
  });

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
}

function showFirebaseLogs() {
  const logs = JSON.parse(localStorage.getItem("firebaseLogs") || "[]");

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000; padding: 20px;
  `;

  let logsHtml = "";
  if (logs.length === 0) {
    logsHtml =
      '<p style="color: var(--text-secondary); text-align: center;">No sync logs available</p>';
  } else {
    logsHtml = logs
      .slice(-50)
      .reverse()
      .map(
        (log) => `
      <div style="
        padding: 10px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 6px;
        border-left: 3px solid ${
          log.type === "error"
            ? "var(--error-color)"
            : log.type === "success"
            ? "var(--success-color)"
            : "var(--primary-color)"
        };
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
          <span style="color: var(--text-primary); font-weight: 600; font-size: 0.9rem;">${
            log.action
          }</span>
          <span style="color: var(--text-secondary); font-size: 0.8rem;">${new Date(
            log.timestamp
          ).toLocaleString()}</span>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.85rem;">${
          log.message
        }</div>
        ${
          log.details
            ? `<div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 5px; font-family: 'Roboto Mono', monospace;">${log.details}</div>`
            : ""
        }
      </div>
    `
      )
      .join("");
  }

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 30px; max-width: 800px; width: 95%; max-height: 80vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0;">🔥 Firebase Sync Logs</h3>
        <button onclick="closeFirebaseLogsModal()" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); font-size: 1.5rem; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      <div style="max-height: 60vh; overflow-y: auto;">
        ${logsHtml}
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
        <button onclick="clearFirebaseLogs()" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--error-color); color: white; cursor: pointer; font-weight: 600;">🗑️ Clear Logs</button>
        <button onclick="closeFirebaseLogsModal()" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer; font-weight: 600;">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentFirebaseLogsModal = modal;
}

// Global hotlist functions for inline chip management
window.addHotlistToRun = function (hotlistId, runIndex) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  try {
    dashboard.addRunToHotlist(hotlistId, runIndex);
    populateRunHotlists(currentAnalysisData);
    showToast("Added to hotlist", "success");
  } catch (error) {
    console.error("Add hotlist error:", error);
    showToast("Failed to add to hotlist", "error");
  }
};

window.removeHotlistFromRun = function (hotlistId, runIndex) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  try {
    dashboard.removeRunFromHotlist(hotlistId, runIndex);
    populateRunHotlists(currentAnalysisData);
    showToast("Removed from hotlist", "success");
  } catch (error) {
    console.error("Remove hotlist error:", error);
    showToast("Failed to remove from hotlist", "error");
  }
};

window.showHotlistSelectionPopup = function (runIndex) {
  const dashboard = window.dashboard;
  const allHotlists = dashboard.getAllHotlists();
  const runHotlists = dashboard.getHotlistsForRun(runIndex);
  const assignedHotlistIds = runHotlists.map((h) => h.id);
  const availableHotlists = allHotlists.filter(
    (h) => !assignedHotlistIds.includes(h.id)
  );

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000;
  `;

  let contentHtml = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 20px; width: 450px; max-height: 600px; overflow: hidden; display: flex; flex-direction: column;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0; font-size: 1.1rem;">Add Hotlist</h3>
        <button onclick="closeHotlistSelectionPopup()" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); font-size: 1.2rem; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      
      <!-- Create new hotlist option at top -->
      <button onclick="showCreateHotlistInPopup(${runIndex})" style="
        width: 100%;
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 15px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: all 0.3s ease;
        flex-shrink: 0;
      " onmouseover="this.style.background='var(--primary-dark)'" onmouseout="this.style.background='var(--primary-color)'">
        ➕ Create New Hotlist
      </button>
      
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 15px; flex: 1; display: flex; flex-direction: column; min-height: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="color: var(--text-primary); margin: 0; font-size: 0.9rem;">Available Hotlists:</h4>
          <span id="hotlistCount" style="color: var(--text-secondary); font-size: 0.8rem;">${availableHotlists.length} available</span>
        </div>
        
        <!-- Search filter -->
        <div style="margin-bottom: 15px; flex-shrink: 0;">
          <input type="text" id="hotlistSearchInput" placeholder="🔍 Search hotlists..." 
                 style="width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; font-size: 0.85rem; box-sizing: border-box;"
                 oninput="filterHotlistsInPopup()" />
        </div>
        
        <!-- Hotlists container with scroll -->
        <div id="hotlistsContainer" style="flex: 1; overflow-y: auto; min-height: 0;">
  `;

  if (availableHotlists.length === 0) {
    contentHtml += `
      <p style="color: var(--text-secondary); text-align: center; margin: 20px 0; font-size: 0.9rem;">
        All available hotlists are already assigned to this run.
      </p>
    `;
  } else {
    availableHotlists.forEach((hotlist) => {
      contentHtml += `
        <button class="hotlist-item" data-name="${hotlist.name.toLowerCase()}" data-description="${(
        hotlist.description || ""
      ).toLowerCase()}" onclick="addHotlistToRun('${
        hotlist.id
      }', ${runIndex}); closeHotlistSelectionPopup();" style="
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: var(--text-primary);
          padding: 10px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.85rem;
          margin-bottom: 8px;
          text-align: left;
          transition: all 0.3s ease;
          display: block;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'; this.style.borderColor='var(--primary-color)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'; this.style.borderColor='rgba(255, 255, 255, 0.2)'">
          <div style="font-weight: 600;">🏷️ ${hotlist.name}</div>
          ${
            hotlist.description
              ? `<div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 2px;">${hotlist.description}</div>`
              : ""
          }
        </button>
      `;
    });
  }

  contentHtml += `
        </div>
        
        <!-- No results message (hidden by default) -->
        <div id="noHotlistResults" style="display: none; color: var(--text-secondary); text-align: center; margin: 20px 0; font-size: 0.9rem;">
          <div style="margin-bottom: 8px;">🔍 No hotlists found</div>
          <div style="font-size: 0.8rem;">Try adjusting your search terms</div>
        </div>
      </div>
    </div>
  `;

  modal.innerHTML = contentHtml;
  document.body.appendChild(modal);
  window.currentHotlistSelectionModal = modal;

  // Store available hotlists for filtering
  window.currentAvailableHotlists = availableHotlists;

  // Focus on search input
  setTimeout(() => {
    const searchInput = document.getElementById("hotlistSearchInput");
    if (searchInput) {
      searchInput.focus();
    }
  }, 100);
};

window.closeHotlistSelectionPopup = function () {
  if (window.currentHotlistSelectionModal) {
    document.body.removeChild(window.currentHotlistSelectionModal);
    window.currentHotlistSelectionModal = null;
  }
};

window.showCreateHotlistInPopup = function (runIndex) {
  // Close the selection popup first
  closeHotlistSelectionPopup();

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000;
  `;

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 25px; width: 400px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h3 style="color: var(--text-primary); margin: 0; font-size: 1.1rem;">Create New Hotlist</h3>
        <button onclick="closeCreateHotlistPopup()" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); font-size: 1.2rem; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">&times;</button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">Hotlist Name:</label>
        <input type="text" id="popupHotlistName" placeholder="Enter hotlist name"
               style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; box-sizing: border-box;" />
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; color: var(--text-primary); margin-bottom: 5px; font-size: 0.9rem;">Description (optional):</label>
        <textarea id="popupHotlistDescription" placeholder="Enter description"
                  style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-family: 'Inter', sans-serif; min-height: 60px; resize: vertical; box-sizing: border-box;"></textarea>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button onclick="closeCreateHotlistPopup()" style="padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer; font-size: 0.9rem;">Cancel</button>
        <button onclick="createHotlistAndAssign(${runIndex})" style="padding: 8px 16px; border-radius: 6px; border: none; background: var(--primary-color); color: white; cursor: pointer; font-size: 0.9rem; font-weight: 600;">Create & Assign</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  window.currentCreateHotlistModal = modal;

  // Focus on the name input
  setTimeout(() => {
    document.getElementById("popupHotlistName").focus();
  }, 100);
};

window.closeCreateHotlistPopup = function () {
  if (window.currentCreateHotlistModal) {
    document.body.removeChild(window.currentCreateHotlistModal);
    window.currentCreateHotlistModal = null;
  }
};

window.createHotlistAndAssign = function (runIndex) {
  const name = document.getElementById("popupHotlistName").value.trim();
  const description = document
    .getElementById("popupHotlistDescription")
    .value.trim();

  if (!name) {
    showToast("Please enter a hotlist name", "warning");
    return;
  }

  try {
    const dashboard = window.dashboard;
    const hotlistId = dashboard.createHotlist(name, description);
    dashboard.addRunToHotlist(hotlistId, runIndex);
    populateRunHotlists(currentAnalysisData);
    closeCreateHotlistPopup();
    showToast(`Created "${name}" and assigned to run`, "success");
  } catch (error) {
    console.error("Create hotlist error:", error);
    showToast("Failed to create hotlist", "error");
  }
};

// Global function for filtering hotlists in the popup
window.filterHotlistsInPopup = function () {
  const searchInput = document.getElementById("hotlistSearchInput");
  const hotlistItems = document.querySelectorAll(".hotlist-item");
  const noResultsMessage = document.getElementById("noHotlistResults");
  const hotlistCount = document.getElementById("hotlistCount");

  if (!searchInput || !hotlistItems || !noResultsMessage || !hotlistCount)
    return;

  const searchTerm = searchInput.value.toLowerCase().trim();
  let visibleCount = 0;

  hotlistItems.forEach((item) => {
    const name = item.getAttribute("data-name") || "";
    const description = item.getAttribute("data-description") || "";

    const matches =
      name.includes(searchTerm) || description.includes(searchTerm);

    if (matches) {
      item.style.display = "block";
      visibleCount++;
    } else {
      item.style.display = "none";
    }
  });

  // Update count and show/hide no results message
  hotlistCount.textContent = `${visibleCount} available`;

  if (visibleCount === 0 && searchTerm !== "") {
    noResultsMessage.style.display = "block";
  } else {
    noResultsMessage.style.display = "none";
  }
};

// Global function for filtering hotlist table
window.filterHotlistTable = function () {
  const searchInput = document.getElementById("hotlistSearchInput");
  const hotlistRows = document.querySelectorAll(".hotlist-row");

  if (!searchInput || !hotlistRows) return;

  const searchTerm = searchInput.value.toLowerCase().trim();
  let visibleCount = 0;

  hotlistRows.forEach((row) => {
    const name = row.getAttribute("data-name") || "";
    const description = row.getAttribute("data-description") || "";

    const matches =
      name.includes(searchTerm) || description.includes(searchTerm);

    if (matches) {
      row.style.display = "table-row";
      visibleCount++;
    } else {
      row.style.display = "none";
    }
  });
};

// Global functions for hotlist table selection
window.toggleAllHotlistsSelection = function (checked) {
  const checkboxes = document.querySelectorAll(".hotlist-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = checked;
  });
  updateHotlistSelection();
};

window.updateHotlistSelection = function () {
  const checkboxes = document.querySelectorAll(".hotlist-checkbox");
  const checkedBoxes = document.querySelectorAll(".hotlist-checkbox:checked");
  const selectAllCheckbox = document.getElementById("selectAllHotlists");
  const bulkActions = document.getElementById("hotlistBulkActions");
  const selectedCount = document.getElementById("selectedHotlistsCount");

  // Update select all checkbox state
  if (selectAllCheckbox) {
    if (checkedBoxes.length === 0) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = false;
    } else if (checkedBoxes.length === checkboxes.length) {
      selectAllCheckbox.indeterminate = false;
      selectAllCheckbox.checked = true;
    } else {
      selectAllCheckbox.indeterminate = true;
      selectAllCheckbox.checked = false;
    }
  }

  // Show/hide bulk actions
  if (bulkActions && selectedCount) {
    if (checkedBoxes.length > 0) {
      bulkActions.style.display = "block";
      selectedCount.textContent = `${checkedBoxes.length} hotlists selected`;
    } else {
      bulkActions.style.display = "none";
    }
  }
};

window.clearHotlistSelection = function () {
  const checkboxes = document.querySelectorAll(".hotlist-checkbox");
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
  });
  updateHotlistSelection();
};

window.bulkEditHotlists = function () {
  const checkedBoxes = document.querySelectorAll(".hotlist-checkbox:checked");
  if (checkedBoxes.length === 0) {
    showToast("No hotlists selected", "warning");
    return;
  }

  const selectedHotlistIds = Array.from(checkedBoxes).map((checkbox) =>
    checkbox.getAttribute("data-hotlist-id")
  );

  // Get the selected hotlists data
  const dashboard = window.dashboard;
  const selectedHotlists = selectedHotlistIds
    .map((id) => HotlistManager.getHotlistById(id))
    .filter(Boolean);

  if (selectedHotlists.length === 0) {
    showToast("Selected hotlists not found", "error");
    return;
  }

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3000;
  `;

  // Show current hotlists being edited
  let hotlistsListHtml = selectedHotlists
    .map(
      (hotlist) => `
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 10px; margin-bottom: 8px;">
        <div style="color: var(--text-primary); font-weight: 600; font-size: 0.9rem;">🏷️ ${
          hotlist.name
        }</div>
        <div style="color: var(--text-secondary); font-size: 0.8rem;">${
          hotlist.description || "No description"
        }</div>
        <div style="color: var(--text-secondary); font-size: 0.7rem; margin-top: 4px;">${
          hotlist.runIds.length
        } runs</div>
      </div>
    `
    )
    .join("");

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 30px; max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <h3 style="color: var(--text-primary); margin-top: 0;">Bulk Edit Hotlists</h3>
      
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 10px;">Selected Hotlists (${selectedHotlists.length}):</div>
        <div style="max-height: 150px; overflow-y: auto;">
          ${hotlistsListHtml}
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h4 style="color: var(--text-primary); margin-bottom: 15px;">Edit Options:</h4>
        
        <div style="margin-bottom: 15px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="bulkEditNames" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
            <span style="color: var(--text-primary); font-weight: 500;">Update Names (add prefix/suffix)</span>
          </label>
          <div id="nameEditOptions" style="display: none; margin-top: 10px; margin-left: 24px;">
            <div style="display: flex; gap: 10px; margin-bottom: 8px;">
              <input type="text" id="namePrefix" placeholder="Prefix" style="flex: 1; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-size: 0.85rem;" />
              <input type="text" id="nameSuffix" placeholder="Suffix" style="flex: 1; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-size: 0.85rem;" />
            </div>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="bulkEditDescriptions" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
            <span style="color: var(--text-primary); font-weight: 500;">Update Descriptions</span>
          </label>
          <div id="descriptionEditOptions" style="display: none; margin-top: 10px; margin-left: 24px;">
            <div style="margin-bottom: 8px;">
              <label style="display: block; color: var(--text-secondary); font-size: 0.8rem; margin-bottom: 4px;">Action:</label>
              <select id="descriptionAction" style="width: 100%; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-size: 0.85rem;">
                <option value="replace">Replace all descriptions</option>
                <option value="append">Append to existing descriptions</option>
                <option value="prepend">Prepend to existing descriptions</option>
              </select>
            </div>
            <textarea id="newDescription" placeholder="Enter new description text" style="width: 100%; padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-size: 0.85rem; min-height: 60px; resize: vertical; box-sizing: border-box;"></textarea>
          </div>
        </div>

        <div style="margin-bottom: 15px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="bulkMergeHotlists" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
            <span style="color: var(--text-primary); font-weight: 500;">Merge all selected hotlists into one</span>
          </label>
          <div id="mergeOptions" style="display: none; margin-top: 10px; margin-left: 24px;">
            <input type="text" id="mergedHotlistName" placeholder="Name for merged hotlist" style="width: 100%; padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-size: 0.85rem; margin-bottom: 8px; box-sizing: border-box;" />
            <textarea id="mergedHotlistDescription" placeholder="Description for merged hotlist" style="width: 100%; padding: 8px 10px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--input-bg-color); color: var(--text-primary); font-size: 0.85rem; min-height: 50px; resize: vertical; box-sizing: border-box;"></textarea>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancelBulkEdit" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button id="saveBulkEdit" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Apply Changes</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Set up event listeners for showing/hiding options
  document.getElementById("bulkEditNames").onchange = function () {
    document.getElementById("nameEditOptions").style.display = this.checked
      ? "block"
      : "none";
  };

  document.getElementById("bulkEditDescriptions").onchange = function () {
    document.getElementById("descriptionEditOptions").style.display = this
      .checked
      ? "block"
      : "none";
  };

  document.getElementById("bulkMergeHotlists").onchange = function () {
    document.getElementById("mergeOptions").style.display = this.checked
      ? "block"
      : "none";
    // Disable other options when merge is selected
    const nameCheckbox = document.getElementById("bulkEditNames");
    const descCheckbox = document.getElementById("bulkEditDescriptions");
    if (this.checked) {
      nameCheckbox.disabled = true;
      descCheckbox.disabled = true;
      nameCheckbox.checked = false;
      descCheckbox.checked = false;
      document.getElementById("nameEditOptions").style.display = "none";
      document.getElementById("descriptionEditOptions").style.display = "none";
    } else {
      nameCheckbox.disabled = false;
      descCheckbox.disabled = false;
    }
  };

  document.getElementById("cancelBulkEdit").onclick = () => {
    document.body.removeChild(modal);
  };

  document.getElementById("saveBulkEdit").onclick = async () => {
    const editNames = document.getElementById("bulkEditNames").checked;
    const editDescriptions = document.getElementById(
      "bulkEditDescriptions"
    ).checked;
    const mergeHotlists = document.getElementById("bulkMergeHotlists").checked;

    if (!editNames && !editDescriptions && !mergeHotlists) {
      showToast("Please select at least one edit option", "warning");
      return;
    }

    try {
      if (mergeHotlists) {
        // Merge hotlists
        const mergedName = document
          .getElementById("mergedHotlistName")
          .value.trim();
        const mergedDescription = document
          .getElementById("mergedHotlistDescription")
          .value.trim();

        if (!mergedName) {
          showToast("Please enter a name for the merged hotlist", "warning");
          return;
        }

        // Collect all run IDs from selected hotlists
        const allRunIds = new Set();
        selectedHotlists.forEach((hotlist) => {
          hotlist.runIds.forEach((runId) => allRunIds.add(runId));
        });

        // Create new merged hotlist
        const mergedHotlist = await dashboard.createHotlist(
          mergedName,
          mergedDescription
        );

        // Add all runs to the new hotlist
        for (const runId of allRunIds) {
          await dashboard.addRunToHotlist(mergedHotlist.id, runId);
        }

        // Delete original hotlists
        for (const hotlist of selectedHotlists) {
          await dashboard.deleteHotlist(hotlist.id);
        }

        showToast(
          `Successfully merged ${selectedHotlists.length} hotlists into "${mergedName}"`,
          "success"
        );
      } else {
        // Individual edits
        let updatedCount = 0;

        for (const hotlist of selectedHotlists) {
          const updates = {};

          if (editNames) {
            const prefix = document.getElementById("namePrefix").value.trim();
            const suffix = document.getElementById("nameSuffix").value.trim();
            updates.name = `${prefix}${hotlist.name}${suffix}`;
          }

          if (editDescriptions) {
            const action = document.getElementById("descriptionAction").value;
            const newDesc = document
              .getElementById("newDescription")
              .value.trim();

            if (newDesc) {
              switch (action) {
                case "replace":
                  updates.description = newDesc;
                  break;
                case "append":
                  updates.description = `${
                    hotlist.description || ""
                  } ${newDesc}`.trim();
                  break;
                case "prepend":
                  updates.description = `${newDesc} ${
                    hotlist.description || ""
                  }`.trim();
                  break;
              }
            }
          }

          if (Object.keys(updates).length > 0) {
            await HotlistManager.updateHotlist(hotlist.id, updates);
            updatedCount++;
          }
        }

        showToast(`Successfully updated ${updatedCount} hotlists`, "success");
      }

      document.body.removeChild(modal);
      clearHotlistSelection();
      updateHotlistsView(dashboard);
    } catch (error) {
      console.error("Bulk edit error:", error);
      showToast("Failed to apply bulk edits", "error");
    }
  };
};

window.bulkDeleteHotlists = function () {
  const checkedBoxes = document.querySelectorAll(".hotlist-checkbox:checked");
  if (checkedBoxes.length === 0) {
    showToast("No hotlists selected", "warning");
    return;
  }

  const selectedHotlistIds = Array.from(checkedBoxes).map((checkbox) =>
    checkbox.getAttribute("data-hotlist-id")
  );

  if (
    confirm(
      `Are you sure you want to delete ${selectedHotlistIds.length} hotlists? This action cannot be undone.`
    )
  ) {
    const dashboard = window.dashboard;
    let deletedCount = 0;

    selectedHotlistIds.forEach((hotlistId) => {
      try {
        dashboard.deleteHotlist(hotlistId);
        deletedCount++;
      } catch (error) {
        console.error("Delete hotlist error:", error);
      }
    });

    showToast(`Successfully deleted ${deletedCount} hotlists`, "success");
    clearHotlistSelection();
  }
};

// --- Selection Details Modal Functions ---

export function openSelectionDetailsModal() {
  const dashboard = window.dashboard;
  if (!dashboard || dashboard.selectedForComparison.size === 0) {
    showToast("No items selected", "warning");
    return;
  }

  const modal = document.getElementById("selectionDetailsModal");
  const selectedData = Array.from(dashboard.selectedForComparison).map(
    (index) => dashboard.uploadedData[index]
  );

  // Update count
  document.getElementById("selectionDetailsCount").textContent =
    selectedData.length;

  // Populate selected items list
  populateSelectionDetailsList(selectedData, dashboard);

  // Set up event listeners
  setupSelectionDetailsEventListeners(dashboard);

  modal.classList.add("show");
  document.body.style.overflow = "hidden";
}

function populateSelectionDetailsList(selectedData, dashboard) {
  const container = document.getElementById("selectionDetailsList");

  let html = "";
  selectedData.forEach((data, index) => {
    const actualIndex = dashboard.uploadedData.indexOf(data);
    const deviceInfo = data.deviceInfo || {};
    const device = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;
    const oemBrand =
      deviceInfo["ro.oem.brand"] ||
      deviceInfo["ro.product.manufacturer"] ||
      "Unknown";

    html += `
      <div class="selected-item-card" style="
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 15px;
        margin-bottom: 10px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.3s ease;
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span style="font-size: 1.2rem;">📱</span>
              <div>
                <div style="color: var(--text-primary); font-weight: 600; font-size: 1rem;">
                  ${data.appName || "Unknown App"}
                </div>
                <div style="color: var(--text-secondary); font-size: 0.8rem;">
                  ${data.packageName || "Unknown Package"}
                </div>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 10px;">
              <div>
                <div style="color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;">Avg FPS</div>
                <div style="color: var(--primary-light); font-weight: 600; font-size: 0.9rem;">${
                  data.avgFps ? data.avgFps.toFixed(1) : "N/A"
                }</div>
              </div>
              <div>
                <div style="color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;">Duration</div>
                <div style="color: var(--text-primary); font-weight: 500; font-size: 0.9rem;">${
                  data.elapsedTimeSeconds
                    ? data.elapsedTimeSeconds.toFixed(1) + "s"
                    : "N/A"
                }</div>
              </div>
              <div>
                <div style="color: var(--text-secondary); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;">Device Brand</div>
                <div style="color: var(--text-primary); font-weight: 500; font-size: 0.9rem;">${oemBrand}</div>
              </div>
            </div>
            
            <div style="color: var(--text-secondary); font-size: 0.8rem;">
              <strong>Device:</strong> ${device}
            </div>
          </div>
          
          <button onclick="removeFromSelectionDetails(${actualIndex})" style="
            background: var(--error-color);
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.8rem;
            font-weight: 600;
            transition: all 0.2s ease;
            margin-left: 15px;
          " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='var(--error-color)'" title="Remove from selection">
            ✕ Remove
          </button>
        </div>
      </div>
    `;
  });

  if (html === "") {
    html = `
      <div class="empty-state">
        <h3>No items selected</h3>
        <p>Select items from the main table to see them here.</p>
      </div>
    `;
  }

  container.innerHTML = html;
}

function setupSelectionDetailsEventListeners(dashboard) {
  // Close button
  const closeBtn = document.getElementById("closeSelectionDetailsBtn");
  closeBtn.onclick = closeSelectionDetailsModal;

  // Clear all selection
  const clearAllBtn = document.getElementById("clearAllSelectionBtn");
  clearAllBtn.onclick = () => {
    dashboard.selectedForComparison.clear();
    updateCompareControls(dashboard);
    closeSelectionDetailsModal();
    showToast("Selection cleared", "info");
  };

  // Bulk delete
  const bulkDeleteBtn = document.getElementById("bulkDeleteFromSelectionBtn");
  bulkDeleteBtn.onclick = () => deleteSelectedItems();

  // Compare selected from modal
  const compareBtn = document.getElementById("compareSelectedFromModal");
  compareBtn.onclick = () => {
    if (dashboard.selectedForComparison.size >= 2) {
      closeSelectionDetailsModal();
      openComparisonModal(dashboard);
    } else {
      showToast("Please select at least 2 items to compare", "warning");
    }
  };

  // Export selected data
  const exportBtn = document.getElementById("exportSelectedData");
  exportBtn.onclick = () => exportSelectedData(dashboard);

  // Add to hotlist bulk
  const hotlistBtn = document.getElementById("addToHotlistBulk");
  hotlistBtn.onclick = () => addSelectedToHotlistBulk(dashboard);
}

function closeSelectionDetailsModal() {
  const modal = document.getElementById("selectionDetailsModal");
  modal.classList.remove("show");
  document.body.style.overflow = "";
}

// Global function to remove item from selection details
window.removeFromSelectionDetails = function (index) {
  const dashboard = window.dashboard;
  if (dashboard) {
    dashboard.selectedForComparison.delete(index);
    updateCompareControls(dashboard);

    // Update the modal content
    if (dashboard.selectedForComparison.size === 0) {
      closeSelectionDetailsModal();
    } else {
      const selectedData = Array.from(dashboard.selectedForComparison).map(
        (idx) => dashboard.uploadedData[idx]
      );
      document.getElementById("selectionDetailsCount").textContent =
        selectedData.length;
      populateSelectionDetailsList(selectedData, dashboard);
    }

    showToast("Item removed from selection", "info");
  }
};

// Global function to delete selected items
window.deleteSelectedItems = async function () {
  const dashboard = window.dashboard;
  if (!dashboard || dashboard.selectedForComparison.size === 0) {
    showToast("No items selected for deletion", "warning");
    return;
  }

  // Check authentication ONCE for bulk operation
  if (!dashboard.isAuthenticated) {
    const authenticated = await showAuthenticationModal(dashboard);
    if (!authenticated) {
      return;
    }
  }

  const selectedIndices = Array.from(dashboard.selectedForComparison).sort(
    (a, b) => b - a
  ); // Sort in descending order
  const itemCount = selectedIndices.length;

  if (
    !confirm(
      `Are you sure you want to delete ${itemCount} selected item${
        itemCount > 1 ? "s" : ""
      }? This action cannot be undone.`
    )
  ) {
    return;
  }

  try {
    dashboard.showLoading();

    // Delete items in reverse order to maintain correct indices
    // Use the bulk delete method to avoid individual confirmations
    for (const index of selectedIndices) {
      // Call the internal delete method directly without authentication checks
      await dashboard.deleteAnalysisResultInternal(index);
    }

    // Clear selection
    dashboard.selectedForComparison.clear();
    updateCompareControls(dashboard);

    // Close modal if open
    const modal = document.getElementById("selectionDetailsModal");
    if (modal.classList.contains("show")) {
      closeSelectionDetailsModal();
    }

    showToast(
      `Successfully deleted ${itemCount} item${itemCount > 1 ? "s" : ""}`,
      "success"
    );
  } catch (error) {
    console.error("Error deleting selected items:", error);
    showToast("Failed to delete some items", "error");
  } finally {
    dashboard.hideLoading();
  }
};

function exportSelectedData(dashboard) {
  const selectedData = Array.from(dashboard.selectedForComparison).map(
    (index) => dashboard.uploadedData[index]
  );

  if (selectedData.length === 0) {
    showToast("No items selected for export", "warning");
    return;
  }

  try {
    const dataStr = JSON.stringify(selectedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `selected-fps-data-${
      new Date().toISOString().split("T")[0]
    }.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${selectedData.length} selected items`, "success");
  } catch (error) {
    console.error("Export error:", error);
    showToast("Failed to export selected data", "error");
  }
}

function addSelectedToHotlistBulk(dashboard) {
  const selectedIndices = Array.from(dashboard.selectedForComparison);

  if (selectedIndices.length === 0) {
    showToast("No items selected", "warning");
    return;
  }

  const allHotlists = dashboard.getAllHotlists();

  if (allHotlists.length === 0) {
    showToast("No hotlists available. Create a hotlist first.", "warning");
    return;
  }

  const modal = document.createElement("div");
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
    display: flex; justify-content: center; align-items: center; z-index: 3500;
  `;

  let hotlistsHtml = allHotlists
    .map(
      (hotlist) => `
      <div style="display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 8px; background: rgba(255, 255, 255, 0.05); margin-bottom: 10px;">
        <input type="checkbox" id="bulk_hotlist_${
          hotlist.id
        }" style="width: 16px; height: 16px; accent-color: var(--primary-color);" />
        <label for="bulk_hotlist_${
          hotlist.id
        }" style="flex: 1; color: var(--text-primary); cursor: pointer;">
          <strong>🏷️ ${hotlist.name}</strong>
          ${
            hotlist.description
              ? `<br><span style="color: var(--text-secondary); font-size: 0.8rem;">${hotlist.description}</span>`
              : ""
          }
        </label>
      </div>
    `
    )
    .join("");

  modal.innerHTML = `
    <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                 padding: 30px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
      <h3 style="color: var(--text-primary); margin-top: 0;">Add Selected Items to Hotlists</h3>
      <div style="background: rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <div style="color: var(--text-primary); font-weight: 600; margin-bottom: 5px;">Selected Items:</div>
        <div style="color: var(--text-secondary); font-size: 0.9rem;">
          ${selectedIndices.length} items selected for hotlist assignment
        </div>
      </div>
      <div style="margin-bottom: 20px;">
        <h4 style="color: var(--text-primary); margin-bottom: 15px;">Select Hotlists:</h4>
        ${hotlistsHtml}
      </div>
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancelBulkHotlistAssignment" style="padding: 10px 20px; border-radius: var(--btn-radius); border: 1px solid var(--border-color); background: transparent; color: var(--text-primary); cursor: pointer;">Cancel</button>
        <button id="saveBulkHotlistAssignment" style="padding: 10px 20px; border-radius: var(--btn-radius); border: none; background: var(--primary-color); color: white; cursor: pointer;">Add to Selected Hotlists</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("cancelBulkHotlistAssignment").onclick = () => {
    document.body.removeChild(modal);
  };

  document.getElementById("saveBulkHotlistAssignment").onclick = () => {
    const selectedHotlists = [];
    allHotlists.forEach((hotlist) => {
      const checkbox = document.getElementById(`bulk_hotlist_${hotlist.id}`);
      if (checkbox && checkbox.checked) {
        selectedHotlists.push(hotlist.id);
      }
    });

    if (selectedHotlists.length === 0) {
      showToast("Please select at least one hotlist", "warning");
      return;
    }

    // Assign selected hotlists to all selected runs
    let assignmentCount = 0;
    selectedIndices.forEach((runIndex) => {
      selectedHotlists.forEach((hotlistId) => {
        dashboard.addRunToHotlist(hotlistId, runIndex);
        assignmentCount++;
      });
    });

    showToast(
      `Successfully assigned ${selectedHotlists.length} hotlists to ${selectedIndices.length} items!`,
      "success"
    );
    document.body.removeChild(modal);
  };
}

// Global function to toggle all selection
window.toggleAllSelection = function (checked) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  const checkboxes = document.querySelectorAll(".compare-checkbox");

  checkboxes.forEach((checkbox) => {
    const index = parseInt(checkbox.getAttribute("onchange").match(/\d+/)[0]);

    if (checked) {
      dashboard.selectedForComparison.add(index);
      checkbox.checked = true;
    } else {
      dashboard.selectedForComparison.delete(index);
      checkbox.checked = false;
    }
  });

  updateCompareControls(dashboard);

  const selectedCount = dashboard.selectedForComparison.size;
  if (selectedCount > 0) {
    showToast(
      `${selectedCount} items ${checked ? "selected" : "deselected"}`,
      "info"
    );
  }
};

// Global function to open selection details modal
window.openSelectionDetailsModal = openSelectionDetailsModal;

// Global Firebase functions
window.syncSingleRecord = async function (index) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  try {
    const data = dashboard.uploadedData[index];
    await dashboard.saveDataToFirebase(data, index);
    updateFirebaseStatus(dashboard);
    updateFirebaseDataTable(dashboard);
    showToast("Record synced to Firebase", "success");
  } catch (error) {
    console.error("Sync error:", error);
    showToast("Failed to sync record", "error");
  }
};

window.viewFirebaseRecord = function (firebaseId) {
  showToast(`Firebase Record ID: ${firebaseId}`, "info");
};

window.closeFirebaseLogsModal = function () {
  if (window.currentFirebaseLogsModal) {
    document.body.removeChild(window.currentFirebaseLogsModal);
    window.currentFirebaseLogsModal = null;
  }
};

window.clearFirebaseLogs = function () {
  if (confirm("Are you sure you want to clear all Firebase sync logs?")) {
    localStorage.removeItem("firebaseLogs");
    showToast("Firebase logs cleared", "success");
    closeFirebaseLogsModal();
  }
};
