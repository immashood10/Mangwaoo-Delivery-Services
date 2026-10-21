export default function Loader({ fullScreen = true }: { fullScreen?: boolean }) {
  return (
    <div
      className={
        fullScreen
          ? 'flex min-h-[60vh] w-full items-center justify-center'
          : 'flex w-full items-center justify-center py-10'
      }
      role="status"
      aria-label="Loading"
    >
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-accent/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-brand-red-primary" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
