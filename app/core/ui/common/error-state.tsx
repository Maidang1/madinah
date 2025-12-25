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
        "space-y-3 rounded-none border-2 border-foreground bg-background p-6 text-center text-foreground transition",
        className,
      )}
    >
      <h2 className="text-lg font-bold uppercase">{resolvedTitle}</h2>
      {message ? (
        <p className="text-sm font-medium">{message}</p>
      ) : null}
      {action ? <div className="flex justify-center">{action}</div> : null}
    </div>
  );
}
