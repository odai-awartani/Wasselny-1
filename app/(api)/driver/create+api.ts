import { neon } from "@neondatabase/serverless";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      user_id,
      car_type,
      car_image_url,
      profile_image_url,
      car_seats,
      created_at = new Date().toISOString(),
    } = body;

    // التحقق من وجود البيانات الأساسية
    if (!user_id || !car_type || !car_image_url || !profile_image_url || !car_seats) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sql = neon(`${process.env.DATABASE_URL}`);
    console.log("Executing SQL query with data:", body);

    // استعلام SQL لإدخال بيانات السائق
    const response = await sql`
      INSERT INTO driver (
        user_id,
        car_type,
        car_image_url,
        profile_image_url,
        car_seats,
        created_at
      ) VALUES (
        ${user_id},
        ${car_type},
        ${car_image_url},
        ${profile_image_url},
        ${car_seats},
        ${created_at}
      )
      RETURNING *;
    `;

    console.log("Database response:", response);
    
    // إرسال استجابة تحتوي على بيانات السائق الجديدة
    return Response.json({ data: response[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error inserting data into driver table:", error.stack || error);
    return Response.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}
