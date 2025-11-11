const { Sequelize, Op, Model, DataTypes, STRING } = require("sequelize");
require ("dotenv").config()
const sequelize = new Sequelize(
  process.env.DB_NAME,
  "postgres",
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    port: process.env.DB_PORT,
    logging: false,
  }
);

const authDbConnection = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({alter:true})
    console.log("Connection has been established successfully 🔑💯");
  } catch (error) {
    console.error("Unable to connect to the database ❌❌:", error.message);
  }
};

module.exports = { authDbConnection, sequelize };
