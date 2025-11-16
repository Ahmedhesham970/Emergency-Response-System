(function () {
  "use strict";

  console.log("🚀 Registration script started");

  const preventDefaultSubmit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    console.log("⛔ Form default submit prevented");
    return false;
  };

  const waitForForm = () => {
    const form = document.getElementById("registerForm");

    if (!form) {
      console.log("⏳ Waiting for form...");
      setTimeout(waitForForm, 50);
      return;
    }

    console.log("✅ Form found, initializing...");
    initializeForm(form);
  };

  const initializeForm = (form) => {
    const errorMessage = document.getElementById("errorMessage");
    const successMessage = document.getElementById("successMessage");
    const submitBtn = document.querySelector(".register-btn");

    if (!errorMessage || !successMessage || !submitBtn) {
      console.error("❌ Required elements not found!");
      return;
    }

    form.onsubmit = preventDefaultSubmit;
    form.addEventListener("submit", preventDefaultSubmit, true);

    const originalBtnText = submitBtn.textContent;
    let isSubmitting = false;

    const handleSubmit = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (isSubmitting) {
        console.log("⏳ Already submitting...");
        return false;
      }

      console.log("🎬 Starting registration process...");
      isSubmitting = true;
      submitBtn.disabled = true;
      submitBtn.textContent = "⏳ جاري التسجيل...";

      errorMessage.textContent = "";
      errorMessage.style.display = "none";
      successMessage.textContent = "";
      successMessage.style.display = "none";

      try {
        const fullName = document.getElementById("full-name")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const phone = document.getElementById("phone")?.value.trim();
        const password = document.getElementById("password")?.value;
        const confirmPassword =
          document.getElementById("confirm-password")?.value;
        const idFile = document.getElementById("national_id_image")?.files[0];

        console.log("📋 Form data collected:", {
          fullName,
          email,
          phone,
          hasFile: !!idFile,
        });

        if (!fullName || !email || !phone || !password || !confirmPassword) {
          throw new Error("❌ جميع الحقول مطلوبة.");
        }

        if (password !== confirmPassword) {
          throw new Error("❌ كلمة المرور وتأكيدها غير متطابقين.");
        }

        if (!idFile) {
          throw new Error("❌ يرجى رفع صورة بطاقة الرقم القومي.");
        }

        if (!["image/jpeg", "image/jpg", "image/png"].includes(idFile.type)) {
          throw new Error("❌ يرجى رفع صورة JPG أو PNG فقط.");
        }

        if (idFile.size > 10 * 1024 * 1024) {
          throw new Error("❌ حجم الصورة كبير جداً. الحد الأقصى 10MB.");
        }

        console.log("📤 Sending registration request...");

        const formData = new FormData();
        formData.append("fullName", fullName);
        formData.append("email", email);
        formData.append("phone", phone);
        formData.append("password", password);
        formData.append("national_id_image", idFile);

        const res = await fetch("http://localhost:2511/api/auth/register", {
          method: "POST",
          body: formData,
        });

        console.log("📥 Response received - Status:", res.status);

        let data;
        try {
          data = await res.json();
          console.log("📥 Response data:", data);
        } catch (parseErr) {
          console.error("❌ Failed to parse response:", parseErr);
          throw new Error("فشل في قراءة استجابة الخادم");
        }

        if (res.ok) {
          console.log("✅ Registration successful!");

          successMessage.textContent = data.message || "تم التسجيل بنجاح! 🎉";
          successMessage.style.display = "block";

          if (typeof Swal !== "undefined") {
            await Swal.fire({
              title: "تم التسجيل بنجاح! 🎉",
              text: data.message || "تم إنشاء حسابك بنجاح , الان اتجه للصفحة الرئيسية",
              icon: "success",
              confirmButtonText: "حسناً",
              confirmButtonColor: "#4CAF50",
              timer: 3000,
              timerProgressBar: true,
            });

            // Redirect after SweetAlert closes
           
          } else {
            alert("✅ " + (data.message || "تم التسجيل بنجاح!"));
            setTimeout(() => {
              window.location.href = "/public/user.html";
            }, 2000);
          }

          form.reset();
        } else {
          console.error("❌ Registration failed:", data);
          throw new Error(data.message || "حدث خطأ غير متوقع.");
        }
      } catch (err) {
        console.error("❌ Error during registration:", err);

        const errorMsg = err.message || "حدث خطأ غير متوقع";
        errorMessage.textContent = errorMsg;
        errorMessage.style.display = "block";

        if (typeof Swal !== "undefined") {
          await Swal.fire({
            title: "خطأ!",
            text: errorMsg,
            icon: "error",
            confirmButtonText: "حسناً",
            confirmButtonColor: "#f44336",
          });
        } else {
          alert("❌ " + errorMsg);
        }
      } finally {
        console.log("🏁 Registration process completed");
        submitBtn.textContent = originalBtnText;
        submitBtn.disabled = false;
        isSubmitting = false;
      }

      return false;
    };

    form.addEventListener("submit", handleSubmit, false);

    const buttons = form.querySelectorAll('button[type="submit"]');
    buttons.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        handleSubmit(e);
      });
    });

    console.log("✅ Form initialized successfully");

    const confirmPasswordInput = document.getElementById("confirm-password");
    if (confirmPasswordInput) {
      confirmPasswordInput.addEventListener("input", function () {
        const passwordInput = document.getElementById("password");
        if (passwordInput && passwordInput.value !== this.value) {
          this.setCustomValidity("كلمة المرور غير متطابقة");
        } else {
          this.setCustomValidity("");
        }
      });
    }

    const fileInput = document.getElementById("national_id_image");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          const sizeKB = (file.size / 1024).toFixed(2);
          console.log("📎 File selected:", file.name, "Size:", sizeKB + "KB");
        }
      });
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", waitForForm);
  } else {
    waitForForm();
  }
})();
 