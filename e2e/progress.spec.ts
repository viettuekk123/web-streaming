import { expect, test } from "@playwright/test";

test("StrictMode chỉ mở một phiên và lưu tua trước lần Play đầu", async ({
  page,
}) => {
  let starts = 0;
  let currentSession = "";
  let position = 0;
  const statuses: number[] = [];
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: { id: "test-user", username: "student" },
        csrf_token: "test-csrf",
      },
    }),
  );
  await page.route("**/api/videos", (route) =>
    route.fulfill({ json: { items: [], total: 0 } }),
  );
  await page.route("**/api/videos/test-progress", (route) =>
    route.fulfill({
      json: {
        id: "test-progress",
        title: "Tiến độ",
        description: "",
        username: "student",
        duration: 65,
        status: "ready",
        created_at: "2026-10-24T00:00:00Z",
      },
    }),
  );
  const manifest = await page.request
    .get("http://localhost:8000/api/demo/demo/manifest")
    .then((r) => r.json());
  await page.route("**/api/videos/test-progress/manifest", (route) =>
    route.fulfill({ json: manifest }),
  );
  await page.route(
    "**/api/videos/test-progress/progress/session",
    async (route) => {
      starts++;
      // Nếu StrictMode tạo phiên thừa, request đầu chậm sẽ thay quyền ghi của phiên sau.
      if (starts === 1)
        await new Promise((resolve) => setTimeout(resolve, 500));
      currentSession = `session-${starts}`;
      await route.fulfill({
        json: { write_session: currentSession, position_seconds: position },
      });
    },
  );
  await page.route("**/api/videos/test-progress/progress", async (route) => {
    const body = route.request().postDataJSON();
    const status = body.write_session === currentSession ? 200 : 409;
    statuses.push(status);
    if (status === 200) position = body.position_seconds;
    await route.fulfill({ status, json: { ok: status === 200 } });
  });
  await page.goto("/watch/test-progress");
  await page.waitForFunction(
    () => (document.querySelector("video")?.readyState ?? 0) >= 2,
  );
  expect(starts).toBe(1);
  await page.locator("video").evaluate((v) => {
    v.currentTime = 6;
  });
  await expect.poll(() => position).toBe(6);
  await page.reload();
  await page.waitForFunction(
    () => (document.querySelector("video")?.readyState ?? 0) >= 2,
  );
  expect(
    await page.locator("video").evaluate((v) => v.currentTime),
  ).toBeCloseTo(6, 1);
  expect(await page.locator("video").evaluate((v) => v.paused)).toBe(true);
  expect(statuses.every((status) => status === 200)).toBe(true);
  await expect(page.locator(".notice")).toHaveCount(0);
});
