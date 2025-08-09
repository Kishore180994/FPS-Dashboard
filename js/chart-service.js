// Chart Service Module - Handles all Chart.js configurations and rendering.

import { aggregateDataByTime } from "./utils.js";

// --- Dashboard Charts ---

export function createFPSChart(dashboard) {
  const ctx = document.getElementById("fpsChart").getContext("2d");

  if (dashboard.charts.fpsChart) {
    dashboard.charts.fpsChart.destroy();
  }

  const appFpsData = {};
  dashboard.uploadedData.forEach((data) => {
    const appName = data.appName || "Unknown App";
    if (!appFpsData[appName]) {
      appFpsData[appName] = [];
    }
    appFpsData[appName].push(data.avgFps);
  });

  const appAverages = Object.keys(appFpsData)
    .map((app) => {
      const values = appFpsData[app];
      const avgFps = values.reduce((sum, val) => sum + val, 0) / values.length;
      return { app, avgFps };
    })
    .sort((a, b) => b.avgFps - a.avgFps);

  dashboard.allFpsChartData = appAverages;

  const topApps = appAverages.slice(0, 5);
  const labels = topApps.map((item) => item.app);
  const avgFpsValues = topApps.map((item) => item.avgFps);

  dashboard.charts.fpsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Average FPS",
          data: avgFpsValues,
          backgroundColor: "rgba(99, 102, 241, 0.6)",
          borderColor: "rgba(99, 102, 241, 1)",
          borderWidth: 2,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 20, left: 10, right: 10, top: 10 } },
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: { color: "rgba(255, 255, 255, 0.8)", padding: 5 },
        },
        x: {
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            maxRotation: 45,
            minRotation: 0,
            padding: 10,
            font: { size: 11 },
          },
        },
      },
    },
  });

  addChartControls(dashboard, "fpsChart", "fps");
}

