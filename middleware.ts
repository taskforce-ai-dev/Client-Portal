import { NextResponse, type NextRequest } from "next/server";

// Gates two areas by cookie presence (full verification happens server-side):
//  - /admin            -> admin session (sentinel_admin), else /admin/login
//  - /select, /agents  -> client session, else /login
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/admin" || pathname === "/admin/") {
    if (!req.cookies.get("sentinel_admin")?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === "/select" || pathname.startsWith("/agents")) {
    if (!req.cookies.get("client_session")?.value) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/", "/select", "/agents/:path*"],
};
