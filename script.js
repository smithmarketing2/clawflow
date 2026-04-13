// script.js
/**
 * Initialize ClawFlow page scripts
 */

/**
 * Smoothly scrolls to an element by ID over a specified duration.
 * Respects reduced-motion preferences.
 * @param {string} targetId - The ID of the target element.
 * @param {number} duration - Duration of the scroll animation in ms.
 * @returns {Promise<void>}
 */
function smoothScroll(targetId, duration = 600) {
  const targetEl = document.getElementById(targetId);
  if (!targetEl) {
    console.warn(`smoothScroll: target element #${targetId} not found`);
    return Promise.resolve();
  }
  const targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset;
  // Respect reduced-motion preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, targetPosition);
    return Promise.resolve();
  }
  const startPosition = window.pageYOffset;
  const distance = targetPosition - startPosition;
  let startTime = null;
  return new Promise(resolve => {
    function animation(currentTime) {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const run = ease(timeElapsed, startPosition, distance, duration);
      window.scrollTo(0, run);
      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      } else {
        resolve();
      }
    }
    function ease(t, b, c, d) {
      t /= d / 2;
      if (t < 1) return c / 2 * t * t + b;
      t--;
      return -c / 2 * (t * (t - 2) - 1) + b;
    }
    requestAnimationFrame(animation);
  });
}

/**
 * Throttles a function to run at most once every wait milliseconds.
 * @param {Function} func
 * @param {number} wait
 * @returns {Function}
 */
function throttle(func, wait) {
  let timeout = null;
  return function() {
    if (!timeout) {
      func.apply(this, arguments);
      timeout = setTimeout(() => {
        timeout = null;
      }, wait);
    }
  };
}

/**
 * Binds click handlers for smooth page navigation on elements marked with data-action="scroll".
 * Also validates supported data-action values and emits CTA click events.
 */
function initSmoothScrolling() {
  const scrollLinks = document.querySelectorAll('[data-action="scroll"]');
  if (!scrollLinks.length) {
    console.warn('initSmoothScrolling: no scroll links found');
    return;
  }
  scrollLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetSection = link.getAttribute('data-scroll-target');
      const durationAttr = link.getAttribute('data-scroll-duration');
      const parsedDuration = durationAttr ? parseInt(durationAttr, 10) : NaN;
      const duration = !isNaN(parsedDuration) ? parsedDuration : undefined;
      document.dispatchEvent(new CustomEvent('scroll:clicked', {
        detail: { targetSection }
      }));
      const isCTA = link.closest('[data-component="hero"], [data-component="cta"]');
      if (isCTA) {
        document.dispatchEvent(new CustomEvent('cta:clicked', {
          detail: { targetSection }
        }));
      }
      smoothScroll(targetSection, duration).then(() => {
        const targetEl = document.getElementById(targetSection);
        if (targetEl) {
          targetEl.setAttribute('tabindex', '-1');
          targetEl.focus();
        }
        link.blur();
      });
    });
  });
  const validActions = ['scroll', 'launch', 'submit'];
  document.querySelectorAll('[data-action]').forEach(el => {
    const action = el.getAttribute('data-action');
    if (!validActions.includes(action)) {
      console.warn(`initSmoothScrolling: unsupported data-action "${action}" on element`, el);
    }
  });
}

/**
 * Sets up IntersectionObserver to reveal sections when they enter the viewport.
 * Emits "section:entered" when a section crosses 50% visibility.
 * Adds staggered reveals for child elements for a smoother experience.
 */
function initScrollReveal() {
  const components = ['hero', 'features', 'commands', 'demo', 'cta'];
  // Fallback for browsers without IntersectionObserver
  if (!('IntersectionObserver' in window)) {
    console.warn('initScrollReveal: IntersectionObserver not supported, revealing all components');
    components.forEach(name => {
      const el = document.querySelector(`[data-component="${name}"]`);
      if (el) {
        el.classList.add('is-visible');
      } else {
        console.warn(`initScrollReveal: component ${name} not found`);
      }
    });
    return;
  }
  const options = { threshold: 0.5 };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const container = entry.target;
        // Stagger reveal child items
        const children = container.querySelectorAll(
          '.index-features__item, .index-commands__card, .index-demo__container > *, .index-signup__wrapper > *'
        );
        if (children.length) {
          children.forEach((child, i) => {
            child.style.transitionDelay = `${i * 100}ms`;
            child.classList.add('is-visible');
          });
        } else {
          container.classList.add('is-visible');
        }
        const section = container.dataset.component;
        document.dispatchEvent(new CustomEvent('section:entered', {
          detail: { section }
        }));
        observer.unobserve(container);
      }
    });
  }, options);
  components.forEach(name => {
    const el = document.querySelector(`[data-component="${name}"]`);
    if (!el) {
      console.warn(`initScrollReveal: component ${name} not found`);
      return;
    }
    observer.observe(el);
  });
}

