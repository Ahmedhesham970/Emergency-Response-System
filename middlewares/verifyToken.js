const jwt = require("jsonwebtoken");

const authToken = async (req, res, next) => {
  try {
    // 1. Extract the token from the Authorization header
    const header = req.headers["authorization"] || req.headers["Authorization"];
    const token = header.split(" ")[1];
    // 2. Verify the token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      req.user = decoded;
    });
    next();
  } catch (error) {
    console.log(error.message);
  }
};

module.exports = authToken;
