import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Study Drill Tracker",
    short_name: "Study Drills",
    description: "Personal spaced-repetition study tracker.",
    start_url: "/",
    display: "standalone",
    background_color: "#12181d",
    theme_color: "#12181d",
    icons: [
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
