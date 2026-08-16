import { subscribeAllResponses, usingLiveSync, clearAllResponses } from './data-store.js';
import { DASHBOARD_PASSCODE } from './sheet-config.js';

// ---------- passcode gate ----------
const gate = document.getElementById('gate');
const gateForm = document.getElementById('gate-form');
const gateInput = document.getElementById('gate-input');
const gateErr = document.getElementById('gate-err');

if (gate && sessionStorage.getItem('dash-unlocked') === 'true') {
  gate.style.display = 'none';
}

if (gateForm && gateInput && gateErr) {
  gateForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (gateInput.value === DASHBOARD_PASSCODE) {
      sessionStorage.setItem('dash-unlocked', 'true');
      if (gate) gate.style.display = 'none';
    } else {
      gateErr.textContent = 'Incorrect passcode.';
    }
  });
}

// ---------- survey schema (mirrors index.html) ----------
const SCHEMA = [
  {
    id: 'pre-survey', title: 'Before We Begin', questions: [
      { id: 'familiarity', label: 'Relationship with AI tools', type: 'choice',
        options: ['Never used them', 'Curious but cautious', 'Use them regularly', 'Integrated into my work'] },
      { id: 'outlook', label: 'Hopeful or worried about AI\u2019s impact', type: 'choice',
        options: ['Mostly hopeful', 'A genuine mix', 'Mostly worried', 'Haven\u2019t thought much about it'] },
      { id: 'question_for_tonight', label: 'What they want answered tonight', type: 'text' }
    ]
  },
  {
    id: 'poll-1', title: 'Mid-Talk Poll — Which Impact Feels Most Real', questions: [
      { id: 'impact', label: 'Which impact feels closest to home', type: 'choice',
        options: ['Jobs and the economy', 'Trust and misinformation', 'Creativity and new opportunity', 'Relationships and community'] }
    ]
  },
  {
    id: 'poll-2', title: 'Mid-Talk Poll — Where Do You Lean?', questions: [
      { id: 'trust_lean', label: 'Default trust lean', type: 'choice',
        options: ['Mostly toward God', 'Whichever is more convenient', 'Mostly toward the tool', 'Honestly not sure'] }
    ]
  },
  {
    id: 'post-survey', title: 'Before You Go', questions: [
      { id: 'shift', label: 'Did tonight shift their view', type: 'choice',
        options: ['More hopeful', 'More cautious', 'About the same', 'Still processing'] },
      { id: 'commitment', label: 'What they\u2019ll try this week', type: 'choice',
        options: ['Spend 30 min learning an AI tool', 'Set a personal rule of trust', 'Talk with my kids about it', 'Bring this up at church'] },
      { id: 'feedback', label: 'Feedback / follow-up questions', type: 'text' }
    ]
  }
];

const root = document.getElementById('blocks');
const respondentCountEl = document.getElementById('respondent-count');
const statusPill = document.getElementById('status-pill');
const clearSessionBtn = document.getElementById('clear-session-btn');

function render(rows) {
  const bySlide = {};
  rows.forEach(r => {
    if (!bySlide[r.slideId]) bySlide[r.slideId] = [];
    bySlide[r.slideId].push(r);
  });

  const uniqueSessions = new Set(rows.map(r => r.sessionId));
  respondentCountEl.textContent = `${uniqueSessions.size} respondent${uniqueSessions.size === 1 ? '' : 's'} so far`;

  root.innerHTML = '';
  SCHEMA.forEach(block => {
    const entries = bySlide[block.id] || [];
    const section = document.createElement('div');
    section.className = 'block';
    section.innerHTML = `
      <div class="block-title">${block.title}</div>
      <div class="block-meta">${entries.length} response${entries.length === 1 ? '' : 's'}</div>
    `;

    block.questions.forEach(q => {
      const qWrap = document.createElement('div');
      qWrap.className = 'qblock';
      const qtext = document.createElement('div');
      qtext.className = 'qtext';
      qtext.textContent = q.label;
      qWrap.appendChild(qtext);

      if (q.type === 'choice') {
        const counts = {};
        q.options.forEach(o => counts[o] = 0);
        let total = 0;
        entries.forEach(e => {
          const val = e.answers ? e.answers[q.id] : undefined;
          if (!val) return;
          const vals = Array.isArray(val) ? val : [val];
          vals.forEach(v => { if (v in counts) { counts[v]++; total++; } });
        });
        if (total === 0) {
          qWrap.innerHTML += `<div class="empty">No responses yet.</div>`;
        } else {
          q.options.forEach(o => {
            const c = counts[o];
            const pct = total ? Math.round((c / total) * 100) : 0;
            const row = document.createElement('div');
            row.className = 'bar-row';
            row.innerHTML = `
              <div class="bar-label">${o}</div>
              <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
              <div class="bar-count">${c} · ${pct}%</div>
            `;
            qWrap.appendChild(row);
          });
        }
      } else {
        const texts = entries
          .map(e => ({ text: e.answers ? e.answers[q.id] : '', ts: e.ts }))
          .filter(t => t.text && String(t.text).trim().length)
          .sort((a, b) => (tsMillis(b.ts) - tsMillis(a.ts)));
        if (!texts.length) {
          qWrap.innerHTML += `<div class="empty">No responses yet.</div>`;
        } else {
          const list = document.createElement('div');
          list.className = 'textlist';
          texts.forEach(t => {
            const entry = document.createElement('div');
            entry.className = 'entry';
            entry.innerHTML = `${escapeHtml(String(t.text))}<time>${formatTs(t.ts)}</time>`;
            list.appendChild(entry);
          });
          qWrap.appendChild(list);
        }
      }
      section.appendChild(qWrap);
    });

    root.appendChild(section);
  });
}

function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.toMillis) return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}
function formatTs(ts) {
  const ms = tsMillis(ts);
  if (!ms) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function resetSession() {
  if (!clearSessionBtn || !window.confirm('Clear all current responses and reset the session?')) {
    return;
  }

  clearSessionBtn.disabled = true;
  try {
    const result = await clearAllResponses();
    root.innerHTML = '';
    render([]);
    statusPill.querySelector('.label').textContent = result.synced ? 'Session reset — ready for new responses' : 'Session reset — local cache cleared';
  } catch (err) {
    console.error(err);
    statusPill.querySelector('.label').textContent = 'Reset failed — try again';
  } finally {
    clearSessionBtn.disabled = false;
  }
}

(async () => {
  const live = await usingLiveSync();
  statusPill.classList.toggle('live', live);
  statusPill.querySelector('.label').textContent = live ? 'Live sync connected' : 'Local only — see README';
  if (clearSessionBtn) {
    clearSessionBtn.addEventListener('click', resetSession);
  }
  await subscribeAllResponses(render);
})();
