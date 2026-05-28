import { NextResponse, type NextRequest } from "next/server";

// Gate the admin console: if there's no admin session cookie, send to login.
// (Full signature verification happens in the API routes.)
export function middleware(req: NextRequest) {
  const hasSession = !!req.cookies.get("sentinel_admin")?.value;
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin"],
};
