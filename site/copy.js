const copyButtons = document.querySelectorAll("[data-copy-target]");

for (const button of copyButtons) {
  button.addEventListener("click", async () => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    const label = button.textContent;

    try {
      await navigator.clipboard.writeText(target.textContent.trim());
      button.textContent = "Copied";
      button.dataset.state = "copied";
    } catch {
      button.textContent = "Select";
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    window.setTimeout(() => {
      button.textContent = label;
      delete button.dataset.state;
    }, 1600);
  });
}
