import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { addAttachment, attachmentDates, countAttachments, deleteAttachment, kindOf, listAttachments } from "./media";

describe("media store", () => {
  it("adds, lists by day, and deletes attachments", async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" });
    const wav = new Blob([new Uint8Array([82, 73, 70, 70])], { type: "audio/wav" });
    const a = await addAttachment("2026-10-01", png, "entry.png");
    await addAttachment("2026-10-01", wav, "note.wav");
    await addAttachment("2026-10-02", png, "other.png");

    const day = await listAttachments("2026-10-01");
    expect(day.map((x) => x.name)).toEqual(["entry.png", "note.wav"]);
    expect(day[0].blob.size).toBe(4);
    expect(await countAttachments()).toBe(3);
    expect([...(await attachmentDates())].sort()).toEqual(["2026-10-01", "2026-10-02"]);

    await deleteAttachment(a.id);
    expect((await listAttachments("2026-10-01")).map((x) => x.name)).toEqual(["note.wav"]);
    expect([...(await attachmentDates())].sort()).toEqual(["2026-10-01", "2026-10-02"]);
  });

  it("classifies MIME types", () => {
    expect(kindOf("image/png")).toBe("image");
    expect(kindOf("video/mp4")).toBe("video");
    expect(kindOf("audio/webm")).toBe("audio");
    expect(kindOf("application/pdf")).toBe("other");
  });
});
