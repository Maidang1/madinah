import { Outlet } from '@remix-run/react';

export default function Blogs() {
  return (
    <div className='prose text-white pt-[60px] mx-auto pb-[40px]'>
      <Outlet />
    </div>
  );
}
