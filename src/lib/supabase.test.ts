import { describe, expect, it } from "vitest";
import { cleanSupabaseUrl } from "./supabase";

describe("cleanSupabaseUrl", () => {
  const app = "https://sebastianpereirarueda-lab.github.io";
  it("accepts a project URL, trimming whitespace and slashes", () => {
    expect(cleanSupabaseUrl("https://zgtsfucgyfibczxnhqud.supabase.co", app)).toBe("https://zgtsfucgyfibczxnhqud.supabase.co");
    expect(cleanSupabaseUrl(" https://zgtsfucgyfibczxnhqud.supabase.co/\r\n", app)).toBe("https://zgtsfucgyfibczxnhqud.supabase.co");
  });
  it("rejects the app's own address, paths, bare refs and plain http", () => {
    expect(cleanSupabaseUrl("https://sebastianpereirarueda-lab.github.io/TradeGrade/\r", app)).toBeNull();
    expect(cleanSupabaseUrl("https://zgtsfucgyfibczxnhqud.supabase.co/rest/v1", app)).toBeNull();
    expect(cleanSupabaseUrl("zgtsfucgyfibczxnhqud", app)).toBeNull();
    expect(cleanSupabaseUrl("http://example.supabase.co", app)).toBeNull();
    expect(cleanSupabaseUrl(undefined, app)).toBeNull();
  });
  it("allows a local Supabase during development", () => {
    expect(cleanSupabaseUrl("http://localhost:54321")).toBe("http://localhost:54321");
  });
});
