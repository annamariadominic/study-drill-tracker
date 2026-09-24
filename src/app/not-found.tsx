import { NotFoundContent } from "@/components/shell/not-found-content";

/** A URL that matches no route: rendered on its own, without the app shell. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <NotFoundContent />
    </main>
  );
}
