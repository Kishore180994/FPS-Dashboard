// Demo script for Firebase Schema Analyzer
import {
  schemaAnalyzer,
  getFirebaseSchema,
  generateSchemaReport,
  exportSchema,
} from "./firebase-schema-analyzer.js";

// Demo functions to showcase the schema analyzer capabilities
export class SchemaDemo {
  /**
   * Run a complete schema analysis demo
   */
  static async runCompleteDemo() {
    console.log("🚀 Starting Firebase Schema Analysis Demo...\n");

    try {
      // 1. Basic schema analysis
      console.log("📊 Step 1: Basic Schema Analysis");
      const basicSchema = await getFirebaseSchema({
        sampleSize: 3,
        includeData: false,
      });
      console.log(
        "Basic schema structure:",
        Object.keys(basicSchema.collections)
      );

      // 2. Detailed analysis with sample data
      console.log("\n📊 Step 2: Detailed Analysis with Sample Data");
      const detailedSchema = await getFirebaseSchema({
        sampleSize: 5,
        includeData: true,
      });
      console.log(
        "Collections analyzed:",
        detailedSchema.metadata.totalCollections
      );
      console.log(
        "Total documents found:",
        detailedSchema.metadata.totalDocuments
      );

      // 3. Generate human-readable report
      console.log("\n📋 Step 3: Generating Schema Report");
      const report = await generateSchemaReport();
      console.log(report);

      // 4. Export schema to JSON
      console.log("\n💾 Step 4: Exporting Schema to JSON");
      const jsonSchema = await exportSchema();
      console.log(
        "JSON Schema (first 500 chars):",
        jsonSchema.substring(0, 500) + "..."
      );

      // 5. Analyze specific collection
      console.log("\n🔍 Step 5: Analyzing Specific Collection (fps_data)");
      const fpsSchema = await schemaAnalyzer.getCollectionSchema("fps_data");
      if (fpsSchema) {
        console.log(
          "FPS Data Collection Fields:",
          Object.keys(fpsSchema.fields)
        );
        console.log("Required Fields:", fpsSchema.requiredFields);
        console.log("Optional Fields:", fpsSchema.optionalFields);
      }

      // 6. Validate sample data
      console.log("\n✅ Step 6: Data Validation Example");
      const sampleData = {
        appName: "TestApp",
        avgFps: 60,
        createdAt: new Date(),
      };

      const validation = schemaAnalyzer.validateDataAgainstSchema(
        "fps_data",
        sampleData,
        detailedSchema
      );
      console.log("Validation Result:", validation);

      console.log("\n🎉 Demo completed successfully!");
      return detailedSchema;
    } catch (error) {
      console.error("❌ Demo failed:", error);
      throw error;
    }
  }

  /**
   * Quick schema overview
   */
  static async quickOverview() {
    console.log("⚡ Quick Firebase Schema Overview");

    try {
      const schema = await getFirebaseSchema({ sampleSize: 2 });

      console.log("\n📊 SCHEMA SUMMARY");
      console.log("================");
      console.log(`Project: ${schema.metadata.projectId}`);
      console.log(`Collections: ${schema.metadata.totalCollections}`);
      console.log(`Documents: ${schema.metadata.totalDocuments}`);

      Object.entries(schema.collections).forEach(([name, data]) => {
        console.log(`\n📁 ${name}:`);
        console.log(`  - Documents: ${data.documentCount}`);
        console.log(`  - Fields: ${Object.keys(data.fields).length}`);
        console.log(`  - Required: ${data.requiredFields.length}`);
        console.log(`  - Optional: ${data.optionalFields.length}`);
      });

      return schema;
    } catch (error) {
      console.error("❌ Quick overview failed:", error);
      throw error;
    }
  }

  /**
   * Analyze and compare collection schemas
   */
  static async compareCollections() {
    console.log("🔄 Comparing Collection Schemas");

    try {
      const collections = ["fps_data", "hotlists", "user_sessions"];
      const comparison = {};

      for (const collectionName of collections) {
        console.log(`Analyzing ${collectionName}...`);
        const schema = await schemaAnalyzer.getCollectionSchema(collectionName);
        if (schema) {
          comparison[collectionName] = {
            fieldCount: Object.keys(schema.fields).length,
            requiredFields: schema.requiredFields.length,
            optionalFields: schema.optionalFields.length,
            hasTimestamps: schema.patterns.hasTimestamps,
            hasIds: schema.patterns.hasIds,
            dataTypes: schema.patterns.dataTypes,
          };
        }
      }

      console.log("\n📊 COLLECTION COMPARISON");
      console.log("========================");
      console.table(comparison);

      return comparison;
    } catch (error) {
      console.error("❌ Collection comparison failed:", error);
      throw error;
    }
  }

