// Core FPSDashboard Class - Application State and Orchestration

import * as DataParser from "./data-parser.js";
import * as UIManager from "./ui-manager.js";
import * as ChartService from "./chart-service.js";
import * as HotlistManager from "./hotlist-manager.js";
import { firebaseService } from "./firebase-service.js";

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

    // Firebase integration
    this.firebaseEnabled = true;
    this.autoSaveToFirebase = true;
    this.firebaseDataIds = new Map(); // Maps local data index to Firebase document ID

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
    this.initializeFirebase();
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
    const uploadedFiles = []; // Track successfully uploaded files with their Firebase IDs

    try {
      this.showLoading();

      // Prompt user for app names and hotlist selection for each file
      const result = await UIManager.promptForAppNames(files);
      if (!result) {
        // User cancelled
        this.hideLoading();
        return;
      }

      const { appNames: fileAppNames, selectedHotlists } = result;

      // Step 1: Upload all files to Firebase first
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
            // Add hotlist references directly to the parsed data
            if (selectedHotlists && selectedHotlists.length > 0) {
              parsedData.hotlistIds = [...selectedHotlists];
            }

            const dataIndex = this.uploadedData.length;
            this.uploadedData.push(parsedData);

            // Always save to Firebase to get the document ID
            let firebaseDocumentId = null;
            if (this.autoSaveToFirebase) {
              firebaseDocumentId = await this.saveDataToFirebase(
                parsedData,
                dataIndex
              );
            }

            // Track the uploaded file with its Firebase ID
            uploadedFiles.push({
              dataIndex,
              firebaseDocumentId,
              parsedData,
            });

            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error processing file ${file.name}:`, error);
          errorCount++;
        }
      }

      // Step 2: Assign successfully uploaded files to selected hotlists
      if (
        selectedHotlists &&
        selectedHotlists.length > 0 &&
        uploadedFiles.length > 0
      ) {
        for (const uploadedFile of uploadedFiles) {
          const { dataIndex, firebaseDocumentId, parsedData } = uploadedFile;

          for (const hotlistId of selectedHotlists) {
            try {
              // Use the Firebase document ID for hotlist assignment
              await this.addRunToHotlist(
                hotlistId,
                dataIndex,
                firebaseDocumentId,
                parsedData
              );
            } catch (hotlistError) {
              console.error(
                `Error adding to hotlist ${hotlistId}:`,
                hotlistError
              );
              // Don't fail the entire upload for hotlist errors
            }
          }
        }
      }

      this.updateDisplay();

      // Show summary toast with hotlist information
      let message = "";
      if (successCount > 0 && errorCount === 0) {
        message = `Successfully processed ${successCount} file${
          successCount > 1 ? "s" : ""
        }!`;
        if (selectedHotlists && selectedHotlists.length > 0) {
          message += ` Added to ${selectedHotlists.length} hotlist${
            selectedHotlists.length > 1 ? "s" : ""
          }.`;
        }
        this.showToast(message, "success");
      } else if (successCount > 0 && errorCount > 0) {
        message = `Processed ${successCount} file${
          successCount > 1 ? "s" : ""
        }, ${errorCount} failed.`;
        if (selectedHotlists && selectedHotlists.length > 0) {
          message += ` Successfully processed files added to ${
            selectedHotlists.length
          } hotlist${selectedHotlists.length > 1 ? "s" : ""}.`;
        }
        this.showToast(message, "warning");
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

      await this.deleteAnalysisResultInternal(dataIndex);

      this.showToast(
        `Analysis result for "${data.appName || "Unknown App"}" deleted.`,
        "success"
      );
    } catch (error) {
      console.error("Error deleting analysis result:", error);
      this.showToast("Failed to delete analysis result.", "error");
    }
  }

  async deleteAnalysisResultInternal(dataIndex) {
    const data = this.uploadedData[dataIndex];
    if (!data) {
      throw new Error("Analysis result not found.");
    }

    // Delete from Firebase first
    await this.deleteDataFromFirebase(dataIndex);

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
  async createHotlist(name, description) {
    try {
      const hotlist = await HotlistManager.createHotlist(name, description);
      this.showToast(`Hotlist "${name}" created successfully!`, "success");
      UIManager.updateHotlistsView(this);
      return hotlist;
    } catch (error) {
      this.showToast(error.message, "error");
      throw error;
    }
  }

  async deleteHotlist(hotlistId) {
    try {
      await HotlistManager.deleteHotlist(hotlistId);
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

  async addRunToHotlist(
    hotlistId,
    runIndex,
    firebaseDocumentId = null,
    parsedData = null
  ) {
    try {
      // Get the Firebase document ID for this run
      const fpsDataId =
        firebaseDocumentId || this.firebaseDataIds.get(runIndex);
      const runData = parsedData || this.uploadedData[runIndex];

      // Add to hotlist manager
      await HotlistManager.addRunToHotlist(
        hotlistId,
        runIndex,
        fpsDataId,
        runData
      );

      // Also store hotlist reference in the FPS data itself
      if (runData && !runData.hotlistIds) {
        runData.hotlistIds = [];
      }
      if (runData && !runData.hotlistIds.includes(hotlistId)) {
        runData.hotlistIds.push(hotlistId);

        // Update in Firebase if available
        if (fpsDataId) {
          try {
            await this.updateDataInFirebase(runIndex, {
              hotlistIds: runData.hotlistIds,
            });
          } catch (firebaseError) {
            console.warn(
              "Failed to update hotlist reference in Firebase:",
              firebaseError
            );
          }
        }
      }

      this.showToast("Run added to hotlist!", "success");
      UIManager.updateHotlistsView(this);
    } catch (error) {
      this.showToast(error.message, "error");
    }
  }

  async removeRunFromHotlist(hotlistId, runIndex) {
    try {
      // Get the Firebase document ID for this run
      const fpsDataId = this.firebaseDataIds.get(runIndex);
      const runData = this.uploadedData[runIndex];

      await HotlistManager.removeRunFromHotlist(
        hotlistId,
        runIndex,
        fpsDataId,
        runData
      );

      // Also remove hotlist reference from the FPS data itself
      if (runData && runData.hotlistIds) {
        const index = runData.hotlistIds.indexOf(hotlistId);
        if (index > -1) {
          runData.hotlistIds.splice(index, 1);

          // Update in Firebase if available
          if (fpsDataId) {
            try {
              await this.updateDataInFirebase(runIndex, {
                hotlistIds: runData.hotlistIds,
              });
            } catch (firebaseError) {
              console.warn(
                "Failed to update hotlist reference in Firebase:",
                firebaseError
              );
            }
          }
        }
      }

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

  // Firebase Integration Methods

  /**
   * Initialize Firebase and load existing data
   */
  async initializeFirebase() {
    if (!this.firebaseEnabled) return;

    try {
      console.log("Initializing Firebase integration...");

      // Check if Firebase is connected
      if (firebaseService.isConnected()) {
        console.log("Firebase connected successfully");

        // Load existing data from Firebase on startup
        await this.loadDataFromFirebase();
      } else {
        console.warn("Firebase not connected");
        this.firebaseEnabled = false;
      }
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      this.firebaseEnabled = false;
      this.showToast(
        "Firebase initialization failed. Working in offline mode.",
        "warning"
      );
    }
  }

  /**
   * Save FPS data to Firebase
   * @param {Object} fpsData - The FPS data to save
   * @param {number} localIndex - Local array index for mapping
   * @returns {Promise<string|null>} Firebase document ID or null if failed
   */
  async saveDataToFirebase(fpsData, localIndex) {
    if (!this.firebaseEnabled || !this.autoSaveToFirebase) return null;

    try {
      const documentId = await firebaseService.saveFPSData(fpsData);
      this.firebaseDataIds.set(localIndex, documentId);
      console.log(`Data saved to Firebase with ID: ${documentId}`);
      return documentId;
    } catch (error) {
      console.error("Error saving data to Firebase:", error);
      this.showToast("Failed to save data to Firebase", "warning");
      return null;
    }
  }

  /**
   * Load all data from Firebase
   */
  async loadDataFromFirebase() {
    if (!this.firebaseEnabled) return;

    try {
      this.showLoading();
      const firebaseData = await firebaseService.loadAllFPSData();

      if (firebaseData.length > 0) {
        // Clear existing data and load from Firebase
        this.uploadedData = [];
        this.firebaseDataIds.clear();

        firebaseData.forEach((data, index) => {
          // Remove Firebase-specific fields for local use
          const {
            id,
            createdAt,
            updatedAt,
            hasRawData,
            rawDataSize,
            ...cleanData
          } = data;

          // Add to local data
          this.uploadedData.push(cleanData);
          this.firebaseDataIds.set(index, id);
        });

        // Initialize hotlists and synchronize references after data is loaded
        await HotlistManager.initializeHotlists();
        HotlistManager.synchronizeHotlistReferences(this.firebaseDataIds);

        this.updateDisplay();
        this.showToast(
          `Loaded ${firebaseData.length} records from Firebase`,
          "success"
        );
        console.log(`Loaded ${firebaseData.length} records from Firebase`);
      } else {
        // Even if no FPS data, still initialize hotlists
        await HotlistManager.initializeHotlists();
      }
    } catch (error) {
      console.error("Error loading data from Firebase:", error);
      this.showToast("Failed to load data from Firebase", "error");
      // Still try to initialize hotlists even if FPS data loading fails
      try {
        await HotlistManager.initializeHotlists();
      } catch (hotlistError) {
        console.error("Error initializing hotlists:", hotlistError);
      }
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Delete data from Firebase
   * @param {number} localIndex - Local array index
   */
  async deleteDataFromFirebase(localIndex) {
    if (!this.firebaseEnabled) return;

    const documentId = this.firebaseDataIds.get(localIndex);
    if (!documentId) return;

    try {
      await firebaseService.deleteFPSData(documentId);
      this.firebaseDataIds.delete(localIndex);
      console.log(`Data deleted from Firebase with ID: ${documentId}`);
    } catch (error) {
      console.error("Error deleting data from Firebase:", error);
      this.showToast("Failed to delete data from Firebase", "warning");
    }
  }

  /**
   * Update data in Firebase
   * @param {number} localIndex - Local array index
   * @param {Object} updateData - Data to update
   */
  async updateDataInFirebase(localIndex, updateData) {
    if (!this.firebaseEnabled) return;

    const documentId = this.firebaseDataIds.get(localIndex);
    if (!documentId) return;

    try {
      await firebaseService.updateFPSData(documentId, updateData);
      console.log(`Data updated in Firebase with ID: ${documentId}`);
    } catch (error) {
      console.error("Error updating data in Firebase:", error);
      this.showToast("Failed to update data in Firebase", "warning");
    }
  }

  /**
   * Search data in Firebase by app name
   * @param {string} appName - App name to search for
   */
  async searchFirebaseByApp(appName) {
    if (!this.firebaseEnabled) return [];

    try {
      const results = await firebaseService.searchFPSDataByApp(appName);
      return results;
    } catch (error) {
      console.error("Error searching Firebase:", error);
      this.showToast("Failed to search Firebase", "error");
      return [];
    }
  }

  /**
   * Toggle Firebase auto-save
   */
  toggleFirebaseAutoSave() {
    this.autoSaveToFirebase = !this.autoSaveToFirebase;
    this.showToast(
      `Firebase auto-save ${this.autoSaveToFirebase ? "enabled" : "disabled"}`,
      "info"
    );
  }

  /**
   * Manual sync with Firebase
   */
  async syncWithFirebase() {
    if (!this.firebaseEnabled) {
      this.showToast("Firebase is not enabled", "warning");
      return;
    }

    try {
      this.showLoading();

      // Save any unsaved local data to Firebase
      for (let i = 0; i < this.uploadedData.length; i++) {
        if (!this.firebaseDataIds.has(i)) {
          await this.saveDataToFirebase(this.uploadedData[i], i);
        }
      }

      // Reload data from Firebase to get latest
      await this.loadDataFromFirebase();

      this.showToast("Successfully synced with Firebase", "success");
    } catch (error) {
      console.error("Error syncing with Firebase:", error);
      this.showToast("Failed to sync with Firebase", "error");
    } finally {
      this.hideLoading();
    }
  }

  /**
   * Get Firebase connection status
   */
  getFirebaseStatus() {
    return {
      enabled: this.firebaseEnabled,
      connected: firebaseService.isConnected(),
      autoSave: this.autoSaveToFirebase,
      localDataCount: this.uploadedData.length,
      firebaseMappedCount: this.firebaseDataIds.size,
    };
  }
}