/**
 * Updates the navigation links to reflect the current scroll position.
 * Highlights the nav link whose section is centered in the viewport.
 */
function initScrollSpy() {
  const navLinks = document.querySelectorAll('.index-nav-list a[data-action="scroll"]');
  const sections = [];
  navLinks.forEach(link => {
    const target = link.getAttribute('data-scroll-target');
    const section = document.getElementById(target);
    if (section) {
      sections.push({ link, section });
    }
  });
  if (!sections.length) return;
  const onScroll = throttle(() => {
    const scrollMiddle = window.pageYOffset + window.innerHeight / 2;
    let activeLink = null;
    sections.forEach(({ link, section }) => {
      if (section.offsetTop <= scrollMiddle) {
        activeLink = link;
      }
    });
    navLinks.forEach(link => {
      link.classList.toggle('is-active', link === activeLink);
    });
  }, 200);
  window.addEventListener('scroll', onScroll);
  onScroll();
}

/**
 * Initializes a basic carousel for the commands showcase section.
 * Cycles through cards every 5 seconds, pauses on hover or focus.
 */
function initCommandsCarousel() {
  const grid = document.querySelector('.index-commands__grid');
  if (!grid) {
    console.warn('initCommandsCarousel: commands grid not found');
    return;
  }
  const cards = grid.querySelectorAll('.index-commands__card');
  if (cards.length < 2) {
    console.warn('initCommandsCarousel: fewer than 2 cards found, carousel disabled');
    return;
  }
  let current = 0;
  let carouselIntervalId = null;
  cards.forEach((card, i) => {
    card.classList.toggle('is-active', i === 0);
  });
  function cycle() {
    cards[current].classList.remove('is-active');
    current = (current + 1) % cards.length;
    cards[current].classList.add('is-active');
  }
  function startCarousel() {
    clearInterval(carouselIntervalId);
    carouselIntervalId = setInterval(cycle, 5000);
  }
  startCarousel();
  grid.addEventListener('mouseenter', () => clearInterval(carouselIntervalId));
  grid.addEventListener('mouseleave', startCarousel);
  grid.addEventListener('focusin', () => clearInterval(carouselIntervalId));
  grid.addEventListener('focusout', startCarousel);
}

/**
 * Binds the AI demo trigger to run a typewriter-style sample output.
 * Emits "demo:run" on start, "demo:completed" on finish, "demo:failed" on error.
 * Makes status text visible during the process.
 */
function initAIDemo() {
  const btn = document.getElementById('index-demo-run');
  const container = document.getElementById('index-demo-container');
  const statusEl = document.getElementById('demo-status');
  if (!btn || !container) {
    console.warn('initAIDemo: demo elements not found');
    return;
  }
  btn.addEventListener('click', function() {
    try {
      const demoType = container.getAttribute('data-demo-type');
      if (statusEl) {
        statusEl.textContent = 'Demo running...';
        statusEl.classList.remove('visually-hidden');
      }
      document.dispatchEvent(new CustomEvent('demo:run', {
        detail: { demoType }
      }));
      let output = document.getElementById('demo-output');
      if (output) {
        output.textContent = '';
      } else {
        console.warn('initAIDemo: #demo-output element not found');
        output = document.createElement('pre');
        output.id = 'demo-output';
        output.className = 'index-demo__output';
        output.setAttribute('aria-live', 'polite');
        container.appendChild(output);
      }
      const text = 'OpenClaw AI Demo: Generating content instantly.';
      let idx = 0;
      const speed = 50;
      function type() {
        if (idx < text.length) {
          output.textContent += text.charAt(idx);
          idx++;
          setTimeout(type, speed);
        } else {
          if (statusEl) {
            statusEl.textContent = 'Demo completed';
          }
          document.dispatchEvent(new CustomEvent('demo:completed', {
            detail: { demoType }
          }));
        }
      }
      type();
    } catch (error) {
      if (statusEl) {
        statusEl.textContent = 'Demo failed';
        statusEl.classList.remove('visually-hidden');
      }
      console.error('initAIDemo: demo failed', error);
      document.dispatchEvent(new CustomEvent('demo:failed', {
        detail: { error }
      }));
    }
  });
}

/**
 * Entry point: Initialize all components after DOM content is loaded.
 */
function initComponents() {
  initScrollReveal();
  initSmoothScrolling();
  initScrollSpy();
  initCommandsCarousel();
  initAIDemo();
}

window.initComponents = initComponents;
document.addEventListener('DOMContentLoaded', initComponents);