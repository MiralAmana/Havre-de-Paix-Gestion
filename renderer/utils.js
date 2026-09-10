window.Utils = (function () {
  function formatCFA(amount) {
    const value = Number(amount) || 0;
    return (
      new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value) + ' CFA'
    );
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('fr-FR');
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (value !== null && value !== undefined) {
        node.setAttribute(key, value);
      }
    });
    (children || []).forEach((child) => {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  let toastTimeout;
  function toast(message, type = 'success') {
    let host = document.getElementById('toast-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toast-host';
      document.body.appendChild(host);
    }
    host.textContent = message;
    host.className = `toast toast-${type} visible`;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => host.classList.remove('visible'), 3000);
  }

  async function call(promise, successMessage) {
    try {
      const result = await promise;
      if (successMessage) toast(successMessage, 'success');
      return result;
    } catch (err) {
      console.error(err);
      toast(err.message || 'Une erreur est survenue', 'error');
      throw err;
    }
  }

  return { formatCFA, formatNumber, formatDate, today, el, toast, call };
})();
