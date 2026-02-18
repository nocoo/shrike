import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { LocaleProvider } from "@/lib/i18n";

/**
 * Custom render that wraps components in required providers (LocaleProvider).
 * Use this instead of `render()` for components that use `useLocale()`.
 */
function renderWithLocale(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return render(ui, {
    wrapper: ({ children }) => <LocaleProvider>{children}</LocaleProvider>,
    ...options,
  });
}

export { renderWithLocale };
