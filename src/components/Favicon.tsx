"use client";

import { useState } from "react";
import { Rss } from "lucide-react";
import { cn } from "@/lib/utils";

/** Feed favicon with graceful fallback to an RSS glyph. */
export default function Favicon({
  src,
  alt = "",
  size = 16,
  className,
}: {
  src: string | null;
  alt?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        className={cn("inline-flex items-center justify-center rounded bg-bg-tertiary", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <Rss style={{ width: size * 0.62, height: size * 0.62 }} className="text-text-tertiary" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("rounded", className)}
      style={{ width: size, height: size }}
    />
  );
}
