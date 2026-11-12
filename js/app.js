document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('sj_logged_in') !== 'true' && !window.location.pathname.includes('index.html')) {
    window.location.href = 'index.html'; return;
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('sj_logged_in');
      window.location.href = 'index.html';
    });
  }

  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.getAttribute('href') === currentPage) item.classList.add('active');
  });

  if (!document.getElementById('globalModal')) {
    const modalHTML = `
      <div id="globalModal" class="custom-modal-overlay">
        <div class="custom-modal-box">
          <div id="globalModalIcon" class="custom-modal-icon"></div>
          <h3 id="globalModalTitle" class="custom-modal-title"></h3>
          <p id="globalModalMessage" class="custom-modal-message"></p>
          <div id="globalModalActions" class="custom-modal-actions"></div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
});

window.showAlert = function(message, type = 'success', callback = null) {
  const overlay = document.getElementById('globalModal');
  if (!overlay) { alert(message); if (callback) callback(); return; }
  const icon = document.getElementById('globalModalIcon');
  const title = document.getElementById('globalModalTitle');
  const msg = document.getElementById('globalModalMessage');
  const actions = document.getElementById('globalModalActions');

  if (type === 'success') { icon.innerHTML = '✅'; title.innerText = 'Success'; }
  else if (type === 'error') { icon.innerHTML = '❌'; title.innerText = 'Error'; }
  else { icon.innerHTML = 'ℹ️'; title.innerText = 'Notice'; }

  msg.innerText = message;
  actions.innerHTML = `<button class="custom-modal-btn btn-modal-confirm" id="modalCloseBtn">OK</button>`;
  overlay.classList.add('active');

  document.getElementById('modalCloseBtn').onclick = () => { overlay.classList.remove('active'); if (callback) callback(); };
};

window.showConfirm = function(title, message, confirmText, cancelText, onConfirm, onCancel = null) {
  const overlay = document.getElementById('globalModal');
  if (!overlay) { if (confirm(message)) { if (onConfirm) onConfirm(); } return; }
  const icon = document.getElementById('globalModalIcon');
  const titleEl = document.getElementById('globalModalTitle');
  const msg = document.getElementById('globalModalMessage');
  const actions = document.getElementById('globalModalActions');

  icon.innerHTML = '⚠️'; titleEl.innerText = title; msg.innerText = message;
  actions.innerHTML = `
    <button class="custom-modal-btn btn-modal-cancel" id="modalCancelBtn">${cancelText}</button>
    <button class="custom-modal-btn btn-modal-danger" id="modalConfirmBtn">${confirmText}</button>`;
  overlay.classList.add('active');

  document.getElementById('modalCancelBtn').onclick = () => { overlay.classList.remove('active'); if (onCancel) onCancel(); };
  document.getElementById('modalConfirmBtn').onclick = () => { overlay.classList.remove('active'); if (onConfirm) onConfirm(); };
};