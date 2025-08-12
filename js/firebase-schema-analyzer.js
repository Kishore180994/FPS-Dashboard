// Firebase Schema Analyzer - Discovers and documents Firebase database structure

import { firebaseService } from "./firebase-service.js";
import {
  collection,
  getDocs,
  query,
  limit,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

export class FirebaseSchemaAnalyzer {
  constructor() {
    this.db = firebaseService.getDatabase();
    this.knownCollections = ["fps_data", "hotlists", "user_sessions"];
    this.schema = {
      collections: {},
      metadata: {
        analyzedAt: new Date(),
        totalCollections: 0,
        totalDocuments: 0,
        projectId: "fps-dashboard",
      },
    };
  }

  /**
   * Discover collections dynamically by attempting to query known collections
   * and checking if they exist and have documents
   * @returns {Array} Array of discovered collection names
   */
  async discoverCollections() {
    console.log("🔍 Discovering Firebase collections...");
    const discoveredCollections = [];

    // Check known collections first
    for (const collectionName of this.knownCollections) {
      try {
        const collectionRef = collection(this.db, collectionName);
        const snapshot = await getDocs(query(collectionRef, limit(1)));

        if (!snapshot.empty) {
          discoveredCollections.push(collectionName);
          console.log(`✅ Found collection: ${collectionName}`);
        } else {
          console.log(`⚠️ Collection exists but is empty: ${collectionName}`);
          // Still add it to the list as it exists
          discoveredCollections.push(collectionName);
        }
      } catch (error) {
        console.log(
          `❌ Collection not accessible: ${collectionName} - ${error.message}`
        );
      }
    }

    // Try to discover additional collections from the COLLECTIONS constant in firebase-service
    const additionalCollections = ["devices", "package_names"];

    for (const collectionName of additionalCollections) {
      if (!discoveredCollections.includes(collectionName)) {
        try {
          const collectionRef = collection(this.db, collectionName);
          const snapshot = await getDocs(query(collectionRef, limit(1)));

          if (!snapshot.empty) {
            discoveredCollections.push(collectionName);
            console.log(`✅ Found additional collection: ${collectionName}`);
          } else {
            console.log(
              `⚠️ Additional collection exists but is empty: ${collectionName}`
            );
            discoveredCollections.push(collectionName);
          }
        } catch (error) {
          console.log(
            `❌ Additional collection not accessible: ${collectionName} - ${error.message}`
          );
        }
      }
    }

    console.log(
      `🎯 Discovered ${discoveredCollections.length} collections:`,
      discoveredCollections
    );
    return discoveredCollections;
  }

  /**
   * Analyze the complete Firebase schema
   * @param {Object} options - Analysis options
   * @param {number} options.sampleSize - Number of documents to sample per collection
   * @param {boolean} options.includeData - Whether to include sample data
   * @param {Array} options.customCollections - Additional collections to analyze
   * @param {boolean} options.useDynamicDiscovery - Whether to discover collections dynamically
   * @returns {Object} Complete schema analysis
   */
  async analyzeGlobalSchema(options = {}) {
    const {
      sampleSize = 5,
      includeData = false,
      customCollections = [],
      useDynamicDiscovery = true,
    } = options;

    console.log("🔍 Starting Firebase schema analysis...");

    try {
      let collectionsToAnalyze;

      if (useDynamicDiscovery) {
        // Discover collections dynamically
        const discoveredCollections = await this.discoverCollections();
        collectionsToAnalyze = [...discoveredCollections, ...customCollections];
      } else {
        // Use known collections with custom ones
        collectionsToAnalyze = [...this.knownCollections, ...customCollections];
      }

      // Remove duplicates
      collectionsToAnalyze = [...new Set(collectionsToAnalyze)];

      // Analyze each collection
      for (const collectionName of collectionsToAnalyze) {
        console.log(`📊 Analyzing collection: ${collectionName}`);
        const collectionSchema = await this.analyzeCollection(
          collectionName,
          sampleSize,
          includeData
        );

        if (collectionSchema) {
          this.schema.collections[collectionName] = collectionSchema;
        }
      }

      // Update metadata
      this.schema.metadata.totalCollections = Object.keys(
        this.schema.collections
      ).length;
      this.schema.metadata.totalDocuments = Object.values(
        this.schema.collections
      ).reduce((total, col) => total + (col.documentCount || 0), 0);

      console.log("✅ Schema analysis complete!");
      return this.schema;
    } catch (error) {
      console.error("❌ Error analyzing schema:", error);
      throw new Error(`Schema analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze a specific collection
   * @param {string} collectionName - Name of the collection
   * @param {number} sampleSize - Number of documents to sample
   * @param {boolean} includeData - Whether to include sample data
   * @returns {Object} Collection schema
   */
  async analyzeCollection(collectionName, sampleSize = 5, includeData = false) {
    try {
      const collectionRef = collection(this.db, collectionName);

      // Get sample documents
      const sampleQuery = query(collectionRef, limit(sampleSize));
      const snapshot = await getDocs(sampleQuery);

      if (snapshot.empty) {
        console.log(
          `⚠️  Collection '${collectionName}' is empty or doesn't exist`
        );
        return {
          name: collectionName,
          documentCount: 0,
          fields: {},
          fieldTypes: {},
          requiredFields: [],
          optionalFields: [],
          sampleDocuments: includeData ? [] : null,
          analyzedAt: new Date(),
          patterns: {
            hasTimestamps: false,
            hasIds: false,
            commonPrefixes: [],
            dataTypes: [],
          },
        };
      }

      const collectionSchema = {
        name: collectionName,
        documentCount: snapshot.size,
        fields: {},
        fieldTypes: {},
        requiredFields: new Set(),
        optionalFields: new Set(),
        sampleDocuments: includeData ? [] : null,
        analyzedAt: new Date(),
        patterns: {
          hasTimestamps: false,
          hasIds: false,
          commonPrefixes: [],
          dataTypes: new Set(),
        },
      };

      // Analyze each document
      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();

        if (includeData) {
          collectionSchema.sampleDocuments.push({
            id: docSnapshot.id,
            data: this.sanitizeData(data),
          });
        }

        // Analyze fields
        this.analyzeDocumentFields(data, collectionSchema);
      });

      // Convert Sets to Arrays for JSON serialization
      collectionSchema.requiredFields = Array.from(
        collectionSchema.requiredFields
      );
      collectionSchema.optionalFields = Array.from(
        collectionSchema.optionalFields
      );
      collectionSchema.patterns.dataTypes = Array.from(
        collectionSchema.patterns.dataTypes
      );

      // Determine field requirements
      this.determineFieldRequirements(collectionSchema, snapshot.size);

      return collectionSchema;
    } catch (error) {
      console.error(`Error analyzing collection '${collectionName}':`, error);
      return null;
    }
  }

  /**
   * Analyze fields in a document
   * @param {Object} data - Document data
   * @param {Object} collectionSchema - Collection schema being built
   */
  analyzeDocumentFields(data, collectionSchema) {
    const analyzeObject = (obj, prefix = "") => {
      Object.entries(obj).forEach(([key, value]) => {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const valueType = this.getValueType(value);

        // Track field existence
        if (!collectionSchema.fields[fullKey]) {
          collectionSchema.fields[fullKey] = {
            type: valueType,
            occurrences: 0,
            examples: [],
            nested: false,
          };
        }

        collectionSchema.fields[fullKey].occurrences++;
        collectionSchema.fieldTypes[fullKey] = valueType;
        collectionSchema.patterns.dataTypes.add(valueType);

        // Store examples (limit to 3)
        if (collectionSchema.fields[fullKey].examples.length < 3) {
          collectionSchema.fields[fullKey].examples.push(
            this.sanitizeValue(value)
          );
        }

        // Check for nested objects
        if (valueType === "object" && value !== null) {
          collectionSchema.fields[fullKey].nested = true;
          analyzeObject(value, fullKey);
        }

        // Detect patterns
        this.detectPatterns(key, value, collectionSchema.patterns);
      });
    };

    analyzeObject(data);
  }

  /**
   * Determine which fields are required vs optional
   * @param {Object} collectionSchema - Collection schema
   * @param {number} totalDocs - Total number of documents analyzed
   */
  determineFieldRequirements(collectionSchema, totalDocs) {
    Object.entries(collectionSchema.fields).forEach(
      ([fieldName, fieldInfo]) => {
        const occurrenceRate = fieldInfo.occurrences / totalDocs;

        if (occurrenceRate >= 0.8) {
          // 80% or more = required
          collectionSchema.requiredFields.push(fieldName);
        } else {
          collectionSchema.optionalFields.push(fieldName);
        }
      }
    );
  }

  /**
   * Detect common patterns in the data
   * @param {string} key - Field key
   * @param {*} value - Field value
   * @param {Object} patterns - Patterns object to update
   */
  detectPatterns(key, value, patterns) {
    // Check for timestamp fields
    if (key.includes("At") || key.includes("Time") || key.includes("Date")) {
      patterns.hasTimestamps = true;
    }

    // Check for ID fields
    if (key.toLowerCase().includes("id")) {
      patterns.hasIds = true;
    }

    // Detect common prefixes
    const prefix = key.split(/[A-Z]/)[0];
    if (prefix.length > 2 && !patterns.commonPrefixes.includes(prefix)) {
      patterns.commonPrefixes.push(prefix);
    }
  }

  /**
   * Get the type of a value
   * @param {*} value - Value to analyze
   * @returns {string} Type name
   */
  getValueType(value) {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (value instanceof Date) return "date";
    if (value && typeof value === "object" && value.toDate) return "timestamp";
    if (value && typeof value === "object" && value.seconds !== undefined)
      return "timestamp";

    const type = typeof value;
    if (type === "object") {
      return "object";
    }
    return type;
  }

  /**
   * Sanitize data for safe display
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   */
  sanitizeData(data) {
    const sanitized = {};
    Object.entries(data).forEach(([key, value]) => {
      sanitized[key] = this.sanitizeValue(value);
    });
    return sanitized;
  }

  /**
   * Sanitize a single value
   * @param {*} value - Value to sanitize
   * @returns {*} Sanitized value
   */
  sanitizeValue(value) {
    if (value && typeof value === "object" && value.toDate) {
      return `[Timestamp: ${value.toDate().toISOString()}]`;
    }
    if (value && typeof value === "object" && value.seconds !== undefined) {
      return `[Timestamp: ${new Date(value.seconds * 1000).toISOString()}]`;
    }
    if (typeof value === "string" && value.length > 100) {
      return value.substring(0, 100) + "...";
    }
    if (Array.isArray(value) && value.length > 5) {
      return [...value.slice(0, 5), `... ${value.length - 5} more items`];
    }
    return value;
  }

  /**
   * Generate a human-readable schema report
   * @param {Object} schema - Schema to report on
   * @returns {string} Formatted report
   */
  generateSchemaReport(schema = this.schema) {
    let report = `
🔥 FIREBASE SCHEMA ANALYSIS REPORT
=====================================

📊 Project: ${schema.metadata.projectId}
📅 Analyzed: ${schema.metadata.analyzedAt.toLocaleString()}
📁 Collections: ${schema.metadata.totalCollections}
📄 Total Documents: ${schema.metadata.totalDocuments}

`;

    Object.entries(schema.collections).forEach(
      ([collectionName, collectionData]) => {
        report += `
📁 COLLECTION: ${collectionName.toUpperCase()}
${"=".repeat(50)}
📄 Documents: ${collectionData.documentCount}
🔧 Required Fields: ${collectionData.requiredFields.length}
⚙️  Optional Fields: ${collectionData.optionalFields.length}

🔑 REQUIRED FIELDS:
${collectionData.requiredFields
  .map((field) => `  • ${field} (${collectionData.fieldTypes[field]})`)
  .join("\n")}

⚙️  OPTIONAL FIELDS:
${collectionData.optionalFields
  .map((field) => `  • ${field} (${collectionData.fieldTypes[field]})`)
  .join("\n")}

🎯 PATTERNS DETECTED:
  • Has Timestamps: ${collectionData.patterns.hasTimestamps ? "✅" : "❌"}
  • Has ID Fields: ${collectionData.patterns.hasIds ? "✅" : "❌"}
  • Data Types: ${collectionData.patterns.dataTypes.join(", ")}

`;
      }
    );

    return report;
  }

  /**
   * Export schema to JSON file
   * @param {Object} schema - Schema to export
   * @returns {string} JSON string
   */
  exportSchemaToJSON(schema = this.schema) {
    return JSON.stringify(schema, null, 2);
  }

  /**
   * Get schema for a specific collection
   * @param {string} collectionName - Name of collection
   * @returns {Object} Collection schema
   */
  async getCollectionSchema(collectionName) {
    return await this.analyzeCollection(collectionName, 10, true);
  }

  /**
   * Compare schemas between different time periods
   * @param {Object} oldSchema - Previous schema
   * @param {Object} newSchema - Current schema
   * @returns {Object} Schema comparison
   */
  compareSchemas(oldSchema, newSchema) {
    const comparison = {
      addedCollections: [],
      removedCollections: [],
      modifiedCollections: [],
      addedFields: {},
      removedFields: {},
      changedFieldTypes: {},
    };

    // Compare collections
    const oldCollections = Object.keys(oldSchema.collections || {});
    const newCollections = Object.keys(newSchema.collections || {});

    comparison.addedCollections = newCollections.filter(
      (col) => !oldCollections.includes(col)
    );
    comparison.removedCollections = oldCollections.filter(
      (col) => !newCollections.includes(col)
    );

    // Compare fields in existing collections
    oldCollections.forEach((collectionName) => {
      if (newCollections.includes(collectionName)) {
        const oldFields = oldSchema.collections[collectionName].fields || {};
        const newFields = newSchema.collections[collectionName].fields || {};

        const oldFieldNames = Object.keys(oldFields);
        const newFieldNames = Object.keys(newFields);

        const addedFields = newFieldNames.filter(
          (field) => !oldFieldNames.includes(field)
        );
        const removedFields = oldFieldNames.filter(
          (field) => !newFieldNames.includes(field)
        );

        if (addedFields.length > 0 || removedFields.length > 0) {
          comparison.modifiedCollections.push(collectionName);
          comparison.addedFields[collectionName] = addedFields;
          comparison.removedFields[collectionName] = removedFields;
        }

        // Check for type changes
        oldFieldNames.forEach((fieldName) => {
          if (newFieldNames.includes(fieldName)) {
            const oldType = oldFields[fieldName].type;
            const newType = newFields[fieldName].type;
            if (oldType !== newType) {
              if (!comparison.changedFieldTypes[collectionName]) {
                comparison.changedFieldTypes[collectionName] = {};
              }
              comparison.changedFieldTypes[collectionName][fieldName] = {
                from: oldType,
                to: newType,
              };
            }
          }
        });
      }
    });

    return comparison;
  }

  /**
   * Validate data against schema
   * @param {string} collectionName - Collection name
   * @param {Object} data - Data to validate
   * @param {Object} schema - Schema to validate against
   * @returns {Object} Validation result
   */
  validateDataAgainstSchema(collectionName, data, schema = this.schema) {
    const collectionSchema = schema.collections[collectionName];
    if (!collectionSchema) {
      return {
        valid: false,
        errors: [`Collection '${collectionName}' not found in schema`],
      };
    }

    const errors = [];
    const warnings = [];

    // Check required fields
    collectionSchema.requiredFields.forEach((requiredField) => {
      if (!this.hasNestedProperty(data, requiredField)) {
        errors.push(`Missing required field: ${requiredField}`);
      }
    });

    // Check field types
    Object.entries(data).forEach(([key, value]) => {
      const expectedType = collectionSchema.fieldTypes[key];
      const actualType = this.getValueType(value);

      if (expectedType && expectedType !== actualType) {
        warnings.push(
          `Type mismatch for field '${key}': expected ${expectedType}, got ${actualType}`
        );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if object has nested property
   * @param {Object} obj - Object to check
   * @param {string} path - Dot-notation path
   * @returns {boolean} Whether property exists
   */
  hasNestedProperty(obj, path) {
    return (
      path.split(".").reduce((current, key) => {
        return current && current[key] !== undefined;
      }, obj) !== undefined
    );
  }

  /**
   * Get document count for a collection
   * @param {string} collectionName - Name of the collection
   * @returns {number} Document count
   */
  async getCollectionDocumentCount(collectionName) {
    try {
      const collectionRef = collection(this.db, collectionName);
      const snapshot = await getDocs(collectionRef);
      return snapshot.size;
    } catch (error) {
      console.error(
        `Error getting document count for ${collectionName}:`,
        error
      );
      return 0;
    }
  }

  /**
   * Get all unique field names across all collections
   * @param {Object} schema - Schema to analyze
   * @returns {Array} Array of unique field names
   */
  getAllUniqueFields(schema = this.schema) {
    const allFields = new Set();
    Object.values(schema.collections).forEach((collection) => {
      Object.keys(collection.fields || {}).forEach((field) => {
        allFields.add(field);
      });
    });
    return Array.from(allFields);
  }

  /**
   * Get statistics about the schema
   * @param {Object} schema - Schema to analyze
   * @returns {Object} Schema statistics
   */
  getSchemaStatistics(schema = this.schema) {
    const stats = {
      totalCollections: Object.keys(schema.collections).length,
      totalDocuments: 0,
      totalFields: 0,
      totalUniqueFields: 0,
      averageFieldsPerCollection: 0,
      collectionsWithTimestamps: 0,
      collectionsWithIds: 0,
      dataTypes: new Set(),
    };

    Object.values(schema.collections).forEach((collection) => {
      stats.totalDocuments += collection.documentCount || 0;
      stats.totalFields += Object.keys(collection.fields || {}).length;

      if (collection.patterns?.hasTimestamps) {
        stats.collectionsWithTimestamps++;
      }

      if (collection.patterns?.hasIds) {
        stats.collectionsWithIds++;
      }

      (collection.patterns?.dataTypes || []).forEach((type) => {
        stats.dataTypes.add(type);
      });
    });

    stats.totalUniqueFields = this.getAllUniqueFields(schema).length;
    stats.averageFieldsPerCollection =
      stats.totalCollections > 0
        ? (stats.totalFields / stats.totalCollections).toFixed(2)
        : 0;
    stats.dataTypes = Array.from(stats.dataTypes);

    return stats;
  }

  /**
   * Reset the schema analyzer
   */
  reset() {
    this.schema = {
      collections: {},
      metadata: {
        analyzedAt: new Date(),
        totalCollections: 0,
        totalDocuments: 0,
        projectId: "fps-dashboard",
      },
    };
  }

  /**
   * Check if the analyzer is properly initialized
   * @returns {boolean} Whether the analyzer is initialized
   */
  isInitialized() {
    return this.db !== null && this.db !== undefined;
  }

  /**
   * Get a clean schema with just field names and types (no sample data)
   * @param {Object} options - Analysis options
   * @returns {Object} Clean schema with field names and types only
   */
  async getCleanSchema(options = {}) {
    const {
      sampleSize = 5,
      customCollections = [],
      useDynamicDiscovery = true,
    } = options;

    console.log("🔍 Getting clean schema (fields and types only)...");

    try {
      // Get the full schema but without sample data
      const fullSchema = await this.analyzeGlobalSchema({
        sampleSize,
        includeData: false,
        customCollections,
        useDynamicDiscovery,
      });

      // Create clean schema with just field names and types
      const cleanSchema = {
        projectId: fullSchema.metadata.projectId,
        analyzedAt: fullSchema.metadata.analyzedAt,
        totalCollections: fullSchema.metadata.totalCollections,
        totalDocuments: fullSchema.metadata.totalDocuments,
        collections: {},
      };

      Object.entries(fullSchema.collections).forEach(
        ([collectionName, collectionData]) => {
          cleanSchema.collections[collectionName] = {
            name: collectionName,
            documentCount: collectionData.documentCount,
            fields: {},
          };

          // Extract just field names and types
          Object.entries(collectionData.fieldTypes || {}).forEach(
            ([fieldName, fieldType]) => {
              cleanSchema.collections[collectionName].fields[fieldName] =
                fieldType;
            }
          );
        }
      );

      console.log("✅ Clean schema generated!");
      return cleanSchema;
    } catch (error) {
      console.error("❌ Error generating clean schema:", error);
      throw new Error(`Clean schema generation failed: ${error.message}`);
    }
  }

  /**
   * Generate a clean schema report with just field names and types
   * @param {Object} schema - Schema to report on
   * @returns {string} Clean formatted report
   */
  generateCleanSchemaReport(schema = null) {
    if (!schema) {
      throw new Error("Schema is required for clean report generation");
    }

    let report = `
🔥 FIREBASE CLEAN SCHEMA REPORT

📊 Project: ${schema.projectId}
📅 Analyzed: ${schema.analyzedAt.toLocaleString()}
📁 Collections: ${schema.totalCollections}
📄 Total Documents: ${schema.totalDocuments}

`;

    Object.entries(schema.collections).forEach(
      ([collectionName, collectionData]) => {
        report += `
📁 COLLECTION: ${collectionName.toUpperCase()}
${"=".repeat(50)}
📄 Documents: ${collectionData.documentCount}
🔧 Fields: ${Object.keys(collectionData.fields).length}

🔑 FIELDS AND TYPES:
${Object.entries(collectionData.fields)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([field, type]) => `  • ${field}: ${type}`)
  .join("\n")}

`;
      }
    );

    return report;
  }
}

// Singleton instance
export const schemaAnalyzer = new FirebaseSchemaAnalyzer();

// Convenience functions
export async function getFirebaseSchema(options = {}) {
  return await schemaAnalyzer.analyzeGlobalSchema(options);
}

export async function generateSchemaReport(options = {}) {
  const schema = await schemaAnalyzer.analyzeGlobalSchema(options);
  return schemaAnalyzer.generateSchemaReport(schema);
}

export async function exportSchema(options = {}) {
  const schema = await schemaAnalyzer.analyzeGlobalSchema(options);
  return schemaAnalyzer.exportSchemaToJSON(schema);
}

// New convenience functions for clean schema
export async function getCleanFirebaseSchema(options = {}) {
  return await schemaAnalyzer.getCleanSchema(options);
}

export async function generateCleanSchemaReport(options = {}) {
  const cleanSchema = await schemaAnalyzer.getCleanSchema(options);
  return schemaAnalyzer.generateCleanSchemaReport(cleanSchema);
}

export async function exportCleanSchema(options = {}) {
  const cleanSchema = await schemaAnalyzer.getCleanSchema(options);
  return JSON.stringify(cleanSchema, null, 2);
}

// Usage examples:
/*
// Basic usage
const schema = await getFirebaseSchema();
console.log(schema);

// With options
const detailedSchema = await getFirebaseSchema({
  sampleSize: 10,
  includeData: true,
  customCollections: ['custom_collection']
});

// Generate report
const report = await generateSchemaReport();
console.log(report);

// Export to JSON
const jsonSchema = await exportSchema();
console.log(jsonSchema);

// Analyze specific collection
const fpsSchema = await schemaAnalyzer.getCollectionSchema('fps_data');
console.log(fpsSchema);

// Validate data
const validation = schemaAnalyzer.validateDataAgainstSchema('fps_data', {
  appName: 'TestApp',
  avgFps: 60
}, schema);
console.log(validation);
*/
