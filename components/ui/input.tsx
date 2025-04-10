import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={`w-full rounded-xl border border-gray-300 px-4 py-2 text-base shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black ${className}`}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
