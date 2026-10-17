"use client";

/** `fileName` becomes the document title while printing, which browsers use as the saved PDF name. */
export function PrintButton({ children = "Print", fileName }: { children?: React.ReactNode; fileName?: string }) {
  function print() {
    if (!fileName) return window.print();
    const previous = document.title;
    document.title = fileName;
    window.addEventListener("afterprint", () => (document.title = previous), { once: true });
    window.print();
  }

  return (
    <button type="button" className="btn btn-primary" onClick={print}>
      {children}
    </button>
  );
}
