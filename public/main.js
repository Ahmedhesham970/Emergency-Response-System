let currentLocation = null;
let view = null;
let graphicsLayer = null;
let reportStartTime = null; // NEW: Track when user started filling the form
let locationMethod = 'map_click'; // NEW: Track how location was set

require([
  "esri/WebMap",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/geometry/Point",
], function (WebMap, MapView, Graphic, GraphicsLayer, Point) {
  graphicsLayer = new GraphicsLayer();

  const map = new WebMap({
    portalItem: { id: "55a428aade3544c3bbfc1598ec991a7e" },
  });
  map.when(() => {
    map.layers.forEach((layer) => {
      layer.visible = false;
      console.log("🔒 Hidden layer:", layer.title);
    });
  });

  view = new MapView({
    container: "map",
    map: map,
    center: [31.22, 30.05],
    zoom: 10,
  });

  map.add(graphicsLayer);

  view
    .when(() => {
      console.log("✅ Map loaded successfully");
      // NEW: Start tracking time when map loads
      reportStartTime = Date.now();
    })
    .catch((err) => console.error("❌ Error loading map:", err));

  // Click on map
  view.on("click", (event) => {
    const coords = [event.mapPoint.longitude, event.mapPoint.latitude];
    currentLocation = coords;
    locationMethod = 'map_click'; // NEW: Track method
    addMarker(coords, [76, 175, 80]);
    Swal.fire(
      "✅ تم اختيار الموقع",
      `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`,
      "success"
    );
  });

  // Locate button
  document.getElementById("getLocationBtn").addEventListener("click", () => {
    if (!navigator.geolocation)
      return Swal.fire("خطأ", "متصفحك لا يدعم تحديد الموقع الجغرافي", "error");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = [pos.coords.longitude, pos.coords.latitude];
        currentLocation = coords;
        locationMethod = 'gps'; // NEW: Track GPS usage
        addMarker(coords, [220, 53, 69]);
        Swal.fire(
          "✅ تم تحديد موقعك",
          `${pos.coords.longitude} , ${pos.coords.latitude}`,
          "success"
        );
      },
      (err) => {
        Swal.fire("خطأ", `تعذر تحديد الموقع: ${err.message}`, "error");
      }
    );
  });

  // ==================== UPDATED: Submit form with fraud detection ====================
  const form = document.getElementById("reportForm");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentLocation)
      return Swal.fire("⚠️", "الرجاء اختيار موقع أولاً", "warning");

    const injuries = parseInt(document.getElementById("injuries").value);
    const desc = document.getElementById("desc").value;

    if (!injuries) return Swal.fire("⚠️", "أدخل عدد المصابين", "warning");

    // NEW: Calculate response time (seconds from map load to submit)
    const responseTime = reportStartTime 
      ? ((Date.now() - reportStartTime) / 1000) 
      : 60; // Default 60s if not tracked

    const reportData = {
      geom: { type: "Point", coordinates: currentLocation },
      numberOfAccidents: injuries,
      description: desc,
      userId: 1,
      timestamp: new Date().toISOString(),
      // NEW: Add fraud detection metadata
      response_time_seconds: responseTime,
      location_source: locationMethod,
      has_photo: false // Set to true if you add photo upload feature
    };

    console.log("📤 Sending report with fraud metadata:", {
      injuries,
      responseTime: `${responseTime.toFixed(1)}s`,
      locationMethod,
      timestamp: reportData.timestamp
    });

    // NEW: Show loading while fraud check runs
    Swal.fire({
      title: 'جاري إرسال البلاغ...',
      html: 'يتم التحقق من صحة البلاغ',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    socket.emit("newAccident", reportData);
  });

  // ==================== NEW: Handle fraud detection responses ====================
  
  // Report accepted (fraud check passed)
  socket.on("reportAccepted", (response) => {
    console.log("✅ Report accepted:", response);
    
    let icon = 'success';
    let title = "✅ تم إرسال البلاغ";
    let message = response.message || "شكراً لك!";
    
    // Show warning if needs verification
    if (response.risk_level === 'MEDIUM' || response.risk_level === 'HIGH') {
      icon = 'warning';
      message += '\n\n⚠️ ملاحظة: سيتم مراجعة البلاغ من قبل المشرف للتأكد';
    }
    
    Swal.fire({
      title: title,
      text: message,
      icon: icon,
      confirmButtonText: 'حسناً'
    });
    
    // Reset form and timer
    form.reset();
    graphicsLayer.removeAll();
    currentLocation = null;
    locationMethod = 'map_click';
    reportStartTime = Date.now();
  });

  // Report rejected (fraud detected)
  socket.on("reportRejected", (response) => {
    console.log("🚫 Report rejected:", response);
    
    // Build risk factors list
    let riskFactorsHtml = '';
    if (response.risk_factors && response.risk_factors.length > 0) {
      riskFactorsHtml = '<div style="margin-top: 15px; text-align: right; background: #fff3cd; padding: 10px; border-radius: 8px;">';
      riskFactorsHtml += '<strong style="color: #856404;">⚠️ أسباب الرفض:</strong>';
      riskFactorsHtml += '<ul style="text-align: right; margin: 10px 0 0 0; padding-right: 20px;">';
      response.risk_factors.forEach(factor => {
        riskFactorsHtml += `<li style="margin: 5px 0; color: #856404;">${factor.factor}</li>`;
      });
      riskFactorsHtml += '</ul></div>';
    }
    
    Swal.fire({
      title: "🚫 تم رفض البلاغ",
      html: `
        <div style="text-align: right;">
          <p style="font-size: 16px; margin-bottom: 15px;">${response.message}</p>
          <div style="background: #f8d7da; padding: 10px; border-radius: 8px; margin-bottom: 15px;">
            <p style="color: #721c24; font-weight: bold; margin: 0;">
              احتمالية الاحتيال: ${(response.fraud_probability * 100).toFixed(1)}%
            </p>
          </div>
          ${riskFactorsHtml}
        </div>
      `,
      icon: 'error',
      confirmButtonText: 'حسناً',
      confirmButtonColor: '#dc3545'
    });
    
    // Don't reset form - let user fix and resubmit
  });

  // Report error (system error, not fraud)
  socket.on("reportError", (response) => {
    console.error("❌ Report error:", response);
    
    Swal.fire({
      title: "خطأ في النظام",
      text: response.message || "حدث خطأ أثناء إرسال البلاغ. الرجاء المحاولة مرة أخرى",
      icon: 'error',
      confirmButtonText: 'حسناً'
    });
  });
  // ====================================================================

  function addMarker(coords, color) {
    const point = new Point({ longitude: coords[0], latitude: coords[1] });
    const marker = new Graphic({
      geometry: point,
      symbol: {
        type: "simple-marker",
        color,
        size: 16,
        outline: { color: "white", width: 2 },
      },
    });
    graphicsLayer.removeAll();
    graphicsLayer.add(marker);
    view.goTo({ center: coords, zoom: 15 });
  }
});