const dialog = document.querySelector("#why-glossa");
const openButton = document.querySelector("[data-open-why]");

openButton.addEventListener("click", () => dialog.showModal());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
