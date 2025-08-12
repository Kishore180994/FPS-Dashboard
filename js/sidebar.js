// Sidebar and Navigation Module

// Dynamic Header Configuration
const headerConfig = {
  "input-analysis": {
    icon: "📊",
    title: "Input & Analysis",
    description: "Upload files & view results",
  },
  dashboard: {
    icon: "📈",
    title: "Dashboard",
    description: "Performance charts & stats",
  },
  games: {
    icon: "🎮",
    title: "All Games",
    description: "Complete game performance data",
  },
  devices: {
    icon: "📱",
    title: "All Devices",
    description: "Device performance overview",
  },
  charts: {
    icon: "📊",
    title: "Charts Section",
    description: "App-specific performance charts",
  },
  hotlists: {
    icon: "🏷️",
    title: "Hotlists",
    description: "Manage and filter by hotlists",
  },
  chatbot: {
    icon: "🤖",
    title: "AI Chatbot",
    description: "Analyze performance with AI",
  },
  firebase: {
    icon: "🔥",
    title: "Firebase",
    description: "Cloud storage & sync settings",
  },
};

// Function to update the dynamic header
function updateDynamicHeader(view) {
  const config = headerConfig[view] || headerConfig["input-analysis"];

  const iconElement = document.getElementById("currentTabIcon");
  const titleElement = document.getElementById("currentTabTitle");
  const descriptionElement = document.getElementById("currentTabDescription");

  if (iconElement) iconElement.textContent = config.icon;
  if (titleElement) titleElement.textContent = config.title;
  if (descriptionElement) descriptionElement.textContent = config.description;
}

// This function will be called once from main.js to set up all the sidebar event listeners.
export function initializeSidebar() {
  const sidebarToggle = document.getElementById("sidebarToggle");
  const sidebar = document.getElementById("sidebar");
  const sidebarOverlay = document.getElementById("sidebarOverlay");
  const mainContent = document.getElementById("mainContent");
  const toggleIcon = document.getElementById("toggleIcon");
  const navItems = document.querySelectorAll(".nav-item");

  // --- Core Sidebar Functions ---

  function openSidebar() {
    sidebar.classList.add("open");
    sidebarOverlay.classList.add("show");
    sidebarToggle.classList.add("open");
    toggleIcon.textContent = "✕";

    // On desktop, shift main content to the right
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

  function toggleSidebar() {
    const isOpen = sidebar.classList.contains("open");
    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  // --- Event Listeners ---

  sidebarToggle.addEventListener("click", toggleSidebar);
  sidebarOverlay.addEventListener("click", closeSidebar);

  // Handle clicks on navigation items
  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const view = item.dataset.view;
      handleNavigation(view);

      // Update active state visuals
      navItems.forEach((nav) => nav.classList.remove("active"));
      item.classList.add("active");

      // Update dynamic header
      updateDynamicHeader(view);

      // Close sidebar on mobile after selecting a view
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  // Handle window resizing to adjust the main content shift
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 768) {
      mainContent.classList.remove("shifted");
    } else if (sidebar.classList.contains("open")) {
      mainContent.classList.add("shifted");
    }
  });

  // Close sidebar on escape key press
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && sidebar.classList.contains("open")) {
      closeSidebar();
    }
  });
}

// --- View Switching Logic ---

/**
 * Handles switching between different primary views of the application.
 * @param {string} view The name of the view to display.
 */
function handleNavigation(view) {
  const dashboard = window.dashboard; // Access the global dashboard instance

  // Hide all main content sections first
  const uploadSection = document.querySelector(".upload-section");
  const statsSection = document.getElementById("statsContainer");
  const performanceSection = document.getElementById("performanceSection");
  const analysisSection = document.querySelector(".analysis-section");
  const chartsSection = document.getElementById("chartsSection");

  // Hide ALL dedicated view sections
  document.getElementById("allGamesSection").style.display = "none";
  document.getElementById("allDevicesSection").style.display = "none";
  document.getElementById("appChartsSection").style.display = "none";
  document.getElementById("hotlistsSection").style.display = "none";
  document.getElementById("chatbotSection").style.display = "none";
  document.getElementById("firebaseSection").style.display = "none";

  // Remove all view classes from main content to prevent stacking
  const mainContent = document.getElementById("mainContent");
  mainContent.classList.remove(
    "games-view",
    "devices-view",
    "charts-view",
    "hotlists-view",
    "chatbot-view",
    "firebase-view"
  );

  // Show the relevant section based on the selected view
  switch (view) {
    case "input-analysis":
      showInputAnalysisView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    case "dashboard":
      showDashboardView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    case "games":
      showAllGamesView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    case "devices":
      showAllDevicesView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    case "charts":
      showAppChartsView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    case "hotlists":
      showHotlistsView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    case "chatbot":
      showChatbotView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    case "firebase":
      showFirebaseView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
      break;
    default:
      // Default to the main input/analysis view
      showInputAnalysisView(
        uploadSection,
        statsSection,
        performanceSection,
        analysisSection,
        chartsSection,
        dashboard
      );
  }
}

function showInputAnalysisView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Show only the sections relevant to input and analysis results table
  if (uploadSection) uploadSection.style.display = "block";
  if (analysisSection) analysisSection.style.display = "block";

  // Hide all dashboard-specific sections
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";

  // Ensure the main results table container is visible
  document.getElementById("currentViewSection").style.display = "block";

  // Reset view state to default
  dashboard.currentView = "recent";
  dashboard.currentPage = 1;
  dashboard.searchTerm = "";
  dashboard.activeFilters.clear();

  const searchInput = document.getElementById("searchInput");
  if (searchInput) searchInput.value = "";

  dashboard.updateViewControls();
  dashboard.updateTable();
  dashboard.updateFilterChips();

  dashboard.showToast("Switched to Input & Analysis view", "info");
}

