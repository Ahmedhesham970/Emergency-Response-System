const { Sequelize, Op, Model, DataTypes, STRING } = require("sequelize");
const { sequelize } = require("../dataBase/dataBaseConnection.js");
const User = require('./userModel')

const Reports = sequelize.define(
  "Reports",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    geom: {
      type: DataTypes.GEOMETRY("POINT", 4326),
      allowNull: false,
      comment: "الموقع الجغرافي للحادث باستخدام PostGIS.",
    },
    numberOfAccidents: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
      },
      comment: "عدد الحوادث أو الإصابات المسجلة.",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "وصف تفصيلي للحادث (اختياري).",
    },
    pictureURL: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "",
      validate: {
        isUrl: true,
      },
      comment: "رابط الصورة المرفوعة (اختياري).",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    // ==================== NEW: Fraud Detection Fields ====================
    fraudScore: {
      type: DataTypes.FLOAT,
      allowNull: true,
      defaultValue: null,
      comment: "Fraud probability from ML model (0-1)",
      validate: {
        min: 0,
        max: 1
      }
    },
    riskLevel: {
      type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNKNOWN'),
      allowNull: true,
      defaultValue: 'UNKNOWN',
      comment: "Risk level: LOW, MEDIUM, HIGH, CRITICAL"
    },
    requiresVerification: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: false,
      comment: "Whether report needs manual verification"
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "When the report was manually verified"
    },
    verifiedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'admin', // Reference to admin table
        key: 'id'
      },
      comment: "Admin who verified the report"
    }
    // ====================================================================
  },
  {
    tableName: "report",
    timestamps: true,
    indexes: [
      {
        name: "spatial_geom_idx",
        using: "GIST",
        fields: ["geom"],
      },
      // NEW: Index for fraud queries
      {
        name: "fraud_score_idx",
        fields: ["fraudScore"],
      },
      {
        name: "risk_level_idx",
        fields: ["riskLevel"],
      }
    ],
  }
);

module.exports = Reports;