import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findRouteGuard, isRole } from "@/types/roles";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

/**
 * The middleware only answers "are you signed in?" and, when the session token
 * happens to carry a role, "is it the wrong role?". Onboarding state and the
 * authoritative role check live in the page layouts (lib/guards.ts), which read
 * the database, because session claims can be a minute stale right after sign-up.
 */
export default clerkMiddleware(async (authFn, req) => {
  if (isPublicRoute(req)) return NextResponse.next();

  const { userId, sessionClaims, redirectToSignIn } = await authFn();

  if (!userId) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Sign in first." }, { status: 401 });
    }
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  const guard = findRouteGuard(req.nextUrl.pathname);
  const role = (sessionClaims?.metadata as { role?: unknown } | undefined)
    ?.role;
  if (guard && isRole(role) && !guard.roles.includes(role)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
