import { auth } from "@/auth";
import { getRoleNavBadges } from "@/lib/nav-badges";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return Response.json({}, { status: 401 });
  }

  const badges = await getRoleNavBadges(session.user.role);

  return Response.json(badges, {
    headers: { "Cache-Control": "no-store" },
  });
}
