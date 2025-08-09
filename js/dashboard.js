// Core FPSDashboard Class - Application State and Orchestration

import * as DataParser from "./data-parser.js";
import * as UIManager from "./ui-manager.js";
import * as ChartService from "./chart-service.js";
import * as HotlistManager from "./hotlist-manager.js";

export class FPSDashboard {
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

    this.activeDetailChart = "fps";
    this.detailChartTimeScale = "1s"; // 'frame', '1s', or '5s'
    this.comparisonChartTimeScale = "1s";
    this.activeComparisonChart = "fps";

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
    UIManager.showToast(message, type);
  }

  showLoading() {
    UIManager.showLoading();
  }

  hideLoading() {
    UIManager.hideLoading();
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
      const fileAppNames = await UIManager.promptForAppNames(files);
      if (!fileAppNames) {
        // User cancelled
        this.hideLoading();
        return;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const userProvidedAppName = fileAppNames[i];

        try {
          const rawData = await DataParser.readFile(file);
          const parsedData = DataParser.parseData(
            rawData,
            file.name,
            userProvidedAppName,
            this.uploadedData.length
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

  updateDisplay() {
    // Always update stats and table
    UIManager.updateStats(this.uploadedData);
    UIManager.updateTableWithCheckboxes(this);

    // Only update performance tables and charts if they should be visible
    const performanceSection = document.getElementById("performanceSection");
    const chartsSection = document.getElementById("chartsSection");

    if (performanceSection && performanceSection.style.display !== "none") {
      UIManager.updatePerformanceTables(this);
    }

    if (chartsSection && chartsSection.style.display !== "none") {
      this.updateCharts();
    }
  }

  updateCharts() {
    const chartsSection = document.getElementById("chartsSection");
    if (this.uploadedData.length === 0) {
      chartsSection.style.display = "none";
      return;
    }
    chartsSection.style.display = "block";

    // Create or update charts via the ChartService
    ChartService.createFPSChart(this);
    ChartService.createDeviceChart(this);
    ChartService.createMemoryFpsChart(this);
    ChartService.createBatteryDrainChart(this);
  }

  async loadDemoData() {
    try {
      this.showLoading();

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
            const parsedData = DataParser.parseData(rawData, fileName);

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
      this.selectedForComparison.clear();

      // Destroy all charts
      Object.values(this.charts).forEach((chart) => {
        if (chart) chart.destroy();
      });
      this.charts = {};

      this.updateDisplay();
      UIManager.updateViewControls(this);
      this.showToast("All data cleared successfully.", "success");

      document.getElementById("fileInput").value = "";
    }
  }

  toggleView() {
    if (this.currentView === "recent") {
      this.currentView = "all";
    } else {
      this.currentView = "recent";
      this.searchTerm = "";
      this.activeFilters.clear();
      document.getElementById("searchInput").value = "";
    }
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    UIManager.updateViewControls(this);
    this.updateTable();
  }

  updateTable() {
    if (this.currentView === "all") {
      UIManager.updateTableWithPagination(this);
    } else {
      UIManager.updateTableWithCheckboxes(this);
    }
  }

  handleSearch(searchTerm) {
    this.searchTerm = searchTerm.toLowerCase();
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    UIManager.updateViewControls(this);
    this.updateTable();
  }

  clearSearch() {
    this.searchTerm = "";
    document.getElementById("searchInput").value = "";
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    UIManager.updateViewControls(this);
    this.updateTable();
    UIManager.updateFilterChips(this);
  }

  applyFiltersAndSearch() {
    this.filteredData = this.uploadedData.filter((data) => {
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

      for (const [filterType, filterValue] of this.activeFilters) {
        switch (filterType) {
          case "manufacturer":
            if (
              (data.deviceInfo?.["ro.product.manufacturer"] || "Unknown") !==
              filterValue
            )
              return false;
            break;
          case "app":
            if ((data.appName || "Unknown App") !== filterValue) return false;
            break;
          case "soc":
            if (
              (data.deviceInfo?.["ro.soc.model"] || "Unknown") !== filterValue
            )
              return false;
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
    UIManager.updateViewControls(this);
    this.updateTable();
    UIManager.updateFilterChips(this);
  }

  removeFilter(filterKey) {
    this.activeFilters.delete(filterKey);
    this.currentPage = 1;
    this.applyFiltersAndSearch();
    UIManager.updateViewControls(this);
    this.updateTable();
    UIManager.updateFilterChips(this);
  }

  async deleteAnalysisResult(dataIndex) {
    try {
      if (!this.isAuthenticated) {
        const authenticated = await UIManager.showAuthenticationModal(this);
        if (!authenticated) {
          return;
        }
      }

      const data = this.uploadedData[dataIndex];
      if (!data) {
        this.showToast("Analysis result not found.", "error");
        return;
      }

      const confirmed = await UIManager.confirmDelete(data);
      if (!confirmed) {
        return;
      }

      this.uploadedData.splice(dataIndex, 1);
      this.selectedForComparison.delete(dataIndex);

      const updatedSelection = new Set();
      for (const index of this.selectedForComparison) {
        if (index > dataIndex) {
          updatedSelection.add(index - 1);
        } else if (index < dataIndex) {
          updatedSelection.add(index);
        }
      }
      this.selectedForComparison = updatedSelection;

      this.updateDisplay();
      UIManager.updateViewControls(this);
      UIManager.updateCompareControls(this);

      if (window.currentAnalysisData === data) {
        UIManager.closeAnalysisModal();
      }

      this.showToast(
        `Analysis result for "${data.appName || "Unknown App"}" deleted.`,
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

  nextPage() {
    const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
    if (this.currentPage < totalPages) {
      this.currentPage++;
      UIManager.updateViewControls(this);
      this.updateTable();
    }
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      UIManager.updateViewControls(this);
      this.updateTable();
    }
  }

  // Missing methods from demo.js
  openDetailedAnalysis(data) {
    // This method will be handled by ui-manager.js
    UIManager.openDetailedAnalysis(data);
  }

  toggleAppSelection(dataIndex, checkbox) {
    if (checkbox.checked) {
      this.selectedForComparison.add(dataIndex);
    } else {
      this.selectedForComparison.delete(dataIndex);
    }
    UIManager.updateCompareControls(this);
  }

  setTimeScale(scale) {
    this.detailChartTimeScale = scale;
    // This will be handled by ui-manager.js
    UIManager.setTimeScale(scale);
  }

  setComparisonTimeScale(scale) {
    this.comparisonChartTimeScale = scale;
    // This will be handled by ui-manager.js
    UIManager.setComparisonTimeScale(scale, this);
  }

  showComparisonChart(chartType) {
    this.activeComparisonChart = chartType;
    // This will be handled by ui-manager.js
    UIManager.showComparisonChart(chartType, this);
  }

  removeFromComparison(index) {
    this.selectedForComparison.delete(index);
    UIManager.updateCompareControls(this);
  }

  generateAIAnalysis() {
    // This method will be handled by ui-manager.js
    UIManager.generateAIAnalysis();
  }

  // Hotlist methods
  createHotlist(name, description) {
    try {
      const hotlist = HotlistManager.createHotlist(name, description);
      this.showToast(`Hotlist "${name}" created successfully!`, "success");
      UIManager.updateHotlistsView(this);
      return hotlist;
    } catch (error) {
      this.showToast(error.message, "error");
      throw error;
    }
  }

  deleteHotlist(hotlistId) {
    try {
      HotlistManager.deleteHotlist(hotlistId);
      this.showToast("Hotlist deleted successfully!", "success");
      UIManager.updateHotlistsView(this);

      // Clear filter if the deleted hotlist was active
      if (HotlistManager.getCurrentHotlistFilter() === hotlistId) {
        this.clearHotlistFilter();
      }
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  addRunToHotlist(hotlistId, runIndex) {
    try {
      HotlistManager.addRunToHotlist(hotlistId, runIndex);
      this.showToast("Run added to hotlist!", "success");
      UIManager.updateHotlistsView(this);
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  removeRunFromHotlist(hotlistId, runIndex) {
    try {
      HotlistManager.removeRunFromHotlist(hotlistId, runIndex);
      this.showToast("Run removed from hotlist!", "success");
      UIManager.updateHotlistsView(this);
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  setHotlistFilter(hotlistId) {
    HotlistManager.setHotlistFilter(hotlistId);
    UIManager.updateHotlistsView(this);

    const hotlist = HotlistManager.getHotlistById(hotlistId);
    if (hotlist) {
      this.showToast(`Filtering by hotlist: ${hotlist.name}`, "info");
    }
  }

  clearHotlistFilter() {
    HotlistManager.clearHotlistFilter();
    UIManager.updateHotlistsView(this);
    this.showToast("Hotlist filter cleared", "info");
  }

  getHotlistsForRun(runIndex) {
    return HotlistManager.getHotlistsForRun(runIndex);
  }

  getAllHotlists() {
    return HotlistManager.getAllHotlists();
  }

  // Missing methods that sidebar.js calls
  updateViewControls() {
    UIManager.updateViewControls(this);
  }

  updateStats(data) {
    UIManager.updateStats(data);
  }

  updatePerformanceTables() {
    UIManager.updatePerformanceTables(this);
  }

  updateFilterChips() {
    UIManager.updateFilterChips(this);
  }
}
