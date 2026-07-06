import { useFileStats } from "@/hooks/use-tabs";

function FooterMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[var(--text-muted)]">{value.toLocaleString()}</span>
      <span>{label}</span>
    </div>
  );
}

export function DocumentFooter({ filePath }: { filePath: string }) {
  const stats = useFileStats(filePath);

  return (
    <div className="flex absolute bottom-0 w-full z-10 h-11 shrink-0 items-center justify-end gap-5 px-6 text-[13px] leading-[1.15] text-[var(--text-muted)] md:px-8">
      <FooterMetric label="words" value={stats.words} />
      <FooterMetric label="characters" value={stats.characters} />
      <FooterMetric label="paragraphs" value={stats.paragraphs} />
    </div>
  );
}
