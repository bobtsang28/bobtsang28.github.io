document.addEventListener("DOMContentLoaded", function() {
  'use strict';

  var html = document.querySelector('html'),
    menuOpenIcon = document.querySelector(".icon__menu"),
    menuCloseIcon = document.querySelector(".nav__icon-close"),
    menuList = document.querySelector(".main-nav"),
    toggleTheme = document.querySelector(".toggle-theme-js"),
    btnScrollToTop = document.querySelector(".top");

  /* =======================================================
  // Scroll-Responsive Header
  ======================================================= */
  const header = document.querySelector(".header");
  if (header) {
    let lastScrollY = window.scrollY;
    let downwardDistance = 0;
    let upwardDistance = 0;
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const revealHeader = () => header.classList.remove("is-hidden");
    const interactionKeepsHeaderVisible = () => (
      header.contains(document.activeElement) ||
      header.querySelector(".main-nav.is-open") ||
      Boolean(Array.from(header.querySelectorAll(".nav__item.dropdown")).find(item => item.matches(":hover")))
    );

    const handleHeaderScroll = () => {
      const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const currentScrollY = Math.max(0, Math.min(window.scrollY, maxScrollY));
      const delta = currentScrollY - lastScrollY;

      if (currentScrollY <= 2) {
        downwardDistance = 0;
        upwardDistance = 0;
        revealHeader();
      } else if (delta < 0) {
        upwardDistance -= delta;
        if (!coarsePointer.matches || upwardDistance >= 3) {
          downwardDistance = 0;
          revealHeader();
        }
      } else if (delta > 0) {
        upwardDistance = 0;
        downwardDistance += delta;
        if (downwardDistance >= 100 && !interactionKeepsHeaderVisible()) {
          header.classList.add("is-hidden");
        }
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleHeaderScroll, { passive: true });
    header.addEventListener("focusin", revealHeader);
    header.addEventListener("pointerenter", revealHeader);
  }


  /* =======================================================
  // Menu + Theme Switcher
  ======================================================= */
  menuOpenIcon.addEventListener("click", () => {
    menuOpen();
  });

  menuCloseIcon.addEventListener("click", () => {
    menuClose();
  });

  function menuOpen() {
    menuList.classList.add("is-open");
    menuOpenIcon.setAttribute("aria-expanded", "true");
    menuCloseIcon.focus();
  }

  function menuClose() {
    menuList.classList.remove("is-open");
    menuOpenIcon.setAttribute("aria-expanded", "false");
    menuOpenIcon.focus();
  }

  document.querySelectorAll(".nav__item.dropdown").forEach(dropdown => {
    const trigger = dropdown.querySelector(".dropdown-toggle");
    const setOpen = open => {
      dropdown.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
    };
    trigger.addEventListener("click", () => setOpen(!dropdown.classList.contains("is-open")));
    dropdown.addEventListener("pointerenter", event => {
      if (event.pointerType === "mouse") setOpen(true);
    });
    dropdown.addEventListener("pointerleave", event => {
      if (event.pointerType === "mouse" && !dropdown.contains(document.activeElement)) setOpen(false);
    });
    dropdown.addEventListener("focusout", event => {
      if (!dropdown.contains(event.relatedTarget) && !dropdown.matches(":hover")) setOpen(false);
    });
    dropdown.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.focus();
      }
    });
  });
  menuList.addEventListener("keydown", event => {
    if (event.key === "Escape" && menuList.classList.contains("is-open")) menuClose();
  });

  if (toggleTheme) {
    const slider = toggleTheme.closest(".toggle-theme");
    let pointerStart;
    let disableTransition;

    function showPosition(value) {
      slider.style.setProperty("--theme-position", value / 100);
    }

    function setTheme(theme) {
      stopAnimation();
      html.classList.toggle("dark-mode", theme === "dark");
      html.classList.toggle("light-mode", theme === "light");
      html.removeAttribute(theme === "dark" ? "light" : "dark");
      html.setAttribute(theme, "");
      localStorage.setItem("theme", theme);
      toggleTheme.value = theme === "light" ? "100" : "0";
      toggleTheme.setAttribute("aria-valuetext", theme === "light" ? "Light" : "Dark");
      showPosition(Number(toggleTheme.value));
    }

    toggleTheme.value = html.classList.contains("light-mode") ? "100" : "0";
    toggleTheme.setAttribute("aria-valuetext", toggleTheme.value === "100" ? "Light" : "Dark");
    showPosition(Number(toggleTheme.value));

    toggleTheme.addEventListener("pointerdown", event => {
      pointerStart = { x: event.clientX, value: toggleTheme.value };
    });
    toggleTheme.addEventListener("pointermove", event => {
      if (pointerStart && Math.abs(event.clientX - pointerStart.x) >= 4) {
        slider.classList.add("is-dragging");
      }
    });
    toggleTheme.addEventListener("input", () => {
      showPosition(Number(toggleTheme.value));
    });
    toggleTheme.addEventListener("pointerup", event => {
      slider.classList.remove("is-dragging");
      if (pointerStart && Math.abs(event.clientX - pointerStart.x) < 4 &&
          toggleTheme.value === pointerStart.value) {
        setTheme(html.classList.contains("dark-mode") ? "light" : "dark");
      }
      pointerStart = null;
    });
    toggleTheme.addEventListener("pointercancel", () => {
      pointerStart = null;
      slider.classList.remove("is-dragging");
      toggleTheme.value = html.classList.contains("light-mode") ? "100" : "0";
      showPosition(Number(toggleTheme.value));
    });
    toggleTheme.addEventListener("change", () => {
      setTheme(Number(toggleTheme.value) >= 50 ? "light" : "dark");
    });
    toggleTheme.addEventListener("keydown", event => {
      let theme;
      if (event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "End") {
        theme = "light";
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown" || event.key === "Home") {
        theme = "dark";
      } else if (event.key === " " || event.key === "Enter") {
        theme = html.classList.contains("dark-mode") ? "light" : "dark";
      } else {
        return;
      }
      event.preventDefault();
      setTheme(theme);
    });

    window.addEventListener("resize", () => {
      stopAnimation();
    });

    function stopAnimation() {
      document.body.classList.add("disable-animation");
      clearTimeout(disableTransition);
      disableTransition = setTimeout(() => {
        document.body.classList.remove("disable-animation");
      }, 100);
    }
  }


  /* =======================
  // Responsive Videos
  ======================= */
  reframe(".post__content iframe:not(.reframe-off), .page__content iframe:not(.reframe-off), .project-content iframe:not(.reframe-off)");


  /* =======================
  // LazyLoad Images
  ======================= */
  var lazyLoadInstance = new LazyLoad({
    elements_selector: ".lazy"
  })


  /* =======================
  // Zoom Image
  ======================= */
  const lightense = document.querySelector(".page__content img, .post__content img, .project-content img, .gallery__image img"),
  imageLink = document.querySelectorAll(".page__content a img, .post__content a img, .project-content a img, .gallery__image a img");

  if (imageLink) {
    for (var i = 0; i < imageLink.length; i++) imageLink[i].parentNode.classList.add("image-link");
    for (var i = 0; i < imageLink.length; i++) imageLink[i].classList.add("no-lightense");
  }

  if (lightense) {
    Lightense(".page__content img:not(.no-lightense), .post__content img:not(.no-lightense), .project-content img:not(.no-lightense), .gallery__image img:not(.no-lightense)", {
    padding: 60,
    offset: 30
    });
  }


  /* ============================
  // Testimonials Slider
  ============================ */
  if (document.querySelector(".my-slider")) {
    var slider = tns({
      container: ".my-slider",
      items: 3,
      slideBy: 1,
      gutter: 32,
      nav: true,
      mouseDrag: true,
      autoplay: false,
      controls: false,
      speed: 500,
      responsive: {
        1024: {
          items: 3,
        },
        768: {
          items: 2,
        },
        0: {
          items: 1,
        }
      }
    });
  }


  /* =======================
  // Copy Code Button
  ======================= */
  document.querySelectorAll('.post__content pre.highlight, .page__content pre.highlight, .project-content pre.highlight')
  .forEach(function (pre) {
    const button = document.createElement('button');
    const copyText = 'Copy';
    button.type = 'button';
    button.ariaLabel = 'Copy code to clipboard';
    button.innerText = copyText;
    button.addEventListener('click', function () {
      let code = pre.querySelector('code').innerText;
      try {
        code = code.trimEnd();
      } catch (e) {
        code = code.trim();
      }
      navigator.clipboard.writeText(code);
      button.innerText = 'Copied!';
      setTimeout(function () {
        button.blur();
        button.innerText = copyText;
      }, 2e3);
    });
    pre.appendChild(button);
  });


  /* =======================
  // Scroll Top Button
  ======================= */
  btnScrollToTop.addEventListener("click", function () {
    if (window.scrollY != 0) {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth"
      })
    }
  });

});