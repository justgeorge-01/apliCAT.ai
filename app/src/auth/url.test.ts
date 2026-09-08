import { describe, expect, it } from "vitest"

import { cleanAuthUrl, inviteUrl, normalizeJoinCode, parseAuthUrl, redirectUrl } from "./url"

describe("join parser", () => {
  it("normalizes codes and rejects garbage", () => {
    expect(normalizeJoinCode(" demo-7f3k ")).toBe("DEMO-7F3K")
    expect(normalizeJoinCode("ab")).toBeNull()
    expect(normalizeJoinCode("-BAD")).toBeNull()
    expect(normalizeJoinCode("has space")).toBeNull()
    expect(normalizeJoinCode(null)).toBeNull()
  })

  it("parseAuthUrl reads join / confirm / tokens / errors", () => {
    expect(parseAuthUrl("?join=demo-7f3k&partner=demo", "")).toMatchObject({ join: "DEMO-7F3K", confirmDelete: false, hasAuthParams: false, error: null })
    expect(parseAuthUrl("?confirm=delete", "#access_token=a&refresh_token=b&type=magiclink")).toMatchObject({ confirmDelete: true, hasAuthParams: true })
    expect(parseAuthUrl("?code=abc", "")).toMatchObject({ hasAuthParams: true })
    expect(parseAuthUrl("", "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired").error).toBe(
      "Email link is invalid or has expired",
    )
    expect(parseAuthUrl("?confirm=other", "")).toMatchObject({ confirmDelete: false })
  })
})

describe("url cleaning", () => {
  it("strips auth / join / confirm and keeps ?partner=", () => {
    expect(cleanAuthUrl("https://x.test/app/?partner=demo&join=ABC-1234&confirm=delete#access_token=1&refresh_token=2&expires_in=3&token_type=bearer&type=magiclink")).toBe(
      "https://x.test/app/?partner=demo",
    )
    expect(cleanAuthUrl("https://x.test/?code=xyz&error=e&error_description=d")).toBe("https://x.test/")
    expect(cleanAuthUrl("https://x.test/#section")).toBe("https://x.test/#section")
    expect(cleanAuthUrl("not a url")).toBe("not a url")
  })

  it("redirectUrl / inviteUrl", () => {
    expect(redirectUrl("http://localhost:5190/?join=ABC-1234#access_token=1")).toBe("http://localhost:5190/")
    expect(redirectUrl("http://localhost:5190/?partner=demo", true)).toBe("http://localhost:5190/?partner=demo&confirm=delete")
    expect(inviteUrl("https://o.github.io/abitura-china/?partner=x#h", "DEMO-7F3K")).toBe("https://o.github.io/abitura-china/?join=DEMO-7F3K")
  })
})