  /**
   * Test data validation against schema
   */
  static async testDataValidation() {
    console.log("🧪 Testing Data Validation");

    try {
      const schema = await getFirebaseSchema({ sampleSize: 3 });

      // Test valid FPS data
      const validFpsData = {
        appName: "TestApp",
        avgFps: 60,
        createdAt: new Date(),
        deviceInfo: {
          "ro.product.model": "TestDevice",
        },
      };

      // Test invalid FPS data (missing required fields)
      const invalidFpsData = {
        avgFps: "not_a_number", // Wrong type
      };

      console.log("\n✅ Testing Valid Data:");
      const validResult = schemaAnalyzer.validateDataAgainstSchema(
        "fps_data",
        validFpsData,
        schema
      );
      console.log("Valid:", validResult.valid);
      console.log("Errors:", validResult.errors);
      console.log("Warnings:", validResult.warnings);

      console.log("\n❌ Testing Invalid Data:");
      const invalidResult = schemaAnalyzer.validateDataAgainstSchema(
        "fps_data",
        invalidFpsData,
        schema
      );
      console.log("Valid:", invalidResult.valid);
      console.log("Errors:", invalidResult.errors);
      console.log("Warnings:", invalidResult.warnings);

      return { validResult, invalidResult };
    } catch (error) {
      console.error("❌ Data validation test failed:", error);
      throw error;
    }
  }

  /**
   * Export schema to downloadable file
   */
  static async exportSchemaFile() {
    console.log("💾 Exporting Schema to File");

    try {
      const schema = await getFirebaseSchema({
        sampleSize: 10,
        includeData: true,
      });

      const jsonString = JSON.stringify(schema, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Create download link
      const link = document.createElement("a");
      link.href = url;
      link.download = `firebase-schema-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log("✅ Schema exported successfully!");
      return schema;
    } catch (error) {
      console.error("❌ Schema export failed:", error);
      throw error;
    }
  }

  /**
   * Monitor schema changes over time
   */
  static async monitorSchemaChanges(previousSchema = null) {
    console.log("🔍 Monitoring Schema Changes");

    try {
      const currentSchema = await getFirebaseSchema({ sampleSize: 5 });

      if (!previousSchema) {
        console.log(
          "📝 No previous schema to compare. Saving current schema as baseline."
        );
        localStorage.setItem(
          "firebase_schema_baseline",
          JSON.stringify(currentSchema)
        );
        return currentSchema;
      }

      const comparison = schemaAnalyzer.compareSchemas(
        previousSchema,
        currentSchema
      );

      console.log("\n🔄 SCHEMA CHANGES DETECTED");
      console.log("==========================");

      if (comparison.addedCollections.length > 0) {
        console.log("➕ Added Collections:", comparison.addedCollections);
      }

      if (comparison.removedCollections.length > 0) {
        console.log("➖ Removed Collections:", comparison.removedCollections);
      }

      if (comparison.modifiedCollections.length > 0) {
        console.log("🔧 Modified Collections:", comparison.modifiedCollections);

        Object.entries(comparison.addedFields).forEach(
          ([collection, fields]) => {
            if (fields.length > 0) {
              console.log(`  ➕ ${collection} - Added fields:`, fields);
            }
          }
        );

        Object.entries(comparison.removedFields).forEach(
          ([collection, fields]) => {
            if (fields.length > 0) {
              console.log(`  ➖ ${collection} - Removed fields:`, fields);
            }
          }
        );
      }

      // Save current schema as new baseline
      localStorage.setItem(
        "firebase_schema_baseline",
        JSON.stringify(currentSchema)
      );

      return { currentSchema, comparison };
    } catch (error) {
      console.error("❌ Schema monitoring failed:", error);
      throw error;
    }
  }
}

// Convenience functions for quick access
export async function analyzeSchema() {
  return await SchemaDemo.runCompleteDemo();
}

export async function quickSchema() {
  return await SchemaDemo.quickOverview();
}

export async function compareCollections() {
  return await SchemaDemo.compareCollections();
}

export async function validateData() {
  return await SchemaDemo.testDataValidation();
}

export async function downloadSchema() {
  return await SchemaDemo.exportSchemaFile();
}

// Auto-run demo if this file is loaded directly
if (
  typeof window !== "undefined" &&
  window.location.pathname.includes("schema-demo")
) {
  console.log("🎬 Auto-running schema demo...");
  SchemaDemo.quickOverview().catch(console.error);
}

// Usage examples:
/*
// Run complete demo
await SchemaDemo.runCompleteDemo();

// Quick overview
await SchemaDemo.quickOverview();

// Compare collections
await SchemaDemo.compareCollections();

// Test validation
await SchemaDemo.testDataValidation();

// Export schema
await SchemaDemo.exportSchemaFile();

// Monitor changes
const baseline = JSON.parse(localStorage.getItem('firebase_schema_baseline') || 'null');
await SchemaDemo.monitorSchemaChanges(baseline);

// Or use convenience functions
await analyzeSchema();
await quickSchema();
await compareCollections();
await validateData();
await downloadSchema();
*/
