
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

// 13) Initial load
loadPhase("phase1");