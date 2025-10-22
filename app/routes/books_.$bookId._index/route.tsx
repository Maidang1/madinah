import { redirect } from "@remix-run/cloudflare";
import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { Link, isRouteErrorResponse, useRouteError } from "@remix-run/react";
import { assertResponse } from "~/core/utils";
import { ErrorState } from "~/core/ui/common/error-state";
import { useTranslation } from "~/core/i18n";
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
  const { t } = useTranslation();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title={t("books.errors.chapterRedirectFailed")}
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
            {t("books.errors.goToBooks")}
          </Link>
        }
      />
    );
  }

  return (
    <ErrorState
      title={t("books.errors.chapterRedirectFailed")}
      message={
        error instanceof Error
          ? error.message
          : t("books.errors.chapterRedirectMessage")
      }
      action={
        <Link
          to="/books"
          className="bg-main-500 hover:bg-main-600 inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white transition"
        >
          {t("books.errors.goToBooks")}
        </Link>
      }
    />
  );
}
