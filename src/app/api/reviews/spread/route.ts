import { NextRequest, NextResponse } from "next/server";
import { getSyllabusRepository } from "@/lib/syllabus/get-repository";
import { MAX_REVIEWS_PER_DAY, MIN_REVIEWS_PER_DAY, spreadBacklog } from "@/lib/syllabus/spread-backlog";

function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** Spreads the overdue backlog over the coming days, then returns to the review schedule. */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const perDay = Number(formData.get("perDay"));
  const timeZone = formData.get("timeZone");
  const view = formData.get("view") === "calendar" ? "calendar" : null;

  if (!Number.isInteger(perDay) || perDay < MIN_REVIEWS_PER_DAY || perDay > MAX_REVIEWS_PER_DAY) {
    return NextResponse.json(
      {
        error: `perDay must be a whole number from ${MIN_REVIEWS_PER_DAY} to ${MAX_REVIEWS_PER_DAY}`,
      },
      { status: 400 },
    );
  }
  if (typeof timeZone !== "string" || !isTimeZone(timeZone)) {
    return NextResponse.json({ error: "timeZone must be an IANA time zone" }, { status: 400 });
  }

  const { moves, days } = await spreadBacklog(getSyllabusRepository(), {
    perDay,
    timeZone,
  });

  const params = new URLSearchParams({
    spread: String(moves.length),
    days: String(days),
  });
  if (view) params.set("view", view);
  return NextResponse.redirect(new URL(`/study/schedule?${params}`, request.url), { status: 303 });
}
