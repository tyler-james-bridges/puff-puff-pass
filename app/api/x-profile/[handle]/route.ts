import { NextRequest, NextResponse } from "next/server";

// Cache profiles for 5 minutes to avoid hammering upstream
const cache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchXProfile(handle: string) {
  const cached = cache.get(handle);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // Try unavatar's Twitter source (includes some profile data)
  // Fallback: use nitter/syndication endpoints
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PuffPuffPass/1.0)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!res.ok) {
      // Try the legacy API endpoint
      const legacyRes = await fetch(
        `https://api.fxtwitter.com/${encodeURIComponent(handle)}`,
        {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!legacyRes.ok) {
        return null;
      }

      const json = await legacyRes.json();
      const user = json?.user;
      if (!user) return null;

      const profile = {
        name: user.name || handle,
        handle: user.screen_name || handle,
        bio: user.description || "",
        followers: user.followers ?? 0,
        following: user.following ?? 0,
        posts: user.tweets ?? user.statuses_count ?? 0,
        avatar: user.avatar_url || user.profile_image_url || null,
        banner: user.banner_url || user.profile_banner_url || null,
      };

      cache.set(handle, { data: profile, ts: Date.now() });
      return profile;
    }

    // Parse syndication HTML for profile data (embedded __NEXT_DATA__ or similar)
    const html = await res.text();

    // Extract JSON data from syndication page
    const scriptMatch = html.match(
      /(?:window\.__INITIAL_STATE__|"UserByScreenName").*?({.*?})\s*[;<]/s,
    );
    if (scriptMatch) {
      // Complex parsing — fall through to fxtwitter
    }

    // Fallback to fxtwitter
    const fxRes = await fetch(
      `https://api.fxtwitter.com/${encodeURIComponent(handle)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000),
      },
    );

    if (!fxRes.ok) return null;

    const fxJson = await fxRes.json();
    const fxUser = fxJson?.user;
    if (!fxUser) return null;

    const profile = {
      name: fxUser.name || handle,
      handle: fxUser.screen_name || handle,
      bio: fxUser.description || "",
      followers: fxUser.followers ?? 0,
      following: fxUser.following ?? 0,
      posts: fxUser.tweets ?? fxUser.statuses_count ?? 0,
      avatar: fxUser.avatar_url || fxUser.profile_image_url || null,
      banner: fxUser.banner_url || fxUser.profile_banner_url || null,
    };

    cache.set(handle, { data: profile, ts: Date.now() });
    return profile;
  } catch (err: any) {
    console.error("[x-profile]", handle, err?.message || String(err));
    return null;
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;

  if (!handle || !/^[a-zA-Z0-9_]{1,50}$/.test(handle)) {
    return NextResponse.json(
      { ok: false, error: "invalid handle" },
      { status: 400 },
    );
  }

  const profile = await fetchXProfile(handle);

  if (!profile) {
    return NextResponse.json(
      { ok: false, error: "profile not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, profile }, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
  });
}
