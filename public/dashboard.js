let socket;
let accidents = [];
window.currentView = null; // Global reference for the map view

// Global arrays to hold the features retrieved from the "Feature Layers"
let allHospitalFeatures = [];
let allAmbulanceFeatures = [];

// Global Chart Instances
let bedsChartInstance = null;
let severityChartInstance = null;

// ===== DYNAMIC COUNTER ANIMATION =====
function animateCounter(elementId, start, end, duration = 1000) {
  const obj = document.getElementById(elementId);
  if (!obj) return;

  // Add 'updating' class for visual pop
  obj.classList.add("updating");
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    
    // Calculate current number
    const current = Math.floor(progress * (end - start) + start);
    obj.innerHTML = current.toLocaleString("ar-EG");

    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.classList.remove("updating");
    }
  };
  window.requestAnimationFrame(step);
}
// ===== Notification Sound =====
function playNotification() {
  try {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = "sine";
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.5
    );
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log("⚠️ Could not play notification sound:", error);
  }
}

// ===== CONNECT TO SOCKET.IO =====
try {
  socket = io("http://localhost:2511", {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });
  socket.on("connect", () => {
    console.log("✅ Dashboard connected - Socket ID:", socket.id);
    socket.emit("getAllAccidents");
  });
  socket.on("disconnect", () => console.log("❌ Dashboard disconnected"));
  socket.on("connect_error", (error) =>
    console.log("⚠️ Socket connection error:", error.message)
  );
  socket.on("allAccidents", (list) => {
    accidents = list.map((accident) => ({
      ...accident,
      id: accident.id || Date.now() + Math.random().toString(36).substr(2, 5),
    }));
    renderAccidents();
  });
  // Inside your socket.on("newAccident") block:

  socket.on("newAccident", (accident) => {
    if (!accident.id)
      accident.id = Date.now() + Math.random().toString(36).substr(2, 5);

    const exists = accidents.some(
      (a) =>
        a.geom.coordinates[0] === accident.geom.coordinates[0] &&
        a.geom.coordinates[1] === accident.geom.coordinates[1] &&
        Math.abs(new Date(a.timestamp) - new Date(accident.timestamp)) < 5000
    );

    if (!exists) {
      accidents.unshift(accident); // Add to top of list

      playNotification(); // Play sound

      // The render function now handles the counter animation automatically
      renderAccidents();

      // Optional: Trigger a toast notification via SweetAlert
      
    }
  });
} catch (error) {
  console.log("❌ Socket.io not available:", error.message);
}

// ===== DELETE ACCIDENT =====
function deleteAccident(index) {
  Swal.fire({
    title: "هل أنت متأكد؟",
    text: "سيتم حذف هذا البلاغ نهائياً",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#d33",
    cancelButtonColor: "#3085d6",
    confirmButtonText: "نعم، احذف",
    cancelButtonText: "إلغاء",
  }).then((result) => {
    if (result.isConfirmed) {
      accidents.splice(index, 1);
      renderAccidents();

      // Update Counter
      const totalEl = document.getElementById("totalReports");
      if (totalEl) {
        const currentCount = parseInt(totalEl.textContent) || 0;
        totalEl.textContent = (currentCount - 1).toLocaleString("ar-EG");
      }

      // Clear Route if specific accident was deleted (Optional logic)
      // window.currentView.graphics.removeAll();
    }
  });
}
window.deleteAccident = deleteAccident;

