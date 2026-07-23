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

const docsTabSets = document.querySelectorAll("[data-docs-tabs]");

for (const tabSet of docsTabSets) {
  const tabs = [...tabSet.querySelectorAll(":scope > .docs-tabs > [data-docs-tab]")];
  const panels = [...tabSet.querySelectorAll(":scope > [data-docs-tab-panel]")];
  const storageKey = tabSet.dataset.tabsStorage;
  const values = tabs.map((tab) => tab.dataset.docsTab);
  const storedValue = storageKey ? window.localStorage.getItem(storageKey) : null;
  const selectedTab = tabs.find((tab) => tab.getAttribute("aria-selected") === "true");
  const initialValue = values.includes(storedValue)
    ? storedValue
    : selectedTab?.dataset.docsTab ?? values[0];

  const selectTab = (value) => {
    for (const tab of tabs) {
      const selected = tab.dataset.docsTab === value;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }

    for (const panel of panels) {
      panel.hidden = panel.dataset.docsTabPanel !== value;
    }

    if (storageKey) window.localStorage.setItem(storageKey, value);
  };

  selectTab(initialValue);

  for (const tab of tabs) {
    tab.addEventListener("click", () => selectTab(tab.dataset.docsTab));
    tab.addEventListener("keydown", (event) => {
      const navigationKeys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!navigationKeys.includes(event.key)) return;
      event.preventDefault();

      const currentIndex = tabs.indexOf(tab);
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      const nextTab = tabs[nextIndex];
      selectTab(nextTab.dataset.docsTab);
      nextTab.focus();
    });
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
