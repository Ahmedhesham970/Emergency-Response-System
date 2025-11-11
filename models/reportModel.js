const { Sequelize, Op, Model, DataTypes, STRING } = require("sequelize");
const { sequelize } = require("../dataBase/dataBaseConnection.js");

const Reports = sequelize.define(
  "Reports",
  {
    // الكائن الأول: تعريف الأعمدة (Attributes)
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    // تم إضافة عمود geom المفقود
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
      validate: {
        isUrl: true,
      },
      comment: "رابط الصورة المرفوعة (اختياري).",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
  },
  {
    // الكائن الثاني: الخيارات (Options)
    tableName: "report",
    timestamps: true,
    // تم نقل indexes إلى هنا (المكان الصحيح)
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
