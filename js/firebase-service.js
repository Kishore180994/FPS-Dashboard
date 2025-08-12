// Firebase Service Module - Handles all Firebase operations for FPS Dashboard

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-analytics.js";
import {
  initializeFirestore,
  setLogLevel, // optional: for debugging
  collection,
  addDoc,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyD5lsgItkVmZV7T2o3x4DBeXQlrRPahsxQ",
  authDomain: "fps-dashboard.firebaseapp.com",
  projectId: "fps-dashboard",
  storageBucket: "fps-dashboard.appspot.com",
  messagingSenderId: "403710119529",
  appId: "1:403710119529:web:838fc9b422286a7b9dcf8",
  measurementId: "G-4339LZDXEZ",
};

// --- INIT ---
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics not initialized:", e?.message || e);
}

// --- CONSTANTS ---
const COLLECTIONS = {
  FPS_DATA: "fps_data",
  DEVICES: "devices",
  PACKAGE_NAMES: "package_names",
  HOTLISTS: "hotlists",
  USER_SESSIONS: "user_sessions",
};

// --- SERVICE ---
export class FirebaseService {
  constructor() {
    this.db = db;
    this.analytics = analytics;
    this.isInitialized = true;
  }

  // ========== AGENT-FACING CORE METHODS ==========

