import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  tooltip?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      tooltip,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp: React.ElementType = asChild ? Slot : "button";
    const buttonContent = (
      <>
        {loading && (
          <span className="mr-2 animate-spin inline-block align-middle">
            <svg className="w-4 h-4 text-current" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
            </svg>
          </span>
        )}
        {icon && <span className="mr-2 align-middle">{icon}</span>}
        <span className="align-middle">{children}</span>
        {iconRight && <span className="ml-2 align-middle">{iconRight}</span>}
      </>
    );
    const buttonNode = (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          fullWidth && "w-full"
        )}
        ref={ref}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        tabIndex={(disabled || loading) ? -1 : undefined}
        disabled={disabled || loading}
        {...props}
      >
        {buttonContent}
      </Comp>
    );
    if (tooltip) {
      return (
        <span className="group relative inline-block">
          {buttonNode}
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">
            {tooltip}
          </span>
        </span>
      );
    }
    return buttonNode;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
