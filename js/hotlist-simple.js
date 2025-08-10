// Simple and Clean Hotlist UI Module

import * as HotlistManager from "./hotlist-manager.js";
import { showToast } from "./ui-manager.js";

// Simple UI state
let searchQuery = "";
let currentFilter = HotlistManager.getCurrentHotlistFilter();

// Initialize simple hotlist UI
export function initializeSimpleHotlistUI() {
  setupEventListeners();
  updateHotlistView();
}

// Setup event listeners
function setupEventListeners() {
  // Search functionality
  const searchInput = document.getElementById("simpleHotlistSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase();
      updateHotlistView();
    });
  }

  // Sort functionality
  const sortSelect = document.getElementById("simpleHotlistSort");
  if (sortSelect) {
    sortSelect.addEventListener("change", updateHotlistView);
  }

  // Create hotlist button
  const createBtn = document.getElementById("simpleCreateHotlistBtn");
  if (createBtn) {
    createBtn.addEventListener("click", showCreateModal);
  }

  // Clear filter button
  const clearFilterBtn = document.getElementById("simpleClearFilterBtn");
  if (clearFilterBtn) {
    clearFilterBtn.addEventListener("click", clearFilter);
  }
}

// Update the main hotlist view
function updateHotlistView() {
  const container = document.getElementById("simpleHotlistsContainer");
  if (!container) return;

  const hotlists = getFilteredAndSortedHotlists();

  // Update filter indicator
  updateFilterIndicator();

  if (hotlists.length === 0) {
    container.innerHTML = createEmptyState();
    return;
  }

  container.innerHTML = `
    <div class="simple-hotlist-grid">
      ${hotlists.map(createHotlistCard).join("")}
    </div>
  `;
}

