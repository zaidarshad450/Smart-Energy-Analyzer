// Redirect unauthenticated users to login.html
(function() {
  if (!localStorage.getItem("currentUser")) {
    window.location.href = "login.html";
  }
})();

// 1) API keys & field definitions
const apiKeys = {
  phase1: {
    url: "https://api.thingspeak.com/channels/2859613/feeds.json",
    title: "Phase 1"
  },
  phase2: {
    url: "https://api.thingspeak.com/channels/2859618/feeds.json",
    title: "Phase 2"
  },
  phase3: {
    url: "https://api.thingspeak.com/channels/2859621/feeds.json",
    title: "Phase 3"
  }
};

const fields = [
  { key: "field1", label: "Voltage", unit: "V" },
  { key: "field2", label: "Current", unit: "A" },
  { key: "field3", label: "Real Power", unit: "W" },
  { key: "field4", label: "Apparent Power", unit: "VA" },
  { key: "field5", label: "Reactive Power", unit: "VAR" },
  { key: "field6", label: "Power Factor", unit: "" },
  { key: "field7", label: "Frequency", unit: "Hz" },
  { key: "field8", label: "Energy", unit: "kWh" }
];

// Default number of points per field
const fieldLimits = {
  field1: 10,
  field2: 10,
  field3: 10,
  field4: 10,
  field5: 10,
  field6: 10,
  field7: 10,
  field8: 10
};

let chartInstances = [];
let currentPhaseKey = "phase1";
let veryLatestData = null;

// 2) Threshold storage & mapping
let thresholds = {
  voltage:     { min: null, max: null },
  current:     { min: null, max: null },
  realPower:   { min: null, max: null },
  appPower:    { min: null, max: null },
  reactPower:  { min: null, max: null },
  powerFactor: { min: null, max: null },
  frequency:   { min: null, max: null },
  energy:      { min: null, max: null }
};

const fieldKeyToName = {
  field1: "voltage",
  field2: "current",
  field3: "realPower",
  field4: "appPower",
  field5: "reactPower",
  field6: "powerFactor",
  field7: "frequency",
  field8: "energy"
};

// 3) Load chosen phase
function loadPhase(phase) {
  currentPhaseKey = phase;
  document.getElementById("phase-title").textContent =
    phase.charAt(0).toUpperCase() + phase.slice(1);
  fetchRealtimeValues();
  fetchAllHistorical();
}

// 4) Fetch & display real-time cards
function fetchRealtimeValues() {
  const { url } = apiKeys[currentPhaseKey];
  fetch(`${url}?results=1`)
    .then(res => res.json())
    .then(data => {
      const latest = data.feeds[0];
      veryLatestData = latest;
      const container = document.getElementById("realtime-values");
      container.innerHTML = "";
      fields.forEach((f, index) => {
        const value = latest[f.key] || "N/A";
        const numeric = parseFloat(latest[f.key]);
        const card = document.createElement("div");
        card.className = `card ${f.key === 'field1' ? 'voltage' : ''}`;
        card.style.animationDelay = `${index * 0.1}s`;

        let bgColor = "var(--card-bg)";
        if (!isNaN(numeric)) {
          const pname = fieldKeyToName[f.key];
          const { min, max } = thresholds[pname];
          if (min !== null && numeric < min) bgColor = "var(--card-low)";
          else if (max !== null && numeric > max) bgColor = "var(--card-high)";
          else bgColor = "var(--card-normal)";
        }
        card.style.backgroundColor = bgColor;

        card.innerHTML = `<h3>${f.label}</h3><p>${value} ${f.unit}</p>`;
        container.appendChild(card);
      });
    })
    .catch(err => console.error("Error fetching real-time:", err));
}

// 5) Build or rebuild all 8 mini‐charts
function fetchAllHistorical() {
  const container = document.getElementById("charts-container");
  container.innerHTML = "";
  chartInstances.forEach(c => c.destroy());
  chartInstances = [];

  fields.forEach((f, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";
    wrapper.style.animationDelay = `${idx * 0.1}s`;

    // Limit button
    const button = document.createElement("button");
    button.className = "limit-button";
    button.textContent = "📊";
    button.title = "Show history count";
    button.addEventListener("click", () => {
      const inputDiv = wrapper.querySelector(".limit-input-wrapper");
      inputDiv.style.display = (inputDiv.style.display === "block") ? "none" : "block";
    });
    wrapper.appendChild(button);

    // Input area
    const inputDiv = document.createElement("div");
    inputDiv.className = "limit-input-wrapper";
    inputDiv.innerHTML = `
      <input type="number" id="${f.key}-count" value="${fieldLimits[f.key]}" min="1" />
      <button onclick="applyLimit('${f.key}', ${idx})">OK</button>
    `;
    wrapper.appendChild(inputDiv);

    // Chart canvas
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    chartInstances.push(null);
    fetchSingleField(f.key, idx);
  });
}

