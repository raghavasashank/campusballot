import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv-export";

describe("toCsv", () => {
  it("prefixes formula-triggering cells so Excel/Sheets won't execute them", () => {
    const rows = [
      { name: "=HYPERLINK(\"http://evil\")", votes: 1 },
      { name: "+1", votes: 2 },
      { name: "-1", votes: 3 },
      { name: "@SUM(A1)", votes: 4 },
      { name: "Normal Name", votes: 5 },
    ];
    const csv = toCsv(rows, [
      { key: "name", header: "Name" },
      { key: "votes", header: "Votes" },
    ]);

    const lines = csv.split("\r\n");
    expect(lines[1]).toContain("'=HYPERLINK");
    expect(lines[2]).toContain("'+1");
    expect(lines[3]).toContain("'-1");
    expect(lines[4]).toContain("'@SUM(A1)");
    expect(lines[5]).toBe("Normal Name,5");
  });

  it("still quotes cells containing commas after the formula prefix is applied", () => {
    const csv = toCsv([{ name: "=A,B" }], [{ key: "name", header: "Name" }]);

    expect(csv.split("\r\n")[1]).toBe('"\'=A,B"');
  });
});