export function createDeviceChart(dashboard) {
  const ctx = document.getElementById("deviceChart").getContext("2d");

  if (dashboard.charts.deviceChart) {
    dashboard.charts.deviceChart.destroy();
  }

  const deviceData = {};
  dashboard.uploadedData.forEach((data) => {
    const manufacturer =
      data.deviceInfo?.["ro.product.manufacturer"] || "Unknown";
    deviceData[manufacturer] = (deviceData[manufacturer] || 0) + 1;
  });

  const labels = Object.keys(deviceData);
  const values = Object.values(deviceData);
  const colors = labels.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsla(${hue}, 70%, 60%, 0.8)`;
  });

  dashboard.charts.deviceChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: colors.map((color) => color.replace("0.8", "1")),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 40, left: 10, right: 10, top: 10 } },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            padding: 12,
            usePointStyle: true,
            boxWidth: 12,
            boxHeight: 12,
            font: { size: 10 },
            generateLabels: function (chart) {
              const data = chart.data;
              if (data.labels.length && data.datasets.length) {
                return data.labels.map((label, index) => {
                  const dataset = data.datasets[0];
                  const backgroundColor = Array.isArray(dataset.backgroundColor)
                    ? dataset.backgroundColor[index]
                    : dataset.backgroundColor;
                  let displayLabel = label;
                  if (displayLabel && displayLabel.length > 12) {
                    displayLabel = displayLabel.substring(0, 12) + "...";
                  }
                  return {
                    text: displayLabel,
                    fillStyle: backgroundColor,
                    strokeStyle: backgroundColor,
                    lineWidth: 2,
                    hidden: false,
                    index: index,
                  };
                });
              }
              return [];
            },
          },
          maxHeight: 100,
          fullSize: false,
        },
      },
    },
  });
}

export function createMemoryFpsChart(dashboard) {
  const ctx = document.getElementById("memoryFpsChart").getContext("2d");
  if (dashboard.charts.memoryFpsChart) {
    dashboard.charts.memoryFpsChart.destroy();
  }

  const bubbleData = [];
  dashboard.uploadedData.forEach((data) => {
    const deviceInfo = data.deviceInfo || {};
    let memoryGB = 0;
    if (deviceInfo.MemTotal) {
      const memKB = parseFloat(deviceInfo.MemTotal.replace(" kB", ""));
      if (!isNaN(memKB)) {
        memoryGB = memKB / (1024 * 1024);
      }
    }
    if (memoryGB > 0 && data.avgFps > 0) {
      const bubbleSize = Math.max(
        5,
        Math.min(20, data.elapsedTimeSeconds || 10)
      );
      bubbleData.push({
        x: memoryGB,
        y: data.avgFps,
        r: bubbleSize,
        label: data.appName || "Unknown App",
        device: deviceInfo["ro.product.manufacturer"] || "Unknown",
        elapsedTime: data.elapsedTimeSeconds || 0,
      });
    }
  });

  const sortedBubbleData = [...bubbleData].sort((a, b) => b.y - a.y);
  dashboard.allMemoryFpsData = sortedBubbleData;
  const topData = sortedBubbleData.slice(0, 5);
  const colors = topData.map(
    (_, index) => `hsla(${(index * 137.5) % 360}, 70%, 60%, 0.7)`
  );

  dashboard.charts.memoryFpsChart = new Chart(ctx, {
    type: "bubble",
    data: {
      datasets: [
        {
          label: "Memory vs FPS",
          data: topData,
          backgroundColor: colors,
          borderColor: colors.map((color) => color.replace("0.7", "1")),
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { bottom: 30, left: 20, right: 20, top: 10 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (context) => context[0].raw.label,
            label: (context) => [
              `Memory: ${context.raw.x.toFixed(2)} GB`,
              `Avg FPS: ${context.raw.y.toFixed(1)}`,
              `Elapsed Time: ${context.raw.elapsedTime.toFixed(1)}s`,
              `Device: ${context.raw.device}`,
            ],
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          title: {
            display: true,
            text: "Total Memory (GB)",
            color: "rgba(255, 255, 255, 0.8)",
            padding: { top: 10 },
            font: { size: 12 },
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            padding: 5,
            font: { size: 11 },
          },
        },
        y: {
          title: {
            display: true,
            text: "Average FPS",
            color: "rgba(255, 255, 255, 0.8)",
            padding: { bottom: 10 },
            font: { size: 12 },
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            padding: 5,
            font: { size: 11 },
          },
        },
      },
    },
  });

  addChartControls(dashboard, "memoryFpsChart", "memory");
}

export function createBatteryDrainChart(dashboard) {
  const ctx = document.getElementById("batteryDrainChart").getContext("2d");

  // Destroy existing chart if it exists
  if (dashboard.charts.batteryDrainChart) {
    dashboard.charts.batteryDrainChart.destroy();
  }

  // Filter data that has battery information
  const dataWithBattery = dashboard.uploadedData.filter((data) => {
    return (
      data.fpsBuckets &&
      data.fpsBuckets.startBattery !== undefined &&
      data.fpsBuckets.endBattery !== undefined &&
      data.fpsBuckets.startBattery > 0 &&
      data.fpsBuckets.endBattery >= 0
    );
  });

  if (dataWithBattery.length === 0) {
    // Show empty state
    const chartContainer =
      document.getElementById("batteryDrainChart").parentElement;
    chartContainer.innerHTML = `
        <div class="chart-title">
          Battery Drain by App & Device
          <div style="display: flex; gap: 10px; margin-top: 10px; justify-content: center;">
            <button 
              id="batteryDrainToggle" 
              onclick="window.dashboard.toggleBatteryDrainMode()"
              style="
                background: var(--primary-color); color: white; border: none; padding: 6px 12px;
                border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;
              "
              title="Toggle between total drain and drain per minute"
            >
              Switch to Per Minute
            </button>
          </div>
        </div>
        <div style="display: flex; align-items: center; justify-content: center; height: 300px; color: var(--text-secondary);">
          <p>No battery data available in uploaded files</p>
        </div>
      `;
    return;
  }

  // Group data by app name
  const appBatteryData = {};
  dataWithBattery.forEach((data) => {
    const appName = data.appName || "Unknown App";
    const deviceInfo = data.deviceInfo || {};
    const deviceName = `${deviceInfo["ro.product.manufacturer"] || "Unknown"} ${
      deviceInfo["ro.product.model"] || "Unknown"
    }`;

    if (!appBatteryData[appName]) {
      appBatteryData[appName] = {};
    }

    const batteryDrain =
      data.fpsBuckets.startBattery - data.fpsBuckets.endBattery;
    const elapsedTimeMinutes = (data.elapsedTimeSeconds || 0) / 60;

    // Store both total drain and per-minute drain
    appBatteryData[appName][deviceName] = {
      totalDrain: Math.max(0, batteryDrain), // Ensure non-negative
      drainPerMinute:
        elapsedTimeMinutes > 0 ? batteryDrain / elapsedTimeMinutes : 0,
      avgFps: data.avgFps,
      elapsedTime: data.elapsedTimeSeconds || 0,
    };
  });

  // Determine if we're showing total drain or per-minute drain
  const isPerMinute = dashboard.batteryDrainMode === "perMinute";
  const dataKey = isPerMinute ? "drainPerMinute" : "totalDrain";
  const yAxisLabel = isPerMinute
    ? "Battery Drain per Minute (%)"
    : "Battery Drain (%)";

  // Prepare data for grouped bar chart
  const apps = Object.keys(appBatteryData);
  const allDevices = new Set();

  // Collect all unique devices
  apps.forEach((app) => {
    Object.keys(appBatteryData[app]).forEach((device) => {
      allDevices.add(device);
    });
  });

  const devices = Array.from(allDevices);

  // If too many devices, show as heatmap instead
  if (devices.length > 8 || apps.length > 10) {
    createBatteryDrainHeatmap(dashboard, appBatteryData, isPerMinute);
    return;
  }

  // Generate colors for each device
  const deviceColors = {};
  devices.forEach((device, index) => {
    const hue = (index * 137.5) % 360;
    deviceColors[device] = `hsl(${hue}, 70%, 60%)`;
  });

  // Create datasets for each device
  const datasets = devices.map((device) => {
    const data = apps.map((app) => {
      const appData = appBatteryData[app][device];
      return appData ? appData[dataKey] : 0;
    });

    return {
      label: device,
      data: data,
      backgroundColor: deviceColors[device] + "80",
      borderColor: deviceColors[device],
      borderWidth: 2,
      borderRadius: 4,
    };
  });

  dashboard.charts.batteryDrainChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: apps,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { bottom: 20, left: 10, right: 10, top: 10 },
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            usePointStyle: true,
            boxWidth: 12,
            font: { size: 10 },
          },
          maxHeight: 80,
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              return context[0].label;
            },
            label: function (context) {
              const device = context.dataset.label;
              const app = context.label;
              const appData = appBatteryData[app][device];

              if (!appData) return "";

              const drainValue = isPerMinute
                ? `${context.parsed.y.toFixed(2)}%/min`
                : `${context.parsed.y.toFixed(1)}%`;

              return [
                `${device}`,
                `Battery Drain: ${drainValue}`,
                `Elapsed Time: ${appData.elapsedTime.toFixed(1)}s`,
                `Avg FPS: ${appData.avgFps.toFixed(1)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            maxRotation: 45,
            font: { size: 11 },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: yAxisLabel,
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            callback: function (value) {
              return isPerMinute ? `${value.toFixed(1)}%/min` : `${value}%`;
            },
          },
        },
      },
    },
  });

  addChartControls(dashboard, "batteryDrainChart", "battery");
}

