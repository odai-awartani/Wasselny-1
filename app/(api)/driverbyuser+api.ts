// (api)/driverbyuser+api.ts
import { neon } from "@neondatabase/serverless";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    const sql = neon(`${process.env.DATABASE_URL}`);
    const response = await sql`SELECT * FROM driver WHERE user_id = ${userId}`;
    console.log("Fetched driver data by user_id:", response);

    if (response.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    return Response.json({ data: response[0] });
  } catch (error) {
    console.error("Error fetching driver by user_id:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user_id, profile_image_url } = await request.json();

    if (!user_id || !profile_image_url) {
      return Response.json(
        { error: "User ID and profile image URL are required" },
        { status: 400 }
      );
    }

    const sql = neon(`${process.env.DATABASE_URL}`);
    const response = await sql`
      UPDATE driver 
      SET profile_image_url = ${profile_image_url}
      WHERE user_id = ${user_id}
      RETURNING *;
    `;

    if (response.length === 0) {
      return Response.json({ error: "Driver not found" }, { status: 404 });
    }

    return Response.json({ data: response[0] });
  } catch (error) {
    console.error("Error updating driver profile image:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}