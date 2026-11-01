import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  FIXTURES_READ_ONLY_MESSAGE,
  isFixtureRequestBlocked,
  isFixturesMode,
} from "@/lib/data-mode";

export async function proxy(request: NextRequest) {
  if (isFixturesMode()) {
    const { pathname } = request.nextUrl;

    if (isFixtureRequestBlocked(request.method, pathname)) {
      return NextResponse.json({ error: FIXTURES_READ_ONLY_MESSAGE }, { status: 403 });
    }

    if (pathname !== "/staging") {
      return NextResponse.rewrite(new URL("/staging", request.url));
    }

    return NextResponse.next({ request });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([name, value]) => {
          response.headers.set(name, value);
        });
      },
    },
  });

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
