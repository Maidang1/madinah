import {
  formatMetric,
  type WritingMetricItem,
} from "../workbench/document-summary";

const STAT_LABELS: Record<WritingMetricItem["id"], string> = {
  words: "Words",
  characters: "Characters",
  blocks: "Blocks",
  headings: "Headings",
  links: "Links",
  images: "Images",
  readingMinutes: "Read minutes",
};

interface WritingStatsProps {
  items: WritingMetricItem[];
}

export function WritingStats({ items }: WritingStatsProps) {
  return (
    <div className="inspector-stat-list" aria-label="Writing metrics">
      {items.map((item) => (
        <div className="inspector-stat-row" key={item.id}>
          <span className="inspector-stat-label">
            {STAT_LABELS[item.id] ?? item.label}
          </span>
          <strong className="inspector-stat-value">
            {formatMetric(item.value)}
          </strong>
        </div>
      ))}
    </div>
  );
}
