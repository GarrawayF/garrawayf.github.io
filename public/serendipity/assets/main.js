(() => {
  const toggle = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.mobile-nav');
  if (!toggle || !menu) return;
  function closeMenu(returnFocus = false) {
    toggle.setAttribute('aria-expanded', 'false');
    menu.hidden = true;
    document.body.classList.remove('menu-open');
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    const opening = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(opening));
    menu.hidden = !opening;
    document.body.classList.toggle('menu-open', opening);
  });
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!menu.hidden && !event.target.closest('.site-header')) closeMenu();
  });
  matchMedia('(min-width: 761px)').addEventListener('change', event => {
    if (event.matches) closeMenu();
  });
})();
