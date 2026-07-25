"use client";

/** Huge skewed ALL-CAPS screen title with accent slash (refs 1–4). */
export function HeroHeader({ title, chip }: { title: string; chip?: string }) {
  return (
    <div className="flex items-end gap-4">
      <h1 className="display-hero slash-underline text-5xl text-paper-050 drop-shadow-lg md:text-6xl">
        {title}
      </h1>
      {chip && (
        <span className="skewed mb-1 bg-paper-050/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-paper-050/90">
          <span className="unskew inline-block">{chip}</span>
        </span>
      )}
    </div>
  );
}