// 6) Fetch & draw/update one field's mini‐chart
function fetchSingleField(fieldKey, chartIndex) {
  const limit = fieldLimits[fieldKey];
  const { url } = apiKeys[currentPhaseKey];
  fetch(`${url}?results=${limit}`)
    .then(res => res.json())
    .then(data => {
      const feeds = data.feeds;
      const labels = feeds.map(fe => new Date(fe.created_at).toLocaleTimeString());
      const dataPoints = feeds.map(fe => parseFloat(fe[fieldKey]) || 0);

      // Get canvas context
      const ctx = document
        .getElementById("charts-container")
        .children[chartIndex]
        .querySelector("canvas")
        .getContext("2d");

      // Update existing chart or create new
      if (chartInstances[chartIndex]) {
        const chart = chartInstances[chartIndex];
        chart.data.labels = labels;
        chart.data.datasets[0].data = dataPoints;
        chart.update();
      } else {
        const fieldInfo = fields.find(x => x.key === fieldKey);
        const newChart = new Chart(ctx, {
          type: "line",
          data: {
            labels,
            datasets: [{
              label: fieldInfo.label,
              data: dataPoints,
              fill: false,
              borderColor: `hsl(${chartIndex * 40}, 70%, 50%)`,
              tension: 0.3
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                labels: {
                  font: { size: 14 },
                  color: getComputedStyle(document.body).getPropertyValue("--text-color")
                }
              }
            },
            scales: {
              x: {
                display: true,
                title: {
                  display: true,
                  text: "Time",
                  font: { size: 14 }
                },
                ticks: {
                  color: getComputedStyle(document.body).getPropertyValue("--text-color"),
                  maxRotation: 45,
                  minRotation: 45
                }
              },
              y: {
                display: true,
                title: {
                  display: true,
                  text: fieldInfo.unit,
                  font: { size: 14 }
                },
                ticks: {
                  color: getComputedStyle(document.body).getPropertyValue("--text-color")
                }
              }
            }
          }
        });
        chartInstances[chartIndex] = newChart;
      }
    })
    .catch(err => console.error("Error fetching field", fieldKey, err));
}

// 7) Apply new limit to chart
function applyLimit(fieldKey, chartIndex) {
  const inputEl = document.getElementById(`${fieldKey}-count`);
  const val = parseInt(inputEl.value);
  if (!isNaN(val) && val > 0) {
    fieldLimits[fieldKey] = val;
    const wrapper = document.getElementById("charts-container").children[chartIndex];
    wrapper.querySelector(".limit-input-wrapper").style.display = "none";
    fetchSingleField(fieldKey, chartIndex);
  }
}

// 8) Dark mode toggle
document.getElementById("dark-mode-toggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  
  // Update button icon/text
  const darkModeBtn = document.getElementById("dark-mode-toggle");
  const icon = darkModeBtn.querySelector("i");
  if (document.body.classList.contains("dark-mode")) {
    icon.className = "fas fa-sun";
    darkModeBtn.innerHTML = `<i class="fas fa-sun"></i> Light Mode`;
  } else {
    icon.className = "fas fa-moon";
    darkModeBtn.innerHTML = `<i class="fas fa-moon"></i> Dark Mode`;
  }
  
  fetchAllHistorical();
  fetchRealtimeValues();
});

// 9) Logout (dummy function)
function logout() {
  localStorage.removeItem("currentUser");
  alert("You have been logged out.");
  window.location.href = "login.html";
}

// 10) Sidebar toggle with direction change
document.getElementById("toggle-sidebar-btn").addEventListener("click", () => {
  const sidebar = document.querySelector(".sidebar");
  sidebar.classList.toggle("hide");
  
  const toggleBtn = document.getElementById("toggle-sidebar-btn");
  if (sidebar.classList.contains("hide")) {
    toggleBtn.textContent = "→";
  } else {
    toggleBtn.textContent = "←";
  }
});
// KWh History Modal
const kwhHistoryModal = document.getElementById("kwh-history-modal");
const kwhHistoryBtn = document.getElementById("kwh-history-btn");
const closeKwhHistoryModalBtn = document.querySelectorAll(".close-modal")[1];
const historyRangeSelect = document.getElementById("history-range");
const customDateRange = document.getElementById("custom-date-range");
let kwhHistoryChart = null;

