// Enhanced Hotlist UI Module - Modern, intuitive hotlist management interface

import * as HotlistManager from "./hotlist-manager.js";
import { showToast } from "./ui-manager.js";

// Enhanced UI state management
let currentHotlistView = "list"; // Only 'list' view available
let hotlistSearchQuery = "";
let selectedHotlistIds = new Set();
let hotlistSortBy = "name"; // 'name', 'created', 'runs', 'updated'
let hotlistSortOrder = "asc"; // 'asc' or 'desc'

// Initialize enhanced hotlist UI
export function initializeEnhancedHotlistUI() {
  setupHotlistEventListeners();
  setupHotlistKeyboardShortcuts();
  updateHotlistView();
}

// Setup event listeners for enhanced hotlist functionality
function setupHotlistEventListeners() {
  // View toggle buttons - Grid view is disabled, only list view available
  const gridViewBtn = document.getElementById("hotlistGridViewBtn");
  const listViewBtn = document.getElementById("hotlistListViewBtn");

  // Disable grid button completely
  if (gridViewBtn) {
    gridViewBtn.disabled = true;
    gridViewBtn.style.opacity = "0.5";
    gridViewBtn.style.cursor = "not-allowed";
    gridViewBtn.classList.remove("active");
  }

  // Ensure list button is active
  if (listViewBtn) {
    listViewBtn.classList.add("active");
    listViewBtn.addEventListener("click", () => setHotlistView("list"));
  }

  // Search functionality
  const searchInput = document.getElementById("hotlistSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      hotlistSearchQuery = e.target.value.toLowerCase();
      updateHotlistView();
    });
  }

  // Sort functionality
  const sortSelect = document.getElementById("hotlistSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      const [sortBy, sortOrder] = e.target.value.split("-");
      hotlistSortBy = sortBy;
      hotlistSortOrder = sortOrder;
      updateHotlistView();
    });
  }

  // Bulk actions
  const selectAllBtn = document.getElementById("selectAllHotlistsBtn");
  const deleteSelectedBtn = document.getElementById(
    "deleteSelectedHotlistsBtn"
  );
  const exportSelectedBtn = document.getElementById(
    "exportSelectedHotlistsBtn"
  );

  if (selectAllBtn) {
    selectAllBtn.addEventListener("click", toggleSelectAllHotlists);
  }
  if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener("click", deleteSelectedHotlists);
  }
  if (exportSelectedBtn) {
    exportSelectedBtn.addEventListener("click", exportSelectedHotlists);
  }

  // Quick create hotlist
  const quickCreateBtn = document.getElementById("quickCreateHotlistBtn");
  if (quickCreateBtn) {
    quickCreateBtn.addEventListener("click", showQuickCreateModal);
  }
}

// Setup keyboard shortcuts for hotlist management
function setupHotlistKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Only activate shortcuts when hotlist section is visible
    const hotlistSection = document.getElementById("hotlistsSection");
    if (!hotlistSection || hotlistSection.style.display === "none") return;

    // Ctrl/Cmd + N: Create new hotlist
    if ((e.ctrlKey || e.metaKey) && e.key === "n") {
      e.preventDefault();
      showQuickCreateModal();
    }

    // Ctrl/Cmd + A: Select all hotlists
    if ((e.ctrlKey || e.metaKey) && e.key === "a") {
      e.preventDefault();
      toggleSelectAllHotlists();
    }

    // Delete key: Delete selected hotlists
    if (e.key === "Delete" && selectedHotlistIds.size > 0) {
      e.preventDefault();
      deleteSelectedHotlists();
    }

    // Escape: Clear selection
    if (e.key === "Escape") {
      clearHotlistSelection();
    }
  });
}

// Set hotlist view mode - Only list view is supported
function setHotlistView(viewMode) {
  // Force list view only
  currentHotlistView = "list";

  // Update button states - disable grid button and keep list active
  const gridBtn = document.getElementById("hotlistGridViewBtn");
  const listBtn = document.getElementById("hotlistListViewBtn");

  if (gridBtn && listBtn) {
    gridBtn.classList.remove("active");
    gridBtn.disabled = true;
    gridBtn.style.opacity = "0.5";
    gridBtn.style.cursor = "not-allowed";
    listBtn.classList.add("active");
  }

  updateHotlistView();
}

