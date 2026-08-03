const Router = (function () {
  const routes = {};
  let activeIntervals = [];

  function register(path, handler) {
    routes[path] = handler;
  }

  function setPoll(intervalHandle) {
    activeIntervals.push(intervalHandle);
  }

  function currentPath() {
    return location.hash.replace(/^#/, '') || '/login';
  }

  function requireRuolo(tipiConsentiti) {
    const ruolo = State.getRuolo();
    if (!ruolo || (tipiConsentiti && tipiConsentiti.indexOf(ruolo.tipo) === -1)) {
      navigate('/login');
      return null;
    }
    return ruolo;
  }

  async function render() {
    activeIntervals.forEach((h) => clearInterval(h));
    activeIntervals = [];

    const container = document.getElementById('app');
    container.innerHTML = '';

    const path = currentPath();
    const handler = routes[path] || routes['/login'];
    try {
      await handler(container);
    } catch (err) {
      container.appendChild(el('div', { class: 'errore' }, ['Errore: ' + err.message]));
    }
  }

  function navigate(path) {
    if (location.hash.replace(/^#/, '') === path) render();
    else location.hash = path;
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('DOMContentLoaded', render);

  return { register, render, navigate, setPoll, requireRuolo };
})();
