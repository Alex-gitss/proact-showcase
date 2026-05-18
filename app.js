const storageKey = "proact-showcase-theme";
const root = document.documentElement;

function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    return "dark";
  }
  return "dark";
}

function setTheme(theme) {
  root.setAttribute("data-theme", theme);
  const toggle = document.querySelector(".theme-toggle");
  if (toggle) {
    toggle.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
  }
  try {
    window.localStorage.setItem(storageKey, theme);
  } catch {
    // Ignore restricted storage contexts.
  }
}

setTheme(getInitialTheme());

document.querySelector(".theme-toggle")?.addEventListener("click", () => {
  const nextTheme = root.getAttribute("data-theme") === "light" ? "dark" : "light";
  setTheme(nextTheme);
});

const videos = Array.from(document.querySelectorAll("video"));
for (const video of videos) {
  video.addEventListener("play", () => {
    for (const otherVideo of videos) {
      if (otherVideo !== video) {
        otherVideo.pause();
      }
    }
  });
}
