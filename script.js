const user = firebase.auth().currentUser;
if (user) {
  console.log("User email:", user.email);
  // User is signed in
}
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

document.addEventListener("DOMContentLoaded", () => {
  loadPhase("phase1");
});

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
  document.getElementById("phase-title").textContent = phase.replace(/([a-zA-Z]+)(\d+)/, '$1 $2').replace(/^./, str => str.toUpperCase());

  fetchRealtimeValues();
  fetchAllHistorical();
}

// 4) Fetch & display real-time cards
function fetchRealtimeValues() {
  const { url } = apiKeys[currentPhaseKey];
  fetch(`${url}?results=1`)
    .then(res => res.json())
    .then(data => {
      const latest = data.feeds.reverse().find(entry =>
        fields.every((f, idx) => entry[`field${idx + 1}`] !== null && entry[`field${idx + 1}`] !== undefined)
      );

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
  chartInstances.forEach(c => c && c.destroy());
  chartInstances = [];

  fields.forEach((f, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";
    wrapper.style.animationDelay = `${idx * 0.1}s`;

    const button = document.createElement("button");
    button.className = "limit-button";
    button.textContent = "📊";
    button.title = "Show history count";
    button.addEventListener("click", () => {
      const inputDiv = wrapper.querySelector(".limit-input-wrapper");
      inputDiv.style.display = inputDiv.style.display === "block" ? "none" : "block";
    });
    wrapper.appendChild(button);

    const inputDiv = document.createElement("div");
    inputDiv.className = "limit-input-wrapper";
    inputDiv.innerHTML = `
      <input type="number" id="${f.key}-count" value="${fieldLimits[f.key]}" min="1" />
      <button onclick="applyLimit('${f.key}', ${idx})">OK</button>
    `;
    wrapper.appendChild(inputDiv);

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

      const ctx = document
        .getElementById("charts-container")
        .children[chartIndex]
        .querySelector("canvas")
        .getContext("2d");

      if (chartInstances[chartIndex]) {
        chartInstances[chartIndex].data.labels = labels;
        chartInstances[chartIndex].data.datasets[0].data = dataPoints;
        chartInstances[chartIndex].update();
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
                title: { display: true, text: "Time" },
                ticks: {
                  color: getComputedStyle(document.body).getPropertyValue("--text-color")
                }
              },
              y: {
                title: { display: true, text: fieldInfo.unit },
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

    // Optional: clear old chart
    if (chartInstances[chartIndex]) {
      chartInstances[chartIndex].destroy();
      chartInstances[chartIndex] = null;
    }

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

// Calculate cumulative energy considering resets
function calculateCumulativeEnergy(feeds, fieldKey = "field8") {
  let total = 0;
  let prev = null;

  for (let i = 0; i < feeds.length; i++) {
    const current = parseFloat(feeds[i][fieldKey]);
    if (isNaN(current)) continue;

    if (prev === null) {
      prev = current;
      continue;
    }

    if (current >= prev) {
      total += current - prev;
    } else {
      // Reset detected
      total += current;
    }

    prev = current;
  }

  return total.toFixed(3);
}

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

      const totalKWh = calculateCumulativeEnergy(feeds, "field8");
      document.getElementById("total-kwh-value").textContent = `Total Energy: ${totalKWh} kWh`;

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

document.getElementById("download-report-btn").addEventListener("click", downloadReportPDF);

async function downloadReportPDF() {
  const channelMap = { phase1: 2859613, phase2: 2859618, phase3: 2859621 };
  const channelID = channelMap[currentPhaseKey];
  const range = historyRangeSelect.value;

  let url;
  let startDateStr = null, endDateStr = null;
  const today = new Date();

  if (range === "daily") {
    endDateStr = today.toISOString().split('T')[0];
    const prev = new Date();
    prev.setDate(prev.getDate() - 1);
    startDateStr = prev.toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDateStr}`;
  } else if (range === "weekly") {
    endDateStr = today.toISOString().split('T')[0];
    const prev = new Date();
    prev.setDate(prev.getDate() - 7);
    startDateStr = prev.toISOString().split('T')[0];
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?start=${startDateStr}`;
  } else if (range === "monthly") {
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
    url = `https://api.thingspeak.com/channels/${channelID}/feeds.json?results=50`;
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    const feeds = data.feeds;
    if (!feeds || feeds.length === 0) {
      alert("No data available for the selected period.");
      return;
    }

    feeds.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const energyValues = feeds.map(f => parseFloat(f.field8)).filter(v => !isNaN(v));

    // ✅ Find first non-zero valid reading as previous reading
    const firstReading = energyValues.find(v => v > 0) || 0;
    const lastReading = energyValues[energyValues.length - 1] || 0;

    // ✅ Calculate cumulative energy considering resets
    let usage = 0;
    for (let i = 1; i < energyValues.length; i++) {
      const prev = energyValues[i - 1];
      const curr = energyValues[i];
      const diff = curr - prev;
      if (!isNaN(diff)) {
        usage += diff >= 0 ? diff : curr; // reset logic
      }
    }

    const labels = feeds.map(f => new Date(f.created_at).toLocaleString());
    const dataPoints = feeds.map(f => parseFloat(f.field8) || 0);

    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    const lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Energy (kWh)",
          data: dataPoints,
          borderColor: 'rgba(23,195,178,1)',
          backgroundColor: 'rgba(23,195,178,0.3)',
          pointRadius: 2,
          tension: 0.2
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: {
            title: { display: true, text: "Date/Time" },
            ticks: {
              autoSkip: true,
              maxRotation: 45,
              minRotation: 45,
              maxTicksLimit: 10
            }
          },
          y: {
            beginAtZero: true,
            title: { display: true, text: "kWh" }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: getComputedStyle(document.body).getPropertyValue("--text-color") || '#000'
            }
          }
        }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    const imgData = canvas.toDataURL("image/png");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });

    let y = 15;
    const margin = 15;

    doc.setFontSize(18);
    doc.text("Smart Energy Analyzer Report", margin, y);
    y += 10;

    doc.setFontSize(12);
    doc.text(`Phase: ${apiKeys[currentPhaseKey].title}`, margin, y);
    y += 6;
    doc.text(`Report Date: ${new Date().toLocaleDateString()}`, margin, y);
    y += 6;
    let label = "";
    if (range === "custom") {
      label = `${startDateStr} to ${endDateStr}`;
    } else if (range === "daily" || range === "weekly" || range === "monthly") {
      label = range;
    } else {
      label = `Last ${feeds.length} entries`;
    }
    doc.text(`Period: ${label}`, margin, y);
    y += 10;

    // Table header
    doc.setFillColor(23, 195, 178);
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, 110, 8, "F");
    doc.text("Summary", margin + 2, y + 6);
    doc.text("Value", margin + 60 + 2, y + 6);
    y += 8;

   const rows = [
  ["Total Consumption", `${usage.toFixed(3)} kWh`]
];

    doc.setTextColor(0, 0, 0);
    rows.forEach(([label, value]) => {
      doc.setDrawColor(200);
      doc.line(margin, y, margin + 110, y);
      doc.text(label, margin + 2, y + 6);
      doc.text(value, margin + 60 + 2, y + 6);
      y += 8;
    });

    y += 10;

    // Add graph image
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgProps = doc.getImageProperties(imgData);
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
    const maxHeight = pageHeight - y - margin;
    const finalImgHeight = Math.min(imgHeight, maxHeight);
    const finalImgWidth = (imgProps.width * finalImgHeight) / imgProps.height;

    doc.addImage(imgData, "PNG", margin, y, finalImgWidth, finalImgHeight);

    const filename = `Energy_Report_${currentPhaseKey}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);

    lineChart.destroy();
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