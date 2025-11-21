const { Sequelize, Op, Model, DataTypes } = require("sequelize");
const { sequelize } = require("../dataBase/dataBaseConnection.js");
const User = require("./userModel");

const Reports = sequelize.define(
  "Reports",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // GEOM (PostGIS)
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
    status: {
      type: DataTypes.ENUM("Normal", "Moderate", "Critical"),
      allowNull: true,
      comment: "حالة البلاغ من حيث الخطورة.",
      // defaultValue : "Normal",
    },
    // ✔ تم إصلاح المشكلة هنا
    pictureURL: {
      type: DataTypes.STRING,
      allowNull: true, // مهم جدًا
      validate: {
        isUrl: true, // بيتأكد فقط لو في URL مبعوت
      },
      comment: "رابط الصورة المرفوعة (اختياري).",
    },
    reportTime: {
      type: DataTypes.DATE, // يخزن التاريخ والوقت معًا
      allowNull: false,
      defaultValue: DataTypes.NOW, // القيمة الافتراضية هي الوقت الحالي
      comment: "تاريخ ووقت إنشاء البلاغ",
    },

    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: User,
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
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
    ],
  }
);

module.exports = Reports;
