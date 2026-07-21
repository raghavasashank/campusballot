import { describe, expect, it } from "vitest";
import { isValidImageDataUrl } from "@/lib/photo";

describe("isValidImageDataUrl", () => {
  it("accepts a well-formed PNG data URL", () => {
    expect(isValidImageDataUrl("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB")).toBe(true);
  });

  it("accepts jpeg, gif, and webp", () => {
    expect(isValidImageDataUrl("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isValidImageDataUrl("data:image/gif;base64,R0lGOD")).toBe(true);
    expect(isValidImageDataUrl("data:image/webp;base64,UklGR")).toBe(true);
  });

  it("rejects a non-image MIME type", () => {
    expect(isValidImageDataUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
  });

  it("rejects a plain string with no data URL prefix", () => {
    expect(isValidImageDataUrl("not-a-data-url-at-all")).toBe(false);
  });

  it("rejects a data URL with non-base64 characters in the payload", () => {
    expect(isValidImageDataUrl("data:image/png;base64,<script>alert(1)</script>")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidImageDataUrl("")).toBe(false);
  });
});
