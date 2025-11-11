const express = require("express");
const app = express();
const admin = require('./routes/adminRoute.js')
const {authDbConnection,sequelize}= require('./dataBase/dataBaseConnection.js')
const PORT = 2511;
authDbConnection()
app.use(express.urlencoded({ extended: true }));
app.use(express.json())


app.use('/admin',admin)
app.get("/", (req, res, next) => {
  res.send("hello from server !");
});




app.listen(process.env.PORT || PORT, () => {
  console.log(`server is litening on port ${PORT}`);
});
