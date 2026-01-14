import { describe, expect, it } from "vitest";

import { tokenize } from "./json";

describe("tokenize", () => {
  it("labels keys, strings, numbers and literals without losing text", () => {
    const json = JSON.stringify({ id: 'a"b', n: -1.5e3, ok: true, none: null, list: ["x:y"] }, null, 2);
    const tokens = tokenize(json);
    expect(tokens.map((t) => t.text).join("")).toBe(json);
    const kinds = (kind: string) => tokens.filter((t) => t.kind === kind).map((t) => t.text);
    expect(kinds("key")).toEqual(['"id"', '"n"', '"ok"', '"none"', '"list"']);
    expect(kinds("string")).toEqual(['"a\\"b"', '"x:y"']);
    expect(kinds("number")).toEqual(["-1500"]);
    expect(kinds("literal")).toEqual(["true", "null"]);
  });
});
