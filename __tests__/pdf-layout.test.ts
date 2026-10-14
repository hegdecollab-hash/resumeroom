import { describe, expect, it } from "vitest";
import { itemsToText } from "@/lib/pdf/extract";

const item = (str: string, x: number, y: number, width = 80) => ({
  str,
  transform: [10, 0, 0, 10, x, y],
  width,
  height: 10,
});

describe("itemsToText", () => {
  it("joins items on the same line in x order", () => {
    expect(itemsToText([item("World", 100, 700), item("Hello", 10, 700)], 600)).toBe("Hello World");
  });

  it("reads a two-column layout left column first", () => {
    const items = [];
    for (let i = 0; i < 12; i++) {
      items.push(item(`L${i}`, 40, 700 - i * 14, 150));
      items.push(item(`R${i}`, 360, 700 - i * 14, 150));
    }
    const text = itemsToText(items, 600);
    expect(text.indexOf("L11")).toBeLessThan(text.indexOf("R0"));
  });

  it("returns empty text for image-only pages", () => {
    expect(itemsToText([], 600)).toBe("");
  });
});