kwhHistoryBtn.addEventListener("click", () => {
  kwhHistoryModal.style.display = "block";
  buildKwhHistoryChart(historyRangeSelect.value);
});

closeKwhHistoryModalBtn.addEventListener("click", () => {
  kwhHistoryModal.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (e.target === kwhHistoryModal) {
    kwhHistoryModal.style.display = "none";
  }
});

historyRangeSelect.addEventListener("change", () => {
  const range = historyRangeSelect.value;
  customDateRange.style.display = range === "custom" ? "block" : "none";
  buildKwhHistoryChart(range);
});

function buildKwhHistoryChart(range) {
  const channelMap = { phase1: 2859613, phase2: 2859618, phase3: 2859621 };
  const channelID = channelMap[currentPhaseKey];
  let url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?results=50`;

  if (range === "daily") {
    const today = new Date();
    const startDate = new Date(today.setDate(today.getDate() - 1)).toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDate}`;
  } else if (range === "weekly") {
    const today = new Date();
    const startDate = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDate}`;
  } else if (range === "monthly") {
    const today = new Date();
    const startDate = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDate}`;
  } else if (range === "custom") {
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDate}&end=${endDate}`;
  }

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const feeds = data.feeds;
      const labels = feeds.map(f => new Date(f.created_at).toLocaleString());
      const dataPoints = feeds.map(f => parseFloat(f.field8) || 0);

      const ctx = document.getElementById("kwh-history-chart").getContext("2d");
      if (kwhHistoryChart) {
        kwhHistoryChart.destroy();
      }
      kwhHistoryChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Energy (kWh)",
            data: dataPoints,
            borderColor: "hsl(200, 70%, 50%)",
            tension: 0.3,
            pointRadius: 2,
          }]
        },
        options: {
          responsive: true,
          scales: {
            x: { title: { display: true, text: "Date" } },
            y: { title: { display: true, text: "kWh" } }
          }
        }
      });
    })
    .catch(err => console.error("Error loading KWh history data:", err));
}

// Download Report
// Attach listener (replace old CSV download listener)
document.getElementById("download-report-btn").addEventListener("click", downloadReportPDF);

async function downloadReportPDF() {
  const channelMap = { phase1: 2859613, phase2: 2859618, phase3: 2859621 };
  const channelID = channelMap[currentPhaseKey];
  const range = historyRangeSelect.value;

  // Build URL based on selected range
  let url;
  let startDateStr = null, endDateStr = null;
  if (range === "daily") {
    const today = new Date();
    endDateStr = today.toISOString().split('T')[0];
    const prev = new Date();
    prev.setDate(prev.getDate() - 1);
    startDateStr = prev.toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDateStr}`;
  } else if (range === "weekly") {
    const today = new Date();
    endDateStr = today.toISOString().split('T')[0];
    const prev = new Date();
    prev.setDate(prev.getDate() - 7);
    startDateStr = prev.toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDateStr}`;
  } else if (range === "monthly") {
    const today = new Date();
    endDateStr = today.toISOString().split('T')[0];
    const prev = new Date();
    prev.setMonth(prev.getMonth() - 1);
    startDateStr = prev.toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDateStr}`;
  } else if (range === "custom") {
    startDateStr = document.getElementById("start-date").value;
    endDateStr = document.getElementById("end-date").value;
    if (!startDateStr || !endDateStr) {
      alert("Please select both start and end dates for custom range.");
      return;
    }
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDateStr}&end=${endDateStr}`;
  } else {
    // fallback to last 50 readings
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?results=50`;
    // startDateStr remains null
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    const feeds = data.feeds;
    if (!feeds || feeds.length === 0) {
      alert("No data available for the selected period.");
      return;
    }
    // Sort ascending by timestamp
    feeds.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Extract energy readings (field8) and timestamps
    const energyValues = feeds.map(f => {
      const v = parseFloat(f.field8);
      return isNaN(v) ? 0 : v;
    });
    const firstReading = energyValues[0];
    const lastReading = energyValues[energyValues.length - 1];
    const usage = lastReading - firstReading;

    const firstTimestamp = new Date(feeds[0].created_at);
    const lastTimestamp = new Date(feeds[feeds.length - 1].created_at);

    // Prepare labels (formatted timestamps) and dataPoints
    // For charts, too many labels can clutter; but we'll include them and rotate labels.
    const labels = feeds.map(f => {
      // e.g., "6/13/2025 3:04:55 PM"
      const dt = new Date(f.created_at);
      return dt.toLocaleString(); 
    });
    const dataPoints = energyValues;

    // Create off-screen canvas for line chart
    const canvas = document.createElement("canvas");
    // Set a larger width for readability, height moderate
    // e.g., width 1000px, height 400px. Chart.js will draw onto it.
    canvas.width = 1000;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    // Build the Chart.js line chart
    const lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Energy (kWh)",
          data: dataPoints,
          fill: false,
          borderColor: 'rgba(23,195,178,1)',
          backgroundColor: 'rgba(23,195,178,0.4)',
          pointRadius: 2,
          tension: 0.2
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: {
            display: true,
            title: { display: true, text: "Date/Time" },
            ticks: {
              autoSkip: true,
              maxRotation: 45,
              minRotation: 45,
              maxTicksLimit: 10, // reduce clutter: show up to ~10 labels, Chart.js auto-skips
            }
          },
          y: {
            display: true,
            title: { display: true, text: "kWh" },
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              color: getComputedStyle(document.body).getPropertyValue("--text-color") || '#000',
              font: { size: 12 }
            }
          }
        }
      }
    });

    // Wait briefly to ensure rendering completes (Chart.js rendering is synchronous,
    // but in some environments a tiny delay can help)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Convert chart canvas to image data URL
    const imgData = canvas.toDataURL("image/png");

    // Prepare PDF
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("PDF library not loaded. Please ensure jsPDF is included.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    // Using landscape orientation to accommodate wide time-series

    const margin = 15;
    let cursorY = 15;

    // Title
    doc.setFontSize(18);
    doc.text("Smart Energy Analyzer Report", margin, cursorY);
    cursorY += 10;

    // Phase and Report Date
    doc.setFontSize(12);
    doc.text(`Phase: ${apiKeys[currentPhaseKey].title}`, margin, cursorY);
    cursorY += 7;
    const reportDateStr = new Date().toLocaleDateString();
    doc.text(`Report Date: ${reportDateStr}`, margin, cursorY);
    cursorY += 7;
    // Period label
    let periodLabel = "";
    if (range === "custom" && startDateStr && endDateStr) {
      periodLabel = `${startDateStr} to ${endDateStr}`;
    } else if (range === "daily" || range === "weekly" || range === "monthly") {
      periodLabel = range;
    } else {
      periodLabel = `Last ${feeds.length} readings`;
    }
    doc.text(`Period: ${periodLabel}`, margin, cursorY);
    cursorY += 12;

    // Summary “table”
    const tableX = margin;
    const tableY = cursorY;
    const col1Width = 60;
    const col2Width = 50;
    const rowHeight = 8;
    // Header background
    doc.setFillColor(23, 195, 178);
    doc.rect(tableX, tableY, col1Width + col2Width, rowHeight, 'F');
    // Header text in white
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text("Summary", tableX + 2, tableY + 6);
    doc.text("Value", tableX + col1Width + 2, tableY + 6);
    // Reset text color to black
    doc.setTextColor(0, 0, 0);

    // Rows: Previous, Current, Total
    const rows = [
      ["Previous Reading", `${firstReading.toFixed(3)} kWh`],
      ["Current Reading", `${lastReading.toFixed(3)} kWh`],
      ["Total Consumption", `${usage.toFixed(3)} kWh`]
    ];
    let rowY = tableY + rowHeight;
    rows.forEach(([label, val]) => {
      // Horizontal line above row
      doc.setDrawColor(200);
      doc.line(tableX, rowY, tableX + col1Width + col2Width, rowY);
      // Text
      doc.setFontSize(11);
      doc.text(label, tableX + 2, rowY + 6);
      doc.text(val, tableX + col1Width + 2, rowY + 6);
      rowY += rowHeight;
    });
    cursorY = rowY + 10;

    // Embed the time-series chart image
    // Determine available width: page width minus margins
    const pageWidth = doc.internal.pageSize.getWidth();
    const availableWidth = pageWidth - 2 * margin;
    // Image properties
    const imgProps = doc.getImageProperties(imgData);
    const imgWidth = availableWidth;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    // Check if it fits vertically; if too tall, scale down
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxHeight = pageHeight - cursorY - margin;
    let finalImgWidth = imgWidth;
    let finalImgHeight = imgHeight;
    if (imgHeight > maxHeight) {
      finalImgHeight = maxHeight;
      finalImgWidth = (imgProps.width * finalImgHeight) / imgProps.height;
    }
    doc.addImage(imgData, 'PNG', margin, cursorY, finalImgWidth, finalImgHeight);

    // Save PDF
    const filename = `Energy_Report_${currentPhaseKey}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    // Cleanup Chart.js instance
    lineChart.destroy();
    // Off-screen canvas is not attached, so it will be garbage-collected

  } catch (err) {
    console.error("Error generating PDF report:", err);
    alert("Failed to generate PDF report.");
  }
}

// 11) SET-POINT MODAL + CHART
const modal = document.getElementById("set-point-modal");
const closeModalBtn = document.querySelector(".close-modal");
const setPointBtn = document.getElementById("set-point-btn");
const paramSelect = document.getElementById("param-select");
const saveBtn = document.getElementById("save-setpoints-btn");
const minInput = document.getElementById("min-input");
const maxInput = document.getElementById("max-input");
let spChart = null;

setPointBtn.addEventListener("click", () => {
  modal.style.display = "block";
  buildSetPointChart(paramSelect.value);
});
closeModalBtn.addEventListener("click", () => {
  modal.style.display = "none";
});
window.addEventListener("click", e => {
  if (e.target === modal) modal.style.display = "none";
});
paramSelect.addEventListener("change", () => buildSetPointChart(paramSelect.value));

saveBtn.addEventListener("click", () => {
  const fieldKey = paramSelect.value;
  const paramName = fieldKeyToName[fieldKey];
  const minVal = parseFloat(minInput.value);
  const maxVal = parseFloat(maxInput.value);
  thresholds[paramName].min = isNaN(minVal) ? null : minVal;
  thresholds[paramName].max = isNaN(maxVal) ? null : maxVal;
  if (veryLatestData) colorCards(veryLatestData);
  modal.style.display = "none";
});

function buildSetPointChart(fieldKey) {
  const channelMap = { phase1: 2859613, phase2: 2859618, phase3: 2859621 };
  const channelID = channelMap[currentPhaseKey];
  fetch(`https://api.thingspeak.com/channels/${channelID}/feeds.json?results=50`)
    .then(res => res.json())
    .then(data => {
      const feeds = data.feeds;
      const labels = feeds.map(f => new Date(f.created_at).toLocaleTimeString());
      const dataPoints = feeds.map(f => parseFloat(f[fieldKey]) || 0);

      const ctx = document.getElementById("setpoint-chart").getContext("2d");
      if (spChart) spChart.destroy();
      const fieldInfo = fields.find(f => f.key === fieldKey);
      spChart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: `${fieldInfo.label} (${fieldInfo.unit})`,
            data: dataPoints,
            fill: false,
            borderColor: "hsl(200, 70%, 50%)",
            tension: 0.3,
            pointRadius: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              display: true,
              title: { display: true, text: "Time" }
            },
            y: {
              display: true,
              title: { display: true, text: fieldInfo.unit }
            }
          }
        }
      });

      const paramName = fieldKeyToName[fieldKey];
      const { min, max } = thresholds[paramName];
      minInput.value = min !== null ? min : "";
      maxInput.value = max !== null ? max : "";
    })
    .catch(err => console.error("Error loading set-point data:", err));
}