export function createBatteryDrainHeatmap(
  dashboard,
  appBatteryData,
  isPerMinute
) {
  const ctx = document.getElementById("batteryDrainChart").getContext("2d");

  if (dashboard.charts.batteryDrainChart) {
    dashboard.charts.batteryDrainChart.destroy();
  }

  const apps = Object.keys(appBatteryData);
  const allDevices = new Set();

  apps.forEach((app) => {
    Object.keys(appBatteryData[app]).forEach((device) => {
      allDevices.add(device);
    });
  });

  const devices = Array.from(allDevices);
  const dataKey = isPerMinute ? "drainPerMinute" : "totalDrain";

  const heatmapData = [];
  let maxValue = 0;

  apps.forEach((app, appIndex) => {
    devices.forEach((device, deviceIndex) => {
      const appData = appBatteryData[app][device];
      const value = appData ? appData[dataKey] : 0;
      maxValue = Math.max(maxValue, value);

      heatmapData.push({
        x: appIndex,
        y: deviceIndex,
        v: value,
        app: app,
        device: device,
        appData: appData,
      });
    });
  });

  const colors = heatmapData.map((point) => {
    const intensity = maxValue > 0 ? point.v / maxValue : 0;
    const alpha = Math.max(0.1, intensity);
    return `rgba(239, 68, 68, ${alpha})`;
  });

  dashboard.charts.batteryDrainChart = new Chart(ctx, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: "Battery Drain",
          data: heatmapData,
          backgroundColor: colors,
          borderColor: colors.map((color) => color.replace(/[\d.]+\)$/g, "1)")),
          borderWidth: 1,
          pointRadius: 15,
          pointHoverRadius: 18,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: { bottom: 40, left: 60, right: 20, top: 20 },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (context) {
              const point = context[0].raw;
              return `${point.app} on ${point.device}`;
            },
            label: function (context) {
              const point = context.raw;
              if (!point.appData) return "No data";

              const drainValue = isPerMinute
                ? `${point.v.toFixed(2)}%/min`
                : `${point.v.toFixed(1)}%`;

              return [
                `Battery Drain: ${drainValue}`,
                `Elapsed Time: ${point.appData.elapsedTime.toFixed(1)}s`,
                `Avg FPS: ${point.appData.avgFps.toFixed(1)}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          position: "bottom",
          min: -0.5,
          max: apps.length - 0.5,
          title: {
            display: true,
            text: "Apps",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            stepSize: 1,
            callback: function (value) {
              return apps[Math.round(value)] || "";
            },
            maxRotation: 45,
            font: { size: 10 },
          },
        },
        y: {
          type: "linear",
          min: -0.5,
          max: devices.length - 0.5,
          title: {
            display: true,
            text: "Devices",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            stepSize: 1,
            callback: function (value) {
              const device = devices[Math.round(value)];
              return device && device.length > 20
                ? device.substring(0, 20) + "..."
                : device || "";
            },
            font: { size: 9 },
          },
        },
      },
    },
  });

  addChartControls(dashboard, "batteryDrainChart", "battery");
}

// --- Chart UI Controls ---

export function addChartControls(dashboard, chartId, chartType) {
  const chartContainer = document.getElementById(chartId).parentElement;
  if (chartContainer.querySelector(".chart-controls")) {
    return;
  }
  const controlsDiv = document.createElement("div");
  controlsDiv.className = "chart-controls";
  controlsDiv.innerHTML = `
      <button onclick="window.dashboard.toggleChart('${chartId}', '${chartType}')" title="Show more/less data" id="${chartId}MaxBtn">📈</button>
      <button onclick="window.dashboard.copyChart('${chartId}')" title="Copy chart data">📋</button>
    `;
  chartContainer.style.position = "relative";
  chartContainer.appendChild(controlsDiv);
}

// --- Detailed Analysis Charts ---

export function createDetailChart(
  chartType,
  analysisData,
  timeScale,
  detailCharts
) {
  if (!analysisData || !analysisData.perFrameInstantaneousFps) return;

  const data = analysisData;
  const startTimeNs =
    data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;

  const createTimeData = (values) => {
    const dataArray =
      values.length < data.rawFpsData.length
        ? data.rawFpsData.slice(1)
        : data.rawFpsData;
    return values
      .map((value, index) => {
        if (index >= dataArray.length) return null;
        const timestampNs = dataArray[index].presentationTime;
        return {
          x: (timestampNs - startTimeNs) / 1000000,
          y: value,
        };
      })
      .filter((p) => p !== null && !isNaN(p.y));
  };

  const intervalMap = { frame: 0, "1s": 1000, "5s": 5000 };
  const intervalMs = intervalMap[timeScale];

  let chartConfig;
  switch (chartType) {
    case "fps":
      const fpsDataPoints = createTimeData(
        data.perFrameInstantaneousFps.map((fps) => Math.min(fps, 200))
      );
      chartConfig = createFpsChartConfig(
        aggregateDataByTime(fpsDataPoints, intervalMs),
        data.targetFPS
      );
      break;
    case "jank":
      const jankDataPoints = createTimeData(data.perFrameSlowFrameExcess);
      const instabilityDataPoints = createTimeData(data.perFrameInstability);
      chartConfig = createJankChartConfig(
        aggregateDataByTime(jankDataPoints, intervalMs),
        aggregateDataByTime(instabilityDataPoints, intervalMs)
      );
      break;
    case "combined":
      const fpsPoints = createTimeData(
        data.perFrameInstantaneousFps.map((fps) => Math.min(fps, 200))
      );
      const jankPoints = createTimeData(data.perFrameSlowFrameExcess);
      const instabilityPoints = createTimeData(data.perFrameInstability);
      chartConfig = createCombinedChartConfig(
        aggregateDataByTime(fpsPoints, intervalMs),
        aggregateDataByTime(jankPoints, intervalMs),
        aggregateDataByTime(instabilityPoints, intervalMs),
        data.targetFPS
      );
      break;
    case "fpsBuckets":
      chartConfig = createFpsBucketsChartConfig(data.fpsBuckets);
      break;
    default:
      return;
  }

  const canvasId = `detail${
    chartType.charAt(0).toUpperCase() + chartType.slice(1)
  }Chart`;
  const ctx = document.getElementById(canvasId).getContext("2d");

  if (detailCharts[chartType]) {
    detailCharts[chartType].destroy();
  }
  detailCharts[chartType] = new Chart(ctx, chartConfig);
}

function createFpsChartConfig(fpsData, targetFPS) {
  const targetFpsLine =
    fpsData.length > 0
      ? [
          {
            x: fpsData[0].x,
            y: targetFPS,
          },
          {
            x: fpsData[fpsData.length - 1].x,
            y: targetFPS,
          },
        ]
      : [];
  return {
    type: "line",
    data: {
      datasets: [
        {
          label: "Actual FPS",
          data: fpsData,
          borderColor: "rgba(99, 102, 241, 1)",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          borderWidth: 2,
          fill: true,
          tension: 0.1,
          pointRadius: 1,
          pointHoverRadius: 4,
        },
        {
          label: `Target FPS (${targetFPS})`,
          data: targetFpsLine,
          borderColor: "rgba(34, 197, 94, 0.8)",
          backgroundColor: "transparent",
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
          },
        },
        tooltip: {
          callbacks: {
            title: (context) =>
              `Time: ${new Date(context[0].parsed.x)
                .toISOString()
                .substr(14, 5)}s`,
            label: (context) =>
              `${context.dataset.label}: ${context.parsed.y.toFixed(1)}`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            callback: (value) => new Date(value).toISOString().substr(14, 5),
          },
        },
        y: {
          title: {
            display: true,
            text: "FPS",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: { color: "rgba(255, 255, 255, 0.8)" },
          beginAtZero: true,
        },
      },
    },
  };
}

function createJankChartConfig(slowFrameData, instabilityData) {
  return {
    type: "line",
    data: {
      datasets: [
        {
          label: "Slow Frame Excess (ms)",
          data: slowFrameData,
          borderColor: "rgba(255, 99, 132, 1)",
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1,
          yAxisID: "y",
        },
        {
          label: "Jank Instability (ms)",
          data: instabilityData,
          borderColor: "rgba(54, 162, 235, 1)",
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 1,
          yAxisID: "y",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        title: {
          display: true,
          text: "Jank Analysis (Slow Frames & Instability)",
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          ticks: {
            callback: (value) => new Date(value).toISOString().substr(14, 5),
          },
        },
        y: {
          title: {
            display: true,
            text: "Jank (ms)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          beginAtZero: true,
        },
      },
    },
  };
}

function createCombinedChartConfig(
  fpsData,
  jankData,
  instabilityData,
  targetFPS
) {
  const targetFpsLine =
    fpsData.length > 0
      ? [
          { x: fpsData[0].x, y: targetFPS },
          { x: fpsData[fpsData.length - 1].x, y: targetFPS },
        ]
      : [];
  const datasets = [
    {
      label: "Actual FPS",
      data: fpsData,
      borderColor: "rgba(99, 102, 241, 1)",
      yAxisID: "y",
    },
    {
      label: `Target FPS (${targetFPS})`,
      data: targetFpsLine,
      borderColor: "rgba(34, 197, 94, 0.8)",
      borderDash: [5, 5],
      yAxisID: "y",
    },
    {
      label: "Slow Frame Excess (ms)",
      data: jankData,
      borderColor: "rgba(239, 68, 68, 1)",
      yAxisID: "y1",
    },
  ];
  if (instabilityData && instabilityData.some((val) => val > 0)) {
    datasets.push({
      label: "Jank Instability (ms)",
      data: instabilityData,
      borderColor: "rgba(255, 165, 0, 1)",
      yAxisID: "y1",
    });
  }
  return {
    type: "line",
    data: { datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      scales: {
        x: {
          type: "linear",
          title: { display: true, text: "Time (mm:ss)" },
          ticks: {
            callback: (value) => new Date(value).toISOString().substr(14, 5),
          },
        },
        y: {
          type: "linear",
          position: "left",
          title: { display: true, text: "FPS" },
          min: 0,
        },
        y1: {
          type: "linear",
          position: "right",
          title: { display: true, text: "Frame Excess (ms)" },
          grid: { drawOnChartArea: false },
          min: 0,
        },
      },
    },
  };
}

function createFpsBucketsChartConfig(fpsBuckets) {
  if (!fpsBuckets) {
    return {
      type: "bar",
      data: { labels: ["No Data"], datasets: [{ data: [0] }] },
    };
  }
  const labels = [
    "0-3",
    "3-5",
    "5-7",
    "7-9",
    "9-11",
    "11-13",
    "13-16",
    "16-19",
    "19-22",
    "22-26",
    "26-35",
    "35-50",
    "50-70",
    "70+",
  ];
  const data = [
    fpsBuckets.bucket_0_3,
    fpsBuckets.bucket_3_5,
    fpsBuckets.bucket_5_7,
    fpsBuckets.bucket_7_9,
    fpsBuckets.bucket_9_11,
    fpsBuckets.bucket_11_13,
    fpsBuckets.bucket_13_16,
    fpsBuckets.bucket_16_19,
    fpsBuckets.bucket_19_22,
    fpsBuckets.bucket_22_26,
    fpsBuckets.bucket_26_35,
    fpsBuckets.bucket_35_50,
    fpsBuckets.bucket_50_70,
    fpsBuckets.bucket_70_plus,
  ];
  return {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Frame Count",
          data: data,
          backgroundColor: "rgba(99, 102, 241, 0.6)",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "FPS Range" } },
        y: {
          title: { display: true, text: "Number of Frames" },
          beginAtZero: true,
        },
      },
    },
  };
}

// --- Comparison Charts ---

export function createComparisonBarChart(selectedData, dashboard) {
  const ctx = document.getElementById("comparisonBarChart").getContext("2d");

  if (dashboard.comparisonCharts.barChart) {
    dashboard.comparisonCharts.barChart.destroy();
  }

  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  const labels = selectedData.map((data) => data.appName || "Unknown App");
  const avgFpsData = selectedData.map((data) => data.avgFps || 0);
  const minFpsData = selectedData.map((data) => data.minFps || 0);
  const maxFpsData = selectedData.map((data) => data.maxFps || 0);

  dashboard.comparisonCharts.barChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Average FPS",
          data: avgFpsData,
          backgroundColor: colors.map((color) => color + "80"),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 4,
        },
        {
          label: "Min FPS",
          data: minFpsData,
          backgroundColor: colors.map((color) => color + "40"),
          borderColor: colors.map((color) => color + "80"),
          borderWidth: 1,
          borderRadius: 4,
        },
        {
          label: "Max FPS",
          data: maxFpsData,
          backgroundColor: colors.map((color) => color + "60"),
          borderColor: colors,
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
          },
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(
                1
              )} FPS`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            maxRotation: 45,
          },
        },
        y: {
          title: {
            display: true,
            text: "FPS",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: {
            color: "rgba(255, 255, 255, 0.1)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
          },
          beginAtZero: true,
        },
      },
    },
  });
}

