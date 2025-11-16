const fs = require("fs");
const bcrypt = require("bcrypt");
const runPythonCheck = require("../services/python.service.js");
const User = require("../models/userModel.js");

// 🎯 قراءة الحد الأدنى من .env أو استخدام 0.6 كقيمة افتراضية
const SIMILARITY_THRESHOLD =
  parseFloat(process.env.AI_SIMILARITY_THRESHOLD) || 0.6;

const safeDeleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`✓ File deleted: ${filePath}`);
    } catch (err) {
      console.error(`✗ Failed to delete file: ${filePath}`, err);
    }
  }
};

exports.register = async (req, res) => {
  const file = req.file;
  let filePath = file?.path;

  try {
    const { fullName, email, phone, password } = req.body;

    // 1) التحقق من المدخلات الأساسية
    if (!fullName || !email || !phone || !password || !file) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        message: "جميع الحقول مطلوبة",
        missingFields: {
          fullName: !fullName,
          email: !email,
          phone: !phone,
          password: !password,
          national_id_image: !file,
        },
      });
    }

    // 2) التحقق من طول كلمة المرور
    if (password.length < 8) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل",
      });
    }

    // 3) التحقق من صيغة البريد الإلكتروني
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        message: "صيغة البريد الإلكتروني غير صحيحة",
      });
    }

    // 4) التحقق من رقم الهاتف (11 رقم)
    const phoneRegex = /^[0-9]{11}$/;
    if (!phoneRegex.test(phone)) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        message: "رقم الهاتف يجب أن يكون 11 رقم",
      });
    }

    // 5) التحقق من وجود البريد مسبقاً
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        message: "هذا البريد الإلكتروني مستخدم بالفعل",
      });
    }

    // 6) التحقق من وجود رقم الهاتف مسبقاً
    const existingPhone = await User.findOne({ where: { phone } });
    if (existingPhone) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        message: "رقم الهاتف مستخدم بالفعل",
      });
    }

    // 7) التحقق من نوع الملف
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      safeDeleteFile(filePath);
      return res.status(400).json({
        message: "يرجى رفع صورة بصيغة JPG أو PNG فقط",
      });
    }

    // 8) التحقق من وجود الملف
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        message: "فشل في رفع الصورة. حاول مرة أخرى",
      });
    }

    console.log(`📸 Processing ID image: ${filePath}`);

    // 9) تشغيل نموذج الذكاء الاصطناعي مع threshold مخصص
    let pythonResult;
    try {
      pythonResult = await runPythonCheck(filePath, SIMILARITY_THRESHOLD);
      console.log("🤖 AI Result:", pythonResult);
    } catch (pyErr) {
      console.error("❌ Python/AI Error:", pyErr.message || pyErr);
      safeDeleteFile(filePath);
      return res.status(500).json({
        message: "فشل التحقق من البطاقة. تأكد من وضوح الصورة وحاول مرة أخرى",
        technicalError:
          process.env.NODE_ENV === "development" ? pyErr.message : undefined,
      });
    }

    // 10) حذف الملف بعد المعالجة
    safeDeleteFile(filePath);

    // 11) التحقق من نتيجة الذكاء الاصطناعي
    if (!pythonResult) {
      return res.status(500).json({
        message: "لم نتمكن من الحصول على نتيجة التحقق",
      });
    }

    if (pythonResult.error) {
      return res.status(400).json({
        message: pythonResult.error,
      });
    }

    if (!pythonResult.valid) {
      const similarityPercent = (pythonResult.similarity * 100).toFixed(2);
      const thresholdPercent = (SIMILARITY_THRESHOLD * 100).toFixed(0);

      return res.status(400).json({
        message: `البطاقة غير صالحة أو غير واضحة. نسبة التطابق: ${similarityPercent}%`,
        similarity: similarityPercent + "%",
        required: thresholdPercent + "%",
        details: `نسبة التطابق أقل من الحد المطلوب (${thresholdPercent}%). يرجى رفع صورة أوضح للبطاقة.`,
      });
    }

    // 12) تشفير كلمة المرور
    const hashedPassword = await bcrypt.hash(password, 10);

    // 13) حفظ المستخدم في قاعدة البيانات
    const newUser = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,
      idSimilarity: pythonResult.similarity || 0,
    });

    console.log("✅ User created successfully:", newUser.id);

    // ✅ إرجاع Response ناجح
    return res.status(201).json({
      success: true,
      message: "تم إنشاء الحساب بنجاح! 🎉",
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
      },
    });
  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);

    // حذف الملف في حالة حدوث أي خطأ
    safeDeleteFile(filePath);

    // التعامل مع أخطاء قاعدة البيانات
    if (err.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل",
      });
    }

    if (err.name === "SequelizeValidationError") {
      return res.status(400).json({
        message: err.errors[0]?.message || "خطأ في التحقق من البيانات",
        errors: err.errors.map((e) => e.message),
      });
    }

    return res.status(500).json({
      message: "حدث خطأ في الخادم. يرجى المحاولة لاحقاً",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
