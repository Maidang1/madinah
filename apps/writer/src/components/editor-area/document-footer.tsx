import { useFileStats } from "@/hooks/use-tabs";

function FooterMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="tabular-nums text-[var(--text-secondary)]">{value.toLocaleString()}</span>
      <span>{label}</span>
    </div>
  );
}

export function DocumentFooter({ filePath }: { filePath: string }) {
  const stats = useFileStats(filePath);

  return (
    <div className="absolute bottom-0 z-10 flex h-11 w-full shrink-0 items-center justify-end gap-5 border-t border-[var(--line-subtler)] bg-[var(--surface-chrome)] px-6 text-[13px] leading-[1.15] text-[var(--text-muted)] backdrop-blur-md md:px-8">
      <FooterMetric label="words" value={stats.words} />
      <FooterMetric label="characters" value={stats.characters} />
      <FooterMetric label="paragraphs" value={stats.paragraphs} />
    </div>
  );
}