export function createComparisonFpsChart(selectedData, dashboard) {
  const ctx = document.getElementById("comparisonFpsChart").getContext("2d");

  if (dashboard.comparisonCharts.fpsChart) {
    dashboard.comparisonCharts.fpsChart.destroy();
  }

  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  const intervalMap = { frame: 0, "1s": 1000, "5s": 5000 };
  const intervalMs = intervalMap[dashboard.comparisonChartTimeScale];

  const datasets = selectedData
    .map((data, index) => {
      if (
        !data.perFrameInstantaneousFps ||
        data.perFrameInstantaneousFps.length === 0
      ) {
        return null;
      }

      const startTimeNs =
        data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;

      const dataPoints = data.perFrameInstantaneousFps
        .map((fps, frameIndex) => {
          if (frameIndex + 1 >= data.rawFpsData.length) return null;
          const timestampNs = data.rawFpsData[frameIndex + 1].presentationTime;
          return {
            x: (timestampNs - startTimeNs) / 1000000,
            y: Math.min(fps, 200),
          };
        })
        .filter((p) => p !== null && !isNaN(p.y));

      const aggregatedData = aggregateDataByTime(dataPoints, intervalMs);

      return {
        label: data.appName || "Unknown App",
        data: aggregatedData,
        borderColor: colors[index],
        backgroundColor: colors[index] + "20",
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 3,
      };
    })
    .filter((dataset) => dataset !== null);

  dashboard.comparisonCharts.fpsChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: "index",
      },
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            title: function (context) {
              if (!context[0]) return "";
              const totalSeconds = context[0].parsed.x / 1000;
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              return `Time: ${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}`;
            },
            label: function (context) {
              return `${context.dataset.label}: ${context.parsed.y.toFixed(
                1
              )} FPS`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            callback: function (value, index, ticks) {
              const totalSeconds = Math.floor(value / 1000);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              return `${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}`;
            },
          },
        },
        y: {
          title: {
            display: true,
            text: "FPS",
            color: "rgba(255, 255, 255, 0.8)",
          },
          grid: { color: "rgba(255, 255, 255, 0.1)" },
          ticks: { color: "rgba(255, 255, 255, 0.8)" },
          beginAtZero: true,
        },
      },
    },
  });
}

