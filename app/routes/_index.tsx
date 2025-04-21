import { Link } from "@remix-run/react";
import { Icons } from "~/components/icons";
import type { MetaFunction } from "@remix-run/cloudflare";
import { TypingAnimation } from "~/magicui/typing-animation";



export const meta: MetaFunction = () => {
  return [
    { title: "Madinah" },
    { name: "description", content: "Welcome to Madinah!" },
  ];
};

const Index = () => {
  return (
    <div className="relative h-full">
      <div className="main-content flex items-center gap-x-6 justify-around pt-[100px] sm:pt-[160px] max-h-full overflow-hidden flex-col gap-y-10 lg:gap-y-0 lg:flex-row lg:pt-[240px] px-4 sm:px-6">
        <div className="flex flex-col gap-y-4 text-center items-center lg:text-left lg:items-start text-[#3c3c43] dark:text-[#fffffff2] order-2 lg:order-1">
          <div className='text-2xl sm:text-3xl min-h-[80px]'>
            <TypingAnimation>Hey I&apos;m Madinah 🙋</TypingAnimation>
          </div>
          <div className="text-sm sm:text-base text-[#3c3c43] dark:text-[#fffffff2]">
            Worked at Tencent Current working at ByteDance
          </div>
          <div className="mt-6 sm:mt-8 flex gap-x-4 items-center">
            <Link to="https://space.bilibili.com/427444426" target="_blank" rel="noreferrer" className="tooltip" data-tip="bilibili">
              <Icons iconName="i-simple-icons-bilibili" iconColor="bg-[rgb(242,93,142)]" />
            </Link>
            <Link to="https://t.me/maidang606" target="_blank" rel="noreferrer" className="tooltip" data-tip="Telegram">
              <Icons iconName="i-simple-icons-minutemailer" iconColor="bg-[rgb(0,136,204)]" />
            </Link>
            <Link to="https://github.com/Maidang1" target="_blank" rel="noreferrer" className="tooltip" data-tip="Github">
              <Icons iconName="i-simple-icons-github" iconColor="bg-black" />
            </Link>
            <Link to="/rss.xml" target="_blank" rel="noreferrer" className="tooltip" data-tip="RSS">
              <Icons iconName="i-simple-icons-rss" iconColor="bg-[rgb(255,135,73)]" />
            </Link>
            <Link to="https://x.com/felixwliu" target="_blank" rel="noreferrer" className="tooltip" data-tip="X">
              <Icons iconName="i-simple-icons-x" iconColor="bg-[rgb(29,145,200)]" />
            </Link>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <img 
            src="https://avatars.githubusercontent.com/u/50993231?v=4" 
            alt="avatar" 
            className="rounded-[50%] w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] lg:w-[300px] lg:h-[300px] select-none" 
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
