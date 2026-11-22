(() => {
  const gallery = document.querySelector(".photography-gallery");
  const lightbox = document.querySelector(".photo-lightbox");
  if (!gallery || !(lightbox instanceof HTMLDialogElement)) return;

  const items = Array.from(gallery.querySelectorAll(".photography-gallery__item"));
  const image = lightbox.querySelector(".photo-lightbox__image");
  const previous = lightbox.querySelector(".photo-lightbox__previous");
  const next = lightbox.querySelector(".photo-lightbox__next");
  const closeButton = lightbox.querySelector(".photo-lightbox__close");
  let activeIndex = 0;
  let closing = false;
  let touchStart = null;
  let returnFocus = null;
  const closeDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;

  if (!items.length) return;

  const showImage = index => {
    activeIndex = (index + items.length) % items.length;
    const source = items[activeIndex].querySelector("img");
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
  };

  const open = index => {
    returnFocus = items[index];
    showImage(index);
    lightbox.showModal();
    requestAnimationFrame(() => lightbox.classList.add("is-visible"));
  };

  const close = () => {
    if (closing) return;
    closing = true;
    lightbox.classList.remove("is-visible");
    lightbox.classList.add("is-closing");
    window.setTimeout(() => {
      lightbox.close();
      lightbox.classList.remove("is-closing");
      closing = false;
    }, closeDuration);
  };

  items.forEach((item, index) => {
    item.addEventListener("click", () => open(index));
  });

  previous.addEventListener("click", () => showImage(activeIndex - 1));
  next.addEventListener("click", () => showImage(activeIndex + 1));
  closeButton.addEventListener("click", close);

  lightbox.addEventListener("cancel", event => {
    event.preventDefault();
    close();
  });
  lightbox.addEventListener("click", event => {
    if (event.target === lightbox) close();
  });
  lightbox.addEventListener("close", () => {
    returnFocus?.focus();
    returnFocus = null;
    image.removeAttribute("src");
  });
  lightbox.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      showImage(activeIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showImage(activeIndex + 1);
    }
  });
  lightbox.addEventListener("pointerdown", event => {
    if (event.pointerType === "touch") touchStart = [event.clientX, event.clientY];
  });
  lightbox.addEventListener("pointerup", event => {
    if (event.pointerType !== "touch" || !touchStart) return;

    const [startX, startY] = touchStart;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    touchStart = null;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    showImage(activeIndex + (deltaX < 0 ? 1 : -1));
  });
  lightbox.addEventListener("pointercancel", () => { touchStart = null; });
})();
