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
          <th>Select</th>
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
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8);
        display: flex; justify-content: center; align-items: center; z-index: 3000;
      `;
    let modalContent = `
        <div style="background: var(--card-bg); border-radius: var(--card-radius); border: var(--glass-border); backdrop-filter: blur(var(--glass-blur));
                     padding: 30px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
          <h3 style="color: var(--text-primary); margin-top: 0;">Enter App Names</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">Please provide the app name for each uploaded file:</p>
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

    document.getElementById("clearAll").onclick = () => {
      files.forEach((_, index) => {
        document.getElementById(`appName_${index}`).value = "";
      });
    };
    document.getElementById("cancelAppNames").onclick = () => {
      document.body.removeChild(modal);
      resolve(null);
    };
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
      if (allValid) {
        document.body.removeChild(modal);
        resolve(appNames);
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
          <th>Select</th>
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
  document.getElementById("analysisModalTitle").textContent = `${
    data.appName || "Unknown App"
  } - Detailed Analysis`;

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

  // Get hotlists for this run
  const runHotlists = dashboard.getHotlistsForRun(runIndex);

  // Find or create the hotlists section in the modal
  let hotlistsSection = document.getElementById("runHotlistsSection");

  if (!hotlistsSection) {
    // Create the hotlists section if it doesn't exist
    const appOverviewSection = document.querySelector(
      "#analysisModal .analysis-section"
    );
    if (appOverviewSection) {
      hotlistsSection = document.createElement("div");
      hotlistsSection.id = "runHotlistsSection";
      hotlistsSection.className = "analysis-section";
      hotlistsSection.innerHTML = `
        <h3 class="analysis-section-title">🏷️ Hotlists</h3>
        <div id="runHotlistsContent"></div>
      `;
      appOverviewSection.parentNode.insertBefore(
        hotlistsSection,
        appOverviewSection.nextSibling
      );
    }
  }

  const contentDiv = document.getElementById("runHotlistsContent");
  if (!contentDiv) return;

  if (runHotlists.length === 0) {
    contentDiv.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
        <span style="color: var(--text-secondary); font-size: 0.9rem;">No hotlists assigned to this run</span>
        <button onclick="showHotlistAssignmentModal(${runIndex})" style="
          background: var(--success-color);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          margin-left: auto;
        ">
          ➕ Add Hotlists
        </button>
      </div>
    `;
  } else {
    let hotlistsHtml = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 15px; background: rgba(255, 255, 255, 0.05); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1);">
    `;

    runHotlists.forEach((hotlist) => {
      hotlistsHtml += `
        <span style="
          background: var(--primary-color);
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        ">
          🏷️ ${hotlist.name}
          <button onclick="window.dashboard.removeRunFromHotlist('${hotlist.id}', ${runIndex}); populateRunHotlists(currentAnalysisData);" style="
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            font-weight: bold;
            padding: 0;
            margin-left: 4px;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
          " onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='none'" title="Remove from hotlist">
            ×
          </button>
        </span>
      `;
    });

    hotlistsHtml += `
        <button onclick="showHotlistAssignmentModal(${runIndex})" style="
          background: var(--success-color);
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          margin-left: auto;
        ">
          ➕ Add More
        </button>
      </div>
    `;

    contentDiv.innerHTML = hotlistsHtml;
  }
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
  const configModal = document.createElement("div");
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

  const close = () => document.body.removeChild(configModal);
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

  if (dashboard.selectedForComparison.size >= 2) {
    compareControls.classList.add("show");
    selectedCount.textContent = `${dashboard.selectedForComparison.size} selected`;
    compareBtn.disabled = false;
  } else {
    compareControls.classList.remove("show");
    compareBtn.disabled = true;
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

export function updateHotlistsView(dashboard) {
  // Only update if we're in the hotlists section
  const mainContent = document.getElementById("mainContent");
  if (!mainContent || !mainContent.classList.contains("hotlists-view")) {
    return;
  }

  updateHotlistsContainer(dashboard);
  updateHotlistFilterButtons(dashboard);
  updateHotlistRunsTable(dashboard);
}

function updateHotlistsContainer(dashboard) {
  const container = document.getElementById("hotlistsContainer");
  const hotlists = dashboard.getAllHotlists();

  if (hotlists.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No hotlists created yet</h3>
        <p>Create your first hotlist to organize and filter your performance runs.</p>
      </div>
    `;
    return;
  }

  let html = '<div style="display: grid; gap: 15px;">';

  hotlists.forEach((hotlist) => {
    const runCount = hotlist.runIds.length;
    const createdDate = new Date(hotlist.createdAt).toLocaleDateString();

    html += `
      <div class="hotlist-card" style="
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: all 0.3s ease;
      " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div>
            <h4 style="color: var(--text-primary); margin: 0 0 5px 0; font-size: 1.1rem; font-weight: 600;">
              🏷️ ${hotlist.name}
            </h4>
            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem; line-height: 1.4;">
              ${hotlist.description || "No description provided"}
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="editHotlist('${hotlist.id}')" style="
              background: var(--primary-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.8rem;
              font-weight: 600;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='var(--primary-dark)'" onmouseout="this.style.background='var(--primary-color)'">
              ✏️ Edit
            </button>
            <button onclick="deleteHotlistConfirm('${hotlist.id}')" style="
              background: var(--error-color);
              color: white;
              border: none;
              padding: 6px 10px;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.8rem;
              font-weight: 600;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='#dc2626'" onmouseout="this.style.background='var(--error-color)'">
              🗑️ Delete
            </button>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <div style="display: flex; gap: 20px;">
            <span style="color: var(--text-secondary); font-size: 0.8rem;">
              <strong style="color: var(--accent-light);">${runCount}</strong> runs
            </span>
            <span style="color: var(--text-secondary); font-size: 0.8rem;">
              Created: <strong>${createdDate}</strong>
            </span>
          </div>
          <button onclick="window.dashboard.setHotlistFilter('${
            hotlist.id
          }')" style="
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
            🔍 Filter Runs
          </button>
        </div>
      </div>
    `;
  });

  html += "</div>";
  container.innerHTML = html;
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

export function updateGamesView(uploadedData) {
  const container = document.getElementById("allGamesContent");
  if (!container) return;

  if (uploadedData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No games data available</h3>
        <p>Upload performance data to see game analysis here.</p>
      </div>
    `;
    return;
  }

  // Group data by app/game
  const gameStats = {};
  uploadedData.forEach((data) => {
    const appName = data.appName || "Unknown App";
    if (!gameStats[appName]) {
      gameStats[appName] = {
        name: appName,
        packageName: data.packageName || "Unknown Package",
        runs: [],
        totalRuns: 0,
        avgFps: 0,
        minFps: Infinity,
        maxFps: 0,
        totalFrames: 0,
        totalTime: 0,
      };
    }

    gameStats[appName].runs.push(data);
    gameStats[appName].totalRuns++;
    gameStats[appName].totalFrames += data.totalFrames || 0;
    gameStats[appName].totalTime += data.elapsedTimeSeconds || 0;

    if (data.avgFps) {
      gameStats[appName].minFps = Math.min(
        gameStats[appName].minFps,
        data.avgFps
      );
      gameStats[appName].maxFps = Math.max(
        gameStats[appName].maxFps,
        data.avgFps
      );
    }
  });

  // Calculate averages
  Object.values(gameStats).forEach((game) => {
    const totalFps = game.runs.reduce((sum, run) => sum + (run.avgFps || 0), 0);
    game.avgFps =
      game.totalRuns > 0 ? (totalFps / game.totalRuns).toFixed(1) : 0;
    if (game.minFps === Infinity) game.minFps = 0;
  });

  // Sort by average FPS
  const sortedGames = Object.values(gameStats).sort(
    (a, b) => b.avgFps - a.avgFps
  );

  let html = `
    <div style="margin-bottom: 20px;">
      <h2 style="color: var(--text-primary); margin-bottom: 10px;">🎮 All Games Performance</h2>
      <p style="color: var(--text-secondary);">Comprehensive performance analysis for all tested games</p>
    </div>
    <div style="display: grid; gap: 15px;">
  `;

  sortedGames.forEach((game, index) => {
    const rank = index + 1;
    const performanceClass =
      game.avgFps >= 50 ? "excellent" : game.avgFps >= 30 ? "good" : "poor";

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
                🎮 ${game.name}
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
              color: ${
                performanceClass === "excellent"
                  ? "var(--success-color)"
                  : performanceClass === "good"
                  ? "var(--warning-color)"
                  : "var(--error-color)"
              };
            ">
              ${game.avgFps} FPS
            </div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Average</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px;">
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
              game.totalRuns
            }</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Total Runs</div>
          </div>
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
              game.minFps
            }</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Min FPS</div>
          </div>
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
              game.maxFps
            }</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Max FPS</div>
          </div>
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${game.totalTime.toFixed(
              1
            )}s</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Total Time</div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <span style="color: var(--text-secondary); font-size: 0.8rem;">
            ${game.totalFrames.toLocaleString()} total frames
          </span>
          <button onclick="filterByGame('${game.name}')" style="
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
        </div>
      </div>
    `;
  });

  html += "</div>";
  container.innerHTML = html;
}

// --- All Devices View ---

export function updateDevicesView(uploadedData) {
  const container = document.getElementById("allDevicesContent");
  if (!container) return;

  if (uploadedData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No device data available</h3>
        <p>Upload performance data to see device analysis here.</p>
      </div>
    `;
    return;
  }

  // Group data by device
  const deviceStats = {};
  uploadedData.forEach((data) => {
    const deviceInfo = data.deviceInfo || {};
    const manufacturer = deviceInfo["ro.product.manufacturer"] || "Unknown";
    const model = deviceInfo["ro.product.model"] || "Unknown";
    const deviceKey = `${manufacturer} ${model}`;

    if (!deviceStats[deviceKey]) {
      deviceStats[deviceKey] = {
        manufacturer,
        model,
        deviceKey,
        runs: [],
        totalRuns: 0,
        avgFps: 0,
        minFps: Infinity,
        maxFps: 0,
        apps: new Set(),
        socModel: deviceInfo["ro.soc.model"] || "Unknown",
        androidVersion: deviceInfo["ro.build.version.release"] || "Unknown",
        totalMemoryGB: "Unknown",
      };

      // Calculate memory
      if (deviceInfo.MemTotal) {
        const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
        if (!isNaN(memKB)) {
          deviceStats[deviceKey].totalMemoryGB = (
            memKB /
            (1024 * 1024)
          ).toFixed(1);
        }
      }
    }

    deviceStats[deviceKey].runs.push(data);
    deviceStats[deviceKey].totalRuns++;
    deviceStats[deviceKey].apps.add(data.appName || "Unknown App");

    if (data.avgFps) {
      deviceStats[deviceKey].minFps = Math.min(
        deviceStats[deviceKey].minFps,
        data.avgFps
      );
      deviceStats[deviceKey].maxFps = Math.max(
        deviceStats[deviceKey].maxFps,
        data.avgFps
      );
    }
  });

  // Calculate averages
  Object.values(deviceStats).forEach((device) => {
    const totalFps = device.runs.reduce(
      (sum, run) => sum + (run.avgFps || 0),
      0
    );
    device.avgFps =
      device.totalRuns > 0 ? (totalFps / device.totalRuns).toFixed(1) : 0;
    if (device.minFps === Infinity) device.minFps = 0;
    device.uniqueApps = device.apps.size;
  });

  // Sort by average FPS
  const sortedDevices = Object.values(deviceStats).sort(
    (a, b) => b.avgFps - a.avgFps
  );

  let html = `
    <div style="margin-bottom: 20px;">
      <h2 style="color: var(--text-primary); margin-bottom: 10px;">📱 All Devices Performance</h2>
      <p style="color: var(--text-secondary);">Comprehensive performance analysis for all tested devices</p>
    </div>
    <div style="display: grid; gap: 15px;">
  `;

  sortedDevices.forEach((device, index) => {
    const rank = index + 1;
    const performanceClass =
      device.avgFps >= 50 ? "excellent" : device.avgFps >= 30 ? "good" : "poor";

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
                📱 ${device.manufacturer} ${device.model}
              </h3>
            </div>
            <p style="color: var(--text-secondary); margin: 0; font-size: 0.9rem;">
              ${device.socModel} • Android ${device.androidVersion} • ${
      device.totalMemoryGB
    }GB RAM
            </p>
          </div>
          <div style="text-align: right;">
            <div style="
              font-size: 1.5rem;
              font-weight: bold;
              color: ${
                performanceClass === "excellent"
                  ? "var(--success-color)"
                  : performanceClass === "good"
                  ? "var(--warning-color)"
                  : "var(--error-color)"
              };
            ">
              ${device.avgFps} FPS
            </div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Average</div>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; margin-bottom: 15px;">
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
              device.totalRuns
            }</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Total Runs</div>
          </div>
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
              device.uniqueApps
            }</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Apps Tested</div>
          </div>
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
              device.minFps
            }</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Min FPS</div>
          </div>
          <div style="text-align: center;">
            <div style="color: var(--text-primary); font-weight: 600; font-size: 1.1rem;">${
              device.maxFps
            }</div>
            <div style="color: var(--text-secondary); font-size: 0.8rem;">Max FPS</div>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 15px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <span style="color: var(--text-secondary); font-size: 0.8rem;">
            SoC: ${device.socModel}
          </span>
          <button onclick="filterByDevice('${device.manufacturer}', '${
      device.model
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
        </div>
      </div>
    `;
  });

  html += "</div>";
  container.innerHTML = html;
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

  document.getElementById("saveEditHotlist").onclick = () => {
    const name = document.getElementById("editHotlistName").value.trim();
    const description = document
      .getElementById("editHotlistDescription")
      .value.trim();

    if (!name) {
      showToast("Please enter a hotlist name", "warning");
      return;
    }

    try {
      HotlistManager.updateHotlist(hotlistId, { name, description });
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
