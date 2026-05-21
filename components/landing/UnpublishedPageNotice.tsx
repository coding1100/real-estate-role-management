import Link from "next/link";

type Props = {
  siteName: string;
  hostname: string;
  slug: string;
};

export function UnpublishedPageNotice({ siteName, hostname, slug }: Props) {
  const homeUrl = `https://${hostname}/`;
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center bg-zinc-50 px-4 py-16 text-center">
      <div className="max-w-md rounded-2xl border border-zinc-200 bg-white px-8 py-10 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Not on the menu yet
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
          This page isn&apos;t published yet
        </h1>
        <p className="mt-4 text-base leading-relaxed text-zinc-600">
          We&apos;re still getting <span className="font-medium text-zinc-800">{slug}</span>{" "}
          ready for {siteName}. Check back soon — good things are worth the wait.
        </p>
        <p className="mt-6">
          <Link
            href={homeUrl}
            className="inline-flex items-center justify-center rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800"
          >
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
