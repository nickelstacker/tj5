import * as React from "react";

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`rounded-xl bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:bg-gray-400 ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
