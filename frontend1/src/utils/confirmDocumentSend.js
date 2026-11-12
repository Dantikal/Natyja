export const confirmDocumentSend = () => {
  if (typeof document === "undefined") return Promise.resolve(true);

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "document-send-confirm";
    overlay.innerHTML = `
      <div aria-labelledby="document-send-confirm-title" aria-modal="true" class="document-send-confirm__panel" role="dialog">
        <h2 id="document-send-confirm-title">Документти жөнөтүү</h2>
        <p>Документти жөнөтүүнү каалайсызбы?</p>
        <div class="document-send-confirm__actions">
          <button data-confirm="cancel" type="button">Жок</button>
          <button data-confirm="send" type="button">Ооба, жөнөтүү</button>
        </div>
      </div>`;

    const finish = (confirmed) => {
      document.removeEventListener("keydown", handleKeyDown);
      overlay.remove();
      resolve(confirmed);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") finish(false);
    };

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest('[data-confirm="cancel"]')) {
        finish(false);
      } else if (event.target.closest('[data-confirm="send"]')) {
        finish(true);
      }
    });
    document.addEventListener("keydown", handleKeyDown);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-confirm="send"]')?.focus();
  });
};
