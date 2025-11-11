const User = require("./userModel");
const Report = require("./reportModel");

User.hasMany(Report, { foreignKey: "userId" });
User.hasOne(Report, { foreignKey: "userId" });


module.exports ={User, Report}