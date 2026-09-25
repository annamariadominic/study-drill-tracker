import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PendingLink } from "./pending-link";

describe("PendingLink", () => {
  it("keeps its loading announcement outside the link, so it isn't read as part of the link's name", () => {
    const markup = renderToStaticMarkup(<PendingLink href="/study">Study</PendingLink>);
    expect(markup).toMatch(/<a [^>]*href="\/study"[^>]*>Study<\/a><span role="status" class="sr-only"><\/span>/);
  });

  it("shows its icon where it's asked for while idle", () => {
    const icon = <svg data-icon="" />;
    expect(renderToStaticMarkup(<PendingLink href="/a" icon={icon}>A</PendingLink>)).toMatch(/>A<svg data-icon=""/);
    expect(renderToStaticMarkup(<PendingLink href="/a" icon={icon} iconPosition="start">A</PendingLink>)).toMatch(
      /<svg data-icon=""><\/svg>A</,
    );
  });

  it("isn't marked pending before it's clicked", () => {
    expect(renderToStaticMarkup(<PendingLink href="/a">A</PendingLink>)).not.toMatch(/data-pending/);
  });
});
