const express = require("express");
const router = express.Router();
const { createAdminAccount,login } = require("../services/adminService.js");




router.route("/new").post(createAdminAccount)
router.route("/login").post(login)





module.exports = router;

