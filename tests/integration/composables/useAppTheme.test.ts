import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { effectScope, nextTick } from "vue";
import { useAppTheme } from "src/composables/useAppTheme";

// Mock Vuetify's useTheme
const mockVuetifyThemeName = { value: "light" };
vi.mock("vuetify", () => ({
  useTheme: () => ({
    global: {
      name: mockVuetifyThemeName,
    },
  }),
}));

describe("useAppTheme", () => {
  let scope: ReturnType<typeof effectScope>;
  let mockMatchMedia: ReturnType<typeof vi.fn>;
  let mediaQueryHandler: ((e: { matches: boolean }) => void) | null;

  beforeEach(() => {
    mockVuetifyThemeName.value = "light";
    mediaQueryHandler = null;

    mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: (_event: string, handler: () => void) => {
        mediaQueryHandler = handler;
      },
      removeEventListener: vi.fn(),
    });

    // Stub window and its properties for Node environment
    vi.stubGlobal("window", {
      matchMedia: mockMatchMedia,
    });

    // Mock document.documentElement.classList
    const classList = {
      toggle: vi.fn(),
    };
    vi.stubGlobal("document", {
      documentElement: { classList },
    });
  });

  afterEach(() => {
    scope?.stop();
    vi.unstubAllGlobals();
  });

  test("initializes with system theme mode by default", () => {
    scope = effectScope();
    scope.run(() => {
      const { themeMode } = useAppTheme();
      expect(themeMode.value).toBe("system");
    });
  });

  test("initializes with provided theme mode", () => {
    scope = effectScope();
    scope.run(() => {
      const { themeMode } = useAppTheme("dark");
      expect(themeMode.value).toBe("dark");
    });
  });

  test("resolvedTheme returns light when system prefers light", () => {
    scope = effectScope();
    scope.run(() => {
      const { resolvedTheme } = useAppTheme();
      expect(resolvedTheme.value).toBe("light");
    });
  });

  test("resolvedTheme returns dark when system prefers dark", () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    scope = effectScope();
    scope.run(() => {
      const { resolvedTheme } = useAppTheme();
      expect(resolvedTheme.value).toBe("dark");
    });
  });

  test("resolvedTheme returns explicit mode when not system", () => {
    scope = effectScope();
    scope.run(() => {
      const { resolvedTheme } = useAppTheme("dark");
      expect(resolvedTheme.value).toBe("dark");
    });
  });

  test("resolvedTheme returns light for explicit light mode", () => {
    // Even if system prefers dark, explicit light mode wins
    mockMatchMedia.mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    scope = effectScope();
    scope.run(() => {
      const { resolvedTheme } = useAppTheme("light");
      expect(resolvedTheme.value).toBe("light");
    });
  });

  test("changing themeMode updates resolvedTheme", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const { themeMode, resolvedTheme } = useAppTheme();
      expect(resolvedTheme.value).toBe("light");

      themeMode.value = "dark";
      await nextTick();
      expect(resolvedTheme.value).toBe("dark");

      themeMode.value = "light";
      await nextTick();
      expect(resolvedTheme.value).toBe("light");
    });
  });

  test("applyTheme updates Vuetify theme and document class", () => {
    scope = effectScope();
    scope.run(() => {
      const { applyTheme } = useAppTheme();

      applyTheme("dark");
      expect(mockVuetifyThemeName.value).toBe("dark");
      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        true,
      );

      applyTheme("light");
      expect(mockVuetifyThemeName.value).toBe("light");
      expect(document.documentElement.classList.toggle).toHaveBeenCalledWith(
        "dark",
        false,
      );
    });
  });

  test("responds to system dark mode changes", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const { resolvedTheme } = useAppTheme();
      expect(resolvedTheme.value).toBe("light");

      // Simulate system dark mode change
      mediaQueryHandler?.({ matches: true } as MediaQueryListEvent);
      await nextTick();
      expect(resolvedTheme.value).toBe("dark");

      // Simulate system light mode change
      mediaQueryHandler?.({ matches: false } as MediaQueryListEvent);
      await nextTick();
      expect(resolvedTheme.value).toBe("light");
    });
  });

  test("system changes do not affect explicit theme mode", async () => {
    scope = effectScope();
    await scope.run(async () => {
      const { resolvedTheme } = useAppTheme("light");
      expect(resolvedTheme.value).toBe("light");

      // System changes shouldn't affect explicit mode
      mediaQueryHandler?.({ matches: true } as MediaQueryListEvent);
      await nextTick();
      expect(resolvedTheme.value).toBe("light");
    });
  });

  test("listens to prefers-color-scheme media query", () => {
    scope = effectScope();
    scope.run(() => {
      useAppTheme();
      expect(mockMatchMedia).toHaveBeenCalledWith(
        "(prefers-color-scheme: dark)",
      );
    });
  });
});
