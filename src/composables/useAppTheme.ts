import { ref, computed, getCurrentInstance, onBeforeUnmount } from "vue";
import { useTheme as useVuetifyTheme } from "vuetify";
import { ThemeMode } from "../optionsStore";

export function useAppTheme(initialThemeMode: ThemeMode = "system") {
  const vuetifyTheme = useVuetifyTheme();
  const themeMode = ref<ThemeMode>(initialThemeMode);
  const systemPrefersDark = ref(false);

  const resolvedTheme = computed<"light" | "dark">(() => {
    if (themeMode.value === "system") {
      return systemPrefersDark.value ? "dark" : "light";
    }
    return themeMode.value;
  });

  function applyTheme(theme: "light" | "dark") {
    vuetifyTheme.global.name.value = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }

  // Set up system dark mode listener
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  systemPrefersDark.value = mediaQuery.matches;
  const handler = (e: MediaQueryListEvent) => {
    systemPrefersDark.value = e.matches;
  };
  mediaQuery.addEventListener("change", handler);
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      mediaQuery.removeEventListener("change", handler);
    });
  }

  return {
    themeMode,
    resolvedTheme,
    applyTheme,
  };
}
