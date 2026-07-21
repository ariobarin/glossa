const copyButtons = document.querySelectorAll("[data-copy-target]");

for (const button of copyButtons) {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    const label = button.getAttribute("aria-label");
    const tooltip = button.querySelector(".copy-tooltip");

    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      button.dataset.state = "copied";
      button.setAttribute("aria-label", "Copied");
      tooltip.textContent = "Copied";
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection.removeAllRanges();
      selection.addRange(range);
      button.setAttribute("aria-label", "Code selected");
      tooltip.textContent = "Selected";
    }

    window.setTimeout(() => {
      button.setAttribute("aria-label", label);
      tooltip.textContent = "Copy";
      delete button.dataset.state;
    }, 1600);
  });
}

const copyPageButton = document.querySelector("[data-copy-page]");

if (copyPageButton) {
  copyPageButton.addEventListener("click", async () => {
    const originalLabel = copyPageButton.textContent;
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyPageButton.textContent = "Copied";
    } catch {
      copyPageButton.textContent = "Copy failed";
    }

    window.setTimeout(() => {
      copyPageButton.textContent = originalLabel;
    }, 1600);
  });
}

const audienceSwitchers = document.querySelectorAll("[data-audience-switcher]");

if (audienceSwitchers.length > 0) {
  const queryAudience = new URLSearchParams(window.location.search).get("audience");
  const storedAudience = window.localStorage.getItem("glossa-doc-audience");
  const initialAudience = ["personal", "workspace"].includes(queryAudience)
    ? queryAudience
    : ["personal", "workspace"].includes(storedAudience)
      ? storedAudience
      : "personal";

  const selectAudience = (audience, updateUrl = true) => {
    for (const switcher of audienceSwitchers) {
      for (const tab of switcher.querySelectorAll("[data-audience-tab]")) {
        const selected = tab.dataset.audienceTab === audience;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      }

      for (const panel of switcher.querySelectorAll("[data-audience-panel]")) {
        panel.hidden = panel.dataset.audiencePanel !== audience;
      }
    }

    window.localStorage.setItem("glossa-doc-audience", audience);
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set("audience", audience);
      window.history.replaceState({}, "", url);
    }
  };

  selectAudience(initialAudience, false);

  for (const switcher of audienceSwitchers) {
    const tabs = [...switcher.querySelectorAll("[data-audience-tab]")];
    for (const tab of tabs) {
      tab.addEventListener("click", () => selectAudience(tab.dataset.audienceTab));
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (tabs.indexOf(tab) + direction + tabs.length) % tabs.length;
        const nextTab = tabs[nextIndex];
        selectAudience(nextTab.dataset.audienceTab);
        nextTab.focus();
      });
    }
  }
}

const sectionLinks = [...document.querySelectorAll(".docs-toc a[href^='#']")];
const sectionHeadings = sectionLinks
  .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
  .filter(Boolean);

if (sectionLinks.length > 0 && sectionHeadings.length > 0) {
  let scrollTicking = false;
  const updateActiveSection = () => {
    const threshold = 140;
    let activeHeading = sectionHeadings[0];
    for (const heading of sectionHeadings) {
      if (heading.getBoundingClientRect().top <= threshold) activeHeading = heading;
    }

    for (const link of sectionLinks) {
      const active = decodeURIComponent(link.hash.slice(1)) === activeHeading.id;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    scrollTicking = false;
  };

  window.addEventListener("scroll", () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateActiveSection);
  }, { passive: true });
  updateActiveSection();
}
