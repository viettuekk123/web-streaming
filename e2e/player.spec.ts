import { expect, test } from "@playwright/test";

test("phát segment, đổi chất lượng và seek liên tiếp", async ({ page }) => {
  await page.goto("/demo");
  await page.waitForFunction(
    () => (document.querySelector("video")?.readyState ?? 0) >= 2,
  );
  await page.locator("video").evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.waitForFunction(
    () => document.querySelector("video")!.currentTime > 1,
  );
  await page.locator("video").evaluate((v) => {
    v.pause();
    v.currentTime = 46;
  });
  await page.waitForFunction(() => {
    const v = document.querySelector("video")!;
    return v.readyState >= 2 && v.buffered.start(0) > 30;
  });
  await page.locator("select").selectOption("1080p");
  await page.locator("video").evaluate((v) => {
    v.currentTime = 5;
  });
  await page.locator("video").evaluate((v) => {
    v.currentTime = 53;
  });
  await page.waitForFunction(() => {
    const v = document.querySelector("video")!;
    return v.currentTime > 52 && v.readyState >= 2;
  });
  expect(
    await page.locator("video").evaluate((v) => v.error?.message || ""),
  ).toBe("");
  await expect(page.locator("select")).toHaveValue("1080p");
});

test("retry khi segment lỗi tạm thời và kết thúc video", async ({ page }) => {
  let requests = 0;
  await page.route("**/480p/seg-00001.m4s*", async (route) => {
    requests++;
    if (requests === 1) await route.fulfill({ status: 503, body: "temporary" });
    else await route.continue();
  });
  await page.goto("/demo");
  await page.waitForFunction(
    () => (document.querySelector("video")?.readyState ?? 0) >= 2,
  );
  expect(requests).toBe(2);
  await page.locator("video").evaluate((v) => {
    v.muted = true;
    v.currentTime = 63;
    return v.play();
  });
  await page.waitForFunction(() => document.querySelector("video")!.ended);
  expect(
    await page.locator("video").evaluate((v) => v.error?.message || ""),
  ).toBe("");
});

test("video ngắn không audio và nguồn thấp hơn 480p", async ({ page }) => {
  await page.goto("/demo/short");
  await page.waitForFunction(
    () => (document.querySelector("video")?.readyState ?? 0) >= 2,
  );
  await expect(page.locator("select option")).toHaveCount(2); // Auto + 360p
  await page.locator("video").evaluate((v) => {
    v.muted = true;
    return v.play();
  });
  await page.waitForFunction(() => document.querySelector("video")!.ended);
});
