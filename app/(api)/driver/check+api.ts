import { neon } from "@neondatabase/serverless";

export async function POST(request: Request) {
  try {
    // استخراج user_id من الطلب
    const body = await request.json();
    const { user_id } = body;

    // التحقق من وجود user_id
    if (!user_id) {
      return Response.json({ error: "Missing user_id" }, { status: 400 });
    }

    // الاتصال بقاعدة البيانات
    const sql = neon(`${process.env.DATABASE_URL}`);
    console.log("Checking driver status for user_id:", user_id);

    // استعلام SQL للتحقق من وجود السائق
    const response = await sql`
      SELECT id FROM driver 
      WHERE user_id = ${user_id}
      LIMIT 1;
    `;

    console.log("Database response:", response);

    // إذا وُجد السائق، أعد استجابة تحتوي على isDriver و driverId
    if (response.length > 0) {
      return Response.json(
        {
          isDriver: true,
          driverId: response[0].id, // افتراض أن id هو معرف السائق
        },
        { status: 200 }
      );
    }

    // إذا لم يُوجد السائق
    return Response.json(
      {
        isDriver: false,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error checking driver in database:", error.stack || error);
    return Response.json(
      { error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}