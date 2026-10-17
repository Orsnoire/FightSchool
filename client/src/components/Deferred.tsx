import { Component, Suspense, lazy, useState, type ComponentType, type ComponentProps, type ReactNode } from 'react';

class LoadBoundary extends Component<{
  children: ReactNode; label: string; retry: () => void; page: boolean;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className={`space-y-3 rounded-md border bg-background p-6 text-foreground ${this.props.page ? 'm-6' : ''}`}>
      <p>Could not load {this.props.label}. Check your connection and try again.</p>
      <button type="button" className="rounded border px-4 py-2" onClick={this.props.retry}>Try again</button>
      {this.props.page && <button type="button" className="ml-3 underline" onClick={() => window.location.reload()}>Reload page</button>}
    </div>;
  }
}

// A new lazy instance on retry clears React's cached rejection. The boundary is
// local to the deferred component, so retrying an editor retains its parent's
// controlled values and the rest of the form. Never automatically reload a draft.
export function deferred<P extends object>(load: () => Promise<{ default: ComponentType<P> }>, label: string, page = false) {
  return function Deferred(props: P) {
    const [Loaded, setLoaded] = useState(() => lazy(load));
    const [attempt, setAttempt] = useState(0);
    const retry = () => { setLoaded(() => lazy(load)); setAttempt(n => n + 1); };
    return <LoadBoundary key={attempt} label={label} retry={retry} page={page}>
      <Suspense fallback={<div role="status" aria-live="polite" className={`p-6 text-muted-foreground ${page ? 'min-h-[50vh]' : 'min-h-20'}`}>Loading {label}…</div>}>
        <Loaded key="loaded" {...props as ComponentProps<typeof Loaded>} />
      </Suspense>
    </LoadBoundary>;
  };
}
