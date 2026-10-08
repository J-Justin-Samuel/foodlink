import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { findRouteGuard, isRole } from "./types/roles";

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);

export default clerkMiddleware(async (authFn, req) => {
  const { pathname } = req.nextUrl;

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const { userId, sessionClaims, redirectToSignIn } = await authFn();

  if (!userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  // Role + onboarding status are synced into Clerk's public metadata
  // (see lib/actions/onboarding.ts) so middleware can check them without
  // a DB round trip on every request.
  const role = sessionClaims?.metadata?.role;
  const onboardingStatus = sessionClaims?.metadata?.onboardingStatus as
    | string
    | undefined;

  // Force incomplete onboarding to finish before touching role dashboards.
  if (
    onboardingStatus &&
    onboardingStatus !== "VERIFIED" &&
    onboardingStatus !== "SUBMITTED" &&
    !isOnboardingRoute(req)
  ) {
    const onboardingUrl = new URL("/onboarding", req.url);
    return NextResponse.redirect(onboardingUrl);
  }

  const guard = findRouteGuard(pathname);
  if (guard) {
    if (!isRole(role) || !guard.roles.includes(role)) {
      const unauthorizedUrl = new URL("/unauthorized", req.url);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