export function createComparisonSlowFrameChart(selectedData, dashboard) {
  const ctx = document
    .getElementById("comparisonSlowFrameChart")
    .getContext("2d");

  if (dashboard.comparisonCharts.slowFrameChart) {
    dashboard.comparisonCharts.slowFrameChart.destroy();
  }

  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  const intervalMap = { frame: 0, "1s": 1000, "5s": 5000 };
  const intervalMs = intervalMap[dashboard.comparisonChartTimeScale];

  const datasets = selectedData
    .map((data, index) => {
      if (!data.perFrameSlowFrameExcess) return null;

      const startTimeNs =
        data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;
      const createTimeData = (values) => {
        const dataArray =
          values.length < data.rawFpsData.length
            ? data.rawFpsData.slice(1)
            : data.rawFpsData;
        return values
          .map((value, frameIndex) => {
            if (frameIndex >= dataArray.length) return null;
            const timestampNs = dataArray[frameIndex].presentationTime;
            return { x: (timestampNs - startTimeNs) / 1000000, y: value };
          })
          .filter((p) => p !== null && !isNaN(p.y));
      };

      const slowFrameDataPoints = createTimeData(data.perFrameSlowFrameExcess);

      return {
        label: `${data.appName || "Unknown"} - Slow Frame`,
        data: aggregateDataByTime(slowFrameDataPoints, intervalMs),
        borderColor: colors[index],
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 0,
        fill: false,
      };
    })
    .filter((ds) => ds !== null);

  dashboard.comparisonCharts.slowFrameChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            title: (context) =>
              `Time: ${new Date(context[0].parsed.x)
                .toISOString()
                .substr(14, 5)}s`,
            label: (context) =>
              `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ms`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            callback: function (value, index, ticks) {
              const totalSeconds = Math.floor(value / 1000);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              return `${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}`;
            },
          },
        },
        y: {
          title: {
            display: true,
            text: "Slow Frame Excess (ms)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          ticks: { color: "rgba(255, 255, 255, 0.8)" },
          beginAtZero: true,
        },
      },
    },
  });
}

