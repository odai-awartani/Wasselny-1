import { neon } from "@neondatabase/serverless";

// استعلام للتحقق مما إذا كان المستخدم سائقًا أم لا
export async function checkDriverStatus(userId: string) {
  try {
    const sql = neon(`${process.env.DATABASE_URL}`);

    // جلب البيانات الخاصة بالسائق بناءً على الـ user_id
    const result = await sql`
      SELECT * FROM driver WHERE user_id = ${userId}
    `;

    console.log("Driver data fetched:", result);

    // إذا كانت النتيجة فارغة، فهذا يعني أن المستخدم ليس سائقًا.
    if (result.length === 0) {
      return { isDriver: false };
    }

    // العودة بمعلومات السائق إذا كان موجودًا.
    return {
      isDriver: true,
      driverId: result[0].id,
      carType: result[0].car_type,
      carSeats: result[0].car_seats,
      carImageUrl: result[0].car_image_url,
    };
  } catch (error) {
    console.error("Error checking driver status:", error);
    throw new Error("Internal Server Error");
  }
}
//driver+api.ts
// API endpoint لجلب جميع السائقين (مثال إضافي)
export async function GET(request: Request) {
  try {
    const sql = neon(`${process.env.DATABASE_URL}`);
    const response = await sql`SELECT * FROM driver`;
    console.log("Fetched driver data1:", response);

    return Response.json({ data: response });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

