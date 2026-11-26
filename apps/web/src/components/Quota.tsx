import { Button, Screen } from './ui';

/** Shown instead of a room when the server's free daily storage allowance is used up. */
export function QuotaNotice({ title, body, action, onAction, className = '' }: { title: string; body: string; action: string; onAction: () => void; className?: string }) {
  return (
    <Screen className={`items-center justify-center text-center ${className}`}>
      <div className="text-5xl">⏳</div>
      <h1 className="mt-3 text-3xl font-black">{title}</h1>
      <p className="mt-2 max-w-sm text-mist">{body}</p>
      <Button className="mt-6" onClick={onAction}>
        {action}
      </Button>
    </Screen>
  );
}

/** A game still running from the server's memory because saving has stopped for the day. */
export function StorageBanner({ children }: { children: string }) {
  return <div className="mb-3 rounded-2xl bg-sun/15 px-4 py-3 text-sm font-bold text-sun ring-1 ring-sun/30">{children}</div>;
}
