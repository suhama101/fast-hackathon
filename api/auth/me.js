import { requireAuthenticatedUser } from "../_lib/requestAuth.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAuthenticatedUser(req);
  if (auth.errorResponse) {
    return res.status(auth.errorResponse.status).json(auth.errorResponse.body);
  }

  const { user } = auth;
  return res.status(200).json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      fullName:
        user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        null,
      confirmed_at: user.confirmed_at || user.email_confirmed_at,
      created_at: user.created_at,
    },
  });
}
