import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CocHttpError, getCurrentWar } from "../lib/coc/client";

describe("coc client", () => {
  beforeEach(() => {
    process.env.COC_API_TOKEN = "test-token";
    process.env.COC_BASE_URL = "https://proxy.test/v1";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("encodes the clan tag, sends the bearer token, and parses JSON", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ state: "notInWar" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await getCurrentWar("#2RV22C9L9");
    expect(res).toEqual({ state: "notInWar" });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://proxy.test/v1/clans/%232RV22C9L9/currentwar");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-token" });
  });

  it("throws CocHttpError with status on non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));
    await expect(getCurrentWar("#X")).rejects.toMatchObject({ status: 403 });
    await expect(getCurrentWar("#X")).rejects.toBeInstanceOf(CocHttpError);
  });

  it("throws when the token is missing", async () => {
    delete process.env.COC_API_TOKEN;
    await expect(getCurrentWar("#X")).rejects.toThrow(/COC_API_TOKEN/);
  });
});
