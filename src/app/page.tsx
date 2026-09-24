import { redirect } from "next/navigation";

/** Study is where each day starts. */
export default function Home() {
  redirect("/study");
}
