import { describe, expect, it } from "vitest";
import { cleanEnvValue } from "@/lib/env-value";
import { DatabaseConfigError, databaseSettings } from "@/lib/db-url";
import { explainDatabaseError } from "@/lib/db-diagnostics";

describe("cleanEnvValue", () => {
  it.each([
    [undefined, undefined],
    ["", undefined],
    ["   ", undefined],
    ['""', undefined],
    ["value", "value"],
    ["  value  ", "value"],
    ['"Shop <orders@shop.test>"', "Shop <orders@shop.test>"],
    ["'single quoted'", "single quoted"],
    ['"mismatched\'', '"mismatched\''],
    ['say "hi"', 'say "hi"'],
  ])("cleans %j to %j", (input, expected) => {
    expect(cleanEnvValue(input)).toBe(expected);
  });
});

describe("databaseSettings", () => {
  const good = "postgresql://postgres.abcd:secret@aws-0-eu-west-2.pooler.supabase.com:6543/postgres";

  it("accepts a normal connection string, quoted or not", () => {
    expect(databaseSettings(good).url).toBe(good);
    expect(databaseSettings(`"${good}"`).url).toBe(good);
    expect(databaseSettings(`  ${good}\n`).url).toBe(good);
  });

  const reasonFor = (value: string | undefined) => {
    try {
      databaseSettings(value);
      return "accepted";
    } catch (error) {
      return error instanceof DatabaseConfigError ? error.reason : "other error";
    }
  };

  it("calls a missing value missing", () => {
    expect(reasonFor(undefined)).toBe("missing");
    expect(reasonFor("")).toBe("missing");
    expect(reasonFor('""')).toBe("missing");
  });

  it.each([
    ["the variable name pasted too", `DATABASE_URL=${good}`],
    ["a # in the password", "postgresql://postgres.abcd:pa#ss@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"],
    ["a / in the password", "postgresql://postgres.abcd:pa/ss@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"],
    ["a ? in the password", "postgresql://postgres.abcd:pa?ss@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"],
    ["a web address", "https://supabase.com/dashboard/project/abcd"],
    ["half a string", "postgresql://"],
  ])("calls %s invalid", (_label, value) => {
    expect(reasonFor(value)).toBe("invalid");
  });

  it("allows an encoded special character", () => {
    expect(reasonFor("postgresql://postgres.abcd:pa%23ss@aws-0-eu-west-2.pooler.supabase.com:6543/postgres")).toBe("accepted");
  });
});

describe("explainDatabaseError", () => {
  it("tells you to add the variable and redeploy when it's missing", () => {
    const { problem, fix } = explainDatabaseError(new DatabaseConfigError("missing", "x"));
    expect(problem).toBe("DATABASE_URL is not set");
    expect(fix).toContain("trigger a new deploy");
  });

  it("explains an unreadable value", () => {
    expect(explainDatabaseError(new DatabaseConfigError("invalid", "x")).fix).toContain("without quotes");
  });

  const withCode = (code: string, message = "boom") => Object.assign(new Error(message), { code });

  it.each([
    ["ENOTFOUND", "address can't be found"],
    ["ENETUNREACH", "can't be reached"],
    ["CONNECT_TIMEOUT", "timed out"],
    ["ECONNREFUSED", "refused"],
    ["28P01", "username or password"],
    ["3D000", "doesn't exist"],
    ["42P01", "tables don't exist yet"],
    ["53300", "run out of connections"],
  ])("explains %s", (code, phrase) => {
    const diagnosis = explainDatabaseError(withCode(code));
    expect(diagnosis.code).toBe(code);
    expect(diagnosis.problem).toContain(phrase);
  });

  it("points IPv6-only connections at Supabase's pooler", () => {
    expect(explainDatabaseError(withCode("ENETUNREACH")).fix).toContain("Transaction pooler");
  });

  it("recognises Supabase pooler user errors", () => {
    expect(explainDatabaseError(withCode("XX000", "Tenant or user not found")).problem).toContain("doesn't recognise the user");
  });

  it("never repeats the raw error text", () => {
    const secret = "password authentication failed for user postgres.secretref at db.secret.example";
    const diagnosis = explainDatabaseError(withCode("XX999", secret));
    expect(JSON.stringify(diagnosis)).not.toContain("secret");
  });
});
