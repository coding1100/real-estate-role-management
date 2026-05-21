import * as React from "react";

type SocialLinksSource = {
  linkedinUrl?: string | null;
  linkedinVisible?: boolean | null;
  googleUrl?: string | null;
  googleVisible?: boolean | null;
  facebookUrl?: string | null;
  facebookVisible?: boolean | null;
  instagramUrl?: string | null;
  instagramVisible?: boolean | null;
  zillowUrl?: string | null;
  zillowVisible?: boolean | null;
  youtubeUrl?: string | null;
  youtubeVisible?: boolean | null;
  tiktokUrl?: string | null;
  tiktokVisible?: boolean | null;
};

interface SocialLinksBarProps {
  base: SocialLinksSource;
  overrides?: SocialLinksSource | null;
  className?: string;
}

const ICON_SIZE_CLASS = "h-6 w-6"; // max ~24px

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function toAbsoluteUrl(url: string): string {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export const SocialLinksBar: React.FC<SocialLinksBarProps> = ({
  base,
  overrides,
  className,
}) => {
  const items = [
    {
      key: "linkedin",
      url: overrides?.linkedinUrl ?? base.linkedinUrl,
      visible: overrides?.linkedinVisible ?? base.linkedinVisible,
      label: "LinkedIn",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={ICON_SIZE_CLASS}
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="4" fill="#0A66C2" />
          <path
            d="M7 17H5V9h2v8Zm-.99-9.6c-.66 0-1.2-.54-1.2-1.2 0-.66.54-1.2 1.2-1.2.66 0 1.2.54 1.2 1.2 0 .66-.54 1.2-1.2 1.2Zm4.99 9.6h-2V9h1.92v1.09h.03c.27-.51.94-1.05 1.94-1.05 2.07 0 2.45 1.36 2.45 3.12V17h-2v-3.51c0-.84-.02-1.92-1.17-1.92-1.18 0-1.36.92-1.36 1.86V17Z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      key: "google",
      url: overrides?.googleUrl ?? base.googleUrl,
      visible: overrides?.googleVisible ?? base.googleVisible,
      label: "Google",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={ICON_SIZE_CLASS}
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="11" fill="white" />
          <path
            d="M20.48 12.2c0-.63-.06-1.25-.18-1.85H12v3.5h4.76a4.07 4.07 0 0 1-1.76 2.67v2.22h2.85c1.67-1.54 2.63-3.81 2.63-6.54Z"
            fill="#4285F4"
          />
          <path
            d="M12 21c2.38 0 4.37-.78 5.83-2.12l-2.85-2.22c-.79.53-1.8.84-2.98.84-2.3 0-4.25-1.55-4.95-3.64H4.13v2.29A9 9 0 0 0 12 21Z"
            fill="#34A853"
          />
          <path
            d="M7.05 13.86A5.41 5.41 0 0 1 6.76 12c0-.65.12-1.28.29-1.86V7.85H4.13A9 9 0 0 0 3 12c0 1.44.34 2.8 1.13 4.15l2.92-2.29Z"
            fill="#FBBC05"
          />
          <path
            d="M12 6.58c1.3 0 2.47.45 3.39 1.33L18 5.3A9.03 9.03 0 0 0 12 3 9 9 0 0 0 4.13 7.85l2.92 2.29C7.75 8.96 9.7 7.42 12 7.42Z"
            fill="#EA4335"
          />
        </svg>
      ),
    },
    {
      key: "facebook",
      url: overrides?.facebookUrl ?? base.facebookUrl,
      visible: overrides?.facebookVisible ?? base.facebookVisible,
      label: "Facebook",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={ICON_SIZE_CLASS}
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="4" fill="#1877F2" />
          <path
            d="M13.5 21v-7h2.35l.35-2.7H13.5V9.05c0-.78.22-1.31 1.34-1.31h1.43V5.33C15.95 5.23 15 5.13 13.93 5.13 11.82 5.13 10.4 6.35 10.4 8.77V11.3H8v2.7h2.4v7h3.1Z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      key: "instagram",
      url: overrides?.instagramUrl ?? base.instagramUrl,
      visible: overrides?.instagramVisible ?? base.instagramVisible,
      label: "Instagram",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={ICON_SIZE_CLASS}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="igGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F58529" />
              <stop offset="50%" stopColor="#DD2A7B" />
              <stop offset="100%" stopColor="#515BD4" />
            </linearGradient>
          </defs>
          <rect width="24" height="24" rx="6" fill="url(#igGradient)" />
          <path
            d="M12 8.6A3.4 3.4 0 1 0 15.4 12 3.4 3.4 0 0 0 12 8.6Zm0 5.6A2.2 2.2 0 1 1 14.2 12 2.2 2.2 0 0 1 12 14.2Z"
            fill="white"
          />
          <circle cx="16.5" cy="7.5" r="0.9" fill="white" />
          <path
            d="M16.8 5H7.2A2.2 2.2 0 0 0 5 7.2v9.6A2.2 2.2 0 0 0 7.2 19h9.6a2.2 2.2 0 0 0 2.2-2.2V7.2A2.2 2.2 0 0 0 16.8 5Zm.9 11.8a.9.9 0 0 1-.9.9H7.2a.9.9 0 0 1-.9-.9V7.2a.9.9 0 0 1 .9-.9h9.6a.9.9 0 0 1 .9.9Z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      key: "zillow",
      url: overrides?.zillowUrl ?? base.zillowUrl,
      visible: overrides?.zillowVisible ?? base.zillowVisible,
      label: "Zillow",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={ICON_SIZE_CLASS}
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="4" fill="#006AFF" />
          <path
            d="M6 15.5 13.7 7h4.3l-7.7 8.5H6Zm0 1.8L9.1 19h4.4l4.5-5.1h-4.4L6 17.3Z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      key: "youtube",
      url: overrides?.youtubeUrl ?? base.youtubeUrl,
      visible: overrides?.youtubeVisible ?? base.youtubeVisible,
      label: "YouTube",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={ICON_SIZE_CLASS}
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="4" fill="#FF0000" />
          <path
            d="M10 15.5V8.5l6 3.5-6 3.5Z"
            fill="white"
          />
        </svg>
      ),
    },
    {
      key: "tiktok",
      url: overrides?.tiktokUrl ?? base.tiktokUrl,
      visible: overrides?.tiktokVisible ?? base.tiktokVisible,
      label: "TikTok",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          className={ICON_SIZE_CLASS}
          aria-hidden="true"
        >
          <rect width="24" height="24" rx="4" fill="#111827" />
          <path
            d="M14.6 7.2c.7.7 1.6 1.1 2.6 1.2v2.3c-1.1 0-2.1-.3-3-.8v5c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4c.3 0 .7 0 1 .1v2.4c-.3-.2-.6-.3-1-.3-1 0-1.8.8-1.8 1.8s.8 1.8 1.8 1.8 1.8-.8 1.8-1.8V5.5h2.6c0 .7.3 1.3.8 1.7Z"
            fill="white"
          />
        </svg>
      ),
    },
  ];

  const visibleItems = items.filter((item) => item.visible !== false);

  if (!visibleItems.length) return null;

  return (
    <div className={cn("mt-3 flex items-center gap-3 justify-center mt-[15px] test ", className)}>
      {visibleItems.map((item) => (
        (() => {
          const rawUrl = typeof item.url === "string" ? item.url.trim() : "";
          const hasUrl = rawUrl.length > 0;

          const href = hasUrl
            ? toAbsoluteUrl(rawUrl)
            : item.key === "linkedin"
              ? "https://linkedin.com"
              : item.key === "google"
                ? "https://google.com"
                : item.key === "facebook"
                  ? "https://facebook.com"
                  : item.key === "instagram"
                    ? "https://instagram.com"
                    : item.key === "zillow"
                      ? "https://zillow.com"
                      : item.key === "youtube"
                        ? "https://youtube.com"
                        : item.key === "tiktok"
                          ? "https://tiktok.com"
                          : "#";

          const openInNewTab = item.key !== "zillow" ? true : true;

          return (
            <a
              key={item.key}
              href={href}
              target={openInNewTab ? "_blank" : undefined}
              rel={openInNewTab ? "noreferrer" : undefined}
              aria-label={item.label}
              className="inline-flex items-center justify-center"
            >
              {item.icon}
            </a>
          );
        })()
      ))}
    </div>
  );
};

