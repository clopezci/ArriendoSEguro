import Link from "next/link";
import type { ContentBlock } from "@/content/blog/types";

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="my-4 list-none space-y-2 pl-0">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-2 text-slate-800">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-600" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="my-4 list-none space-y-3 pl-0">
      {items.map((item, i) => (
        <li key={`${i}-${item.slice(0, 24)}`} className="flex gap-3 text-slate-800">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-400 bg-violet-100 text-xs font-bold text-violet-800"
            aria-hidden
          >
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

export function ArticleBody({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="prose prose-slate max-w-none">
      {blocks.map((block, idx) => {
        const key = `${block.type}-${idx}`;
        switch (block.type) {
          case "h2":
            return (
              <h2 key={key} className="mt-10 scroll-mt-24 text-xl font-bold tracking-tight text-slate-900 first:mt-0 sm:text-2xl">
                {block.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={key} className="mt-8 scroll-mt-24 text-lg font-semibold text-slate-900 sm:text-xl">
                {block.text}
              </h3>
            );
          case "p":
            return (
              <p key={key} className="mt-4 leading-relaxed text-slate-800">
                {block.text}
              </p>
            );
          case "ul":
            return <BulletList key={key} items={block.items} />;
          case "ol":
            return <NumberedList key={key} items={block.items} />;
          case "note":
            return (
              <aside
                key={key}
                className="my-6 rounded-lg border-l-4 border-violet-500 bg-violet-50 px-4 py-3 text-sm leading-relaxed text-violet-950"
              >
                {block.text}
              </aside>
            );
          case "table":
            return (
              <div key={key} className="my-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {block.caption ? (
                  <p className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                    {block.caption}
                  </p>
                ) : null}
                <table className="min-w-full text-left text-sm text-slate-800">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      {block.headers.map((h) => (
                        <th key={h} className="whitespace-nowrap px-3 py-2 font-semibold text-slate-900">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, ri) => (
                      <tr
                        key={`row-${ri}-${row.join("|").slice(0, 48)}`}
                        className="border-b border-slate-100 last:border-0"
                      >
                        {row.map((cell, ci) => (
                          <td key={`${ri}-${ci}`} className="px-3 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "sources":
            return (
              <section
                key={key}
                className="my-8 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                aria-label="Fuentes"
              >
                <h2 className="text-sm font-semibold text-slate-900">Fuentes oficiales</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {block.items.map((s) => (
                    <li key={s.href}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-violet-700 underline underline-offset-2 hover:text-violet-900"
                      >
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          case "cta":
            return (
              <div
                key={key}
                className="my-6 rounded-xl border border-violet-300 bg-gradient-to-br from-violet-50 to-white p-4 shadow-[0_4px_20px_rgba(139,92,246,0.12)]"
              >
                <Link
                  href={block.href}
                  className="inline-flex items-center rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-700"
                >
                  {block.label}
                </Link>
                {block.description ? (
                  <p className="mt-2 text-sm leading-snug text-slate-700">{block.description}</p>
                ) : null}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
