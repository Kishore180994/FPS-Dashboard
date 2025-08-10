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
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
// Optional (uncomment if your rules require auth during local dev):
// import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// --- CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyD5lsgItkVmZV7T2o3x4DBeXQlrRPahsxQ",
  authDomain: "fps-dashboard.firebaseapp.com",
  projectId: "fps-dashboard",
  storageBucket: "fps-dashboard.appspot.com",
  messagingSenderId: "403710119529",
  appId: "1:403710119529:web:838fc9b4222863a7b9dcf8",
  measurementId: "G-4339LZDXEZ",
};

// --- INIT ---
const app = initializeApp(firebaseConfig);

// Most conservative transport to avoid Listen 400s on local dev
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});

// (Optional) Turn on Firestore debug logs while testing
// setLogLevel("debug");

// (Optional) Anonymous auth for local testing if rules require auth
// try { await signInAnonymously(getAuth(app)); } catch (e) { console.warn("Anon auth failed:", e?.message || e); }

// Guard Analytics (can throw in some environments)
let analytics = null;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("Analytics not initialized:", e?.message || e);
}

// --- CONSTANTS ---
const COLLECTIONS = {
  FPS_DATA: "fps_data",
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

  // Save FPS data
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
      return ref.id;
    } catch (error) {
      console.error("Error saving FPS data:", error);
      throw new Error(`Failed to save FPS data: ${error.message}`);
    }
  }

  // Load all FPS data (optionally limited)
  async loadAllFPSData(limitCount = null) {
    try {
      let q = query(
        collection(this.db, COLLECTIONS.FPS_DATA),
        orderBy("createdAt", "desc")
      );
      if (limitCount) q = query(q, limit(limitCount));

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

  // Delete FPS data by ID
  async deleteFPSData(documentId) {
    try {
      await deleteDoc(doc(this.db, COLLECTIONS.FPS_DATA, documentId));
      console.log("FPS data deleted with ID:", documentId);
    } catch (error) {
      console.error("Error deleting FPS data:", error);
      throw new Error(`Failed to delete FPS data: ${error.message}`);
    }
  }

  // Update FPS data by ID
  async updateFPSData(documentId, updateData) {
    try {
      const payload = { ...updateData, updatedAt: serverTimestamp() };
      await updateDoc(doc(this.db, COLLECTIONS.FPS_DATA, documentId), payload);
      console.log("FPS data updated with ID:", documentId);
    } catch (error) {
      console.error("Error updating FPS data:", error);
      throw new Error(`Failed to update FPS data: ${error.message}`);
    }
  }

  // Search by app name
  async searchFPSDataByApp(appName) {
    try {
      const q = query(
        collection(this.db, COLLECTIONS.FPS_DATA),
        where("appName", "==", appName),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      const results = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.createdAt?.toDate) data.createdAt = data.createdAt.toDate();
        results.push({ id: d.id, ...data });
      });
      return results;
    } catch (error) {
      console.error("Error searching FPS data:", error);
      throw new Error(`Failed to search FPS data: ${error.message}`);
    }
  }

  // Save hotlist
  async saveHotlist(hotlistData) {
    try {
      const dataToStore = {
        ...hotlistData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(
        collection(this.db, COLLECTIONS.HOTLISTS),
        dataToStore
      );
      console.log("Hotlist saved with ID:", ref.id);
      return ref.id;
    } catch (error) {
      console.error("Error saving hotlist:", error);
      throw new Error(`Failed to save hotlist: ${error.message}`);
    }
  }

  // Load all hotlists
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

  // Delete hotlist
  async deleteHotlist(documentId) {
    try {
      await deleteDoc(doc(this.db, COLLECTIONS.HOTLISTS, documentId));
      console.log("Hotlist deleted with ID:", documentId);
    } catch (error) {
      console.error("Error deleting hotlist:", error);
      throw new Error(`Failed to delete hotlist: ${error.message}`);
    }
  }

  // Update hotlist
  async updateHotlist(documentId, updateData) {
    try {
      const payload = { ...updateData, updatedAt: serverTimestamp() };
      await updateDoc(doc(this.db, COLLECTIONS.HOTLISTS, documentId), payload);
      console.log("Hotlist updated with ID:", documentId);
    } catch (error) {
      console.error("Error updating hotlist:", error);
      throw new Error(`Failed to update hotlist: ${error.message}`);
    }
  }

  // Save user session
  async saveUserSession(sessionData) {
    try {
      const dataToStore = { ...sessionData, createdAt: serverTimestamp() };
      const ref = await addDoc(
        collection(this.db, COLLECTIONS.USER_SESSIONS),
        dataToStore
      );
      console.log("User session saved with ID:", ref.id);
      return ref.id;
    } catch (error) {
      console.error("Error saving user session:", error);
      throw new Error(`Failed to save user session: ${error.message}`);
    }
  }

  // Utils
  isConnected() {
    return this.isInitialized;
  }
  getDatabase() {
    return this.db;
  }
  getAnalytics() {
    return this.analytics;
  }
}

// Singleton
export const firebaseService = new FirebaseService();
export { app, db, analytics };
