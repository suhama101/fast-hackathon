import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "../../../../lib/requestAuth";

export async function GET(request) {
  const auth = await requireAuthenticatedUser(request);
  if (auth.errorResponse) return auth.errorResponse;

  const { user } = auth;
  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName || user.full_name,
      role: user.role,
      created_at: user.created_at,
    },
  });
}
