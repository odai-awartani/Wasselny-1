import { neon } from "@neondatabase/serverless";

export async function checkDriverStatus(userId: string) {
    const sql = neon(`${process.env.DATABASE_URL}`);
    const result = await sql`SELECT * FROM driver WHERE user_id = ${userId}`;
  
    if (result.length === 0) return { isDriver: false };
  
    return {
      isDriver: true,
      driverId: result[0].id,
      carType: result[0].car_type,
      carSeats: result[0].car_seats,
      carImageUrl: result[0].car_image_url,
      profileImageUrl: result[0].profile_image_url,
      rating: result[0].rating,
    };
  }
  