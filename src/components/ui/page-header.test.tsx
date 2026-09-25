import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageHeaderSkeleton } from "./page-header";

/** How many placeholder blocks the markup draws. */
function blocks(markup: string) {
  return markup.match(/animate-pulse/g)?.length ?? 0;
}

describe("PageHeaderSkeleton", () => {
  it("draws just the title when the page has no breadcrumb or description", () => {
    expect(blocks(renderToStaticMarkup(<PageHeaderSkeleton />))).toBe(1);
  });

  it("adds a line for each of the breadcrumb, description and actions the page will show", () => {
    expect(blocks(renderToStaticMarkup(<PageHeaderSkeleton crumbs />))).toBe(2);
    expect(blocks(renderToStaticMarkup(<PageHeaderSkeleton crumbs description />))).toBe(3);
    expect(blocks(renderToStaticMarkup(<PageHeaderSkeleton crumbs description actions />))).toBe(4);
  });
});
