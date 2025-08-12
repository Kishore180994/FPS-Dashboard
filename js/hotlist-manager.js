// Hotlist Management Module - Handles hotlist creation, assignment, and filtering

import { firebaseService } from "./firebase-service.js";

// Hotlist storage and state
let hotlists = [];
let currentHotlistFilter = null;

// Initialize hotlists from Firebase and localStorage (fallback)
export async function initializeHotlists() {
  try {
    // Try to load from Firebase first
    if (firebaseService.isConnected()) {
      hotlists = await firebaseService.loadAllHotlists();
      console.log(`Loaded ${hotlists.length} hotlists from Firebase`);
    } else {
      // Fallback to localStorage
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
  } catch (error) {
    console.error("Error initializing hotlists:", error);
    // Fallback to localStorage
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
export async function createHotlist(name, description) {
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

  // Save to Firebase first if connected
  if (firebaseService.isConnected()) {
    try {
      const firebaseId = await firebaseService.createHotlist(hotlist);
      hotlist.firebaseId = firebaseId; // Store Firebase document ID
      console.log(`Hotlist created in Firebase with ID: ${firebaseId}`);
    } catch (error) {
      console.error("Error creating hotlist in Firebase:", error);
      // Continue with local storage even if Firebase fails
    }
  }

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
export async function updateHotlist(id, updates) {
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

  const updatedHotlist = {
    ...hotlists[hotlistIndex],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Update in Firebase if connected and has Firebase ID
  if (firebaseService.isConnected() && updatedHotlist.firebaseId) {
    try {
      await firebaseService.updateHotlist(updatedHotlist.firebaseId, updates);
      console.log(`Hotlist updated in Firebase: ${updatedHotlist.firebaseId}`);
    } catch (error) {
      console.error("Error updating hotlist in Firebase:", error);
      // Continue with local update even if Firebase fails
    }
  }

  hotlists[hotlistIndex] = updatedHotlist;
  saveHotlists();
  return hotlists[hotlistIndex];
}

// Delete hotlist
export async function deleteHotlist(id) {
  const hotlistIndex = hotlists.findIndex((h) => h.id === id);
  if (hotlistIndex === -1) {
    throw new Error("Hotlist not found");
  }

  const hotlist = hotlists[hotlistIndex];

  // Delete from Firebase if connected and has Firebase ID
  if (firebaseService.isConnected() && hotlist.firebaseId) {
    try {
      await firebaseService.deleteHotlist(hotlist.firebaseId);
      console.log(`Hotlist deleted from Firebase: ${hotlist.firebaseId}`);
    } catch (error) {
      console.error("Error deleting hotlist from Firebase:", error);
      // Continue with local deletion even if Firebase fails
    }
  }

  hotlists.splice(hotlistIndex, 1);
  saveHotlists();
  return true;
}

// Add run to hotlist (with Firebase integration)
export async function addRunToHotlist(
  hotlistId,
  runIndex,
  fpsDataId = null,
  runData = null
) {
  const hotlist = getHotlistById(hotlistId);
  if (!hotlist) {
    throw new Error("Hotlist not found");
  }

  if (!hotlist.runIds.includes(runIndex)) {
    hotlist.runIds.push(runIndex);
    saveHotlists();

    // Also update Firebase hotlist collection
    if (firebaseService.isConnected()) {
      try {
        // If fpsDataId is provided, use it directly
        if (fpsDataId) {
          await firebaseService.addToHotlistCollection(hotlist.name, fpsDataId);
          console.log(
            `Added FPS data ${fpsDataId} to Firebase hotlist: ${hotlist.name}`
          );
        }
        // If runData is provided and has an id, use that
        else if (runData && runData.id) {
          await firebaseService.addToHotlistCollection(
            hotlist.name,
            runData.id
          );
          console.log(
            `Added FPS data ${runData.id} to Firebase hotlist: ${hotlist.name}`
          );
        }
        // Otherwise, just create/update the hotlist structure without the specific reference
        else {
          console.warn(
            `No Firebase ID available for run ${runIndex}, hotlist updated locally only`
          );
        }
      } catch (error) {
        console.error("Error updating Firebase hotlist collection:", error);
      }
    }
  }
  return hotlist;
}

// Remove run from hotlist (with Firebase integration)
export async function removeRunFromHotlist(
  hotlistId,
  runIndex,
  fpsDataId = null,
  runData = null
) {
  const hotlist = getHotlistById(hotlistId);
  if (!hotlist) {
    throw new Error("Hotlist not found");
  }

  const index = hotlist.runIds.indexOf(runIndex);
  if (index > -1) {
    hotlist.runIds.splice(index, 1);
    saveHotlists();

    // Also update Firebase hotlist collection
    if (firebaseService.isConnected()) {
      try {
        // If fpsDataId is provided, use it directly
        if (fpsDataId) {
          await firebaseService.removeFromHotlistCollection(
            hotlist.name,
            fpsDataId
          );
          console.log(
            `Removed FPS data ${fpsDataId} from Firebase hotlist: ${hotlist.name}`
          );
        }
        // If runData is provided and has an id, use that
        else if (runData && runData.id) {
          await firebaseService.removeFromHotlistCollection(
            hotlist.name,
            runData.id
          );
          console.log(
            `Removed FPS data ${runData.id} from Firebase hotlist: ${hotlist.name}`
          );
        }
        // Otherwise, just update locally
        else {
          console.warn(
            `No Firebase ID available for run ${runIndex}, hotlist updated locally only`
          );
        }
      } catch (error) {
        console.error("Error updating Firebase hotlist collection:", error);
      }
    }
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
  return hotlists.filter(
    (hotlist) => hotlist.runIds && hotlist.runIds.includes(runIndex)
  );
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

// Synchronize hotlist references with local data after loading from Firebase
export function synchronizeHotlistReferences(firebaseDataIds) {
  if (!firebaseDataIds || firebaseDataIds.size === 0) {
    console.log(
      "No Firebase data mapping available for hotlist synchronization"
    );
    return;
  }

  // Create reverse mapping: Firebase document ID → local array index
  const firebaseIdToLocalIndex = new Map();
  for (const [localIndex, firebaseId] of firebaseDataIds.entries()) {
    firebaseIdToLocalIndex.set(firebaseId, localIndex);
  }

  let updatedCount = 0;

  // Update each hotlist's runIds to use local indices instead of Firebase IDs
  hotlists.forEach((hotlist) => {
    if (hotlist.runIds && Array.isArray(hotlist.runIds)) {
      const originalRunIds = [...hotlist.runIds];
      const newRunIds = [];

      for (const runId of originalRunIds) {
        // If runId is a Firebase document ID, convert it to local index
        if (typeof runId === "string" && firebaseIdToLocalIndex.has(runId)) {
          const localIndex = firebaseIdToLocalIndex.get(runId);
          newRunIds.push(localIndex);
          updatedCount++;
        }
        // If runId is already a local index (number), keep it
        else if (typeof runId === "number") {
          newRunIds.push(runId);
        }
        // Skip invalid references
        else {
          console.warn(
            `Invalid run reference in hotlist ${hotlist.name}: ${runId}`
          );
        }
      }

      hotlist.runIds = newRunIds;
    }
  });

  if (updatedCount > 0) {
    console.log(
      `Synchronized ${updatedCount} hotlist references from Firebase IDs to local indices`
    );
    saveHotlists();
  }
}
