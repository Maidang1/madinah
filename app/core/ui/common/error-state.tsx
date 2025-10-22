import type { ReactNode } from "react";
import { cn } from "~/core/utils";
import { useTranslation } from "~/core/i18n";

interface ErrorStateProps {
  title?: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title,
  message,
  action,
  className,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("common.errors.defaultTitle");

  return (
    <div
      role="alert"
      className={cn(
        "space-y-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 transition",
        "dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100",
        className,
      )}
    >
      <h2 className="text-lg font-semibold">{resolvedTitle}</h2>
      {message ? (
        <p className="text-sm text-red-600 dark:text-red-100">{message}</p>
      ) : null}
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}
