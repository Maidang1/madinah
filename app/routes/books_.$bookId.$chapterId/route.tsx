import { json } from "@remix-run/cloudflare";
import type {
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/cloudflare";
import { Suspense, lazy, useMemo } from "react";
import type { ComponentType } from "react";
import {
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useOutletContext,
  useRouteError,
} from "@remix-run/react";
import { BookChapterContent } from "~/features/books/components/chapter-content";
import type { BookChapterInfo, BookSummaryInfo } from "~/types";
import type { BookRouteContext } from "../books_.$bookId/route";
import { ErrorState } from "~/core/ui/common/error-state";
import { assertResponse } from "~/core/utils";
// eslint-disable-next-line import/no-unresolved
import { getSerializedChapter, loadChapterModule } from "virtual:book-data";

interface LoaderData {
  chapter: BookChapterInfo;
}

const createLazyChapter = (bookId: string, chapterId: string) =>
  lazy(async () => {
    const result = await loadChapterModule(bookId, chapterId);
    if (!result?.module) {
      throw new Error("未能加载章节内容");
    }

    return { default: result.module as ComponentType };
  });

export async function loader({ params }: LoaderFunctionArgs) {
  const bookId = assertResponse(params.bookId, "Book not found", 404);
  const chapterId = assertResponse(params.chapterId, "Chapter not found", 404);

  const chapter = assertResponse(
    getSerializedChapter(bookId, chapterId),
    "Chapter not found",
    404,
  );

  return json<LoaderData>({ chapter });
}

export const meta: MetaFunction<typeof loader> = ({
  data,
  params,
  matches,
}) => {
  if (!data) {
    return [];
  }

  const parent = matches
    ?.find((match) => match.id.endsWith("books_.$bookId/route"))
    ?.data as { book: BookSummaryInfo } | undefined;
  const bookTitle = parent?.book.title ?? params.bookId ?? "Books";

  return [
    { title: `${data.chapter.title} • ${bookTitle} • Madinah` },
    {
      name: "description",
      content:
        data.chapter.summary ??
        `阅读 ${bookTitle} 的章节 ${data.chapter.title}`,
    },
  ];
};

export default function BookChapterRoute() {
  const { chapter } = useLoaderData<typeof loader>();
  const { book } = useOutletContext<BookRouteContext>();

  const ChapterComponent = useMemo(
    () => createLazyChapter(book.id, chapter.id),
    [book.id, chapter.id],
  );

  return (
    <Suspense
      key={chapter.id}
      fallback={
        <div className="border-border/60 bg-background/40 text-muted-foreground rounded-2xl border p-8 text-sm">
          正在加载章节内容...
        </div>
      }
    >
      <BookChapterContent book={book} chapter={chapter}>
        <ChapterComponent />
      </BookChapterContent>
    </Suspense>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorState
        title={error.status === 404 ? "未找到章节" : "加载章节失败"}
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
      title="章节内容渲染失败"
      message={
        error instanceof Error
          ? error.message
          : "章节内容加载时发生未知错误。"
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
