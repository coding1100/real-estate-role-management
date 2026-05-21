import { NextRequest, NextResponse } from "next/server";

const ZILLOW_API_KEY = process.env.ZILLOW_API_KEY;
const ZILLOW_API_BASE_URL =
  process.env.ZILLOW_API_BASE_URL ??
  "https://api.bridgedataoutput.com/api/v2/zestimates_v1/zestimates";

export async function POST(req: NextRequest) {
  if (!ZILLOW_API_KEY) {
    return NextResponse.json(
      { error: "Zillow API key is not configured." },
      { status: 500 },
    );
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    // ignore
  }

  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!address) {
    return NextResponse.json(
      { error: "Missing address" },
      { status: 400 },
    );
  }

  try {
    const url = new URL(ZILLOW_API_BASE_URL);
    url.searchParams.set("access_token", ZILLOW_API_KEY);
    url.searchParams.set("address", address);

    const res = await fetch(url.toString());
    if (res.status === 404) {
      return NextResponse.json(
        { found: false, address },
        { status: 404 },
      );
    }
    if (!res.ok) {
      console.error(
        "[home-value] Zillow API error",
        res.status,
        await res.text().catch(() => ""),
      );
      return NextResponse.json(
        { error: "Failed to look up property." },
        { status: 502 },
      );
    }

    const data = await res.json();
    const bundle = Array.isArray((data as any)?.bundle)
      ? (data as any).bundle
      : Array.isArray((data as any)?.zestimates)
        ? (data as any).zestimates
        : [];

    if (!bundle.length) {
      return NextResponse.json(
        { found: false, address },
        { status: 404 },
      );
    }

    const first = bundle[0] as any;

    const lat =
      typeof first.latitude === "number"
        ? first.latitude
        : typeof first.lat === "number"
          ? first.lat
          : typeof first.location?.lat === "number"
            ? first.location.lat
            : typeof first.location?.latitude === "number"
              ? first.location.latitude
              : null;
    const lng =
      typeof first.longitude === "number"
        ? first.longitude
        : typeof first.lon === "number"
          ? first.lon
          : typeof first.location?.lng === "number"
            ? first.location.lng
            : typeof first.location?.longitude === "number"
              ? first.location.longitude
              : null;

    const estimateRaw =
      typeof first.zestimate === "number"
        ? first.zestimate
        : typeof first.estimate === "number"
          ? first.estimate
          : typeof first.amount === "number"
            ? first.amount
            : typeof first.zestimate_amount === "number"
              ? first.zestimate_amount
              : null;

    const resolvedAddress =
      (first.address &&
        (first.address.full ||
          first.address.line ||
          first.address.street ||
          first.address.address)) ||
      first.full_address ||
      address;

    if (!lat || !lng) {
      return NextResponse.json(
        { found: false, address: resolvedAddress },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        found: true,
        address: resolvedAddress,
        lat,
        lng,
        estimate: typeof estimateRaw === "number" ? estimateRaw : null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[home-value] Unexpected error", err);
    return NextResponse.json(
      { error: "Unexpected error while looking up property." },
      { status: 500 },
    );
  }
}

