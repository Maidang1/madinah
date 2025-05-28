import dayjs from "dayjs";

export const Time = ({ time }: { time: string }) => {
  return (
    <span className='flex items-center gap-x-1.5'>
      <span className='i-simple-line-icons-clock w-3 h-3' />
      <span className='text-xs'>{dayjs(time).format('YYYY [年] MM [月] DD [日]')}</span>
      <span className='text-xs'>星期{[' ', '一', '二', '三', '四', '五', '六', '日'][dayjs(time).day()]}</span>
    </span>
  );
};