import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "./lib/utils/validation";

function getClientIP(request: NextRequest): string {
  // Try different headers for getting client IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  if (realIP) {
    return realIP;
  }

  // Fallback to connection remote address if available
  return "anonymous";
}

export default clerkMiddleware((auth, req: NextRequest) => {
  const response = NextResponse.next();

  // Security headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  // response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // response.headers.set(
  //   "Content-Security-Policy",
  //   "default-src 'self'; " +
  //     "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.dev https://*.clerk.dev https://*.clerk.accounts.dev https://www.google.com https://www.gstatic.com https://js.hcaptcha.com https://*.hcaptcha.com; " +
  //     "style-src 'self' 'unsafe-inline' https://www.google.com https://fonts.googleapis.com https://*.hcaptcha.com; " +
  //     "img-src 'self' data: blob: https: http:; " +
  //     "font-src 'self' https: https://fonts.gstatic.com; " +
  //     "connect-src 'self' https: wss: https://*.clerk.accounts.dev https://www.google.com https://api.hcaptcha.com; " +
  //     "frame-src https://www.google.com https://*.hcaptcha.com;"
  // );

  // Rate limiting for API routes
  if (req.nextUrl.pathname.startsWith("/api/")) {
    const clientIP = getClientIP(req);
    const key = `${clientIP}:${req.nextUrl.pathname}`;

    if (!rateLimit(key, 100, 15 * 60 * 1000)) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Too many requests. Please try again later.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": "900", // 15 minutes
          },
        }
      );
    }
  }

  return response;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
