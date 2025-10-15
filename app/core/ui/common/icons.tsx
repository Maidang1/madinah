import clsx from "clsx"

interface IconsProps {
  iconName: string
  iconColor: string
}

export const Icons = (props: IconsProps) => {
  const { iconColor, iconName } = props;
  return <div className={clsx("rounded-md w-6 h-6 text-center cursor-pointer flex items-center justify-center hover:scale-[1.1] transition-transform", iconColor)} >
    <span className={clsx("w-4 h-4 inline-block m-auto text-white", iconName)} />
  </div>
}