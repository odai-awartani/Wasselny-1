// في ملف مثل pages/api/ride/create.js
// شغال طبعي بس لازم يكون فهاض الملف بس
// برفع على الداتا بيس الجديدة
import { neon } from "@neondatabase/serverless";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      origin_address,
      destination_address,
      origin_latitude,
      origin_longitude,
      destination_latitude,
      destination_longitude,
      destination_street,
      ride_datetime,
      ride_days,
      required_gender,
      available_seats,
      no_smoking = false,
      no_children = false,
      no_music = false,
      driver_id,
      user_id,
      is_recurring,
      created_at = new Date().toISOString(),
    } = body;

    if (
      !origin_address ||
      !destination_address ||
      !origin_latitude ||
      !origin_longitude ||
      !destination_latitude ||
      !destination_longitude ||
      !ride_datetime ||
      !ride_days ||
      !required_gender ||
      !available_seats ||
      !driver_id ||
      !user_id
    ) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const sql = neon(`${process.env.DATABASE_URL}`);
    console.log("Executing SQL query with data:", body);

    const response = await sql`
      INSERT INTO ride (
        origin_address, 
        destination_address, 
        origin_latitude, 
        origin_longitude, 
        destination_latitude, 
        destination_longitude, 
        destination_street,
        ride_datetime,
        ride_days,
        required_gender,
        available_seats,
        no_smoking,
        no_children,
        no_music,
        driver_id,
        user_id,
        is_recurring,
        created_at
      ) VALUES (
        ${origin_address},
        ${destination_address},
        ${origin_latitude},
        ${origin_longitude},
        ${destination_latitude},
        ${destination_longitude},
        ${destination_street},
        ${ride_datetime},
        ${ride_days},
        ${required_gender},
        ${available_seats},
        ${no_smoking},
        ${no_children},
        ${no_music},
        ${driver_id},
        ${user_id},
        ${is_recurring},
        ${created_at}
      )
      RETURNING *;
    `;

    console.log("Database response:", response);
    return Response.json({ data: response[0] }, { status: 201 });
  } catch (error: any) {
    console.error("Error inserting data into ride table:", error.stack || error);
    return Response.json({ error: "Internal Server Error", details: error.message }, { status: 500 });
  }
}