// ./sockets/index.js
const { Server } = require("socket.io");
const fraudDetectionService = require("../services/fraudDetectionService");
const Report = require("../models/reportModel");

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "*", // أو origin: "http://127.0.0.1:5500" لو بتستخدم Live Server
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("✅ Client connected:", socket.id);

    // استقبال بلاغ جديد من المستخدم
    socket.on("newAccident", (data) => {
      console.log("🚨 New accident received:", data);
      // إرسال البلاغ إلى جميع الـ dashboards
      io.emit("newAccident", data);
    });
      // ==================== NEW: Fraud Detection Logic ====================
    socket.on("newAccident", async (data) => {
      console.log("🚨 New accident received from:", socket.id);
      console.log("📦 Report data:", data);
      
      try {
        // STEP 1: Run fraud detection check
        console.log("🔍 Running fraud detection...");
        const fraudResult = await fraudDetectionService.checkFraudSafe(data);
        
        console.log("📊 Fraud check result:", {
          risk_level: fraudResult.prediction.risk_level,
          probability: `${(fraudResult.prediction.fraud_probability * 100).toFixed(1)}%`,
          should_block: fraudResult.prediction.recommendation.should_block
        });

        // STEP 2: Check if report should be blocked
        if (fraudDetectionService.shouldBlockReport(fraudResult)) {
          console.log("🚫 Report BLOCKED - flagged as fraudulent");
          
          // Send rejection to the user who submitted
          socket.emit("reportRejected", {
            success: false,
            message: fraudResult.prediction.recommendation.message,
            risk_level: fraudResult.prediction.risk_level,
            fraud_probability: fraudResult.prediction.fraud_probability,
            risk_factors: fraudResult.prediction.risk_factors
          });
          
          return; // Don't save or broadcast
        }

        // STEP 3: Save report to database with fraud score
        const savedReport = await Report.create({
          geom: data.geom,
          numberOfAccidents: data.numberOfAccidents,
          description: data.description || "",
          pictureURL: data.pictureURL || "",
          userId: data.userId || 1,
          timestamp: data.timestamp || new Date().toISOString(),
          // Add fraud detection metadata
          fraudScore: fraudDetectionService.getFraudScore(fraudResult),
          riskLevel: fraudResult.prediction.risk_level,
          requiresVerification: fraudResult.prediction.risk_level === 'HIGH'
        });

        console.log("✅ Report saved with ID:", savedReport.id);

        // STEP 4: Add fraud info to the data before broadcasting
        const reportWithFraudInfo = {
          ...savedReport.toJSON(),
          fraud_check: {
            risk_level: fraudResult.prediction.risk_level,
            fraud_probability: fraudResult.prediction.fraud_probability,
            requires_verification: fraudResult.prediction.risk_level === 'HIGH'
          }
        };

        // STEP 5: Broadcast to all connected dashboards
        io.emit("newAccident", reportWithFraudInfo);
        
        // STEP 6: Send confirmation to submitter
        socket.emit("reportAccepted", {
          success: true,
          message: fraudResult.prediction.recommendation.message,
          reportId: savedReport.id,
          risk_level: fraudResult.prediction.risk_level
        });

        console.log("📡 Report broadcasted to all dashboards");

      } catch (error) {
        console.error("❌ Error processing accident report:", error);
        
        // Even if fraud check fails, we still save the report (fail-open policy)
        try {
          const savedReport = await Report.create({
            geom: data.geom,
            numberOfAccidents: data.numberOfAccidents,
            description: data.description || "",
            pictureURL: data.pictureURL || "",
            userId: data.userId || 1,
            fraudScore: null,
            riskLevel: 'UNKNOWN'
          });

          io.emit("newAccident", savedReport.toJSON());
          
          socket.emit("reportAccepted", {
            success: true,
            message: "Report saved (fraud check unavailable)",
            reportId: savedReport.id,
            warning: "Fraud detection was unavailable"
          });
        } catch (dbError) {
          console.error("❌ Database error:", dbError);
          socket.emit("reportError", {
            success: false,
            message: "Failed to save report"
          });
        }
      }
    });

    // Get all accidents (for dashboard initial load)
    socket.on("getAllAccidents", async () => {
      try {
        const reports = await Report.findAll({
          order: [['createdAt', 'DESC']],
          limit: 100
        });
        
        socket.emit("allAccidents", reports);
      } catch (error) {
        console.error("❌ Error fetching accidents:", error);
        socket.emit("allAccidents", []);
      }
    });

    socket.on("disconnect", () => {
      console.log("❌ Client disconnected:", socket.id);
    });
  });

  console.log("🚀 Socket.IO initialized");
}

module.exports = initSocket;