// Get filtered and sorted hotlists
function getFilteredAndSortedHotlists() {
  let hotlists = HotlistManager.getAllHotlists();

  // Apply search filter
  if (searchQuery) {
    hotlists = hotlists.filter(
      (hotlist) =>
        hotlist.name.toLowerCase().includes(searchQuery) ||
        (hotlist.description &&
          hotlist.description.toLowerCase().includes(searchQuery))
    );
  }

  // Apply sorting
  const sortSelect = document.getElementById("simpleHotlistSort");
  const sortValue = sortSelect ? sortSelect.value : "name-asc";
  const [sortBy, sortOrder] = sortValue.split("-");

  hotlists.sort((a, b) => {
    let aValue, bValue;

    switch (sortBy) {
      case "name":
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case "created":
        aValue = new Date(a.createdAt);
        bValue = new Date(b.createdAt);
        break;
      case "runs":
        aValue = a.runIds.length;
        bValue = b.runIds.length;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
    if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

  return hotlists;
}

// Create hotlist card
function createHotlistCard(hotlist) {
  const runCount = hotlist.runIds.length;
  const createdDate = new Date(hotlist.createdAt).toLocaleDateString();
  const isActive = currentFilter === hotlist.id;

  return `
    <div class="simple-hotlist-card ${isActive ? "active" : ""}" 
         onclick="applyHotlistFilter('${hotlist.id}')">
      
      ${isActive ? '<div class="active-filter-indicator">Active</div>' : ""}
      
      <div class="hotlist-card-header">
        <h3 class="hotlist-name">${hotlist.name}</h3>
        <div class="hotlist-menu">
          <button class="hotlist-menu-btn" onclick="showHotlistMenu('${
            hotlist.id
          }', event)">⋮</button>
        </div>
      </div>
      
      <div class="hotlist-description">
        ${hotlist.description || "No description provided"}
      </div>
      
      <div class="hotlist-stats">
        <div class="hotlist-run-count">
          <span>📊</span>
          <span class="run-count-number">${runCount}</span>
          <span>runs</span>
        </div>
        <div class="hotlist-created">
          Created ${createdDate}
        </div>
      </div>
    </div>
  `;
}

// Create empty state
function createEmptyState() {
  if (searchQuery) {
    return `
      <div class="simple-empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">No hotlists found</h3>
        <p class="empty-description">
          No hotlists match your search for "${searchQuery}"
        </p>
        <button class="simple-btn simple-btn-secondary" onclick="clearSearch()">
          Clear Search
        </button>
      </div>
    `;
  }

  return `
    <div class="simple-empty-state">
      <div class="empty-icon">🏷️</div>
      <h3 class="empty-title">No hotlists yet</h3>
      <p class="empty-description">
        Create your first hotlist to organize and filter your performance runs
      </p>
      <button class="simple-btn simple-btn-primary" onclick="showCreateModal()">
        <span>➕</span>
        Create First Hotlist
      </button>
    </div>
  `;
}

// Show create modal
function showCreateModal() {
  const modal = document.createElement("div");
  modal.className = "simple-modal-overlay";
  modal.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-header">
        <h3 class="modal-title">
          <span>🏷️</span>
          Create New Hotlist
        </h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      
      <div class="simple-modal-content">
        <div class="form-group">
          <label class="form-label" for="hotlistName">Name *</label>
          <input type="text" 
                 id="hotlistName" 
                 class="form-input" 
                 placeholder="Enter hotlist name"
                 maxlength="50" />
          <div class="form-hint">Choose a clear, descriptive name</div>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="hotlistDescription">Description</label>
          <textarea id="hotlistDescription" 
                    class="form-textarea" 
                    placeholder="Describe the purpose of this hotlist (optional)"
                    maxlength="200"
                    rows="3"></textarea>
          <div class="form-hint">Help others understand what this hotlist is for</div>
        </div>
      </div>
      
      <div class="simple-modal-footer">
        <button class="simple-btn simple-btn-secondary" onclick="closeModal()">
          Cancel
        </button>
        <button class="simple-btn simple-btn-primary" onclick="createHotlist()">
          <span>✅</span>
          Create Hotlist
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("hotlistName").focus();

  // Close on escape key
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
  });
}

// Show edit modal
function showEditModal(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  const modal = document.createElement("div");
  modal.className = "simple-modal-overlay";
  modal.innerHTML = `
    <div class="simple-modal">
      <div class="simple-modal-header">
        <h3 class="modal-title">
          <span>✏️</span>
          Edit Hotlist
        </h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      
      <div class="simple-modal-content">
        <div class="form-group">
          <label class="form-label" for="editHotlistName">Name *</label>
          <input type="text" 
                 id="editHotlistName" 
                 class="form-input" 
                 value="${hotlist.name}"
                 maxlength="50" />
        </div>
        
        <div class="form-group">
          <label class="form-label" for="editHotlistDescription">Description</label>
          <textarea id="editHotlistDescription" 
                    class="form-textarea" 
                    maxlength="200"
                    rows="3">${hotlist.description || ""}</textarea>
        </div>
      </div>
      
      <div class="simple-modal-footer">
        <button class="simple-btn simple-btn-secondary" onclick="closeModal()">
          Cancel
        </button>
        <button class="simple-btn simple-btn-primary" onclick="saveEditHotlist('${hotlistId}')">
          <span>✅</span>
          Save Changes
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById("editHotlistName").focus();
}

// Create hotlist
function createHotlist() {
  const name = document.getElementById("hotlistName").value.trim();
  const description = document
    .getElementById("hotlistDescription")
    .value.trim();

  if (!name) {
    showToast("Please enter a hotlist name", "warning");
    document.getElementById("hotlistName").focus();
    return;
  }

  try {
    const hotlist = HotlistManager.createHotlist(name, description);
    showToast(`Hotlist "${hotlist.name}" created successfully!`, "success");
    closeModal();
    updateHotlistView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Save edit hotlist
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
    closeModal();
    updateHotlistView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Close modal
function closeModal() {
  const modal = document.querySelector(".simple-modal-overlay");
  if (modal) {
    modal.remove();
  }
}

// Apply hotlist filter
function applyHotlistFilter(hotlistId) {
  const dashboard = window.dashboard;
  if (dashboard) {
    if (currentFilter === hotlistId) {
      // If clicking the same hotlist, clear the filter
      dashboard.clearHotlistFilter();
      currentFilter = null;
      showToast("Hotlist filter cleared", "info");
    } else {
      // Apply new filter
      dashboard.setHotlistFilter(hotlistId);
      currentFilter = hotlistId;
      const hotlist = HotlistManager.getHotlistById(hotlistId);
      showToast(`Filtering by "${hotlist.name}"`, "success");
    }
    updateHotlistView();
  }
}

// Clear filter
function clearFilter() {
  const dashboard = window.dashboard;
  if (dashboard) {
    dashboard.clearHotlistFilter();
    currentFilter = null;
    showToast("Hotlist filter cleared", "info");
    updateHotlistView();
  }
}

// Update filter indicator
function updateFilterIndicator() {
  const clearBtn = document.getElementById("simpleClearFilterBtn");
  if (clearBtn) {
    if (currentFilter) {
      clearBtn.style.display = "inline-flex";
      const hotlist = HotlistManager.getHotlistById(currentFilter);
      clearBtn.textContent = `Clear "${
        hotlist ? hotlist.name : "Unknown"
      }" filter`;
    } else {
      clearBtn.style.display = "none";
    }
  }
}

