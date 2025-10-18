import { redirect } from "@remix-run/cloudflare";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Link, isRouteErrorResponse, useRouteError } from "@remix-run/react";
import { assertResponse } from "~/core/utils";
import { ErrorState } from "~/core/ui/common/error-state";
// eslint-disable-next-line import/no-unresolved
import { getSerializedBook } from "virtual:book-data";

export async function loader({ params }: LoaderFunctionArgs) {
  const bookId = assertResponse(params.bookId, "Book not found", 404);

  const book = assertResponse(getSerializedBook(bookId), "Book not found", 404);

  const chapterId = assertResponse(
    book.defaultChapterId ?? book.chapters[0]?.id,
    "No chapters available",
    404,
  );

  throw redirect(`/books/${bookId}/${chapterId}`);
}

export default function BookIndexPlaceholder() {
  return null;
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title="无法定位章节"
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
      title="章节重定向失败"
      message={
        error instanceof Error
          ? error.message
          : "无法确认默认章节，请稍后重试。"
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