export function createComparisonInstabilityChart(selectedData, dashboard) {
  const ctx = document
    .getElementById("comparisonInstabilityChart")
    .getContext("2d");

  if (dashboard.comparisonCharts.instabilityChart) {
    dashboard.comparisonCharts.instabilityChart.destroy();
  }

  const colors = selectedData.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  const intervalMap = { frame: 0, "1s": 1000, "5s": 5000 };
  const intervalMs = intervalMap[dashboard.comparisonChartTimeScale];

  const datasets = selectedData
    .map((data, index) => {
      if (!data.perFrameInstability) return null;

      const startTimeNs =
        data.rawFpsData.length > 0 ? data.rawFpsData[0].presentationTime : 0;
      const createTimeData = (values) => {
        const dataArray =
          values.length < data.rawFpsData.length
            ? data.rawFpsData.slice(1)
            : data.rawFpsData;
        return values
          .map((value, frameIndex) => {
            if (frameIndex >= dataArray.length) return null;
            const timestampNs = dataArray[frameIndex].presentationTime;
            return { x: (timestampNs - startTimeNs) / 1000000, y: value };
          })
          .filter((p) => p !== null && !isNaN(p.y));
      };

      const instabilityDataPoints = createTimeData(data.perFrameInstability);

      return {
        label: `${data.appName || "Unknown"} - Instability`,
        data: aggregateDataByTime(instabilityDataPoints, intervalMs),
        borderColor: colors[index],
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 0,
        fill: false,
      };
    })
    .filter((ds) => ds !== null);

  dashboard.comparisonCharts.instabilityChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          labels: {
            color: "rgba(255, 255, 255, 0.8)",
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            title: (context) =>
              `Time: ${new Date(context[0].parsed.x)
                .toISOString()
                .substr(14, 5)}s`,
            label: (context) =>
              `${context.dataset.label}: ${context.parsed.y.toFixed(2)} ms`,
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Time (mm:ss)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          ticks: {
            color: "rgba(255, 255, 255, 0.8)",
            callback: function (value, index, ticks) {
              const totalSeconds = Math.floor(value / 1000);
              const minutes = Math.floor(totalSeconds / 60);
              const seconds = totalSeconds % 60;
              return `${minutes.toString().padStart(2, "0")}:${seconds
                .toString()
                .padStart(2, "0")}`;
            },
          },
        },
        y: {
          title: {
            display: true,
            text: "Instability (ms)",
            color: "rgba(255, 255, 255, 0.8)",
          },
          ticks: { color: "rgba(255, 255, 255, 0.8)" },
          beginAtZero: true,
        },
      },
    },
  });
}

