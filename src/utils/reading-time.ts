/**
 * Calculate reading time for text content
 * Based on average reading speed of 200 words per minute
 */
export interface ReadingTime {
  text: string;
  minutes: number;
  time: number;
  words: number;
}

const WORDS_PER_MINUTE = 200;

export function calculateReadingTime(content: string): ReadingTime {
  // Remove HTML tags and MDX syntax
  const plainText = content
    .replace(/<[^>]*>/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Count words (split by whitespace)
  const words = plainText.trim().split(/\s+/).length;
  
  // Calculate reading time
  const minutes = words / WORDS_PER_MINUTE;
  const timeMs = Math.ceil(minutes * 60 * 1000); // in milliseconds
  
  const displayMinutes = Math.ceil(minutes);
  const displayText = `${displayMinutes} min read`;

  return {
    text: displayText,
    minutes: displayMinutes,
    time: timeMs,
    words,
  };
}
