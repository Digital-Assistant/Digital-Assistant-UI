const STYLE_TAG_ID = 'uda-custom-theme';

export interface ThemePayload {
  enableCustomCSS: boolean;
  customCSS?: string;
  customTheme?: Record<string, string>;
  enableDarkMode: boolean;
}

/**
 * Determines if the value is a URL (absolute or relative) rather than an inline CSS string.
 * - Absolute: starts with http:// or https://
 * - Relative: starts with ./, ../, or / and ends with .css (optionally with query string)
 * A raw CSS string always contains '{' so we use that as the negative discriminator.
 */
function isCSSUrl(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.includes('{')) return false; // definitely inline CSS
  return /^https?:\/\//i.test(trimmed) || /^(\.\/|\.\.\/|\/).*\.css(\?.*)?$/i.test(trimmed);
}

/**
 * Fetches CSS content from a URL.
 * Relative paths resolve against the host page origin.
 * Cross-origin URLs require the remote server to allow CORS (Access-Control-Allow-Origin).
 */
async function fetchCSS(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`[UDA] Failed to fetch custom CSS from: ${url} (HTTP ${response.status})`);
      return '';
    }
    return response.text();
  } catch (err) {
    console.warn(
      `[UDA] Could not load custom CSS from: ${url}. ` +
      `If this is a cross-origin URL, ensure the server sends "Access-Control-Allow-Origin: *".`,
      err
    );
    return '';
  }
}

/**
 * Builds the final CSS string from customTheme map and/or customCSS (string or URL).
 */
async function buildCSS(payload: ThemePayload): Promise<string> {
  const parts: string[] = [];

  // Convert customTheme map into :host { } CSS variable block
  if (payload.customTheme && Object.keys(payload.customTheme).length > 0) {
    const vars = Object.entries(payload.customTheme)
      .map(([key, value]) => `  ${key}: ${value};`)
      .join('\n');
    parts.push(`:host {\n${vars}\n}`);
  }

  // Handle customCSS — either a URL or a raw CSS string
  if (payload.customCSS) {
    if (isCSSUrl(payload.customCSS)) {
      const fetched = await fetchCSS(payload.customCSS);
      if (fetched) parts.push(fetched);
    } else {
      parts.push(payload.customCSS);
    }
  }

  return parts.join('\n\n');
}

/**
 * Applies or removes the .dark class on the widget root element inside the shadow root.
 * Tailwind's dark: variants activate when .dark is present on an ancestor.
 * Since we're inside a shadow DOM, the class must be set on an element within it.
 */
function applyDarkMode(shadowRoot: ShadowRoot, enable: boolean): void {
  const root = shadowRoot.getElementById('udan-react-app-root');
  if (!root) return;
  root.classList.toggle('dark', enable);
  // Mark as explicitly managed so OS-level auto-switching is suppressed
  root.dataset.themeManaged = 'true';
}

/**
 * Injects or updates the custom theme <style> tag inside the shadow root.
 * Does nothing if enableCustomCSS is false.
 */
export async function injectTheme(shadowRoot: ShadowRoot, payload: ThemePayload): Promise<void> {
  // Always apply dark mode regardless of enableCustomCSS flag
  applyDarkMode(shadowRoot, payload.enableDarkMode);
  if (!payload.enableCustomCSS) return;

  const css = await buildCSS(payload);
  if (!css.trim()) return;

  // Reuse existing tag if present (supports dynamic updates)
  let styleTag = shadowRoot.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement('style');
    styleTag.id = STYLE_TAG_ID;
    shadowRoot.appendChild(styleTag);
  }

  styleTag.textContent = css;
}

/**
 * Removes the injected custom theme style tag from the shadow root.
 */
export function removeTheme(shadowRoot: ShadowRoot): void {
  const styleTag = shadowRoot.getElementById(STYLE_TAG_ID);
  if (styleTag) styleTag.remove();
}