export function createComparisonFpsBucketsCharts(selectedData, dashboard) {
  const container = document.getElementById("comparisonFpsBucketsContainer");

  container.innerHTML = "";

  const dataWithBuckets = selectedData.filter((data) => data.fpsBuckets);

  if (dataWithBuckets.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
        <p>No FPS bucket data available for comparison</p>
      </div>
    `;
    return;
  }

  const colors = dataWithBuckets.map((_, index) => {
    const hue = (index * 137.5) % 360;
    return `hsl(${hue}, 70%, 60%)`;
  });

  dataWithBuckets.forEach((data, index) => {
    const chartId = `fpsBucketsChart_${index}`;
    const color = colors[index];

    const chartContainer = document.createElement("div");
    chartContainer.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

    chartContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px;">
        <span class="app-color-indicator" style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%;"></span>
        <h4 style="margin: 0; color: var(--text-primary); font-size: 1rem;">${
          data.appName || "Unknown App"
        }</h4>
      </div>
      <div style="height: 300px; position: relative;">
        <canvas id="${chartId}"></canvas>
      </div>
    `;

    container.appendChild(chartContainer);

    const ctx = document.getElementById(chartId).getContext("2d");
    const chartConfig = createFpsBucketsChartConfig(data.fpsBuckets);

    if (chartConfig.data.datasets[0]) {
      const baseColor = color;
      // Create a proper color array for FPS buckets (14 buckets total)
      const bucketColors = [
        "rgba(239, 68, 68, 0.8)", // 0-3: Red (very poor)
        "rgba(245, 101, 101, 0.8)", // 3-5: Light red (poor)
        "rgba(251, 146, 60, 0.8)", // 5-7: Orange (below average)
        "rgba(252, 211, 77, 0.8)", // 7-9: Yellow (average)
        "rgba(163, 230, 53, 0.8)", // 9-11: Light green (good)
        "rgba(34, 197, 94, 0.8)", // 11-13: Green (very good)
        "rgba(16, 185, 129, 0.8)", // 13-16: Teal (excellent)
        "rgba(99, 102, 241, 0.8)", // 16-19: Blue (outstanding)
        "rgba(139, 92, 246, 0.8)", // 19-22: Purple (exceptional)
        "rgba(168, 85, 247, 0.8)", // 22-26: Purple variant
        "rgba(192, 132, 252, 0.8)", // 26-35: Light purple
        "rgba(196, 181, 253, 0.8)", // 35-50: Very light purple
        "rgba(221, 214, 254, 0.8)", // 50-70: Pale purple
        "rgba(237, 233, 254, 0.8)", // 70+: Very pale purple
      ];

      chartConfig.data.datasets[0].backgroundColor = bucketColors;
      chartConfig.data.datasets[0].borderColor = bucketColors.map((color) =>
        color.replace("0.8", "1")
      );
    }

    dashboard.comparisonCharts[`fpsBuckets_${index}`] = new Chart(
      ctx,
      chartConfig
    );
  });
}
