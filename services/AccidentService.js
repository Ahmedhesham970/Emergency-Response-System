const Report = require("../models/reportModel");

/**
 * Create a new accident report
 * @route POST /api/reports
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createReport = async (req, res) => {
  try {
    const { geom, numberOfAccidents, description, pictureURL, severity } =
      req.body;

    if (!geom || !geom.coordinates || !numberOfAccidents) {
      return res.status(400).json({
        success: false,
        message: "geom and numberOfAccidents required",
      });
    }
    const currentDate = new Date();

    const report = await Report.create({
      geom: {
        ...geom,
        crs: { type: "name", properties: { name: "EPSG:4326" } },
      },
      numberOfAccidents,
      description: description || "",
      pictureURL: pictureURL || null,
      status: severity ,
      userId :  req.user.id,
      reportTime: currentDate, // ← التاريخ مباشرة
    });

    return res.status(201).json({
      success: true,
      message: "Report created successfully",
      report, // ← هذا مهم للـ frontend
    });
  } catch (error) {
    console.error("Error creating report:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating report",
      error: error.message,
    });
  }
};

/**
 * Get all accident reports
 * @route GET /api/reports
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllReports = async (req, res) => {
  try {
    console.log("📋 Fetching all reports...");

    const reports = await Report.findAll();

    console.log(`✅ Retrieved ${reports.length} reports`);

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports: reports,
    });
  } catch (error) {
    console.error("❌ Error fetching reports:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error fetching reports",
      error: error.message,
    });
  }
};

/**
 * Get report by ID
 * @route GET /api/reports/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getReportById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🔍 Fetching report with ID:", id);

    const report = await Report.findByPk(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    console.log("✅ Report found - ID:", id);

    return res.status(200).json({
      success: true,
      report: report,
    });
  } catch (error) {
    console.error("❌ Error fetching report:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error fetching report",
      error: error.message,
    });
  }
};

/**
 * Update report by ID
 * @route PUT /api/reports/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateReport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("✏️ Updating report with ID:", id);

    const report = await Report.findByPk(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    await report.update(req.body);

    console.log("✅ Report updated successfully - ID:", id);

    return res.status(200).json({
      success: true,
      message: "Report updated successfully",
      report: report,
    });
  } catch (error) {
    console.error("❌ Error updating report:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error updating report",
      error: error.message,
    });
  }
};

/**
 * Delete report by ID
 * @route DELETE /api/reports/:id
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;
    console.log("🗑️ Deleting report with ID:", id);

    const report = await Report.findByPk(id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    await report.destroy();

    console.log("✅ Report deleted successfully - ID:", id);

    return res.status(200).json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting report:", error.message);
    return res.status(500).json({
      success: false,
      message: "Error deleting report",
      error: error.message,
    });
  }
};

module.exports = {
  createReport,
  getAllReports,
  getReportById,
  updateReport,
  deleteReport,
};
