(() => {
  const gallery = document.querySelector(".photography-gallery");
  const lightbox = document.querySelector(".photo-lightbox");
  if (!gallery || !(lightbox instanceof HTMLDialogElement)) return;

  const items = Array.from(gallery.querySelectorAll(".photography-gallery__item"));
  const image = lightbox.querySelector(".photo-lightbox__image");
  const imageSource = lightbox.querySelector(".photo-lightbox__source");
  const previous = lightbox.querySelector(".photo-lightbox__previous");
  const next = lightbox.querySelector(".photo-lightbox__next");
  const closeButton = lightbox.querySelector(".photo-lightbox__close");
  let activeIndex = 0;
  let closing = false;
  let touchStart = null;
  let returnFocus = null;
  const closeDuration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 220;

  if (!items.length) return;

  const layoutMasonry = () => {
    gallery.classList.remove("photography-gallery--masonry");
    items.forEach(item => {
      item.style.gridColumn = "";
      item.style.gridRow = "";
    });

    const styles = getComputedStyle(gallery);
    const columns = Number(styles.getPropertyValue("--photography-gallery-columns"));
    const rowGap = parseFloat(styles.rowGap);
    const columnGap = parseFloat(styles.columnGap);
    const columnWidth = (gallery.clientWidth - columnGap * (columns - 1)) / columns;
    if (!columns || !columnWidth) return;

    const rowStride = 1 + rowGap;
    const columnHeights = Array(columns).fill(0);
    items.forEach(item => {
      const source = item.querySelector("img");
      const width = Number(source.getAttribute("width"));
      const height = Number(source.getAttribute("height"));
      const itemHeight = columnWidth * height / width;
      const rowSpan = Math.max(1, Math.ceil((itemHeight + rowGap) / rowStride));
      const column = columnHeights.indexOf(Math.min(...columnHeights));

      item.style.gridColumn = String(column + 1);
      item.style.gridRow = `${columnHeights[column] + 1} / span ${rowSpan}`;
      columnHeights[column] += rowSpan;
    });
    gallery.classList.add("photography-gallery--masonry");
  };

  let layoutFrame = 0;
  const scheduleLayout = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      layoutMasonry();
    });
  };

  layoutMasonry();
  window.addEventListener("resize", scheduleLayout, { passive: true });

  const showImage = index => {
    activeIndex = (index + items.length) % items.length;
    const source = items[activeIndex].querySelector("img");
    imageSource.srcset = source.dataset.fullAvifSrcset || "";
    imageSource.sizes = source.dataset.fullSizes || "";
    image.src = source.dataset.fullSrc || source.currentSrc || source.src;
    image.alt = source.alt;
    image.width = Number(source.getAttribute("width")) || 0;
    image.height = Number(source.getAttribute("height")) || 0;
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
    imageSource.removeAttribute("srcset");
    imageSource.removeAttribute("sizes");
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
