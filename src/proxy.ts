import { NextResponse, type NextRequest } from 'next/server';

export default function proxy(req: NextRequest) {
  const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard');
  if (!isOnDashboard) return NextResponse.next();

  const sessionToken =
    req.cookies.get('__Secure-authjs.session-token')?.value ??
    req.cookies.get('authjs.session-token')?.value;

  if (sessionToken) return NextResponse.next();

  const url = new URL('/login', req.nextUrl);
  url.searchParams.set('callbackUrl', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