// Update the main hotlist view - List view only
function updateHotlistView() {
  const container = document.getElementById("enhancedHotlistsContainer");
  if (!container) return;

  const hotlists = getFilteredAndSortedHotlists();

  if (hotlists.length === 0) {
    container.innerHTML = createEmptyHotlistState();
    return;
  }

  // Always use list view - grid view is disabled
  container.innerHTML = createHotlistListView(hotlists);

  updateBulkActionControls();
}

// Get filtered and sorted hotlists
function getFilteredAndSortedHotlists() {
  let hotlists = HotlistManager.getAllHotlists();

  // Apply search filter
  if (hotlistSearchQuery) {
    hotlists = hotlists.filter(
      (hotlist) =>
        hotlist.name.toLowerCase().includes(hotlistSearchQuery) ||
        (hotlist.description &&
          hotlist.description.toLowerCase().includes(hotlistSearchQuery))
    );
  }

  // Apply sorting
  hotlists.sort((a, b) => {
    let aValue, bValue;

    switch (hotlistSortBy) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "created":
        aValue = new Date(a.createdAt);
        bValue = new Date(b.createdAt);
        break;
      case "updated":
        aValue = new Date(a.updatedAt || a.createdAt);
        bValue = new Date(b.updatedAt || b.createdAt);
        break;
      case "runs":
        aValue = a.runIds.length;
        bValue = b.runIds.length;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return hotlistSortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return hotlistSortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return hotlists;
}

// Create empty state for hotlists
function createEmptyHotlistState() {
  return `
    <div class="enhanced-empty-state">
      <div class="empty-state-icon">🏷️</div>
      <h3 class="empty-state-title">No Hotlists Found</h3>
      <p class="empty-state-description">
        ${
          hotlistSearchQuery
            ? `No hotlists match your search for "${hotlistSearchQuery}"`
            : "Create your first hotlist to organize and filter your performance runs"
        }
      </p>
      <div class="empty-state-actions">
        ${
          !hotlistSearchQuery
            ? `
          <button class="enhanced-btn enhanced-btn-primary" onclick="showQuickCreateModal()">
            <span class="btn-icon">➕</span>
            Create First Hotlist
          </button>
        `
            : `
          <button class="enhanced-btn enhanced-btn-secondary" onclick="clearHotlistSearch()">
            <span class="btn-icon">🔍</span>
            Clear Search
          </button>
        `
        }
      </div>
    </div>
  `;
}

// Create list view for hotlists - Proper HTML table
function createHotlistListView(hotlists) {
  return `
    <table class="enhanced-hotlist-table">
      <thead>
        <tr>
          <th class="hotlist-table-select">
            <input type="checkbox" id="selectAllHotlistsHeader" onchange="toggleSelectAllHotlists()" />
          </th>
          <th class="hotlist-table-name">Name</th>
          <th class="hotlist-table-description">Description</th>
          <th class="hotlist-table-runs">Runs</th>
          <th class="hotlist-table-created">Created</th>
          <th class="hotlist-table-actions">Actions</th>
        </tr>
      </thead>
      <tbody>
        ${hotlists.map((hotlist) => createHotlistListItem(hotlist)).join("")}
      </tbody>
    </table>
  `;
}

// Create individual hotlist card for grid view
function createHotlistCard(hotlist) {
  const isSelected = selectedHotlistIds.has(hotlist.id);
  const runCount = hotlist.runIds.length;
  const createdDate = new Date(hotlist.createdAt).toLocaleDateString();
  const updatedDate = hotlist.updatedAt
    ? new Date(hotlist.updatedAt).toLocaleDateString()
    : null;

  return `
    <div class="enhanced-hotlist-card ${
      isSelected ? "selected" : ""
    }" data-hotlist-id="${hotlist.id}">
      <div class="hotlist-card-header">
        <div class="hotlist-card-select">
          <input type="checkbox" ${isSelected ? "checked" : ""} 
                 onchange="toggleHotlistSelection('${hotlist.id}')" 
                 onclick="event.stopPropagation()" />
        </div>
        <div class="hotlist-card-menu">
          <button class="hotlist-menu-btn" onclick="showHotlistMenu('${
            hotlist.id
          }', event)">
            <span class="menu-dots">⋮</span>
          </button>
        </div>
      </div>
      
      <div class="hotlist-card-content" onclick="selectHotlistForFiltering('${
        hotlist.id
      }')">
        <div class="hotlist-card-icon">
          <span class="hotlist-icon">🏷️</span>
          ${
            runCount > 0 ? `<span class="hotlist-badge">${runCount}</span>` : ""
          }
        </div>
        
        <div class="hotlist-card-info">
          <h4 class="hotlist-card-title">${hotlist.name}</h4>
          <p class="hotlist-card-description">
            ${hotlist.description || "No description provided"}
          </p>
        </div>
      </div>
      
      <div class="hotlist-card-footer">
        <div class="hotlist-card-stats">
          <span class="hotlist-stat">
            <span class="stat-icon">📊</span>
            <span class="stat-value">${runCount}</span>
            <span class="stat-label">runs</span>
          </span>
          <span class="hotlist-stat">
            <span class="stat-icon">📅</span>
            <span class="stat-value">${createdDate}</span>
            <span class="stat-label">created</span>
          </span>
        </div>
        
        <div class="hotlist-card-actions">
          <button class="hotlist-action-btn hotlist-filter-btn" 
                  onclick="selectHotlistForFiltering('${hotlist.id}')"
                  title="Filter runs by this hotlist">
            <span class="action-icon">🔍</span>
          </button>
          <button class="hotlist-action-btn hotlist-edit-btn" 
                  onclick="editHotlist('${hotlist.id}')"
                  title="Edit hotlist">
            <span class="action-icon">✏️</span>
          </button>
          <button class="hotlist-action-btn hotlist-assign-btn" 
                  onclick="showBulkAssignModal('${hotlist.id}')"
                  title="Assign runs to hotlist">
            <span class="action-icon">➕</span>
          </button>
        </div>
      </div>
      
      ${
        updatedDate
          ? `
        <div class="hotlist-card-updated">
          <span class="updated-label">Updated: ${updatedDate}</span>
        </div>
      `
          : ""
      }
    </div>
  `;
}

// Create individual hotlist item for list view - Proper table row
function createHotlistListItem(hotlist) {
  const isSelected = selectedHotlistIds.has(hotlist.id);
  const runCount = hotlist.runIds.length;
  const createdDate = new Date(hotlist.createdAt).toLocaleDateString();

  return `
    <tr class="enhanced-hotlist-row ${
      isSelected ? "selected" : ""
    }" data-hotlist-id="${hotlist.id}">
      <td class="hotlist-table-select">
        <input type="checkbox" ${isSelected ? "checked" : ""} 
               onchange="toggleHotlistSelection('${hotlist.id}')" />
      </td>
      
      <td class="hotlist-table-name">
        <div class="hotlist-name-container">
          <span class="hotlist-icon">🏷️</span>
          <span class="hotlist-name">${hotlist.name}</span>
          ${
            runCount > 0 ? `<span class="hotlist-badge">${runCount}</span>` : ""
          }
        </div>
      </td>
      
      <td class="hotlist-table-description">
        <span class="hotlist-description" title="${
          hotlist.description || "No description"
        }">
          ${hotlist.description || "No description provided"}
        </span>
      </td>
      
      <td class="hotlist-table-runs">
        <span class="runs-count ${
          runCount === 0 ? "empty" : ""
        }">${runCount}</span>
      </td>
      
      <td class="hotlist-table-created">
        <span class="created-date">${createdDate}</span>
      </td>
      
      <td class="hotlist-table-actions">
        <div class="hotlist-action-buttons">
          <button class="hotlist-action-btn" onclick="selectHotlistForFiltering('${
            hotlist.id
          }')" title="Filter runs">
            🔍
          </button>
          <button class="hotlist-action-btn" onclick="editHotlist('${
            hotlist.id
          }')" title="Edit">
            ✏️
          </button>
          <button class="hotlist-action-btn" onclick="showBulkAssignModal('${
            hotlist.id
          }')" title="Assign runs">
            ➕
          </button>
          <button class="hotlist-action-btn danger" onclick="deleteHotlistConfirm('${
            hotlist.id
          }')" title="Delete">
            🗑️
          </button>
        </div>
      </td>
    </tr>
  `;
}

// Toggle hotlist selection
function toggleHotlistSelection(hotlistId) {
  if (selectedHotlistIds.has(hotlistId)) {
    selectedHotlistIds.delete(hotlistId);
  } else {
    selectedHotlistIds.add(hotlistId);
  }

  updateHotlistView();
}

// Toggle select all hotlists
function toggleSelectAllHotlists() {
  const hotlists = getFilteredAndSortedHotlists();

  if (selectedHotlistIds.size === hotlists.length) {
    // Deselect all
    selectedHotlistIds.clear();
  } else {
    // Select all
    hotlists.forEach((hotlist) => selectedHotlistIds.add(hotlist.id));
  }

  updateHotlistView();
}

// Clear hotlist selection
function clearHotlistSelection() {
  selectedHotlistIds.clear();
  updateHotlistView();
}

// Update bulk action controls
function updateBulkActionControls() {
  const bulkActions = document.getElementById("hotlistBulkActions");
  const selectedCount = document.getElementById("selectedHotlistsCount");

  if (bulkActions && selectedCount) {
    if (selectedHotlistIds.size > 0) {
      bulkActions.style.display = "flex";
      selectedCount.textContent = `${selectedHotlistIds.size} hotlist${
        selectedHotlistIds.size === 1 ? "" : "s"
      } selected`;
    } else {
      bulkActions.style.display = "none";
    }
  }
}

// Show quick create modal
function showQuickCreateModal() {
  const modal = document.createElement("div");
  modal.className = "enhanced-modal-overlay";
  modal.innerHTML = `
    <div class="enhanced-modal enhanced-create-hotlist-modal">
      <div class="enhanced-modal-header">
        <h3 class="modal-title">
          <span class="modal-icon">🏷️</span>
          Create New Hotlist
        </h3>
        <button class="modal-close-btn" onclick="closeEnhancedModal()">×</button>
      </div>
      
      <div class="enhanced-modal-content">
        <div class="form-group">
          <label class="form-label" for="quickHotlistName">
            <span class="label-text">Hotlist Name</span>
            <span class="label-required">*</span>
          </label>
          <input type="text" 
                 id="quickHotlistName" 
                 class="form-input" 
                 placeholder="Enter a descriptive name for your hotlist"
                 maxlength="50" />
          <div class="form-hint">Choose a clear, descriptive name (max 50 characters)</div>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="quickHotlistDescription">
            <span class="label-text">Description</span>
            <span class="label-optional">(optional)</span>
          </label>
          <textarea id="quickHotlistDescription" 
                    class="form-textarea" 
                    placeholder="Describe the purpose or criteria for this hotlist"
                    maxlength="200"
                    rows="3"></textarea>
          <div class="form-hint">Help others understand what this hotlist is for (max 200 characters)</div>
        </div>
        
        <div class="form-group">
          <label class="form-label">
            <span class="label-text">Quick Actions</span>
          </label>
          <div class="quick-action-buttons">
            <button class="quick-action-btn" onclick="setQuickHotlistTemplate('high-performance')">
              <span class="quick-icon">🚀</span>
              <span class="quick-text">High Performance</span>
            </button>
            <button class="quick-action-btn" onclick="setQuickHotlistTemplate('low-performance')">
              <span class="quick-icon">⚠️</span>
              <span class="quick-text">Low Performance</span>
            </button>
            <button class="quick-action-btn" onclick="setQuickHotlistTemplate('specific-device')">
              <span class="quick-icon">📱</span>
              <span class="quick-text">Device Specific</span>
            </button>
            <button class="quick-action-btn" onclick="setQuickHotlistTemplate('game-category')">
              <span class="quick-icon">🎮</span>
              <span class="quick-text">Game Category</span>
            </button>
          </div>
        </div>
      </div>
      
      <div class="enhanced-modal-footer">
        <button class="enhanced-btn enhanced-btn-secondary" onclick="closeEnhancedModal()">
          Cancel
        </button>
        <button class="enhanced-btn enhanced-btn-primary" onclick="createQuickHotlist()">
          <span class="btn-icon">✅</span>
          Create Hotlist
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("quickHotlistName").focus();

  // Add escape key listener
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeEnhancedModal();
    }
  });
}

// Set quick hotlist template
function setQuickHotlistTemplate(template) {
  const nameInput = document.getElementById("quickHotlistName");
  const descInput = document.getElementById("quickHotlistDescription");

  const templates = {
    "high-performance": {
      name: "High Performance Games",
      description:
        "Games that consistently achieve 60+ FPS across different devices",
    },
    "low-performance": {
      name: "Performance Issues",
      description: "Games with performance problems that need optimization",
    },
    "specific-device": {
      name: "Device Testing",
      description: "Performance data for specific device models",
    },
    "game-category": {
      name: "Game Category",
      description: "Games grouped by genre or category",
    },
  };

  const template_data = templates[template];
  if (template_data) {
    nameInput.value = template_data.name;
    descInput.value = template_data.description;
    nameInput.focus();
    nameInput.select();
  }
}

// Create quick hotlist
function createQuickHotlist() {
  const name = document.getElementById("quickHotlistName").value.trim();
  const description = document
    .getElementById("quickHotlistDescription")
    .value.trim();

  if (!name) {
    showToast("Please enter a hotlist name", "warning");
    document.getElementById("quickHotlistName").focus();
    return;
  }

  try {
    const hotlist = HotlistManager.createHotlist(name, description);
    showToast(`Hotlist "${hotlist.name}" created successfully!`, "success");
    closeEnhancedModal();
    updateHotlistView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Close enhanced modal
function closeEnhancedModal() {
  const modal = document.querySelector(".enhanced-modal-overlay");
  if (modal) {
    modal.remove();
  }
}

// Clear hotlist search
function clearHotlistSearch() {
  const searchInput = document.getElementById("hotlistSearchInput");
  if (searchInput) {
    searchInput.value = "";
    hotlistSearchQuery = "";
    updateHotlistView();
    searchInput.focus();
  }
}

// Select hotlist for filtering
function selectHotlistForFiltering(hotlistId) {
  const dashboard = window.dashboard;
  if (dashboard) {
    dashboard.setHotlistFilter(hotlistId);
    showToast("Hotlist filter applied", "success");
  }
}

// Show hotlist menu
function showHotlistMenu(hotlistId, event) {
  event.stopPropagation();

  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  // Create context menu
  const menu = document.createElement("div");
  menu.className = "enhanced-context-menu";
  menu.innerHTML = `
    <div class="context-menu-item" onclick="selectHotlistForFiltering('${hotlistId}')">
      <span class="menu-icon">🔍</span>
      <span class="menu-text">Filter Runs</span>
    </div>
    <div class="context-menu-item" onclick="editHotlist('${hotlistId}')">
      <span class="menu-icon">✏️</span>
      <span class="menu-text">Edit Hotlist</span>
    </div>
    <div class="context-menu-item" onclick="showBulkAssignModal('${hotlistId}')">
      <span class="menu-icon">➕</span>
      <span class="menu-text">Assign Runs</span>
    </div>
    <div class="context-menu-item" onclick="duplicateHotlist('${hotlistId}')">
      <span class="menu-icon">📋</span>
      <span class="menu-text">Duplicate</span>
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item" onclick="exportHotlist('${hotlistId}')">
      <span class="menu-icon">📤</span>
      <span class="menu-text">Export</span>
    </div>
    <div class="context-menu-separator"></div>
    <div class="context-menu-item danger" onclick="deleteHotlistConfirm('${hotlistId}')">
      <span class="menu-icon">🗑️</span>
      <span class="menu-text">Delete</span>
    </div>
  `;

  // Position menu
  const rect = event.target.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.zIndex = "10000";

  document.body.appendChild(menu);

  // Close menu when clicking outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };

  setTimeout(() => {
    document.addEventListener("click", closeMenu);
  }, 0);
}

// Delete selected hotlists
function deleteSelectedHotlists() {
  if (selectedHotlistIds.size === 0) return;

  const count = selectedHotlistIds.size;
  const message =
    count === 1
      ? "Are you sure you want to delete this hotlist?"
      : `Are you sure you want to delete ${count} hotlists?`;

  if (confirm(message)) {
    let deletedCount = 0;
    selectedHotlistIds.forEach((hotlistId) => {
      try {
        HotlistManager.deleteHotlist(hotlistId);
        deletedCount++;
      } catch (error) {
        console.error("Error deleting hotlist:", error);
      }
    });

    selectedHotlistIds.clear();
    showToast(
      `${deletedCount} hotlist${deletedCount === 1 ? "" : "s"} deleted`,
      "success"
    );
    updateHotlistView();
  }
}

// Export selected hotlists
function exportSelectedHotlists() {
  if (selectedHotlistIds.size === 0) return;

  const hotlists = Array.from(selectedHotlistIds)
    .map((id) => HotlistManager.getHotlistById(id))
    .filter(Boolean);

  const exportData = {
    hotlists: hotlists,
    exportedAt: new Date().toISOString(),
    version: "2.0",
    count: hotlists.length,
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `hotlists-export-${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(
    `${hotlists.length} hotlist${hotlists.length === 1 ? "" : "s"} exported`,
    "success"
  );
}

// Duplicate hotlist
function duplicateHotlist(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  try {
    const duplicatedHotlist = HotlistManager.createHotlist(
      `${hotlist.name} (Copy)`,
      hotlist.description
    );

    // Copy run assignments
    hotlist.runIds.forEach((runIndex) => {
      HotlistManager.addRunToHotlist(duplicatedHotlist.id, runIndex);
    });

    showToast(
      `Hotlist "${duplicatedHotlist.name}" created as a copy`,
      "success"
    );
    updateHotlistView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Export single hotlist
function exportHotlist(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  const exportData = {
    hotlists: [hotlist],
    exportedAt: new Date().toISOString(),
    version: "2.0",
    count: 1,
  };

  const dataStr = JSON.stringify(exportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `hotlist-${hotlist.name
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Hotlist "${hotlist.name}" exported`, "success");
}

// Add missing functions
function showBulkAssignModal(hotlistId) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  // Get all runs that are NOT in this hotlist
  const availableRuns = dashboard.uploadedData.filter(
    (_, index) => !hotlist.runIds.includes(index)
  );

  if (availableRuns.length === 0) {
    showToast("All runs are already assigned to this hotlist", "info");
    return;
  }

  const modal = document.createElement("div");
  modal.className = "enhanced-modal-overlay";
  modal.innerHTML = `
    <div class="enhanced-modal enhanced-bulk-assign-modal">
      <div class="enhanced-modal-header">
        <h3 class="modal-title">
          <span class="modal-icon">🏷️</span>
          Bulk Assign to "${hotlist.name}"
        </h3>
        <button class="modal-close-btn" onclick="closeEnhancedModal()">×</button>
      </div>
      
      <div class="enhanced-modal-content">
        <p style="color: var(--text-secondary); margin-bottom: 20px;">
          Select runs to assign to this hotlist. ${
            availableRuns.length
          } runs available.
        </p>
        
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: rgba(255, 255, 255, 0.05); position: sticky; top: 0;">
              <tr>
                <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border-color);">
                  <input type="checkbox" id="selectAllBulkRuns" onchange="toggleAllBulkRunsSelection()" />
                </th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border-color);">App</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border-color);">Device</th>
                <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border-color);">FPS</th>
              </tr>
            </thead>
            <tbody>
              ${availableRuns
                .map((run, idx) => {
                  const actualIndex = dashboard.uploadedData.indexOf(run);
                  const deviceInfo = run.deviceInfo || {};
                  const device = `${
                    deviceInfo["ro.product.manufacturer"] || "Unknown"
                  } ${deviceInfo["ro.product.model"] || "Unknown"}`;

                  return `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 8px; text-align: center;">
                      <input type="checkbox" class="bulk-run-checkbox" data-run-index="${actualIndex}" />
                    </td>
                    <td style="padding: 8px; color: var(--text-primary);">${
                      run.appName || "Unknown App"
                    }</td>
                    <td style="padding: 8px; color: var(--text-secondary); font-size: 0.9rem;">${device}</td>
                    <td style="padding: 8px; text-align: center; color: var(--accent-light); font-weight: 600;">${
                      run.avgFps ? run.avgFps.toFixed(1) : "N/A"
                    }</td>
                  </tr>
                `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="enhanced-modal-footer">
        <button class="enhanced-btn enhanced-btn-secondary" onclick="closeEnhancedModal()">
          Cancel
        </button>
        <button class="enhanced-btn enhanced-btn-primary" onclick="executeBulkAssign('${hotlistId}')">
          <span class="btn-icon">✅</span>
          Assign Selected Runs
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

function toggleAllBulkRunsSelection() {
  const selectAllCheckbox = document.getElementById("selectAllBulkRuns");
  const runCheckboxes = document.querySelectorAll(".bulk-run-checkbox");

  runCheckboxes.forEach((checkbox) => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

function executeBulkAssign(hotlistId) {
  const selectedCheckboxes = document.querySelectorAll(
    ".bulk-run-checkbox:checked"
  );

  if (selectedCheckboxes.length === 0) {
    showToast("Please select at least one run", "warning");
    return;
  }

  const runIndices = Array.from(selectedCheckboxes).map((cb) =>
    parseInt(cb.getAttribute("data-run-index"))
  );

  try {
    runIndices.forEach((runIndex) => {
      HotlistManager.addRunToHotlist(hotlistId, runIndex);
    });

    showToast(
      `Successfully assigned ${runIndices.length} runs to hotlist`,
      "success"
    );
    closeEnhancedModal();
    updateHotlistView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function editHotlist(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  const modal = document.createElement("div");
  modal.className = "enhanced-modal-overlay";
  modal.innerHTML = `
    <div class="enhanced-modal enhanced-edit-hotlist-modal">
      <div class="enhanced-modal-header">
        <h3 class="modal-title">
          <span class="modal-icon">✏️</span>
          Edit Hotlist
        </h3>
        <button class="modal-close-btn" onclick="closeEnhancedModal()">×</button>
      </div>
      
      <div class="enhanced-modal-content">
        <div class="form-group">
          <label class="form-label" for="editHotlistName">
            <span class="label-text">Hotlist Name</span>
            <span class="label-required">*</span>
          </label>
          <input type="text" 
                 id="editHotlistName" 
                 class="form-input" 
                 value="${hotlist.name}"
                 placeholder="Enter hotlist name"
                 maxlength="50" />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="editHotlistDescription">
            <span class="label-text">Description</span>
            <span class="label-optional">(optional)</span>
          </label>
          <textarea id="editHotlistDescription" 
                    class="form-textarea" 
                    placeholder="Describe the purpose or criteria for this hotlist"
                    maxlength="200"
                    rows="3">${hotlist.description || ""}</textarea>
        </div>
      </div>
      
      <div class="enhanced-modal-footer">
        <button class="enhanced-btn enhanced-btn-secondary" onclick="closeEnhancedModal()">
          Cancel
        </button>
        <button class="enhanced-btn enhanced-btn-primary" onclick="saveEditHotlist('${hotlistId}')">
          <span class="btn-icon">✅</span>
          Save Changes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("editHotlistName").focus();
}

function saveEditHotlist(hotlistId) {
  const name = document.getElementById("editHotlistName").value.trim();
  const description = document
    .getElementById("editHotlistDescription")
    .value.trim();

  if (!name) {
    showToast("Please enter a hotlist name", "warning");
    document.getElementById("editHotlistName").focus();
    return;
  }

  try {
    HotlistManager.updateHotlist(hotlistId, { name, description });
    showToast("Hotlist updated successfully!", "success");
    closeEnhancedModal();
    updateHotlistView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteHotlistConfirm(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  if (
    confirm(
      `Are you sure you want to delete "${hotlist.name}"? This action cannot be undone.`
    )
  ) {
    try {
      await HotlistManager.deleteHotlist(hotlistId);
      showToast(`Hotlist "${hotlist.name}" deleted successfully`, "success");
      updateHotlistView();
    } catch (error) {
      showToast(error.message, "error");
    }
  }
}

// Make functions globally available
window.toggleHotlistSelection = toggleHotlistSelection;
window.toggleSelectAllHotlists = toggleSelectAllHotlists;
window.clearHotlistSelection = clearHotlistSelection;
window.showQuickCreateModal = showQuickCreateModal;
window.setQuickHotlistTemplate = setQuickHotlistTemplate;
window.createQuickHotlist = createQuickHotlist;
window.closeEnhancedModal = closeEnhancedModal;
window.clearHotlistSearch = clearHotlistSearch;
window.selectHotlistForFiltering = selectHotlistForFiltering;
window.showHotlistMenu = showHotlistMenu;
window.deleteSelectedHotlists = deleteSelectedHotlists;
window.exportSelectedHotlists = exportSelectedHotlists;
window.duplicateHotlist = duplicateHotlist;
window.exportHotlist = exportHotlist;
window.showBulkAssignModal = showBulkAssignModal;
window.toggleAllBulkRunsSelection = toggleAllBulkRunsSelection;
window.executeBulkAssign = executeBulkAssign;
window.editHotlist = editHotlist;
window.saveEditHotlist = saveEditHotlist;
window.deleteHotlistConfirm = deleteHotlistConfirm;

// Export the main functions for module usage
export {
  updateHotlistView,
  setHotlistView,
  clearHotlistSelection,
  toggleSelectAllHotlists,
};
