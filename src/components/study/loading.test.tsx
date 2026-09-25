import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DrillSkeleton, StudyPageSkeleton } from "./loading";

describe("loading skeletons", () => {
  it.each([
    ["a Study page", <StudyPageSkeleton key="study" />],
    ["a Drill", <DrillSkeleton key="drill" />],
  ])("announce %s as loading to screen readers", (_, skeleton) => {
    const markup = renderToStaticMarkup(skeleton);
    expect(markup).toMatch(/role="status"/);
    expect(markup).toMatch(/<span class="sr-only">Loading…<\/span>/);
  });

  it("keeps a Drill inside its own frame, without the app's navigation", () => {
    const markup = renderToStaticMarkup(<DrillSkeleton />);
    expect(markup).toMatch(/<header/);
    expect(markup).toMatch(/<main/);
  });

  it("leaves the <main> landmark to the app shell on a Study page", () => {
    expect(renderToStaticMarkup(<StudyPageSkeleton />)).not.toMatch(/<main/);
  });
});
