import { submitResponse, getMyResponse, usingLiveSync } from './data-store.js';

const deck = document.getElementById('deck');
const slides = Array.from(document.querySelectorAll('.slide'));
const nav = document.getElementById('nav');
const pageinfo = document.getElementById('pageinfo');

let current = 0;

// ---------- build ribbon dots ----------
slides.forEach((s, i) => {
  const dot = document.createElement('button');
  dot.className = 'dot';
  dot.setAttribute('aria-label', `Go to slide ${i + 1}: ${s.dataset.title || ''}`);
  dot.addEventListener('click', () => goTo(i));
  nav.appendChild(dot);
});

function updateChrome() {
  const dots = nav.querySelectorAll('.dot');
  dots.forEach((d, i) => {
    d.classList.toggle('done', i < current);
    d.classList.toggle('current', i === current);
  });
  pageinfo.textContent = `${String(current + 1).padStart(2, '0')} / ${slides.length}`;
}

function goTo(i) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  slides[i].scrollIntoView({ behavior: 'smooth' });
}

// ---------- track current slide via scroll ----------
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && e.intersectionRatio > 0.6) {
      current = slides.indexOf(e.target);
      updateChrome();
    }
  });
}, { root: deck, threshold: [0.6] });
slides.forEach(s => io.observe(s));

// ---------- keyboard + buttons ----------
document.addEventListener('keydown', (e) => {
  if (['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); goTo(current + 1); }
  if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); goTo(current - 1); }
});
document.getElementById('next-btn').addEventListener('click', () => goTo(current + 1));
document.getElementById('prev-btn').addEventListener('click', () => goTo(current - 1));

updateChrome();

// ---------- sync banner ----------
(async () => {
  const live = await usingLiveSync();
  const banner = document.getElementById('sync-banner');
  if (banner) {
    banner.textContent = live
      ? '● Live sync connected — your responses are shared with the presenter in real time.'
      : '○ Live sync not configured on this deck — responses are saved to this device only. (See README.md if you\u2019re the presenter.)';
  }
})();

// ---------- survey forms ----------
function collectFormData(form) {
  const fd = new FormData(form);
  const out = {};
  new Set(fd.keys()).forEach((key) => {
    const vals = fd.getAll(key);
    out[key] = vals.length > 1 ? vals : vals[0];
  });
  return out;
}

function setSubmittedState(form, answers) {
  const card = form.closest('.survey-card');
  const thankyou = card.querySelector('.thankyou');
  form.style.display = 'none';
  thankyou.classList.add('show');
  const editBtn = thankyou.querySelector('.edit-link');
  if (editBtn) {
    editBtn.onclick = () => {
      form.style.display = 'flex';
      thankyou.classList.remove('show');
    };
  }
}

document.querySelectorAll('form.survey-form').forEach((form) => {
  const slideId = form.dataset.surveyId;
  const status = form.querySelector('.survey-status');

  // pre-fill if this visitor already answered
  getMyResponse(slideId).then((answers) => {
    if (answers) setSubmittedState(form, answers);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('.btn');
    submitBtn.disabled = true;
    status.textContent = 'Saving…';
    status.className = 'survey-status';
    try {
      const answers = collectFormData(form);
      await submitResponse(slideId, answers);
      status.textContent = '';
      setSubmittedState(form, answers);
    } catch (err) {
      console.error(err);
      status.textContent = 'Couldn\u2019t save — check your connection and try again.';
      status.className = 'survey-status err';
      submitBtn.disabled = false;
    }
  });
});
