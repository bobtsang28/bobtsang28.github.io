(() => {
  const content = document.querySelector(".journal-content");
  const container = document.getElementById("toc-compact");
  const trigger = document.getElementById("toc-toggle");
  const panel = document.getElementById("toc-dropdown");
  const list = document.getElementById("toc-list");
  if (!content || !container || !trigger || !panel || !list) return;

  const headings = Array.from(content.querySelectorAll("h2, h3"));
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pinned = false;
  let openTimer;
  let closeTimer;
  let activeIndex = -1;
  let restoringFocus = false;

  const setOpen = open => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    panel.hidden = !open;
    panel.classList.toggle("is-open", open);
    container.classList.toggle("is-open", open);
    trigger.classList.toggle("is-active", open);
    trigger.setAttribute("aria-expanded", String(open));
  };

  if (!headings.length) container.hidden = true;
  const usedIds = new Set();
  const links = headings.map((heading, index) => {
    let id = heading.id || `chapter-${index + 1}`;
    const base = id;
    let suffix = 2;
    while (usedIds.has(id)) id = `${base}-${suffix++}`;
    usedIds.add(id);
    heading.id = id;

    const legacyId = `heading-${index}`;
    if (legacyId !== id && !document.getElementById(legacyId)) {
      const alias = document.createElement("span");
      alias.id = legacyId;
      heading.prepend(alias);
    }

    const item = document.createElement("li");
    if (heading.tagName === "H3") item.className = "toc-subheading";
    const link = document.createElement("a");
    link.className = "toc-link";
    link.href = `#${encodeURIComponent(id)}`;
    link.textContent = heading.textContent.trim();
    item.append(link);
    list.append(item);

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "journal-section-link";
    copy.setAttribute("aria-label", `Copy link to ${heading.textContent.trim()}`);
    copy.textContent = "↗";
    copy.addEventListener("click", async () => {
      const url = new URL(window.location.href);
      url.hash = id;
      await copyLink(url.href, copy);
    });
    heading.append(copy);
    return link;
  });

  const activate = index => {
    if (index === activeIndex || index < 0 || index >= links.length) return;
    if (activeIndex >= 0) links[activeIndex].removeAttribute("aria-current");
    activeIndex = index;
    links[index].setAttribute("aria-current", "location");
  };

  const updateActive = () => {
    let current = 0;
    const boundary = Math.max(160, window.innerHeight * .25);
    headings.forEach((heading, index) => {
      if (heading.getBoundingClientRect().top <= boundary) current = index;
    });
    if (headings.length) activate(current);
  };

  container.addEventListener("pointerenter", event => {
    if (!finePointer.matches || event.pointerType === "touch") return;
    clearTimeout(closeTimer);
    openTimer = setTimeout(() => setOpen(true), 140);
  });
  container.addEventListener("pointerleave", event => {
    if (!finePointer.matches || event.pointerType === "touch" || pinned) return;
    clearTimeout(openTimer);
    closeTimer = setTimeout(() => {
      if (!container.contains(document.activeElement)) setOpen(false);
    }, 300);
  });
  container.addEventListener("focusin", () => {
    if (!restoringFocus) setOpen(true);
  });
  container.addEventListener("focusout", () => {
    setTimeout(() => {
      if (!pinned && !container.contains(document.activeElement) &&
          !(finePointer.matches && container.matches(":hover"))) setOpen(false);
    }, 0);
  });
  trigger.addEventListener("click", () => {
    pinned = !pinned;
    setOpen(pinned);
  });
  document.addEventListener("click", event => {
    if (!container.contains(event.target) && !panel.hidden) {
      pinned = false;
      setOpen(false);
    }
  });
  container.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) {
      event.preventDefault();
      pinned = false;
      setOpen(false);
      restoringFocus = true;
      trigger.focus();
      restoringFocus = false;
    }
  });
  links.forEach((link, index) => {
    link.addEventListener("click", event => {
      event.preventDefault();
      history.pushState(null, "", link.getAttribute("href"));
      headings[index].scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start"
      });
      activate(index);
      if (event.pointerType === "touch" || !finePointer.matches || !pinned) {
        pinned = false;
        setOpen(false);
        restoringFocus = true;
        trigger.focus({ preventScroll: true });
        restoringFocus = false;
      }
    });
  });

  async function copyLink(url, control) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const field = document.createElement("textarea");
        field.value = url;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.append(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Copy command failed");
      }
      const status = control.closest(".journal-share")?.querySelector(".journal-share__status");
      if (status) status.textContent = "Link copied";
      else {
        const label = control.getAttribute("aria-label");
        const text = control.textContent;
        control.setAttribute("aria-label", "Section link copied");
        control.textContent = "✓";
        setTimeout(() => {
          control.setAttribute("aria-label", label);
          control.textContent = text;
        }, 2000);
      }
    } catch (error) {
      const status = control.closest(".journal-share")?.querySelector(".journal-share__status");
      if (status) status.textContent = "Could not copy link";
      else control.setAttribute("aria-label", "Could not copy section link");
      console.error("Could not copy link", error);
    }
  }

  const articleUrl = `${location.origin}${location.pathname}`;
  document.querySelectorAll(".journal-share").forEach(group => {
    const native = group.querySelector(".journal-share__native");
    const copy = group.querySelector(".journal-share__copy");
    const email = group.querySelector(".journal-share__email");
    copy.addEventListener("click", () => copyLink(articleUrl, copy));
    if (navigator.share) {
      native.hidden = false;
      if (email) email.hidden = true;
      native.addEventListener("click", async () => {
        try {
          await navigator.share({ title: document.title, url: articleUrl });
        } catch (error) {
          if (error.name !== "AbortError") await copyLink(articleUrl, copy);
        }
      });
    }
  });

  const progress = document.querySelector(".journal-progress");
  const bar = progress?.querySelector(".journal-progress__bar");
  const header = document.querySelector(".header");
  let frame = 0;
  const updateProgress = () => {
    frame = 0;
    const rect = content.getBoundingClientRect();
    const headerHeight = header?.offsetHeight || 0;
    const start = scrollY + rect.top - headerHeight;
    const end = scrollY + rect.bottom - innerHeight;
    const value = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
    updateActive();
    if (bar) bar.style.transform = `scaleX(${value})`;
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(updateProgress);
  };
  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", schedule, { passive: true });
  schedule();

  const dialog = document.querySelector(".journal-lightbox");
  const enlarged = dialog?.querySelector(".journal-lightbox__image");
  const close = dialog?.querySelector(".journal-lightbox__close");
  if (dialog instanceof HTMLDialogElement && enlarged && close) {
    let returnFocus;
    content.querySelectorAll("img[data-blog-full]").forEach(image => {
      if (image.closest("a, button")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "journal-image-button";
      button.setAttribute("aria-label", image.alt ? `Enlarge photograph: ${image.alt}` : "Enlarge photograph");
      image.replaceWith(button);
      button.append(image);
      button.addEventListener("click", () => {
        returnFocus = button;
        enlarged.src = image.dataset.blogFull;
        enlarged.alt = image.alt;
        dialog.showModal();
        requestAnimationFrame(() => dialog.classList.add("is-visible"));
        close.focus();
      });
    });
    const closeDialog = () => {
      dialog.classList.remove("is-visible");
      dialog.close();
    };
    close.addEventListener("click", closeDialog);
    dialog.addEventListener("cancel", event => {
      event.preventDefault();
      closeDialog();
    });
    dialog.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
      }
    });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", () => {
      enlarged.removeAttribute("src");
      returnFocus?.focus({ preventScroll: true });
    });
  }
})();
