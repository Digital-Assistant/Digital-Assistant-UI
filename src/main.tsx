import {createRoot} from "react-dom/client";
import App from "./App";
import { injectTheme, ThemePayload } from "./utils/ThemeInjector";

// createRoot(document.getElementById("root")!).render(<App />);

/**
 * creating shadow root element for UDAN plugin
 */

const htmlTag = document.querySelector("html");

// create udan custom container and push udan shadow
const udanContainer = document.createElement("udan");

// react mounter
const rootDiv = document.createElement("div");
rootDiv.id = "udan-react-root";
rootDiv.classList.add("uda_exclude");

// const rootShadow = rootDiv.attachShadow({ mode: "open" });
udanContainer.appendChild(rootDiv);

// check if html available
if (htmlTag) {
    htmlTag.appendChild(udanContainer);
}

// attach shadow to the container
export const shadowHost = document.getElementById('udan-react-root');
shadowHost.attachShadow({mode: 'open'});

// adding react application into shadow dom

// Get the shadow root
const shadowRoot = document.getElementById('udan-react-root').shadowRoot;

// Create div element for react to render into
const reactDiv = document.createElement('div');
reactDiv.setAttribute('id', 'udan-react-app-root');

// Append react root to shadow root
shadowRoot.appendChild(reactDiv);

const reactRoot = createRoot(shadowRoot);
reactRoot.render(<App />);

// Listen for config updates — inject custom CSS and apply dark mode into the shadow root
window.addEventListener('UDAConfigUpdated', (e: Event) => {
  const payload = (e as CustomEvent<ThemePayload>).detail;
  if (payload) {
    injectTheme(shadowRoot, payload);
  }
});

// Also respond to OS-level dark mode changes (e.g. user switches system theme)
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const appRoot = shadowRoot.getElementById('udan-react-app-root');
  // Only auto-switch if the widget hasn't been explicitly configured via enableDarkMode
  // i.e. if no UDAConfigUpdated event has set a preference yet, follow the OS
  if (appRoot && !appRoot.dataset.themeManaged) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    appRoot.classList.toggle('dark', prefersDark);
  }
});
  