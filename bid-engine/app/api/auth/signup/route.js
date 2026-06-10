import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabaseClient";

/**
 * Registers new bidders inside BidEngine AI portal
 */
export async function POST(request) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required for initialization." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name || "Anonymous Bidder",
        }
      }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { 
        message: "Registration successful. Please verify your email if required.", 
        user: data.user, 
        session: data.session 
      }, 
      { status: 201 }
    );
  } catch (err) {
    console.error("Signup route error:", err);
    return NextResponse.json(
      { error: "Internal Server Error within Sign-up endpoint: " + err.message },
      { status: 500 }
    );
  }
}
