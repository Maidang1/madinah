import { useMemo } from 'react';
import { useTranslation } from '~/core/i18n';

export const Time = ({ time }: { time: string }) => {
  const { locale } = useTranslation();
  const { formattedDate, weekday } = useMemo(() => {
    const parsed = new Date(time);
    if (Number.isNaN(parsed.getTime())) {
      return { formattedDate: time, weekday: '' };
    }
    const localeCode = locale === 'zh' ? 'zh-CN' : 'en-US';
    const formattedDate = new Intl.DateTimeFormat(localeCode, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parsed);
    const weekday = new Intl.DateTimeFormat(localeCode, {
      weekday: 'short',
    }).format(parsed);
    return { formattedDate, weekday };
  }, [locale, time]);

  return (
    <span className="flex items-center gap-x-1.5 whitespace-nowrap">
      <span className="text-muted-foreground text-xs">{formattedDate}</span>
      {weekday ? <span className="text-xs">{weekday}</span> : null}
    </span>
  );
};
