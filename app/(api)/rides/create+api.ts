
//  الفيل مثل app/api/rides/ تاع البحث مع الفيديو كان شغال بس لما نقلتو هون خرب بشتغل بس فملف الrides/create+api.ts
// هون مش شغال بس اذا رجعتو على الملف الاول بشتغل ىلانو بزبطش يكون في ملفين وهاض برفع على داتا بيس القديمة 
import {neon} from "@neondatabase/serverless";

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
            ride_time,
            fare_price,
            payment_status,
            driver_id,
            user_id,
        } = body;
        
        if (
            !origin_address ||
            !destination_address ||
            !origin_latitude ||
            !origin_longitude ||
            !destination_latitude ||
            !destination_longitude ||
            !ride_time ||
            !fare_price ||
            !payment_status ||
            !driver_id ||
            !user_id
        ) {
            return Response.json(
                {error: "Missing required fields"},
                {status: 400},
            );
        }

        const sql = neon(`${process.env.DATABASE_URL}`);

        const response = await sql`
        INSERT INTO rides ( 
          origin_address, 
          destination_address, 
          origin_latitude, 
          origin_longitude, 
          destination_latitude, 
          destination_longitude, 
          ride_time, 
          fare_price, 
          payment_status, 
          driver_id, 
          user_id
        ) VALUES (
          ${origin_address},
          ${destination_address},
          ${origin_latitude},
          ${origin_longitude},
          ${destination_latitude},
          ${destination_longitude},
          ${ride_time},
          ${fare_price},
          ${payment_status},
          ${driver_id},
          ${user_id}
        )
        RETURNING *;
        `;

        return Response.json({data: response[0]}, {status: 201});
    } catch (error) {
        console.error("Error inserting data into recent_rides:", error);
        return Response.json({error: "Internal Server Error"}, {status: 500});
    }
}