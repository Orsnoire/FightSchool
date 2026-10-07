import { useEffect, useRef, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./ui/button";

/** One phase-controlled dialog. Closing it must never advance combat. */
export function CombatOverlay({ title, view, seconds, children, resources, error, status, onLeave, isLeaving }: {
  title: string;
  view: string;
  seconds: number | null;
  children: ReactNode;
  resources?: ReactNode;
  error: string | null;
  status: string;
  onLeave?: () => void;
  isLeaving?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [view]);
  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/35" />
        <Dialog.Content
          aria-describedby={undefined}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => { e.preventDefault(); heading.current?.focus(); }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border bg-background shadow-2xl"
          data-testid="combat-overlay"
        >
          <div className="shrink-0 border-b p-4 sm:p-5 space-y-3">
            {onLeave && <div className="flex justify-end"><Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onLeave} disabled={isLeaving}>{isLeaving ? "Leaving…" : "Leave fight"}</Button></div>}
            <div className="flex items-center justify-between gap-4">
              <Dialog.Title ref={heading} tabIndex={-1} className="text-xl sm:text-2xl font-bold outline-none">
                {title}
              </Dialog.Title>
              {seconds !== null && <span aria-label={`${seconds} seconds remaining`} className="shrink-0 rounded-full bg-muted px-3 py-1 font-bold tabular-nums">{seconds}s</span>}
            </div>
            {resources}
            {status !== "connected" && <p role="status" className="text-sm">Reconnecting… Choices will resume when connected.</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4" data-testid="combat-overlay-body">
            {children}
          </div>
          <div data-math-keyboard-host className="relative shrink-0" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
