const Admin = require("../models/adminModel");
const express = require("express");
const { sequelize } = require("../dataBase/dataBaseConnection.js");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcrypt");
const signToken = require("../middlewares/signToken.js");

const {
  success,
  created,
  badRequest,
  notFound,
  internalServerError,
} = require("../utils/statusCodes.js");
/**
 * @desc    Register a new admin
 * @route   POST /api/admin/register
 * @access  Private
 */

const createAdminAccount = asyncHandler(async (req, res, next) => {
  try {
    const { adminId, name, phone, password, role } = req.body;
    const findExsists = await Admin.findOne({
      where: { adminId },
    });
    findExsists
      ? res
          .status(badRequest.code)
          .send({ status: badRequest.message, message: "already exists" })
      : null;

    const salt = await bcrypt.genSalt(8);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newAdmin = new Admin({
      adminId,
      name,
      phone,
      password: hashedPassword,
      role,
    });
    // const registeredAdmin = await signToken({
    //   id: newAdmin.id,
    //   email: newAdmin.email,
    //   role: newAdmin.role,
    //   otp: newAdmin.otp,
    // });

    await newAdmin.save();
    return res.status(success.code).send({
      status: success.message,
      message: "saved successfully !",
    });
  } catch (error) {
    console.error(error.message);
    res.json(error.message);
  }
});

const login = asyncHandler(async(req,res,next)=>{
  const { adminId, password } = req.body;
  // if(!adminId)
  const loggedAdmin = await Admin.findOne({
    where: { adminId },
  });
  if (!loggedAdmin) {
    return res.status(404).send({
      status: "Error",
      message: "Invalid adminId or password.",
    });
  }
  const checkPassword = await bcrypt.compare(
      password,
      loggedAdmin.dataValues.password
  );
  if (!loggedAdmin || !checkPassword) {
    throw res
      .status(badRequest.code)
      .json("error in login , check id or password");
  }
  const adminToken = await signToken({
    id: loggedAdmin.adminId,
    name: loggedAdmin.name,
    
  });
  return res.status(success.code).json({
    status: success.message,
    token: adminToken,
  });

})

module.exports = { createAdminAccount, login };
