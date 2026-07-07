import { describe, expect, test } from "vite-plus/test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";

const appRoot = resolve(__dirname, "..");
const srcRoot = resolve(appRoot, "src");

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      files.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("architecture boundaries", () => {
  test("components do not import app stores directly", () => {
    const offenders = sourceFiles(resolve(srcRoot, "components"))
      .filter((file) => /from\s+["']@\/stores\//.test(read(file)))
      .map((file) => relative(appRoot, file));

    expect(offenders).toEqual([]);
  });

  test("store setState writes stay inside store owner modules", () => {
    const offenders = sourceFiles(srcRoot)
      .filter((file) => !isStoreOwnerFile(file))
      .filter((file) => /use[A-Za-z]+Store\.setState/.test(read(file)))
      .map((file) => relative(appRoot, file));

    expect(offenders).toEqual([]);
  });

  test("legacy Tauri bridge remains a compatibility export", () => {
    expect(read(resolve(srcRoot, "lib/tauri.ts")).trim()).toBe(
      'export * from "../platform/tauri";',
    );
  });
});

function isStoreOwnerFile(file: string) {
  const rel = relative(srcRoot, file);
  return rel.startsWith("stores/") || /(^|\/)[^/]+-store\.ts$/.test(rel);
}
