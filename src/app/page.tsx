import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Study Drill Tracker</h1>
      <p>
        <Link href="/domains">Manage your syllabus</Link>
      </p>
      <p>
        <Link href="/study">Study</Link>
      </p>
    </main>
  );
}
