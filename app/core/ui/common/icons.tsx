import clsx from "clsx"

interface IconsProps {
  iconName: string
  iconColor: string
  onClick?: () => void
  ariaLabel: string
  disabled?: boolean
}

export const Icons = (props: IconsProps) => {
  const { iconColor, iconName, onClick, ariaLabel, disabled = false } = props;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel}
        className={clsx(
          "rounded-md w-6 h-6 text-center flex items-center justify-center transition-transform",
          "hover:scale-[1.1] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
          iconColor
        )}
      >
        <span
          className={clsx("w-4 h-4 inline-block m-auto text-white", iconName)}
          aria-hidden="true"
        />
      </button>
    )
  }

  return (
    <div
      className={clsx("rounded-md w-6 h-6 text-center flex items-center justify-center", iconColor)}
      role="img"
      aria-label={ariaLabel}
    >
      <span
        className={clsx("w-4 h-4 inline-block m-auto text-white", iconName)}
        aria-hidden="true"
      />
    </div>
  )
}