  async queryFpsRunsAdvanced(filters = {}) {
    const {
      text,
      appName,
      packageName,
      deviceModel,
      board,
      brand,
      socModel,
      socManufacturer,
      dateFrom,
      dateTo,
      date,
      minAvgFps,
      maxAvgFps,
      minJankPct,
      maxJankPct,
      orderBy: ob = "createdAt",
      orderDirection: dir = "desc",
      limit: lim = 2000, // Increased limit for better summaries
      withRaw = false,
    } = filters;

    let qRef = collection(this.db, "fps_data");

    // Equality filters
    if (appName) qRef = query(qRef, where("appName", "==", appName));
    if (packageName)
      qRef = query(qRef, where("packageName", "==", packageName));
    if (deviceModel)
      qRef = query(
        qRef,
        where("deviceInfo.ro.product.model", "==", deviceModel)
      );
    if (board)
      qRef = query(qRef, where("deviceInfo.ro.product.board", "==", board));
    if (brand)
      qRef = query(qRef, where("deviceInfo.ro.oem.brand", "==", brand));
    if (socModel)
      qRef = query(qRef, where("deviceInfo.ro.soc.model", "==", socModel));
    if (socManufacturer)
      qRef = query(
        qRef,
        where("deviceInfo.ro.soc.manufacturer", "==", socManufacturer)
      );

    // Date filters
    if (date) {
      const { start, end } = this.#toDayBounds(new Date(date));
      qRef = query(
        qRef,
        where("createdAt", ">=", start),
        where("createdAt", "<", end)
      );
    } else {
      if (dateFrom)
        qRef = query(qRef, where("createdAt", ">=", new Date(dateFrom)));
      if (dateTo)
        qRef = query(qRef, where("createdAt", "<=", new Date(dateTo)));
    }

    // Numeric range filters
    if (minAvgFps != null)
      qRef = query(qRef, where("avgFps", ">=", Number(minAvgFps)));
    if (maxAvgFps != null)
      qRef = query(qRef, where("avgFps", "<=", Number(maxAvgFps)));
    if (minJankPct != null)
      qRef = query(
        qRef,
        where("jankInstabilityPercentage", ">=", Number(minJankPct))
      );
    if (maxJankPct != null)
      qRef = query(
        qRef,
        where("jankInstabilityPercentage", "<=", Number(maxJankPct))
      );

    // Order and limit
    qRef = query(qRef, orderBy(ob, dir), limit(lim));

    const snap = await getDocs(qRef);
    let docs = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
      if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
      docs.push({ id: d.id, ...data });
    });

    if (text) docs = this.applyClientTextFilter(docs, text);
    if (!withRaw) docs = docs.map((x) => this.stripRaw(x));

    return { docs };
  }

  groupAndSummarize(docs, { by = "appName" } = {}) {
    const keyOf = (d) => {
      if (by === "deviceModel") return d?.deviceInfo?.["ro.product.model"];
      if (by === "board") return d?.deviceInfo?.["ro.product.board"];
      if (by === "brand") return d?.deviceInfo?.["ro.oem.brand"];
      if (by === "socModel") return d?.deviceInfo?.["ro.soc.model"];
      if (by === "socManufacturer")
        return d?.deviceInfo?.["ro.soc.manufacturer"];
      if (by === "day") {
        const dt =
          d.createdAt instanceof Date ? d.createdAt : new Date(d.createdAt);
        return dt.toISOString().slice(0, 10);
      }
      return d[by];
    };

    const groups = new Map();
    for (const d of docs) {
      const k = keyOf(d);
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(d);
    }

    const stats = [];
    for (const [k, arr] of groups.entries()) {
      const n = arr.length;
      const fpsValues = arr.map((x) => x.avgFps || 0);
      const jankValues = arr.map((x) => x.jankInstabilityPercentage || 0);
      const avgFps = fpsValues.reduce((s, v) => s + v, 0) / Math.max(1, n);
      const avgJank = jankValues.reduce((s, v) => s + v, 0) / Math.max(1, n);

      stats.push({
        key: k,
        runCount: n,
        avgFps: +avgFps.toFixed(2),
        minAvgFps: Math.min(...fpsValues),
        maxAvgFps: Math.max(...fpsValues),
        avgJank: +avgJank.toFixed(2),
      });
    }
    stats.sort((a, b) => b.avgFps - a.avgFps);
    return stats;
  }

  // ========== DATA MANAGEMENT & CRUD METHODS ==========

  /**
   * **FIX:** Re-added for dashboard initialization.
   * Load all FPS data (optionally limited) for the main UI table.
   */
  async loadAllFPSData(limitCount = null) {
    try {
      let q = query(
        collection(this.db, COLLECTIONS.FPS_DATA),
        orderBy("createdAt", "desc")
      );
      if (limitCount) {
        q = query(q, limit(limitCount));
      }
      const snap = await getDocs(q);
      const arr = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        arr.push({ id: d.id, ...data });
      });
      console.log(`Loaded ${arr.length} FPS data records from Firebase`);
      return arr;
    } catch (error) {
      console.error("Error loading FPS data:", error);
      throw new Error(`Failed to load FPS data: ${error.message}`);
    }
  }

  /**
   * **FIX:** Re-added for hotlist manager initialization.
   * Load all hotlists for the UI.
   */
  async loadAllHotlists() {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.HOTLISTS),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const hotlists = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        hotlists.push({ id: d.id, ...data });
      });
      console.log(`Loaded ${hotlists.length} hotlists from Firebase`);
      return hotlists;
    } catch (error) {
      console.error("Error loading hotlists:", error);
      throw new Error(`Failed to load hotlists: ${error.message}`);
    }
  }

  async saveFPSData(fpsData) {
    try {
      const dataToStore = {
        ...fpsData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        hasRawData: !!fpsData?.rawFpsData,
        rawDataSize: fpsData?.rawFpsData ? fpsData.rawFpsData.length : 0,
      };

      const ref = await addDoc(
        collection(this.db, COLLECTIONS.FPS_DATA),
        dataToStore
      );
      console.log("FPS data saved with ID:", ref.id);

      if (fpsData.deviceInfo?.["ro.oem.brand"]) {
        await this.updateDeviceCollection(
          fpsData.deviceInfo["ro.oem.brand"],
          ref.id,
          fpsData
        );
      }
      if (fpsData.packageName) {
        await this.updatePackageNameCollection(
          fpsData.packageName,
          ref.id,
          fpsData
        );
      }

      return ref.id;
    } catch (error) {
      console.error("Error saving FPS data:", error);
      throw new Error(`Failed to save FPS data: ${error.message}`);
    }
  }

  async deleteFPSData(documentId) {
    try {
      const fpsDocSnap = await getDoc(
        doc(this.db, COLLECTIONS.FPS_DATA, documentId)
      );
      if (fpsDocSnap.exists()) {
        const fpsData = fpsDocSnap.data();
        if (fpsData.deviceInfo?.["ro.oem.brand"]) {
          await this.cleanupDeviceReference(
            fpsData.deviceInfo["ro.oem.brand"],
            documentId
          );
        }
        if (fpsData.packageName) {
          await this.cleanupPackageNameReference(
            fpsData.packageName,
            documentId
          );
        }
        await this.cleanupHotlistReferences(documentId);
      }
      await deleteDoc(doc(this.db, COLLECTIONS.FPS_DATA, documentId));
      console.log("FPS data deleted with ID:", documentId);
    } catch (error) {
      console.error("Error deleting FPS data:", error);
      throw new Error(`Failed to delete FPS data: ${error.message}`);
    }
  }

  // ========== HOTLIST MANAGEMENT METHODS ==========

  /**
   * Create or update a hotlist in Firebase
   * @param {string} hotlistName - Name of the hotlist
   * @param {string} fpsDataId - FPS data ID to add (optional)
   * @returns {Promise<string>} - Document ID of the hotlist
   */
  async addToHotlistCollection(hotlistName, fpsDataId = null) {
    try {
      // Check if hotlist already exists
      const q = query(
        collection(this.db, COLLECTIONS.HOTLISTS),
        where("name", "==", hotlistName)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        // Create new hotlist
        const hotlistData = {
          name: hotlistName,
          fpsDataReferences: fpsDataId ? [fpsDataId] : [],
          totalRecords: fpsDataId ? 1 : 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(
          collection(this.db, COLLECTIONS.HOTLISTS),
          hotlistData
        );
        console.log(
          `Created new hotlist in Firebase: ${hotlistName} with ID: ${docRef.id}`
        );
        return docRef.id;
      } else {
        // Update existing hotlist
        const hotlistDoc = snap.docs[0];
        const existingData = hotlistDoc.data();

        if (fpsDataId && !existingData.fpsDataReferences.includes(fpsDataId)) {
          await updateDoc(doc(this.db, COLLECTIONS.HOTLISTS, hotlistDoc.id), {
            fpsDataReferences: [...existingData.fpsDataReferences, fpsDataId],
            totalRecords: (existingData.totalRecords || 0) + 1,
            updatedAt: serverTimestamp(),
          });
          console.log(
            `Added FPS data ${fpsDataId} to existing hotlist: ${hotlistName}`
          );
        }
        return hotlistDoc.id;
      }
    } catch (error) {
      console.error("Error adding to hotlist collection:", error);
      throw new Error(`Failed to add to hotlist collection: ${error.message}`);
    }
  }

  /**
   * Remove FPS data from a hotlist in Firebase
   * @param {string} hotlistName - Name of the hotlist
   * @param {string} fpsDataId - FPS data ID to remove
   * @returns {Promise<void>}
   */
  async removeFromHotlistCollection(hotlistName, fpsDataId) {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.HOTLISTS),
        where("name", "==", hotlistName)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        const hotlistDoc = snap.docs[0];
        const existingData = hotlistDoc.data();
        const updatedReferences = existingData.fpsDataReferences.filter(
          (ref) => ref !== fpsDataId
        );

        if (updatedReferences.length === 0) {
          // Delete hotlist if no references remain
          await deleteDoc(doc(this.db, COLLECTIONS.HOTLISTS, hotlistDoc.id));
          console.log(`Deleted empty hotlist from Firebase: ${hotlistName}`);
        } else {
          // Update hotlist with remaining references
          await updateDoc(doc(this.db, COLLECTIONS.HOTLISTS, hotlistDoc.id), {
            fpsDataReferences: updatedReferences,
            totalRecords: updatedReferences.length,
            updatedAt: serverTimestamp(),
          });
          console.log(
            `Removed FPS data ${fpsDataId} from hotlist: ${hotlistName}`
          );
        }
      }
    } catch (error) {
      console.error("Error removing from hotlist collection:", error);
      throw new Error(
        `Failed to remove from hotlist collection: ${error.message}`
      );
    }
  }

  /**
   * Create a hotlist document in Firebase
   * @param {Object} hotlistData - Hotlist data object
   * @returns {Promise<string>} - Document ID of the created hotlist
   */
  async createHotlist(hotlistData) {
    try {
      const dataToStore = {
        ...hotlistData,
        fpsDataReferences: hotlistData.runIds || [],
        totalRecords: hotlistData.runIds ? hotlistData.runIds.length : 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(
        collection(this.db, COLLECTIONS.HOTLISTS),
        dataToStore
      );
      console.log("Hotlist created in Firebase with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("Error creating hotlist:", error);
      throw new Error(`Failed to create hotlist: ${error.message}`);
    }
  }

  /**
   * Update a hotlist document in Firebase
   * @param {string} hotlistId - Firebase document ID of the hotlist
   * @param {Object} updates - Updates to apply
   * @returns {Promise<void>}
   */
  async updateHotlist(hotlistId, updates) {
    try {
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      if (updates.runIds) {
        updateData.fpsDataReferences = updates.runIds;
        updateData.totalRecords = updates.runIds.length;
      }

      await updateDoc(
        doc(this.db, COLLECTIONS.HOTLISTS, hotlistId),
        updateData
      );
      console.log("Hotlist updated in Firebase:", hotlistId);
    } catch (error) {
      console.error("Error updating hotlist:", error);
      throw new Error(`Failed to update hotlist: ${error.message}`);
    }
  }

  /**
   * Delete a hotlist document from Firebase
   * @param {string} hotlistId - Firebase document ID of the hotlist
   * @returns {Promise<void>}
   */
  async deleteHotlist(hotlistId) {
    try {
      await deleteDoc(doc(this.db, COLLECTIONS.HOTLISTS, hotlistId));
      console.log("Hotlist deleted from Firebase:", hotlistId);
    } catch (error) {
      console.error("Error deleting hotlist:", error);
      throw new Error(`Failed to delete hotlist: ${error.message}`);
    }
  }

  /**
   * Get a specific hotlist by Firebase document ID
   * @param {string} hotlistId - Firebase document ID
   * @returns {Promise<Object|null>} - Hotlist data or null if not found
   */
  async getHotlist(hotlistId) {
    try {
      const docSnap = await getDoc(
        doc(this.db, COLLECTIONS.HOTLISTS, hotlistId)
      );
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        return { id: docSnap.id, ...data };
      }
      return null;
    } catch (error) {
      console.error("Error getting hotlist:", error);
      throw new Error(`Failed to get hotlist: ${error.message}`);
    }
  }

  // ========== COLLECTION & REFERENCE MANAGEMENT ==========

  async cleanupDeviceReference(oemBrand, fpsDataId) {
    const q = query(
      collection(this.db, COLLECTIONS.DEVICES),
      where("oemBrand", "==", oemBrand)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const deviceDoc = snap.docs[0];
    const updatedReferences = deviceDoc
      .data()
      .fpsDataReferences.filter((ref) => ref !== fpsDataId);
    if (updatedReferences.length === 0) {
      await deleteDoc(doc(this.db, COLLECTIONS.DEVICES, deviceDoc.id));
    } else {
      await updateDoc(doc(this.db, COLLECTIONS.DEVICES, deviceDoc.id), {
        fpsDataReferences: updatedReferences,
        totalRecords: updatedReferences.length,
        updatedAt: serverTimestamp(),
      });
    }
  }

  async cleanupPackageNameReference(packageName, fpsDataId) {
    const q = query(
      collection(this.db, COLLECTIONS.PACKAGE_NAMES),
      where("packageName", "==", packageName)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const packageDoc = snap.docs[0];
    const updatedReferences = packageDoc
      .data()
      .fpsDataReferences.filter((ref) => ref !== fpsDataId);
    if (updatedReferences.length === 0) {
      await deleteDoc(doc(this.db, COLLECTIONS.PACKAGE_NAMES, packageDoc.id));
    } else {
      await updateDoc(doc(this.db, COLLECTIONS.PACKAGE_NAMES, packageDoc.id), {
        fpsDataReferences: updatedReferences,
        totalRecords: updatedReferences.length,
        updatedAt: serverTimestamp(),
      });
    }
  }

  async cleanupHotlistReferences(fpsDataId) {
    const snap = await getDocs(
      query(collection(this.db, COLLECTIONS.HOTLISTS))
    );
    const cleanupPromises = [];
    snap.forEach((hotlistDoc) => {
      const hotlistData = hotlistDoc.data();
      if (hotlistData.fpsDataReferences?.includes(fpsDataId)) {
        const updatedReferences = hotlistData.fpsDataReferences.filter(
          (ref) => ref !== fpsDataId
        );
        if (updatedReferences.length === 0) {
          cleanupPromises.push(
            deleteDoc(doc(this.db, COLLECTIONS.HOTLISTS, hotlistDoc.id))
          );
        } else {
          cleanupPromises.push(
            updateDoc(doc(this.db, COLLECTIONS.HOTLISTS, hotlistDoc.id), {
              fpsDataReferences: updatedReferences,
              totalRecords: updatedReferences.length,
              updatedAt: serverTimestamp(),
            })
          );
        }
      }
    });
    await Promise.all(cleanupPromises);
  }

  async updateDeviceCollection(oemBrand, fpsDataId, fpsData) {
    const deviceModel = fpsData.deviceInfo?.["ro.product.model"] || "Unknown";
    const deviceBoard = fpsData.deviceInfo?.["ro.product.board"] || "Unknown";
    const socModel = fpsData.deviceInfo?.["ro.soc.model"] || "Unknown";
    const q = query(
      collection(this.db, COLLECTIONS.DEVICES),
      where("oemBrand", "==", oemBrand)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(this.db, COLLECTIONS.DEVICES), {
        oemBrand,
        deviceModels: [deviceModel],
        deviceBoards: [deviceBoard],
        socModels: [socModel],
        fpsDataReferences: [fpsDataId],
        totalRecords: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const deviceDoc = snap.docs[0];
      const existingData = deviceDoc.data();
      await updateDoc(doc(this.db, COLLECTIONS.DEVICES, deviceDoc.id), {
        deviceModels: [...new Set([...existingData.deviceModels, deviceModel])],
        deviceBoards: [...new Set([...existingData.deviceBoards, deviceBoard])],
        socModels: [...new Set([...existingData.socModels, socModel])],
        fpsDataReferences: [...existingData.fpsDataReferences, fpsDataId],
        totalRecords: (existingData.totalRecords || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }
  }

  async updatePackageNameCollection(packageName, fpsDataId, fpsData) {
    const appName = fpsData.appName || "Unknown App";
    const q = query(
      collection(this.db, COLLECTIONS.PACKAGE_NAMES),
      where("packageName", "==", packageName)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      await addDoc(collection(this.db, COLLECTIONS.PACKAGE_NAMES), {
        packageName,
        appName,
        fpsDataReferences: [fpsDataId],
        totalRecords: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const packageDoc = snap.docs[0];
      const existingData = packageDoc.data();
      await updateDoc(doc(this.db, COLLECTIONS.PACKAGE_NAMES, packageDoc.id), {
        appName,
        fpsDataReferences: [...existingData.fpsDataReferences, fpsDataId],
        totalRecords: (existingData.totalRecords || 0) + 1,
        updatedAt: serverTimestamp(),
      });
    }
  }

  // ========== USER SESSION METHODS ==========

  async saveUserSession(sessionData) {
    try {
      const docRef = await addDoc(
        collection(this.db, COLLECTIONS.USER_SESSIONS),
        {
          ...sessionData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );
      console.log("User session saved with ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error("Error saving user session:", error);
      throw new Error(`Failed to save user session: ${error.message}`);
    }
  }

  async updateUserSession(sessionId, sessionData) {
    try {
      await updateDoc(doc(this.db, COLLECTIONS.USER_SESSIONS, sessionId), {
        ...sessionData,
        updatedAt: serverTimestamp(),
      });
      console.log("User session updated:", sessionId);
    } catch (error) {
      console.error("Error updating user session:", error);
      throw new Error(`Failed to update user session: ${error.message}`);
    }
  }

  async getUserSession(sessionId) {
    try {
      const docSnap = await getDoc(
        doc(this.db, COLLECTIONS.USER_SESSIONS, sessionId)
      );
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        return { id: docSnap.id, ...data };
      }
      return null;
    } catch (error) {
      console.error("Error getting user session:", error);
      throw new Error(`Failed to get user session: ${error.message}`);
    }
  }

  // ========== HELPER & UTILITY METHODS ==========

  stripRaw(doc) {
    const omit = [
      "rawFpsData",
      "perFrameActualFrameTimesMs",
      "perFrameInstantaneousFps",
      "perFrameInstability",
      "perFrameSlowFrameExcess",
    ];
    const out = { ...doc };
    for (const k of omit) {
      if (k in out) delete out[k];
    }
    return out;
  }

  applyClientTextFilter(docs, text) {
    if (!text) return docs;
    const q = text.trim().toLowerCase();
    const hit = (v) => (v || "").toLowerCase().includes(q);
    return docs.filter(
      (doc) =>
        hit(doc.appName) ||
        hit(doc.packageName) ||
        hit(doc?.deviceInfo?.["ro.product.model"]) ||
        hit(doc?.deviceInfo?.["ro.product.board"]) ||
        hit(doc?.deviceInfo?.["ro.oem.brand"]) ||
        hit(doc?.deviceInfo?.["ro.soc.model"])
    );
  }

  #toDayBounds(date) {
    const d = new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    const next = new Date(d.getTime() + 24 * 3600 * 1000);
    return { start: d, end: next };
  }

  isConnected() {
    return this.isInitialized;
  }

  /**
   * Get the Firestore database instance
   * @returns {Object} Firestore database instance
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Get all available collections
   * @returns {Array} Array of collection names
   */
  getCollections() {
    return Object.values(COLLECTIONS);
  }

  /**
   * Get collection reference by name
   * @param {string} collectionName - Name of the collection
   * @returns {Object} Collection reference
   */
  getCollection(collectionName) {
    return collection(this.db, collectionName);
  }

  // ========== COLLECTION RETRIEVAL METHODS ==========

  /**
   * Get all devices from the devices collection
   * @returns {Promise<Array>} Array of device documents
   */
  async getAllDevices() {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.DEVICES),
        orderBy("totalRecords", "desc")
      );
      const snap = await getDocs(q);
      const devices = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        devices.push({ id: d.id, ...data });
      });
      console.log(`Loaded ${devices.length} devices from Firebase`);
      return devices;
    } catch (error) {
      console.error("Error loading devices:", error);
      return []; // Return empty array instead of throwing to prevent UI crashes
    }
  }

  /**
   * Get all hotlists from the hotlists collection
   * @returns {Promise<Array>} Array of hotlist documents
   */
  async getAllHotlists() {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.HOTLISTS),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const hotlists = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        // Convert fpsDataReferences to runIds for compatibility with local hotlist format
        if (data.fpsDataReferences && !data.runIds) {
          data.runIds = data.fpsDataReferences;
        }
        hotlists.push({ id: d.id, ...data });
      });
      console.log(`Loaded ${hotlists.length} hotlists from Firebase`);
      return hotlists;
    } catch (error) {
      console.error("Error loading hotlists:", error);
      return []; // Return empty array instead of throwing to prevent UI crashes
    }
  }

  /**
   * Get all package names from the package_names collection
   * @returns {Promise<Array>} Array of package name documents
   */
  async getAllPackageNames() {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.PACKAGE_NAMES),
        orderBy("totalRecords", "desc")
      );
      const snap = await getDocs(q);
      const packages = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        if (data.updatedAt?.toDate) data.updatedAt = data.updatedAt.toDate();
        packages.push({ id: d.id, ...data });
      });
      console.log(`Loaded ${packages.length} package names from Firebase`);
      return packages;
    } catch (error) {
      console.error("Error loading package names:", error);
      return []; // Return empty array instead of throwing to prevent UI crashes
    }
  }
}

// Singleton
export const firebaseService = new FirebaseService();
