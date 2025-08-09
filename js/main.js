// Main Application Entry Point

import { FPSDashboard } from "./dashboard.js";
import * as UIManager from "./ui-manager.js";
import {
  initializeDetailedAnalysis,
  initializeTooltips,
  initializeComparisonModal,
  initializeHotlistsSection,
} from "./ui-manager.js";
import { initializeSidebar } from "./sidebar.js";
import * as HotlistManager from "./hotlist-manager.js";

// A global variable to hold the main dashboard instance.
let dashboard;

/**
 * This is the main function that runs when the DOM is fully loaded.
 * It sets up the entire application.
 */
document.addEventListener("DOMContentLoaded", function () {
  // 1. Create the single instance of our main application controller.
  dashboard = new FPSDashboard();

  // 2. Make the dashboard instance globally accessible.
  // This is crucial for the inline event handlers (e.g., onclick="...
  // in the dynamically generated HTML to find and call the dashboard's methods.
  window.dashboard = dashboard;

  // 3. Initialize all the major UI components by calling their setup functions
  //    from the other modules.
  initializeDetailedAnalysis();
  initializeComparisonModal();
  initializeSidebar();
  initializeTooltips();
  initializeHotlistsSection();

  // Initialize hotlists from localStorage
  HotlistManager.initializeHotlists();

  // 4. Expose certain UI or utility functions globally if they are called directly
  //    from inline HTML handlers and are not methods of the dashboard object.
  //    This makes them accessible in the global scope.
  window.openDetailedAnalysis = (data) => dashboard.openDetailedAnalysis(data);
  window.toggleAppSelection = (index, checkbox) =>
    dashboard.toggleAppSelection(index, checkbox);
  window.setTimeScale = (scale) => UIManager.setTimeScale(scale);
  window.setComparisonTimeScale = (scale) =>
    UIManager.setComparisonTimeScale(scale, dashboard);
  window.showComparisonChart = (chartType) =>
    UIManager.showComparisonChart(chartType, dashboard);
  window.removeFromComparison = (index) =>
    dashboard.removeFromComparison(index);
  window.openComparisonModal = () => UIManager.openComparisonModal(dashboard);
  window.closeComparisonModal = () => UIManager.closeComparisonModal(dashboard);
  window.generateAIAnalysis = () => UIManager.generateAIAnalysis();
  window.generateComparisonAIAnalysis = () =>
    UIManager.generateComparisonAIAnalysis();
  window.copyAnalysisContent = () => UIManager.copyAnalysisContent();
  window.copyComparisonAnalysisContent = () =>
    UIManager.copyComparisonAnalysisContent();
  window.showInputData = () => UIManager.showInputData();
  window.showComparisonInputData = () => UIManager.showComparisonInputData();
  window.showAIConfig = () => UIManager.showAIConfig();
  window.closeComparisonInputDataModal = () => {
    if (window.currentComparisonInputDataModal) {
      document.body.removeChild(window.currentComparisonInputDataModal);
      window.currentComparisonInputDataModal = null;
    }
  };
  window.copyComparisonInputData = () => {
    if (!window.lastComparisonAnalysisInputData) return;
    const jsonString = JSON.stringify(
      window.lastComparisonAnalysisInputData,
      null,
      2
    );
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(jsonString)
          .then(() => {
            UIManager.showToast(
              "Comparison input data copied to clipboard!",
              "success"
            );
          })
          .catch((err) => {
            console.error("Failed to copy:", err);
            UIManager.fallbackCopyText(jsonString);
          });
      } else {
        UIManager.fallbackCopyText(jsonString);
      }
    } catch (error) {
      console.error("Copy failed:", error);
      UIManager.showToast("Failed to copy comparison input data", "error");
    }
  };
});
