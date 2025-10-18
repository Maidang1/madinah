import { json } from "@remix-run/cloudflare";
import type { MetaFunction } from "@remix-run/cloudflare";
import {
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { BookList } from "~/features/books/components/book-list";
import { ErrorState } from "~/core/ui/common/error-state";
import { jsonError } from "~/core/utils";
// eslint-disable-next-line import/no-unresolved
import { getBooks } from "virtual:book-data";

export async function loader() {
  try {
    const books = getBooks();
    if (!Array.isArray(books)) {
      throw new Error("Books data must be an array");
    }
    return json({ books });
  } catch (error) {
    console.error("Failed to load books", error);
    throw jsonError("Failed to load books", { status: 500 });
  }
}

export const meta: MetaFunction = () => [
  { title: "Books • Madinah" },
  {
    name: "description",
    content: "系统化地阅读 Rust、Remix 等专题整理的书籍系列。",
  },
];

export default function BooksIndexRoute() {
  const { books } = useLoaderData<typeof loader>();
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <h1 className="text-foreground text-3xl font-bold">Books</h1>
      </header>
      <BookList books={books} />
    </div>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title="书籍列表加载失败"
        message={
          typeof error.data === "string"
            ? error.data
            : error.data?.error ?? error.statusText
        }
        action={
          <Link
            to="/"
            className="bg-main-500 hover:bg-main-600 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
          >
            返回首页
          </Link>
        }
      />
    );
  }

  return (
    <ErrorState
      title="书籍列表渲染失败"
      message={
        error instanceof Error
          ? error.message
          : "加载书籍时出现未知错误。"
      }
      action={
        <Link
          to="/"
          className="bg-main-500 hover:bg-main-600 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
        >
          返回首页
        </Link>
      }
    />
  );
}
