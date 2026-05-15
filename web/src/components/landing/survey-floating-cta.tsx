"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SurveyFloatingCtaProps = {
  href?: string;
  label?: string;
};

/**
 * CTA lateral que acompaña el scroll; al llegar al final de la página se ancla abajo.
 */
export function SurveyFloatingCta({
  href = "/encuesta",
  label = "Ir a encuesta",
}: SurveyFloatingCtaProps) {
  const [pinnedToBottom, setPinnedToBottom] = useState(false);

  useEffect(() => {
    const update = () => {
      const threshold = 96;
      const atBottom =
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;
      setPinnedToBottom(atBottom);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className={`pointer-events-none fixed z-40 flex justify-end px-3 sm:px-5 ${
        pinnedToBottom
          ? "inset-x-0 bottom-4 justify-center sm:justify-end"
          : "right-0 top-1/2 -translate-y-1/2"
      }`}
    >
      <Link
        href={href}
        className={`pointer-events-auto inline-flex items-center justify-center rounded-full border-2 border-violet-500 bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_28px_rgba(124,58,237,0.45)] transition hover:bg-violet-700 hover:shadow-[0_12px_32px_rgba(124,58,237,0.55)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600 ${
          pinnedToBottom ? "w-full max-w-md sm:w-auto" : "max-w-[11rem] text-center leading-tight"
        }`}
      >
        {label}
      </Link>
    </div>
  );
}
