// Hotlist Management Module - Handles hotlist creation, assignment, and filtering

// Hotlist storage and state
let hotlists = [];
let currentHotlistFilter = null;

// Initialize hotlists from localStorage
export function initializeHotlists() {
  const savedHotlists = localStorage.getItem("fps-dashboard-hotlists");
  if (savedHotlists) {
    try {
      hotlists = JSON.parse(savedHotlists);
    } catch (error) {
      console.error("Error loading hotlists from localStorage:", error);
      hotlists = [];
    }
  }
}

// Save hotlists to localStorage
function saveHotlists() {
  try {
    localStorage.setItem("fps-dashboard-hotlists", JSON.stringify(hotlists));
  } catch (error) {
    console.error("Error saving hotlists to localStorage:", error);
  }
}

// Generate unique ID for hotlists
function generateHotlistId() {
  return (
    "hotlist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
  );
}

// Create a new hotlist
export function createHotlist(name, description) {
  if (!name || name.trim() === "") {
    throw new Error("Hotlist name is required");
  }

  // Check if hotlist with same name already exists
  const existingHotlist = hotlists.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  if (existingHotlist) {
    throw new Error("A hotlist with this name already exists");
  }

  const hotlist = {
    id: generateHotlistId(),
    name: name.trim(),
    description: description ? description.trim() : "",
    createdAt: new Date().toISOString(),
    runIds: [], // Array of run indices that belong to this hotlist
  };

  hotlists.push(hotlist);
  saveHotlists();
  return hotlist;
}

// Get all hotlists
export function getAllHotlists() {
  return [...hotlists];
}

// Get hotlist by ID
export function getHotlistById(id) {
  return hotlists.find((h) => h.id === id);
}

// Update hotlist
export function updateHotlist(id, updates) {
  const hotlistIndex = hotlists.findIndex((h) => h.id === id);
  if (hotlistIndex === -1) {
    throw new Error("Hotlist not found");
  }

  // Validate name if being updated
  if (updates.name !== undefined) {
    if (!updates.name || updates.name.trim() === "") {
      throw new Error("Hotlist name is required");
    }

    // Check if another hotlist with same name exists
    const existingHotlist = hotlists.find(
      (h) => h.id !== id && h.name.toLowerCase() === updates.name.toLowerCase()
    );
    if (existingHotlist) {
      throw new Error("A hotlist with this name already exists");
    }
  }

  hotlists[hotlistIndex] = {
    ...hotlists[hotlistIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  saveHotlists();
  return hotlists[hotlistIndex];
}

// Delete hotlist
export function deleteHotlist(id) {
  const hotlistIndex = hotlists.findIndex((h) => h.id === id);
  if (hotlistIndex === -1) {
    throw new Error("Hotlist not found");
  }

  hotlists.splice(hotlistIndex, 1);
  saveHotlists();
  return true;
}

// Add run to hotlist
export function addRunToHotlist(hotlistId, runIndex) {
  const hotlist = getHotlistById(hotlistId);
  if (!hotlist) {
    throw new Error("Hotlist not found");
  }

  if (!hotlist.runIds.includes(runIndex)) {
    hotlist.runIds.push(runIndex);
    saveHotlists();
  }
  return hotlist;
}

// Remove run from hotlist
export function removeRunFromHotlist(hotlistId, runIndex) {
  const hotlist = getHotlistById(hotlistId);
  if (!hotlist) {
    throw new Error("Hotlist not found");
  }

  const index = hotlist.runIds.indexOf(runIndex);
  if (index > -1) {
    hotlist.runIds.splice(index, 1);
    saveHotlists();
  }
  return hotlist;
}

// Get runs for a specific hotlist
export function getRunsForHotlist(hotlistId, allRuns) {
  const hotlist = getHotlistById(hotlistId);
  if (!hotlist) {
    return [];
  }

  return hotlist.runIds
    .map((index) => allRuns[index])
    .filter((run) => run !== undefined);
}

// Get hotlists for a specific run
export function getHotlistsForRun(runIndex) {
  return hotlists.filter((hotlist) => hotlist.runIds.includes(runIndex));
}

// Set current hotlist filter
export function setHotlistFilter(hotlistId) {
  currentHotlistFilter = hotlistId;
}

// Clear hotlist filter
export function clearHotlistFilter() {
  currentHotlistFilter = null;
}

// Get current hotlist filter
export function getCurrentHotlistFilter() {
  return currentHotlistFilter;
}

// Filter runs by current hotlist
export function filterRunsByCurrentHotlist(allRuns) {
  if (!currentHotlistFilter) {
    return allRuns;
  }

  return getRunsForHotlist(currentHotlistFilter, allRuns);
}

// Update run indices when runs are deleted (to maintain consistency)
export function updateRunIndicesAfterDeletion(deletedIndex) {
  hotlists.forEach((hotlist) => {
    // Remove the deleted run index
    const indexToRemove = hotlist.runIds.indexOf(deletedIndex);
    if (indexToRemove > -1) {
      hotlist.runIds.splice(indexToRemove, 1);
    }

    // Update indices that are greater than the deleted index
    hotlist.runIds = hotlist.runIds.map((index) =>
      index > deletedIndex ? index - 1 : index
    );
  });
  saveHotlists();
}

// Get statistics for hotlists
export function getHotlistStats() {
  return {
    totalHotlists: hotlists.length,
    totalAssignments: hotlists.reduce(
      (sum, hotlist) => sum + hotlist.runIds.length,
      0
    ),
    averageRunsPerHotlist:
      hotlists.length > 0
        ? hotlists.reduce((sum, hotlist) => sum + hotlist.runIds.length, 0) /
          hotlists.length
        : 0,
  };
}

// Export hotlists data
export function exportHotlists() {
  return {
    hotlists: hotlists,
    exportedAt: new Date().toISOString(),
    version: "1.0",
  };
}

// Import hotlists data
export function importHotlists(data) {
  if (!data || !Array.isArray(data.hotlists)) {
    throw new Error("Invalid hotlist data format");
  }

  hotlists = data.hotlists;
  saveHotlists();
  return hotlists;
}