// 12) Color cards based on thresholds
function colorCards(latestData) {
  const cards = document.querySelectorAll(".card");
  cards.forEach(card => {
    const p = card.querySelector("p");
    const label = card.querySelector("h3").textContent;
    const f = fields.find(x => x.label === label);
    if (!f) return;
    const rawValue = latestData[f.key];
    const numericValue = parseFloat(rawValue);
    if (isNaN(numericValue)) {
      card.style.backgroundColor = "var(--card-bg)";
      return;
    }
    const paramName = fieldKeyToName[f.key];
    const { min, max } = thresholds[paramName];
    if (min !== null && numericValue < min) {
      card.style.backgroundColor = "var(--card-low)";
    } else if (max !== null && numericValue > max) {
      card.style.backgroundColor = "var(--card-high)";
    } else {
      card.style.backgroundColor = "var(--card-normal)";
    }
  });
}
// Handle modal close buttons
document.getElementById("close-kwh-modal").onclick = function () {
  document.getElementById("kwh-history-modal").style.display = "none";
};
document.getElementById("close-setpoint-modal").onclick = function () {
  document.getElementById("set-point-modal").style.display = "none";
};

// Optional: Close modal when clicking outside
window.onclick = function (event) {
  const kwhModal = document.getElementById("kwh-history-modal");
  const setPointModal = document.getElementById("set-point-modal");
  if (event.target === kwhModal) {
    kwhModal.style.display = "none";
  } else if (event.target === setPointModal) {
    setPointModal.style.display = "none";
  }
};

// 13) Initial load
loadPhase("phase1");