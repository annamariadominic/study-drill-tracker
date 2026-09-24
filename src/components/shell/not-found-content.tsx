import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** What a missing page says and where it offers to go instead. */
export function NotFoundContent() {
  return (
    <div className="w-full max-w-sm">
      <p className="text-xs text-muted">Not found</p>
      <h1 className="mt-1 font-serif text-2xl text-text">There&apos;s nothing here</h1>
      <p className="mt-2 text-sm text-muted">The page may have been renamed or removed, or the link is out of date.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/study" className={buttonVariants()}>
          Go to Study
        </Link>
        <Link href="/domains" className={buttonVariants({ variant: "secondary" })}>
          Open your syllabus
        </Link>
      </div>
    </div>
  );
}
