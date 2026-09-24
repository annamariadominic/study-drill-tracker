import Link from "next/link";

/** The app's name as set in the navigation; it links home to Study. */
export function Wordmark() {
  return (
    <Link href="/study" className="rounded-[2px] font-serif text-lg leading-none tracking-[-0.01em] text-text">
      Study Drill Tracker
    </Link>
  );
}
