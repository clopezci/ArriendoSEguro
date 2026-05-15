import Link from "next/link";
import { getLandingBlogTopicLinks } from "@/content/blog/landing-topic-links";

export function BlogTopicLinks() {
  const links = getLandingBlogTopicLinks();

  return (
    <section
      id="guias-blog"
      aria-labelledby="guias-blog-heading"
      className="rounded-lg border border-slate-300 bg-white p-3 shadow-[0_4px_18px_rgba(15,23,42,0.06)] sm:p-3.5"
    >
      <h2
        id="guias-blog-heading"
        className="text-center text-sm font-semibold text-slate-900 sm:text-base lg:text-left"
      >
        Guías para formalizar tu arriendo
      </h2>
      <p className="mt-1 text-center text-[11px] leading-relaxed text-slate-600 sm:text-xs lg:text-left">
        Orientación general en Colombia; no sustituye asesoría legal.{" "}
        <Link href="/blog" className="font-medium text-violet-700 underline-offset-2 hover:underline">
          Ver el blog completo
        </Link>
        .
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="block rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-xs font-medium leading-snug text-slate-800 transition hover:border-violet-400 hover:bg-violet-50/80 hover:text-violet-900 sm:text-[13px]"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
