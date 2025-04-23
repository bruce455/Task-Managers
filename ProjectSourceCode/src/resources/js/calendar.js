/* public/js/calendar.js — 2025-04-23
   Clickable pills ▸ edit works ▸ no duplicates
   Fix: correctly reads top-level task_id and shows description/priority/reward
*/

document.addEventListener('DOMContentLoaded', () => {
  /* ── helpers ─────────────────────────────────────────── */
  const pad = n => String(n).padStart(2, '0');
  const z   = n => (n < 10 ? '0' : '') + n;

  /* ── live UTC clock ──────────────────────────────────── */
  function tick() {
    const d  = new Date();
    const ts = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`
             + ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    const el = document.querySelector('.current-datetime');
    if (el) el.textContent = `Current Date and Time (UTC – YYYY-MM-DD HH:MM:SS): ${ts}`;
  }
  tick();
  setInterval(tick, 1000);

  /* ── state ───────────────────────────────────────────── */
  let currentDate = new Date();
  const events    = [];
  const months    = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

  /* ── modals ──────────────────────────────────────────── */
  const viewElem  = document.getElementById('viewEventModal');
  const viewModal = new bootstrap.Modal(viewElem);
  const addElem   = document.getElementById('exampleModal');
  const addModal  = new bootstrap.Modal(addElem);
  const addBtn    = document.getElementById('addEventBtn');

  document.addEventListener('hidden.bs.modal',
    () => document.querySelectorAll('.modal-backdrop').forEach(b => b.remove()));

  /* ── fetch helper ────────────────────────────────────── */
  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} → ${res.status}`);
    return res.json();
  }

  /* ── load & dedupe events ───────────────────────────── */
  async function loadEvents() {
    try {
      const rows = await getJSON('/get-events');
      const seen = new Map();

      for (const r of rows) {
        const raw = r.start ?? r.due_date ?? r.start_date;
        if (!raw) continue;
        const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
        const d   = new Date(iso);
        if (isNaN(d)) continue;

        // use top-level task_id
        const id  = r.task_id;
        const key = id != null ? id : `${iso}|${r.title}`;

        seen.set(key, {
          ...r,
          startDate  : d,
          task_id    : id,
          priority   : Number(r.priority ?? 0),
          reward     : Number(r.reward   ?? 0),
          description: r.description || ''
        });
      }

      events.length = 0;
      events.push(...seen.values());
    } catch (e) {
      console.error('loadEvents:', e);
    }
    renderGrid();
  }

  /* ── header ──────────────────────────────────────────── */
  function updateHeader() {
    document.getElementById('currentMonth').textContent = months[currentDate.getMonth()];
    document.getElementById('currentYear' ).textContent = currentDate.getFullYear();
  }

  /* ── grid renderer ───────────────────────────────────── */
  function createDiv(cls) {
    return Object.assign(document.createElement('div'), { className: cls });
  }

  function renderGrid() {
    const wrap = document.getElementById('calendar-days');
    if (!wrap) return;
    wrap.innerHTML = '';

    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const last  = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0);
    let offset  = first.getDay(); offset = offset === 0 ? 6 : offset - 1;

    for (let i = 0; i < offset; i++) wrap.appendChild(createDiv('day day--disabled'));

    for (let d = 1; d <= last.getDate(); d++) {
      const cell = createDiv('day');
      cell.appendChild(Object.assign(document.createElement('span'), { textContent: d }));

      events.forEach(ev => {
        const dt = ev.startDate;
        if (dt.getDate() !== d ||
            dt.getMonth() !== currentDate.getMonth() ||
            dt.getFullYear() !== currentDate.getFullYear()) return;

        const pill = createDiv('task');
        const prio = ev.priority ? ` (P${ev.priority})` : '';
        pill.textContent = `${z(dt.getHours())}:${z(dt.getMinutes())} – ${ev.title}${prio}`;
        pill.style.cursor = 'pointer';

        // stash metadata
        pill.dataset.taskId   = ev.task_id;
        pill.dataset.title    = ev.title;
        pill.dataset.desc     = ev.description;
        pill.dataset.priority = ev.priority;
        pill.dataset.reward   = ev.reward;
        pill.dataset.when     = dt.toISOString();

        cell.appendChild(pill);
      });

      wrap.appendChild(cell);
    }
  }

  /* ── pill click handler ───────────────────────────────── */
  document.addEventListener('click', e => {
    const pill = e.target.closest('.task');
    if (!pill) return;

    const id = pill.dataset.taskId;
    if (id) {
      openEditModal(id);
    } else {
      showQuickView(pill);
    }
  });

  function showQuickView(pill) {
    ['title','desc','priority','reward','when'].forEach(f => {
      const el = document.getElementById(`view-${f}`);
      if (el) el.textContent = pill.dataset[f] || '';
    });
    viewModal.show();

    document.getElementById('view-edit-btn').onclick = () => {
      viewModal.hide();
      viewElem.addEventListener('hidden.bs.modal', () => {
        launchAddModal({
          task_id : '',
          title   : pill.dataset.title,
          desc    : pill.dataset.desc,
          priority: pill.dataset.priority,
          reward  : pill.dataset.reward,
          when    : pill.dataset.when
        });
      }, { once: true });
    };
  }

  /* ── open existing for edit ──────────────────────────── */
  async function openEditModal(taskId) {
    try {
      const ev = await getJSON(`/tasks/${taskId}`);
      launchAddModal({
        task_id   : ev.task_id,
        title     : ev.title,
        desc      : ev.description || '',
        priority  : ev.priority    || 0,
        reward    : ev.rewards     || 0,
        when      : (ev.due_date).replace(' ', 'T')
      });
    } catch (e) {
      console.error(e);
      alert('Could not load event for editing.');
    }
  }

  /* ── prep & show add/edit modal ───────────────────────── */
  function launchAddModal({ task_id, title, desc, priority, reward, when }) {
    addElem.dataset.mode   = task_id ? 'edit' : 'new';
    addElem.dataset.editId = task_id || '';

    document.getElementById('event_name').value        = title;
    document.getElementById('event_description').value = desc;
    document.getElementById('event_priority').value    = priority;
    document.getElementById('event_reward').value      = reward;
    document.getElementById('eventDate').value         = when.slice(0, 16);

    addModal.show();
  }

  /* ── save (new | edit) ────────────────────────────────── */
  document.getElementById('data-form').addEventListener('submit', async e => {
    e.preventDefault();
    const mode   = addElem.dataset.mode;
    const editId = addElem.dataset.editId;

    const payload = {
      title      : e.target.event_name.value.trim(),
      description: e.target.event_description.value.trim(),
      priority   : Number(e.target.event_priority.value) || 0,
      rewards    : Number(e.target.event_reward.value)   || 0,
      due_date   : e.target.eventDate.value
    };

    try {
      if (mode === 'edit' && editId) {
        await fetch(`/tasks/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await fetch('/add-event', {
          method: 'POST',
          headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
          body:new URLSearchParams({
            event_name       : payload.title,
            event_description: payload.description,
            event_priority   : payload.priority,
            event_reward     : payload.rewards,
            eventDate        : payload.due_date
          }).toString()
        });
      }

      addElem.addEventListener('hidden.bs.modal', async function after() {
        addElem.removeEventListener('hidden.bs.modal', after);
        await loadEvents();
        addBtn?.focus();
      }, { once:true });

      addModal.hide();
      e.target.reset();
    } catch (err) {
      console.error('save failed:', err);
    }
  });

  /* ── month nav ────────────────────────────────────────── */
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateHeader(); renderGrid();
  });
  document.getElementById('nextMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateHeader(); renderGrid();
  });

  /* ── initialize ──────────────────────────────────────── */
  updateHeader();
  loadEvents();
});