function showDashboardView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Hide the input and results table sections
  if (uploadSection) uploadSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  document.getElementById("currentViewSection").style.display = "none";

  // Show all dashboard-specific sections
  if (statsSection) statsSection.style.display = "flex";
  if (performanceSection) performanceSection.style.display = "block";
  if (chartsSection) chartsSection.style.display = "block";

  // Refresh dashboard sections with current data
  if (dashboard.uploadedData.length > 0) {
    dashboard.updateStats(dashboard.uploadedData);
    dashboard.updatePerformanceTables(dashboard);
    dashboard.updateCharts();
  }

  dashboard.showToast("Switched to Dashboard view", "info");
}

function showAllGamesView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Hide all original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";
  document.getElementById("currentViewSection").style.display = "none";

  // Hide other dedicated view sections
  document.getElementById("allDevicesSection").style.display = "none";
  document.getElementById("appChartsSection").style.display = "none";

  // Show the dedicated games section
  document.getElementById("allGamesSection").style.display = "block";

  // Import and call the UI update function
  import("./ui-manager.js").then((UIManager) => {
    UIManager.updateGamesView(dashboard.uploadedData);
  });

  dashboard.showToast("Switched to All Games view", "info");
}

function showAllDevicesView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Hide all original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";
  document.getElementById("currentViewSection").style.display = "none";

  // Hide other dedicated view sections
  document.getElementById("allGamesSection").style.display = "none";
  document.getElementById("appChartsSection").style.display = "none";

  // Show the dedicated devices section
  document.getElementById("allDevicesSection").style.display = "block";

  // Import and call the UI update function
  import("./ui-manager.js").then((UIManager) => {
    UIManager.updateDevicesView(dashboard.uploadedData);
  });

  dashboard.showToast("Switched to All Devices view", "info");
}

function showAppChartsView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Hide all original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";
  document.getElementById("currentViewSection").style.display = "none";

  // Show the dedicated charts section
  document.getElementById("appChartsSection").style.display = "block";

  // Logic to populate the charts view would be here
  // For example: UIManager.updateAppChartsView(dashboard.uploadedData);

  dashboard.showToast("Switched to App Charts view", "info");
}

function showHotlistsView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Hide all original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";
  document.getElementById("currentViewSection").style.display = "none";

  // Hide other dedicated view sections
  document.getElementById("allGamesSection").style.display = "none";
  document.getElementById("allDevicesSection").style.display = "none";
  document.getElementById("appChartsSection").style.display = "none";

  // Remove all view classes from main content
  const mainContent = document.getElementById("mainContent");
  mainContent.classList.remove(
    "games-view",
    "devices-view",
    "charts-view",
    "hotlists-view"
  );

  // Add hotlists view class
  mainContent.classList.add("hotlists-view");

  // Show the dedicated hotlists section
  const hotlistsSection = document.getElementById("hotlistsSection");
  if (hotlistsSection) {
    hotlistsSection.style.display = "block";

    // Import and call the UI update function
    import("./ui-manager.js").then((UIManager) => {
      UIManager.updateHotlistsView(dashboard);
    });
  }

  dashboard.showToast("Switched to Hotlists view", "info");
}

function showChatbotView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Hide all original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";
  document.getElementById("currentViewSection").style.display = "none";

  // Hide other dedicated view sections
  document.getElementById("allGamesSection").style.display = "none";
  document.getElementById("allDevicesSection").style.display = "none";
  document.getElementById("appChartsSection").style.display = "none";
  document.getElementById("hotlistsSection").style.display = "none";
  document.getElementById("firebaseSection").style.display = "none";

  // Show the dedicated chatbot section
  const chatbotSection = document.getElementById("chatbotSection");
  if (chatbotSection) {
    chatbotSection.style.display = "block";

    // Activate chatbot UI
    if (window.chatbotUI) {
      window.chatbotUI.activate();
    }
  }

  dashboard.showToast("Switched to AI Chatbot view", "info");
}

function showFirebaseView(
  uploadSection,
  statsSection,
  performanceSection,
  analysisSection,
  chartsSection,
  dashboard
) {
  // Hide all original dashboard sections
  if (uploadSection) uploadSection.style.display = "none";
  if (statsSection) statsSection.style.display = "none";
  if (performanceSection) performanceSection.style.display = "none";
  if (analysisSection) analysisSection.style.display = "none";
  if (chartsSection) chartsSection.style.display = "none";
  document.getElementById("currentViewSection").style.display = "none";

  // Hide other dedicated view sections
  document.getElementById("allGamesSection").style.display = "none";
  document.getElementById("allDevicesSection").style.display = "none";
  document.getElementById("appChartsSection").style.display = "none";
  document.getElementById("hotlistsSection").style.display = "none";
  document.getElementById("chatbotSection").style.display = "none";

  // Show the dedicated Firebase section
  const firebaseSection = document.getElementById("firebaseSection");
  if (firebaseSection) {
    firebaseSection.style.display = "block";

    // Import and call the UI update function
    import("./ui-manager.js").then((UIManager) => {
      UIManager.updateFirebaseView(dashboard);
    });
  }

  dashboard.showToast("Switched to Firebase view", "info");
}
