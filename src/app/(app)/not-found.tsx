import { NotFoundContent } from "@/components/shell/not-found-content";

/**
 * A page inside the app shell that called notFound(), e.g. an unknown Domain.
 * The shell already provides the <main> landmark, so this doesn't add another.
 */
export default function AppNotFound() {
  return (
    <div className="py-12 sm:py-20">
      <NotFoundContent />
    </div>
  );
}