// Show hotlist context menu
function showHotlistMenu(hotlistId, event) {
  event.stopPropagation();

  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  // Remove existing menu
  const existingMenu = document.querySelector(".simple-context-menu");
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement("div");
  menu.className = "simple-context-menu";
  menu.innerHTML = `
    <div class="context-menu-item" onclick="applyHotlistFilter('${hotlistId}')">
      <span class="menu-icon">🔍</span>
      <span>${
        currentFilter === hotlistId ? "Clear Filter" : "Apply Filter"
      }</span>
    </div>
    <div class="context-menu-item" onclick="showEditModal('${hotlistId}')">
      <span class="menu-icon">✏️</span>
      <span>Edit</span>
    </div>
    <div class="context-menu-item" onclick="showManageRunsModal('${hotlistId}')">
      <span class="menu-icon">📊</span>
      <span>Manage Runs</span>
    </div>
    <div class="context-menu-item danger" onclick="deleteHotlist('${hotlistId}')">
      <span class="menu-icon">🗑️</span>
      <span>Delete</span>
    </div>
  `;

  // Position menu
  const rect = event.target.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 5}px`;
  menu.style.left = `${rect.left}px`;

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

// Show manage runs modal
function showManageRunsModal(hotlistId) {
  const dashboard = window.dashboard;
  if (!dashboard) return;

  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  const modal = document.createElement("div");
  modal.className = "simple-modal-overlay";
  modal.innerHTML = `
    <div class="simple-modal" style="max-width: 700px;">
      <div class="simple-modal-header">
        <h3 class="modal-title">
          <span>📊</span>
          Manage Runs - ${hotlist.name}
        </h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      
      <div class="simple-modal-content">
        <p style="color: var(--text-secondary); margin-bottom: 20px;">
          Select runs to add or remove from this hotlist.
        </p>
        
        <div style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead style="background: rgba(255, 255, 255, 0.05); position: sticky; top: 0;">
              <tr>
                <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border-color);">In Hotlist</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border-color);">App</th>
                <th style="padding: 10px; text-align: left; border-bottom: 1px solid var(--border-color);">Device</th>
                <th style="padding: 10px; text-align: center; border-bottom: 1px solid var(--border-color);">FPS</th>
              </tr>
            </thead>
            <tbody>
              ${dashboard.uploadedData
                .map((run, index) => {
                  const isInHotlist = hotlist.runIds.includes(index);
                  const deviceInfo = run.deviceInfo || {};
                  const device = `${
                    deviceInfo["ro.product.manufacturer"] || "Unknown"
                  } ${deviceInfo["ro.product.model"] || "Unknown"}`;

                  return `
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 8px; text-align: center;">
                      <input type="checkbox" ${isInHotlist ? "checked" : ""} 
                             onchange="toggleRunInHotlist('${hotlistId}', ${index}, this.checked)" />
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
      
      <div class="simple-modal-footer">
        <button class="simple-btn simple-btn-primary" onclick="closeModal()">
          <span>✅</span>
          Done
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// Toggle run in hotlist
function toggleRunInHotlist(hotlistId, runIndex, isChecked) {
  try {
    if (isChecked) {
      HotlistManager.addRunToHotlist(hotlistId, runIndex);
    } else {
      HotlistManager.removeRunFromHotlist(hotlistId, runIndex);
    }
    updateHotlistView();
  } catch (error) {
    showToast(error.message, "error");
  }
}

// Delete hotlist
function deleteHotlist(hotlistId) {
  const hotlist = HotlistManager.getHotlistById(hotlistId);
  if (!hotlist) return;

  if (
    confirm(
      `Are you sure you want to delete "${hotlist.name}"? This action cannot be undone.`
    )
  ) {
    try {
      HotlistManager.deleteHotlist(hotlistId);

      // Clear filter if this hotlist was active
      if (currentFilter === hotlistId) {
        currentFilter = null;
        const dashboard = window.dashboard;
        if (dashboard) {
          dashboard.clearHotlistFilter();
        }
      }

      showToast(`Hotlist "${hotlist.name}" deleted`, "success");
      updateHotlistView();
    } catch (error) {
      showToast(error.message, "error");
    }
  }
}

// Clear search
function clearSearch() {
  const searchInput = document.getElementById("simpleHotlistSearch");
  if (searchInput) {
    searchInput.value = "";
    searchQuery = "";
    updateHotlistView();
    searchInput.focus();
  }
}

// Update current filter when changed externally
export function updateCurrentFilter() {
  currentFilter = HotlistManager.getCurrentHotlistFilter();
  updateHotlistView();
}

// Make functions globally available
window.showCreateModal = showCreateModal;
window.showEditModal = showEditModal;
window.createHotlist = createHotlist;
window.saveEditHotlist = saveEditHotlist;
window.closeModal = closeModal;
window.applyHotlistFilter = applyHotlistFilter;
window.clearFilter = clearFilter;
window.showHotlistMenu = showHotlistMenu;
window.showManageRunsModal = showManageRunsModal;
window.toggleRunInHotlist = toggleRunInHotlist;
window.deleteHotlist = deleteHotlist;
window.clearSearch = clearSearch;

// Export main functions
export { updateHotlistView, updateCurrentFilter };
