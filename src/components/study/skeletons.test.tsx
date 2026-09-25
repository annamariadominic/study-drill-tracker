import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DrillSkeleton, QuestionPageSkeleton, StudyPageSkeleton } from "./skeletons";

describe("loading skeletons", () => {
  it.each([
    ["a Study page", <StudyPageSkeleton key="study" header={{ crumbs: true }} />],
    ["a single question", <QuestionPageSkeleton key="question" />],
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
    expect(renderToStaticMarkup(<StudyPageSkeleton header={{}} />)).not.toMatch(/<main/);
  });
});
