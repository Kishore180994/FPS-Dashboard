// Chatbot Function Calling API - Enables AI to interact with Firebase and dashboard data

import { firebaseService } from "./firebase-service.js";

/**
 * Defines and executes the tools available to the AI chatbot.
 * This version uses a single, powerful tool to simplify the AI's reasoning process.
 */
export class ChatbotFunctions {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.firebaseService = firebaseService;
  }

  /**
   * Get the list of available tools for the AI model.
   */
  getAvailableFunctions() {
    return [
      {
        name: "get_performance_data",
        description:
          "The single, primary tool to get performance data. It can both filter for specific runs and provide summarized data. Use this tool for ALL data-related questions.",
        parameters: {
          type: "object",
          properties: {
            filters: {
              type: "object",
              description:
                "A set of filters to apply to the search. All properties are optional.",
              properties: {
                text: {
                  type: "string",
                  description:
                    "A free-form text search for app name, device, etc.",
                },
                appName: { type: "string" },
                deviceModel: { type: "string" },
                brand: { type: "string" },
                socManufacturer: {
                  type: "string",
                  description:
                    "Filter by an exact SoC manufacturer (e.g., 'Intel', 'Mediatek').",
                },
                dateFrom: {
                  type: "string",
                  description: "Start date (YYYY-MM-DD).",
                },
                dateTo: {
                  type: "string",
                  description: "End date (YYYY-MM-DD).",
                },
                minAvgFps: { type: "number" },
              },
            },
            groupBy: {
              type: "string",
              description:
                "If provided, the results will be summarized and grouped by this field. If omitted, returns a list of individual runs.",
              enum: [
                "appName",
                "deviceModel",
                "board",
                "brand",
                "socModel",
                "socManufacturer",
                "day",
              ],
            },
            limit: {
              type: "number",
              default: 200,
              description: "Max items to return.",
            },
            orderBy: {
              type: "string",
              enum: ["createdAt", "avgFps", "jankInstabilityPercentage"],
              default: "createdAt",
            },
            orderDirection: {
              type: "string",
              enum: ["asc", "desc"],
              default: "desc",
            },
          },
        },
      },
      // You can add other, non-data tools here if needed, like `export_runs`.
    ];
  }

  /**
   * Execute a function call from the AI agent.
   */
  async executeFunction(functionName, parameters) {
    try {
      console.log(`🤖 AI is executing function: ${functionName}`, parameters);

      if (functionName === "get_performance_data") {
        const { filters = {}, groupBy, ...otherParams } = parameters;

        // Combine all queryable parameters for the firebase service
        const queryParams = { ...filters, ...otherParams };

        console.log("Query parameters being sent to Firebase:", queryParams);

        const { docs } = await this.firebaseService.queryFpsRunsAdvanced(
          queryParams
        );

        console.log(`Firebase returned ${docs.length} documents`);

        // Log some sample data for debugging
        if (docs.length > 0) {
          console.log("Sample document structure:", {
            id: docs[0].id,
            socManufacturer: docs[0].deviceInfo?.["ro.soc.manufacturer"],
            deviceModel: docs[0].deviceInfo?.["ro.product.model"],
            avgFps: docs[0].avgFps,
          });
        }

        if (docs.length === 0) {
          // Provide more specific feedback about what was searched
          let searchDescription = "the specified criteria";
          if (filters.socManufacturer) {
            searchDescription = `${filters.socManufacturer} SoC devices`;
          } else if (filters.deviceModel) {
            searchDescription = `${filters.deviceModel} devices`;
          } else if (filters.appName) {
            searchDescription = `${filters.appName} app`;
          }

          return {
            success: true,
            summary: `No performance data was found for ${searchDescription}.`,
            data: [],
          };
        }

        // If groupBy is specified, perform summarization.
        if (groupBy) {
          const breakdown = this.firebaseService.groupAndSummarize(docs, {
            by: groupBy,
          });
          return {
            success: true,
            summary: `Successfully summarized ${docs.length} runs, grouped by ${groupBy}.`,
            data: breakdown,
          };
        } else {
          // If no groupBy, return the raw run data.
          return {
            success: true,
            summary: `Found ${docs.length} individual runs.`,
            data: docs,
          };
        }
      } else {
        console.error(
          `Error: AI tried to call an unknown function: ${functionName}`
        );
        return {
          success: false,
          error: `The function '${functionName}' does not exist.`,
        };
      }
    } catch (error) {
      console.error(`Error executing function ${functionName}:`, error);
      return {
        success: false,
        error: `An unexpected error occurred while executing ${functionName}: ${error.message}`,
      };
    }
  }
}
