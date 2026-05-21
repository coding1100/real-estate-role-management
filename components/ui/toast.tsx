import * as React from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      "pointer-events-none fixed inset-x-auto z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-0",
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> & {
    variant?: "default" | "destructive" | "alert" | "info";
    durationMs?: number;
  }
>(({ className, variant = "default", durationMs, ...props }, ref) => {
  const [remainingMs, setRemainingMs] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!durationMs || typeof window === "undefined") {
      setRemainingMs(null);
      return;
    }
    const start = performance.now();
    const end = start + durationMs;
    let frame: number;

    const tick = () => {
      const now = performance.now();
      const left = Math.max(0, end - now);
      setRemainingMs(left);
      if (left > 0) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    setRemainingMs(durationMs);
    frame = window.requestAnimationFrame(tick);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [durationMs]);

  const progress =
    durationMs && remainingMs != null && durationMs > 0
      ? 1 - Math.min(1, Math.max(0, remainingMs / durationMs))
      : 0;

  const progressBarClass =
    variant === "destructive"
      ? "bg-red-600/90"
      : variant === "alert"
        ? "bg-amber-500/90"
        : variant === "info"
          ? "bg-sky-600/90"
          : "bg-emerald-700/90";

  return (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(
        "pointer-events-auto relative flex w-full min-w-64 max-w-[360px] items-start gap-3 overflow-hidden !rounded-md border bg-white p-3 text-sm shadow-lg",
        // Smooth slide / fade animation from top-right
        "transform translate-x-full -translate-y-2 opacity-0 transition-transform transition-opacity duration-300 ease-out",
        "data-[state=open]:translate-x-0 data-[state=open]:translate-y-0 data-[state=open]:opacity-100",
        "data-[state=closed]:translate-x-full data-[state=closed]:-translate-y-2 data-[state=closed]:opacity-0",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
        "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]",
        variant === "destructive" &&
          "border-red-200 bg-red-50 text-red-900",
        variant === "default" &&
          "border-emerald-200 bg-emerald-50 text-emerald-900",
        className,
      )}
      {...props}
    >
      {durationMs && progress > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-transparent">
          <div
            className={`h-full w-full origin-left ${progressBarClass}`}
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      )}
      {props.children}
    </ToastPrimitives.Root>
  );
});
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastTitle = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title
    ref={ref}
    className={cn("font-semibold", className)}
    {...props}
  />
));
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
));
ToastDescription.displayName = ToastPrimitives.Description.displayName;

const ToastClose = React.forwardRef<
  React.ElementRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      "absolute right-2 top-2 rounded p-1 text-xs text-zinc-500 hover:bg-black/5 hover:text-zinc-700",
      className,
    )}
    toast-close=""
    {...props}
  >
    ✕
  </ToastPrimitives.Close>
));
ToastClose.displayName = ToastPrimitives.Close.displayName;

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
};

