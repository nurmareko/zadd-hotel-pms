"use client";

export function focusFirstFormError(formElement: HTMLFormElement | null) {
  if (!formElement) {
    return;
  }

  window.requestAnimationFrame(() => {
    const invalidField = formElement.querySelector<HTMLElement>(
      '[aria-invalid="true"]:not([type="hidden"])',
    );

    if (invalidField) {
      invalidField.scrollIntoView({ behavior: "smooth", block: "center" });
      invalidField.focus({ preventScroll: true });
      return;
    }

    formElement
      .querySelector<HTMLElement>('[data-slot="form-message"]')
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
