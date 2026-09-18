export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={{ maxWidth: 320, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>Study Drill Tracker</h1>
      <form
        method="post"
        action="/api/login"
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
      >
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoFocus />
        <button type="submit">Enter</button>
        {error ? <p role="alert">Incorrect password.</p> : null}
      </form>
    </main>
  );
}
