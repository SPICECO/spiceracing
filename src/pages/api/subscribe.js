import { supabase } from "@/lib/supabase";

export const prerender = false;

export const POST = async ({ request }) => {
  try {
    const text = await request.text();
    console.log("SUBSCRIBE DEBUG - Raw request body text:", JSON.stringify(text));
    
    let email = null;

    // 1. Try parsing as JSON
    try {
      const body = JSON.parse(text);
      email = body?.email;
      console.log("SUBSCRIBE DEBUG - Parsed JSON email:", email);
    } catch {
      // Not JSON
    }

    // 2. Try parsing as URL Search Params (x-www-form-urlencoded)
    if (!email) {
      const params = new URLSearchParams(text);
      email = params.get('email');
      console.log("SUBSCRIBE DEBUG - Parsed URLSearchParams email:", email);
    }

    // 3. Try parsing as multipart form data using Regex
    if (!email) {
      const match = text.match(/name="email"[\s\S]*?\r?\n\r?\n([^\r\n]+)/);
      if (match) {
        email = match[1].trim();
        console.log("SUBSCRIBE DEBUG - Parsed multipart Regex email:", email);
      }
    }

    console.log("SUBSCRIBE DEBUG - Final extracted email:", email);

    if (!email) {
      return new Response(
        JSON.stringify({ success: false, message: 'EMAIL IS REQUIRED' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { error } = await supabase
      .from('newsletter_subscribers')
      .insert([{ email }]);

    if (error) {
      if (error.code === '23505') { // Postgres duplicate key error code
        return new Response(
          JSON.stringify({ success: false, message: 'THIS EMAIL IS ALREADY REGISTERED' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Successfully subscribed!' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error("Error in newsletter subscription:", err);
    return new Response(
      JSON.stringify({ success: false, message: 'TRANSMISSION ERROR. PLEASE TRY AGAIN.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
