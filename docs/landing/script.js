(function () {
  'use strict';

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => {
      const scrolled = window.scrollY > 4;
      if (header.dataset.scrolled !== String(scrolled)) {
        header.dataset.scrolled = String(scrolled);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  const targets = document.querySelectorAll('.reveal');
  if (targets.length) {
    if (reduced || !('IntersectionObserver' in window)) {
      targets.forEach(el => el.classList.add('is-visible'));
    } else {
      const io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              obs.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      targets.forEach(el => io.observe(el));
    }
  }

  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', evt => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      evt.preventDefault();
      target.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'start',
      });
      history.replaceState(null, '', id);
    });
  });

  document.querySelectorAll('[data-stagger]').forEach(group => {
    const step = parseInt(group.getAttribute('data-stagger'), 10) || 60;
    Array.from(group.children).forEach((child, i) => {
      if (child.classList.contains('reveal')) {
        child.style.setProperty('--reveal-delay', `${i * step}ms`);
      }
    });
  });
})();
