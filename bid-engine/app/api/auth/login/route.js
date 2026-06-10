import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

/**
 * Handles credentials-based user logging inside BidEngine AI
 */
export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required credentials." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { 
        message: "Login successful", 
        user: data.user, 
        session: data.session 
      }, 
      { status: 200 }
    );
  } catch (err) {
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: "Internal Server Error within Auth endpoint: " + err.message },
      { status: 500 }
    );
  }
}
