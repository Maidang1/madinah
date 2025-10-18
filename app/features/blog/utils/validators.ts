import type { PostInfo } from "~/types";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const isPostInfoList = (value: unknown): value is PostInfo[] =>
  Array.isArray(value) &&
  value.every((post) => {
    if (!post || typeof post !== "object") {
      return false;
    }

    const candidate = post as PostInfo;

    return (
      isNonEmptyString(candidate.title) &&
      isNonEmptyString(candidate.url) &&
      isNonEmptyString(candidate.summary ?? "") &&
      isNonEmptyString(candidate.time ?? "") &&
      isNonEmptyString(candidate.date ?? "")
    );
  });
