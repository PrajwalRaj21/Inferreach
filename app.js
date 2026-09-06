// =========================================================
// INFERREACH – Coming Soon
// =========================================================

(function () {
  'use strict';

  // ---------- SCROLL REVEAL ----------
  const revealElements = document.querySelectorAll('[data-reveal]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -20px 0px' });

  revealElements.forEach(el => revealObserver.observe(el));

  // ---------- EMAIL FORM (frontend only) ----------
  const form = document.getElementById('email-form');
  const input = document.getElementById('email-input');
  const feedback = document.getElementById('form-feedback');

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const email = input.value.trim();
      if (!email || !email.includes('@') || !email.includes('.')) {
        feedback.textContent = 'Please enter a valid email address.';
        feedback.className = 'form-feedback error';
        return;
      }

      // Success (simulate)
      feedback.textContent = '✅ Thank you! We\'ll notify you at ' + email + ' when we launch.';
      feedback.className = 'form-feedback';
      input.value = '';

      // Optional: you could send this to a backend endpoint later
      // For now, just show a success message.
    });
  }

})();