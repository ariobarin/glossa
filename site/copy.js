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
