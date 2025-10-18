import { json } from "@remix-run/cloudflare";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import {
  Link,
  Outlet,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { BookChapterSidebar } from "~/features/books/components/chapter-sidebar";
import { BookLayout } from "~/features/books/components/book-layout";
import { BookOverviewCard } from "~/features/books/components/book-overview-card";
import { ErrorState } from "~/core/ui/common/error-state";
import { assertResponse } from "~/core/utils";
import type { BookSummaryInfo } from "~/types";
// eslint-disable-next-line import/no-unresolved
import { getSerializedBook } from "virtual:book-data";

interface LoaderData {
  book: BookSummaryInfo;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const bookId = assertResponse(params.bookId, "Book not found", 404);

  const book = assertResponse(getSerializedBook(bookId), "Book not found", 404);

  return json<LoaderData>({ book });
}

export type BookRouteContext = LoaderData;

export default function BookRoute() {
  const { book } = useLoaderData<typeof loader>();

  return (
    <BookLayout
      overview={() => <BookOverviewCard book={book} />}
      sidebar={(close) => (
        <BookChapterSidebar book={book} onNavigate={close} />
      )}
    >
      <Outlet context={{ book }} />
    </BookLayout>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title={error.status === 404 ? "未找到书籍" : "加载书籍失败"}
        message={
          typeof error.data === "string"
            ? error.data
            : error.data?.error ?? error.statusText
        }
        action={
          <Link
            to="/books"
            className="bg-main-500 hover:bg-main-600 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
          >
            返回书籍列表
          </Link>
        }
      />
    );
  }

  return (
    <ErrorState
      title="加载书籍时出现错误"
      message={
        error instanceof Error
          ? error.message
          : "发生未知错误，请稍后再试。"
      }
      action={
        <Link
          to="/books"
          className="bg-main-500 hover:bg-main-600 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
        >
          返回书籍列表
        </Link>
      }
    />
  );
}
