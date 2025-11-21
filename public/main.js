let currentLocation = null;
let view = null;
let graphicsLayer = null;



function initMap() {
  require([
    "esri/Map",
    "esri/WebMap",
    "esri/views/MapView",
    "esri/Graphic",
    "esri/layers/GraphicsLayer",
    "esri/geometry/Point",
  ], function (Map,WebMap, MapView, Graphic, GraphicsLayer, Point) {
    graphicsLayer = new GraphicsLayer();
    const map = new Map({
      basemap: "streets-vector",
    });

    // const map = new WebMap({
    //   portalItem: { id: "55a428aade3544c3bbfc1598ec991a7e" },
    // });

    view = new MapView({
      container: "map",
      map: map,
      center: [31.22, 30.05],
      zoom: 10,
    });

    map.add(graphicsLayer);

    view
      .when(() => console.log("✅ Map loaded successfully"))
      .catch((err) => console.error("❌ Error loading map:", err));

    view.on("click", (event) => {
      const coords = [event.mapPoint.longitude, event.mapPoint.latitude];
      currentLocation = coords;
      addMarker(coords, [76, 175, 80]);
      Swal.fire(
        "✅ تم اختيار الموقع",
        `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`,
        "success"
      );
    });

    const getLocationBtn = document.getElementById("getLocationBtn");
    if (getLocationBtn) {
      getLocationBtn.addEventListener("click", () => {
        if (!navigator.geolocation)
          return Swal.fire(
            "خطأ",
            "متصفحك لا يدعم تحديد الموقع الجغرافي",
            "error"
          );

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const coords = [pos.coords.longitude, pos.coords.latitude];
            currentLocation = coords;
            addMarker(coords, [220, 53, 69]);
            Swal.fire({
              title: "✅ تم تحديد موقعك",
              text: `${pos.coords.longitude.toFixed(4)} , ${
                pos.coords.latitude.toFixed(4)
              }`,
              position: "top-left",
              icon: "success",
            });
          },
          (err) => {
            Swal.fire("خطأ", `تعذر تحديد الموقع: ${err.message}`, "error");
          }
        );
      });
    }

    const form = document.getElementById("reportForm");
    if (form) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!currentLocation)
          return Swal.fire("⚠️", "الرجاء اختيار موقع أولاً", "warning");

        const injuries = parseInt(document.getElementById("injuries").value);
        const desc = document.getElementById("desc").value;
        const severity = document.getElementById("severity").value;

        if (!injuries) return Swal.fire("⚠️", "أدخل عدد المصابين", "warning");

        const reportData = {
          geom: { type: "Point", coordinates: currentLocation },
          numberOfAccidents: injuries,
          description: desc,
          severity: severity,
          // userId: 1,
        };

        const token = localStorage.getItem("token");

        try {
          const response = await fetch("http://localhost:2511/api/reports", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify(reportData),
          });

          const data = await response.json();

          if (response.ok) {
            if (typeof socket !== "undefined") {
              socket.emit("newAccident", data.report);
            }
            Swal.fire("✅ تم إرسال البلاغ", "شكراً لك!", "success");
          } else {
            Swal.fire("❌ خطأ", data.message || "فشل حفظ البلاغ", "error");
          }
        } catch (error) {
          console.error(error);
          Swal.fire("❌ خطأ", "تعذر الاتصال بالخادم!", "error");
        }
      });
    }

    function addMarker(coords, color) {
      const point = new Point({ longitude: coords[0], latitude: coords[1] });
      const marker = new Graphic({
        geometry: point,
        symbol: {
          type: "simple-marker",
          color,
          size: 16,
          outline: { color: "red", width: 1 },
        },
      });
      graphicsLayer.removeAll();
      graphicsLayer.add(marker);
      view.goTo({ center: coords, zoom: 15 });
    }
  });
}
