// public/js/calendar.js
// Combines home-page "Add Event" AJAX hijack with full calendar functionality

document.addEventListener('DOMContentLoaded', () => {
  // ── COMMON: Hijack the Add-Event form on every page ────────────────────────────
  const addForm    = document.getElementById('data-form');
  const addModalEl = document.getElementById('exampleModal');
  const addModal   = addModalEl && new bootstrap.Modal(addModalEl);
  const addBtn     = document.getElementById('addEventBtn');

  if (addForm) {
    addForm.addEventListener('submit', async e => {
      e.preventDefault();

      const mode   = addForm.dataset.mode;
      const editId = addForm.dataset.editId;
      const body   = {
        title      : e.target.event_name.value.trim(),
        description: e.target.event_description.value.trim(),
        priority   : Number(e.target.event_priority.value),
        reward     : Number(e.target.event_reward.value),
        due_date   : e.target.eventDate.value
      };

      try {
        let res;
        if (mode === 'edit' && editId) {
          res = await fetch(`/tasks/${editId}`, {
            method : 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(body)
          });
        } else {
          res = await fetch('/add-event', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify(body)
          });
        }
        if (!res.ok) throw new Error('Failed to save event');

        // hide & reset the modal, clear mode/editId
        addModal && addModal.hide();
        addForm.reset();
        delete addForm.dataset.mode;
        delete addForm.dataset.editId;

        // on calendar page, reload events; on home, reload page
        if (document.getElementById('calendar-days')) {
          await loadEvents();
          addBtn?.focus();
        } else {
          window.location.reload();
        }
      } catch (err) {
        console.error('save-event failed:', err);
        alert('Could not save event.');
      }
    });
  }

  // ── CALENDAR-ONLY: Abort if no calendar grid on this page ────────────────────
  const wrap = document.getElementById('calendar-days');
  if (!wrap) return;

  // ── helpers ────────────────────────────────────────────────────────────────
  const pad = n => String(n).padStart(2, '0');

  // ── live UTC clock ─────────────────────────────────────────────────────────
  const tick = () => {
    const d  = new Date();
    const ts = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`
             + ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    const el = document.querySelector('.current-datetime');
    if (el) el.textContent = `UTC – ${ts}`;
  };
  tick(); setInterval(tick, 1000);

  // ── state & modals ─────────────────────────────────────────────────────────
  let currentDate = new Date();
  const events    = [];
  const months    = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

  const viewModalEl = document.getElementById('viewEventModal');
  const viewModal   = new bootstrap.Modal(viewModalEl);

  document.addEventListener('hidden.bs.modal', () =>
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove())
  );

  // ── fetch wrapper ──────────────────────────────────────────────────────────
  async function getJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.json();
  }

  // ── load & dedupe events ───────────────────────────────────────────────────
  async function loadEvents() {
    try {
      const rows = await getJSON('/get-events');
      const seen = new Map();
      for (const r of rows) {
        const iso = (r.start||'').replace(' ', 'T');
        const d   = new Date(iso);
        if (isNaN(d)) continue;
        seen.set(r.task_id, { ...r,
          startDate  : d,
          priority   : Number(r.priority  || 0),
          reward     : Number(r.reward    || 0),
          description: r.description || ''
        });
      }
      events.length = 0;
      events.push(...seen.values());
    } catch (e) {
      console.error('loadEvents:', e);
    }
    renderCalendar();
  }

  // ── header ─────────────────────────────────────────────────────────────────
  function updateHeader() {
    document.getElementById('currentMonth').textContent = months[currentDate.getMonth()];
    document.getElementById('currentYear' ).textContent = currentDate.getFullYear();
  }

  // ── draw grid & pills ──────────────────────────────────────────────────────
  function makeDiv(cls) { return Object.assign(document.createElement('div'), { className: cls }); }

  function renderCalendar() {
    wrap.innerHTML = '';
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const last  = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0);
    let offset  = first.getDay(); offset = offset===0?6:offset-1;
    for (let i=0;i<offset;i++) wrap.appendChild(makeDiv('day day--disabled'));
    for (let d=1; d<=last.getDate(); d++) {
      const cell = makeDiv('day');
      cell.appendChild(Object.assign(document.createElement('span'), { textContent: d }));
      for (const ev of events) {
        const dt = ev.startDate;
        if (dt.getDate()===d && dt.getMonth()===currentDate.getMonth() && dt.getFullYear()===currentDate.getFullYear()) {
          const pill = makeDiv('task');
          pill.textContent = `${pad(dt.getHours())}:${pad(dt.getMinutes())} – ${ev.title}` + (ev.priority?` (P${ev.priority})`:``);
          pill.style.cursor = 'pointer';
          pill.dataset.taskId   = ev.task_id;
          pill.dataset.title    = ev.title;
          pill.dataset.desc     = ev.description;
          pill.dataset.priority = ev.priority;
          pill.dataset.reward   = ev.reward;
          pill.dataset.when     = dt.toISOString();
          cell.appendChild(pill);
        }
      }
      wrap.appendChild(cell);
    }
  }

  // ── click pill → quick‐view ───────────────────────────────────────────────
  document.addEventListener('click', e => {
    const pill = e.target.closest('.task'); if (!pill) return; showQuickView(pill);
  });

  function showQuickView(pill) {
    ['title','desc','priority','reward','when'].forEach(f => {
      const el = document.getElementById(`view-${f}`);
      if (!el) return;
      if (f==='when') {
        const d = new Date(pill.dataset.when);
        el.textContent = d.toLocaleString('en-US',{month:'2-digit',day:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
      } else el.textContent = pill.dataset[f] || '';
    });
    viewModal.show();
    document.getElementById('view-edit-btn').onclick = () => {
      viewModal.hide();
      viewModalEl.addEventListener('hidden.bs.modal', () => openEditModal(pill.dataset.taskId), { once:true });
    };
  }

  // ── open edit form ───────────────────────────────────────────────────────
  async function openEditModal(taskId) {
    try {
      const ev = await getJSON(`/tasks/${taskId}`);
      launchAddModal({ task_id: ev.task_id, title: ev.title, desc: ev.description||'', priority: ev.priority||0, reward: ev.reward||0, when: ev.due_date });
    } catch (e) {
      console.error('openEditModal:', e);
      alert('Could not load event.');
    }
  }

  // ── prep & show add/edit ─────────────────────────────────────────────────
  function launchAddModal({ task_id, title, desc, priority, reward, when }) {
    addForm.dataset.mode   = task_id? 'edit' : 'new';
    addForm.dataset.editId = task_id || '';
    document.getElementById('event_name').value        = title;
    document.getElementById('event_description').value = desc;
    document.getElementById('event_priority').value    = priority;
    document.getElementById('event_reward').value      = reward;
    document.getElementById('eventDate').value         = when.slice(0,16);
    addModal.show();
  }

  // ── month navigation ─────────────────────────────────────────────────────
  document.getElementById('prevMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth()-1); updateHeader(); renderCalendar(); };
  document.getElementById('nextMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth()+1); updateHeader(); renderCalendar(); };

  // ── init ─────────────────────────────────────────────────────────────────
  updateHeader(); loadEvents();
});
