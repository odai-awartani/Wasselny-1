import { neon } from '@neondatabase/serverless';

export async function POST(request: Request) {
    try {
      const sql = neon(`${process.env.DATABASE_URL}`);

    // تحويل body الطلب إلى JSON
    const { name, email, clerkId, phoneNumber, gender, workindustry } = await request.json();

    // التحقق من وجود البيانات المطلوبة
    if (!name || !email || !clerkId || !phoneNumber || !gender || !workindustry ) {
        return Response.json(
            { error: 'Missing required fields: name, email, clerkId' },
            { status: 400 }
          );
        }
    
        // إدراج البيانات في قاعدة البيانات
        const response = await sql`
        INSERT INTO users (
          name, 
          email, 
          clerk_id,
          phonenumber,
          gender,
          workindustry
        ) 
        VALUES (
          ${name}, 
          ${email},
          ${clerkId},
          ${phoneNumber},
          ${gender},
          ${workindustry}
       );`;
    
        // إرجاع النتيجة
        return new Response(JSON.stringify({ data: response }), {
            status: 201,
          });
        } catch (error) {
          console.error("Error creating user:", error);
          return Response.json({ error: "Internal Server Error" }, { status: 500 });
        }
      }