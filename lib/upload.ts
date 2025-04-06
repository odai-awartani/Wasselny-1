// lib/upload.ts
export const uploadImageToCloudinary = async (imageUri: string) => {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: imageUri,
        type: "image/jpeg", // تأكد من نوع الملف حسب الصورة. إذا كان لديك صور PNG أو GIF يمكنك تعديلها
        name: "car.jpg", // اختر اسم الصورة المرفوعة
      } as any);
      
      // استخدام الـ preset الذي أنشأته
      formData.append("upload_preset", "car-image"); // اسم الـ preset اللي أنشأته
      
      const res = await fetch("https://api.cloudinary.com/v1_1/daq2ulgqd/image/upload", {
        method: "POST",
        body: formData,
      });
  
      const data = await res.json();
  
      if (!res.ok) throw new Error(data.error?.message || "فشل الرفع");
  
      // إرجاع الرابط الآمن للصورة بعد رفعها
      return data.secure_url;
    } catch (err) {
      console.error("❌ Upload error:", err);
      throw err; // إعادة الخطأ ليتم التعامل معه في أماكن أخرى من التطبيق
    }
  };
  