// ===== RENDER ACCIDENTS LIST =====
// ===== ENHANCED RENDER ACCIDENTS =====
// ===== ENHANCED RENDER ACCIDENTS =====
function renderAccidents() {
  const container = document.getElementById("accidentsList");
  const totalEl = document.getElementById("totalReports");

  // 1. Handle Counter Animation
  if (totalEl) {
    // Get current number (strip non-digits)
    const currentVal = parseInt(totalEl.innerText.replace(/[^0-9]/g, "")) || 0;
    const newVal = accidents.length;
    
    // Only animate if the number changed
    if (currentVal !== newVal) {
      animateCounter("totalReports", currentVal, newVal);
    }
  }

  // 2. Update Charts
  if(window.updateSeverityChart) window.updateSeverityChart();

  // 3. Handle Empty State
  if (!accidents || accidents.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 40px; color: var(--muted);">
        <div style="font-size: 40px; margin-bottom:10px; opacity:0.5; animation: pulse 2s infinite;">📡</div>
        <p>جاري انتظار إشارات البلاغات...</p>
      </div>`;
    return;
  }

  // 4. Generate Enhanced HTML
  container.innerHTML = accidents
    .map((accident, index) => {
      const reportTime = new Date(accident.reportTime || accident.timestamp).toLocaleTimeString("ar-EG", { hour: '2-digit', minute:'2-digit' });
      const reportId = accident.id ? String(accident.id).substring(0, 6).toUpperCase() : `R-${index}`;
      const injuries = accident.numberOfAccidents || 0;

      // --- FIX: Define Severity Variables Logic ---
      const status = (accident.status || "")

      let severityClass, badgeClass, severityText;
 switch (status) {
   case "Normal":
     severityClass = "severity-low";
     badgeClass = "badge-low";
     severityText = "حالة مستقرة";
     break;
   case "Moderate":
     severityClass = "severity-medium";
     badgeClass = "badge-medium";
     severityText = "حالة متوسطة";
     break;
   case "Critical":
     severityClass = "severity-high";
     badgeClass = "badge-high";
     severityText = "حالة حرجة 🚨";
     break;
   default:
     severityClass = "severity-low";
     badgeClass = "badge-low";
     severityText = "حالة مستقرة";
 }

      // --------------------------------------------

      return `
        <div class="accident-item ${severityClass}">
          <div class="accident-header">
            <span class="accident-id">#${reportId}</span>
            <span class="accident-time">🕒 ${reportTime}</span>
          </div>
          
          <div class="accident-body">
            <div class="location-text">
              <span>عدد المصابين: <strong>${injuries}</strong></span>
            </div>
            <div class="severity-badge ${badgeClass}">
              ${severityText}
            </div>
          </div>

          <div class="accident-actions">
            <button class="action-btn btn-view" id="viewBtn${index}" onclick="handleRouteClick(${index})">
              <span class="btn-icon">🗺️</span>
              <div class="btn-spinner"></div>
              <span class="btn-text">تتبع المسار</span>
            </button>
            
            <button class="action-btn btn-delete" onclick="deleteAccident(${index})">
              <span>🗑️</span>
              <span>حذف</span>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}
window.renderAccidents = renderAccidents;

// ===== WRAPPER FOR BUTTON CLICK (LOADING EFFECT) =====
window.handleRouteClick = function(index) {
  const btn = document.getElementById(`viewBtn${index}`);
  const btnText = btn.querySelector(".btn-text");
  
  // Add loading state
  if (btn) {
    btn.classList.add("btn-loading");
    btnText.textContent = "جاري الحساب...";
    btn.disabled = true;
  }

  // Call the original map function
  window.showAccidentOnMap(index).then(() => {
    // Reset button after map logic finishes (Success or Error)
    if (btn) {
      btn.classList.remove("btn-loading");
      btnText.textContent = "تتبع المسار";
      btn.disabled = false;
    }
  }).catch(() => {
     // Reset on error too
     if (btn) {
      btn.classList.remove("btn-loading");
      btnText.textContent = "تتبع المسار";
      btn.disabled = false;
    }
  });
};
window.renderAccidents = renderAccidents;

// ===== CHARTS LOGIC =====

function initCharts() {
  const ctx1 = document.getElementById("hospitalBedsChart").getContext("2d");
  const ctx2 = document
    .getElementById("accidentSeverityChart")
    .getContext("2d");

  // Chart 1: Top Hospitals (Bar)
  bedsChartInstance = new Chart(ctx1, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "عدد الأسرة المتاحة",
          data: [],
          backgroundColor: "rgba(33, 150, 243, 0.7)",
          borderColor: "rgba(33, 150, 243, 1)",
          borderWidth: 1,
          borderRadius: 5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: "🏥 أكثر المستشفيات استيعاباً (أسرة)",
          font: { family: "Cairo" },
        },
      },
      scales: {
        y: { beginAtZero: true, ticks: { font: { family: "Cairo" } } },
        x: { ticks: { font: { family: "Cairo", size: 10 } } },
      },
    },
  });

  // Chart 2: Severity (Doughnut)
  severityChartInstance = new Chart(ctx2, {
    type: "doughnut",
    data: {
      labels: [
        "إصابات طفيفة (1-2)",
        "إصابات متوسطة (3-5)",
        "إصابات خطيرة (>5)",
      ],
      datasets: [
        {
          data: [0, 0, 0],
          backgroundColor: [
            "rgba(76, 175, 80, 0.7)", // Green
            "rgba(255, 152, 0, 0.7)", // Orange
            "rgba(244, 67, 54, 0.7)", // Red
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { font: { family: "Cairo", size: 10 }, boxWidth: 10 },
        },
        title: {
          display: true,
          text: "📊 توزيع شدة الحوادث",
          font: { family: "Cairo" },
        },
      },
    },
  });
}

