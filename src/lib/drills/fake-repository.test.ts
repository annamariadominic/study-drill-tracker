import { beforeEach, describe, expect, it } from "vitest";
import { FakeDrillsRepository } from "./fake-repository";

describe("FakeDrillsRepository", () => {
  let repo: FakeDrillsRepository;

  beforeEach(() => {
    repo = new FakeDrillsRepository();
  });

  it("creates and retrieves a due-scoped Drill", async () => {
    const drill = await repo.createDrill({
      domainId: "domain-1",
      scope: "due",
      scopeDetail: { dueAsOf: "2026-01-01T00:00:00.000Z" },
    });

    expect(drill.domainId).toBe("domain-1");
    expect(drill.scope).toBe("due");
    expect(drill.scopeDetail).toEqual({ dueAsOf: "2026-01-01T00:00:00.000Z" });
    expect(await repo.getDrill(drill.id)).toEqual(drill);
  });

  it("defaults scope detail to null", async () => {
    const drill = await repo.createDrill({ domainId: "domain-1", scope: "due" });

    expect(drill.scopeDetail).toBeNull();
  });

  it("returns null for a missing Drill", async () => {
    expect(await repo.getDrill("missing")).toBeNull();
  });
});
