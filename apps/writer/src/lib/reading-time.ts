export interface ReadingTime {
  text: string;
  minutes: number;
  time: number;
  words: number;
}

const WORDS_PER_MINUTE = 200;

export function calculateReadingTime(content: string): ReadingTime {
  const plainText = content
    .replace(/<[^>]*>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const words = plainText.trim().split(/\s+/).filter(Boolean).length;
  const minutes = words / WORDS_PER_MINUTE;
  const time = Math.ceil(minutes * 60 * 1000);
  const displayMinutes = Math.max(1, Math.ceil(minutes));

  return {
    text: `${displayMinutes} min read`,
    minutes: displayMinutes,
    time,
    words,
  };
}