function updateSeverityChart() {
  if (!severityChartInstance) return;

  let low = 0,
    medium = 0,
    high = 0;

  accidents.forEach((acc) => {
    switch ((acc.status  )) {
      case "Normal":
        low++;
        break;
      case "Moderate":
        medium++;
        break;
      case "Critical":
        high++;
        break;
    }
  });

  severityChartInstance.data.datasets[0].data = [low, medium, high];
  severityChartInstance.update();
}


// Call initialization on load
document.addEventListener("DOMContentLoaded", () => {
  initCharts();
  renderAccidents();
});

// ===== INITIALIZE MAP & ARCGIS LOGIC =====
require([
  "esri/config",
  "esri/WebMap",
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/geometry/Point",
  "esri/layers/GraphicsLayer",
  "esri/layers/FeatureLayer",
  "esri/rest/closestFacility",
  "esri/rest/support/ClosestFacilityParameters",
  "esri/rest/support/FeatureSet",
], function (
  esriConfig,
  WebMap,
  Map,
  MapView,
  Graphic,
  Point,
  GraphicsLayer,
  FeatureLayer,
  closestFacility,
  ClosestFacilityParameters,
  FeatureSet
) {
  // --- 1. SETUP URLS & LAYERS ---
  const hospitalLayerUrl =
    "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Cairo_Emergency_WFL1/FeatureServer/0";
  const ambulanceLayerUrl =
    "https://services3.arcgis.com/UDCw00RKDRKPqASe/arcgis/rest/services/Cairo_Emergency_WFL1/FeatureServer/1";

  const closestFacilityUrl =
    "https://route.arcgis.com/arcgis/rest/services/World/ClosestFacility/NAServer/ClosestFacility_World";

  // --- 2. MAP INITIALIZATION ---
  const map = new Map({
    basemap: "streets-vector",
  });

  const view = new MapView({
    container: "map",
    map: map,
    center: [31.22, 30.05], // Centered on Cairo
    zoom: 10,
  });
  window.currentView = view;

  // ✅ LAYERS SETUP
  // Layer 1: Background Resources (Hospitals & Ambulances) - Always visible
  const resourcesLayer = new GraphicsLayer();
  map.add(resourcesLayer);

  // Layer 2: Active Routes & Selected Incident - Draws ON TOP
  const routesLayer = new GraphicsLayer();
  map.add(routesLayer);

  // --- 3. DEFINE SYMBOLS ---
  const hospitalSymbol = {
    type: "picture-marker",
    url: "https://img.icons8.com/?size=100&id=11934&format=png&color=000000",
    width: "32px",
    height: "32px",
  };

  const ambulanceSymbol = {
    type: "picture-marker",
    url: "https://img.icons8.com/?size=100&id=14739&format=png&color=000000",
    width: "32px",
    height: "32px",
  };

  // --- 4. FUNCTION TO FETCH REAL DATA ---
  async function loadFeaturesFromLayer(url, symbol, type) {
    try {
      const layer = new FeatureLayer({ url: url });
      const query = layer.createQuery();
      query.where = "1=1";
      query.outFields = ["*"];
      query.returnGeometry = true;
      query.outSpatialReference = { wkid: 4326 }; // Lat/Long

      console.log(`⏳ Fetching data from: ${type}...`);
      const results = await layer.queryFeatures(query);
      console.log(`✅ Loaded ${results.features.length} ${type}s.`);

      return results.features.map((f) => {
        f.symbol = symbol;
        f.popupTemplate = {
          title: "{name}",
          content:
            type === "hospital"
              ? "🏥 مستشفى | الأسرة المتاحة: {Bed}"
              : "🚑 محطة إسعاف",
        };
        return f;
      });
    } catch (error) {
      console.error(`❌ Error loading ${type}:`, error);
      return [];
    }
  }

  // --- 5. UPDATE HOSPITAL CHART FUNCTION ---
  function updateHospitalChart(features) {
    if (!bedsChartInstance) return;

    // 1. Extract Name and Bed Count
    const data = features.map((f) => ({
      name: f.attributes.name_ar || f.attributes.name || "مستشفى",
      beds: f.attributes.Bed || 0,
    }));

    // 2. Sort by Beds (High to Low) and take top 5
    data.sort((a, b) => b.beds - a.beds);
    const top5 = data.slice(0, 5);

    // 3. Update Chart
    bedsChartInstance.data.labels = top5.map((d) => d.name);
    bedsChartInstance.data.datasets[0].data = top5.map((d) => d.beds);
    bedsChartInstance.update();
  }

  // --- 6. EXECUTE DATA LOADING ---
  (async () => {
    // Load Hospitals
    allHospitalFeatures = await loadFeaturesFromLayer(
      hospitalLayerUrl,
      hospitalSymbol,
      "hospital"
    );

    // Load Ambulances
    allAmbulanceFeatures = await loadFeaturesFromLayer(
      ambulanceLayerUrl,
      ambulanceSymbol,
      "ambulance"
    );

    // ✅ Add all features to the RESOURCES layer (Background)
    resourcesLayer.addMany([...allHospitalFeatures, ...allAmbulanceFeatures]);

    // ✅ Update Chart after loading data
    updateHospitalChart(allHospitalFeatures);
  })();

  // --- 7. ROUTING LOGIC ---
  window.showAccidentOnMap = async function (index) {
 

    // Check data
    if (allHospitalFeatures.length === 0 || allAmbulanceFeatures.length === 0) {
      Swal.fire("انتظر قليلاً", "جارٍ تحميل البيانات...", "info");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🗺️ عرض على الخريطة";
      }
      return;
    }

    const accident = accidents[index];
    if (!accident || !accident.geom) {
      Swal.fire("خطأ", "بيانات الحادث غير صحيحة", "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🗺️ عرض على الخريطة";
      }
      return;
    }

    const coords = accident.geom.coordinates;

    // ✅ Clear ONLY the route layer (Keep resources visible)
    routesLayer.removeAll();

    const incidentPoint = new Point({
      longitude: coords[0],
      latitude: coords[1],
    });

    // --- Add Accident Marker ---
    const accidentMarker = new Graphic({
      geometry: incidentPoint,
      symbol: {
        type: "simple-marker",
        color: [255, 68, 68], // Red
        size: 22,
        outline: { color: [255, 255, 255], width: 3 },
      },
      attributes: {
        name: "Incident",
        numberOfAccidents: accident.numberOfAccidents,
      },
      popupTemplate: {
        title: "🚨 موقع الحادث",
        content: `عدد المصابين: ${accident.numberOfAccidents}`,
      },
    });
    routesLayer.add(accidentMarker);

    try {
      // Route 1: Ambulance -> Accident
      const cfParams1 = new ClosestFacilityParameters({
        incidents: new FeatureSet({ features: allAmbulanceFeatures }),
        facilities: new FeatureSet({ features: [accidentMarker] }),
        returnRoutes: true,
        returnDirections: true,
        defaultTargetFacilityCount: 1,
      });

      console.log("🔍 Calculating Route 1...");
      const result1 = await closestFacility.solve(
        closestFacilityUrl,
        cfParams1
      );

      if (!result1.routes || result1.routes.features.length === 0) {
        throw new Error("لم يتم العثور على سيارة إسعاف قريبة");
      }

      const routeFromAmbulance = result1.routes.features[0];
      const closestAmbulanceIndex = routeFromAmbulance.attributes.IncidentID;
      const closestAmbulanceGraphic =
        allAmbulanceFeatures[closestAmbulanceIndex];
      const closestAmbulanceProperties = closestAmbulanceGraphic.attributes;

      // Style Route 1
      routeFromAmbulance.symbol = {
        type: "simple-line",
        color: [255, 152, 0],
        width: 5,
      };
      routesLayer.add(routeFromAmbulance);

      // Highlight Ambulance
      const selectedAmbulance = new Graphic({
        geometry: closestAmbulanceGraphic.geometry,
        symbol: {
          type: "simple-marker",
          color: [76, 175, 80],
          size: 20,
          outline: { color: [255, 255, 255], width: 3 },
        },
        popupTemplate: closestAmbulanceGraphic.popupTemplate,
      });
      routesLayer.add(selectedAmbulance);

      // Route 2: Accident -> Hospital
      const requiredBeds = accident.numberOfAccidents || 1;
      const availableHospitalsGraphics = allHospitalFeatures.filter(
        (h) => (h.attributes.Bed || 0) >= requiredBeds
      );

      if (availableHospitalsGraphics.length === 0) {
        throw new Error(
          `لا توجد مستشفيات بها أسرة كافية (${requiredBeds}) للمصابين.`
        );
      }

      const cfParams2 = new ClosestFacilityParameters({
        incidents: new FeatureSet({ features: [accidentMarker] }),
        facilities: new FeatureSet({ features: availableHospitalsGraphics }),
        returnRoutes: true,
        returnDirections: true,
        defaultTargetFacilityCount: 1,
      });

      console.log("🔍 Calculating Route 2...");
      const result2 = await closestFacility.solve(
        closestFacilityUrl,
        cfParams2
      );

      if (!result2.routes || result2.routes.features.length === 0) {
        throw new Error("لم يتم العثور على مسار للمستشفى");
      }

      const routeToHospital = result2.routes.features[0];
      const closestHospitalIndex = routeToHospital.attributes.FacilityID;
      const closestHospitalGraphic =
        availableHospitalsGraphics[closestHospitalIndex];
      const closestHospitalProperties = closestHospitalGraphic.attributes;

      // Style Route 2
      routeToHospital.symbol = {
        type: "simple-line",
        color: [33, 150, 243],
        width: 5,
      };
      routesLayer.add(routeToHospital);

      // Highlight Hospital
      const selectedHospital = new Graphic({
        geometry: closestHospitalGraphic.geometry,
        symbol: {
          type: "simple-marker",
          color: [33, 150, 243],
          size: 20,
          outline: { color: [255, 255, 255], width: 3 },
        },
        popupTemplate: closestHospitalGraphic.popupTemplate,
      });
      routesLayer.add(selectedHospital);

      // Zoom to Scene
      window.currentView.goTo(
        {
          target: [
            selectedAmbulance,
            accidentMarker,
            selectedHospital,
            routeFromAmbulance,
            routeToHospital,
          ],
          zoom: 13,
        },
        { duration: 1500 }
      );

      // Display Info
      const distance1 = (
        routeFromAmbulance.attributes.Total_Kilometers || 0
      ).toFixed(2);
      const time1 = ((parseFloat(distance1) / 60) * 60).toFixed(1);
      const distance2 = (
        routeToHospital.attributes.Total_Kilometers || 0
      ).toFixed(2);
      const time2 = ((parseFloat(distance2) / 60) * 60).toFixed(1);
      const totalDistance = (
        parseFloat(distance1) + parseFloat(distance2)
      ).toFixed(2);
      const totalTime = (parseFloat(time1) + parseFloat(time2)).toFixed(1);

      Swal.fire({
        title: "✅ تم تعيين مسار الطوارئ",
        html: `
    <div style="text-align: right; direction: rtl; padding: 15px;">
      <div style="background: #fff3e0; padding: 10px; border-radius: 8px; margin-bottom: 10px;">
        <h4 style="color: #e65100; margin:0;">🚑 1. تحرك الإسعاف</h4>
        <div style="font-size: 0.9em; margin-top: 5px;">
           من: <strong>${
             closestAmbulanceProperties.name_ar || "نقطة تمركز"
           }</strong><br>
           المسافة: <strong>${distance1} كم</strong> | الوقت: <strong>${time1} دقيقة</strong>
        </div>
      </div>
      <div style="background: #e3f2fd; padding: 10px; border-radius: 8px;">
        <h4 style="color: #1565c0; margin:0;">🏥 2. النقل للمستشفى</h4>
        <div style="font-size: 0.9em; margin-top: 5px;">
           إلى: <strong>${
             closestHospitalProperties.name_ar || "مستشفى"
           }</strong><br>
           الأسرة المتاحة: <strong>${closestHospitalProperties.Bed}</strong><br>
           المسافة: <strong>${distance2} كم</strong> | الوقت: <strong>${time2} دقيقة</strong>
        </div>
      </div>
      <hr style="margin: 15px 0;">
      <p style="font-size: 16px;"><strong>📍 إجمالي المسافة:</strong> ${totalDistance} كم</p>
      <p style="font-size: 16px;"><strong>⏱️ إجمالي الوقت التقديري:</strong> ${totalTime} دقيقة</p>
    </div>
  `,
        icon: "success",
        confirmButtonText: "حسناً",
        position: "top-start", // ← this moves it to the left (start) at the top
      });
    } catch (error) {
      console.error("❌ Routing Error:", error);
      Swal.fire({
        title: "خطأ في التحليل",
        text: error.message || "حدث خطأ أثناء حساب المسار.",
        icon: "error",
      });
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🗺️ عرض على الخريطة";
      }
    }
  };
});
