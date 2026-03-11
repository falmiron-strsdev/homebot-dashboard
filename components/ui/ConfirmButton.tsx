"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { RiLoaderLine } from "react-icons/ri";

interface ConfirmButtonProps {
  label: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  variant?: "danger" | "warning" | "ghost";
  size?: "sm" | "xs";
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * Two-step confirmation button.
 * First click → shows "Confirm?" state with a 3s auto-reset timer.
 * Second click → executes the action.
 * Shows spinner while pending, green checkmark on success, red on error.
 */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  variant = "danger",
  size = "sm",
  disabled,
  className,
  icon,
}: ConfirmButtonProps) {
  const [phase, setPhase] = useState<"idle" | "confirm" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const variantStyles = {
    danger:  "border-red-500/40 text-red-400 hover:bg-red-500/10",
    warning: "border-amber-500/40 text-amber-400 hover:bg-amber-500/10",
    ghost:   "border-gray-600/40 text-gray-400 hover:bg-gray-500/10",
  };

  const confirmStyles = {
    danger:  "border-red-500 bg-red-500/15 text-red-300",
    warning: "border-amber-500 bg-amber-500/15 text-amber-300",
    ghost:   "border-gray-400 bg-gray-500/15 text-gray-300",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    xs: "px-2 py-1 text-[11px]",
  };

  function handleClick() {
    if (phase === "idle") {
      setPhase("confirm");
      timerRef.current = setTimeout(() => setPhase("idle"), 3000);
      return;
    }

    if (phase === "confirm") {
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase("loading");
      onConfirm()
        .then(() => {
          setPhase("done");
          timerRef.current = setTimeout(() => setPhase("idle"), 2000);
        })
        .catch((err) => {
          setErrorMsg(err instanceof Error ? err.message : String(err));
          setPhase("error");
          timerRef.current = setTimeout(() => setPhase("idle"), 4000);
        });
    }
  }

  const isLoading = phase === "loading";
  const isConfirm = phase === "confirm";
  const isDone    = phase === "done";
  const isError   = phase === "error";

  return (
    <div className="flex flex-col items-start gap-0.5">
      <button
        onClick={handleClick}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded border font-medium transition-all select-none",
          sizeStyles[size],
          isDone  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400" :
          isError ? "border-red-500/50 bg-red-500/10 text-red-400" :
          isConfirm ? confirmStyles[variant] :
          variantStyles[variant],
          (disabled || isLoading) && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {isLoading ? (
          <RiLoaderLine className="w-3 h-3 animate-spin" />
        ) : icon && phase === "idle" ? (
          icon
        ) : null}
        {isLoading ? "Working…"
          : isDone    ? "Done ✓"
          : isError   ? "Failed"
          : isConfirm ? (confirmLabel ?? `Confirm ${label}?`)
          : label}
      </button>

      {isError && errorMsg && (
        <span className="text-[10px] text-red-400/80 font-mono max-w-[220px] truncate">
          {errorMsg}
        </span>
      )}
    </div>
  );
}
