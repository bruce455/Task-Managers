/* public/js/calendar.js — dark‑theme grid, clickable pills, view/edit with server sync (no dupes) */

document.addEventListener('DOMContentLoaded', () => {
  // -------- UTC clock --------
  const pad = n => String(n).padStart(2, '0');
  const tick = () => {
    const d  = new Date();
    const ts = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`
             + ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
    const el = document.querySelector('.current-datetime');
    if (el) el.textContent = `Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS): ${ts}`;
  };
  tick();
  setInterval(tick, 1000);

  // -------- state --------
  let currentDate = new Date();
  const events    = [];
  const months    = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
  const z = n => (n < 10 ? '0' : '') + n;

  // -------- modals --------
  const viewElem  = document.getElementById('viewEventModal');
  const viewModal = new bootstrap.Modal(viewElem, { backdrop: true, keyboard: true });
  const addElem   = document.getElementById('exampleModal');
  const addModal  = new bootstrap.Modal(addElem, { backdrop: true, keyboard: true });

  // always clean up any leftover backdrops
  document.addEventListener('hidden.bs.modal', () => {
    document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
  });

  // -------- load events from server --------
  async function loadEvents() {
    try {
      const res  = await fetch('/get-events');
      const rows = await res.json();
      events.length = 0;
      rows.forEach(r => {
        const raw = r.due_date ?? r.start ?? r.start_date;
        if (!raw) return;
        const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
        const d   = new Date(iso);
        if (!isNaN(d)) events.push({ ...r, startDate: d });
      });
    } catch (e) {
      console.error('get-events failed:', e);
    }
    renderCalendar();
  }

  // -------- render header --------
  function updateHeader() {
    document.getElementById('currentMonth').textContent = months[currentDate.getMonth()];
    document.getElementById('currentYear').textContent  = currentDate.getFullYear();
  }

  // helper for creating divs
  const make = cls => Object.assign(document.createElement('div'), { className: cls });

  // -------- render grid --------
  function renderCalendar() {
    const wrap = document.getElementById('calendar-days');
    if (!wrap) return;
    wrap.innerHTML = '';

    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const last  = new Date(currentDate.getFullYear(), currentDate.getMonth()+1, 0);
    let offset  = first.getDay(); offset = offset === 0 ? 6 : offset - 1;

    for (let i = 0; i < offset; i++) {
      wrap.appendChild(make('day day--disabled'));
    }

    for (let d = 1; d <= last.getDate(); d++) {
      const cell = make('day');
      cell.appendChild(Object.assign(document.createElement('span'), { textContent: d }));

      events.forEach(ev => {
        const dt = ev.startDate;
        if (
          dt.getDate() === d &&
          dt.getMonth() === currentDate.getMonth() &&
          dt.getFullYear() === currentDate.getFullYear()
        ) {
          const pill = make('task');
          pill.textContent = `${z(dt.getHours())}:${z(dt.getMinutes())} - ${ev.title} (P${ev.priority})`;

          // stash metadata
          pill.dataset.title    = ev.title;
          pill.dataset.desc     = ev.description ?? '';
          pill.dataset.priority = ev.priority  ?? '';
          pill.dataset.reward   = ev.rewards   ?? '';
          pill.dataset.when     = dt.toISOString();
          if (ev.task_id) pill.dataset.taskId = ev.task_id;

          pill.style.cursor = 'pointer';
          cell.appendChild(pill);
        }
      });

      wrap.appendChild(cell);
    }
  }

  // -------- handle pill clicks --------
  document.getElementById('calendar-days')?.addEventListener('click', e => {
    const pill = e.target.closest('.task');
    if (!pill) return;

    if (pill.dataset.taskId) {
      // existing task → open edit modal
      openEditModal(pill.dataset.taskId);

    } else {
      // client-only event → view in modal
      document.getElementById('view-title').textContent    = pill.dataset.title;
      document.getElementById('view-desc').textContent     = pill.dataset.desc;
      document.getElementById('view-priority').textContent = pill.dataset.priority;
      document.getElementById('view-reward').textContent   = pill.dataset.reward;
      document.getElementById('view-when').textContent     = pill.dataset.when;

      viewModal.show();

      // on clicking Edit inside view modal
      document.getElementById('view-edit-btn').onclick = () => {
        viewModal.hide();
        viewElem.addEventListener('hidden.bs.modal', function handler() {
          // mark inline edit
          addElem.dataset.editInline = 'true';
          // prefill add/edit form
          document.getElementById('event_name').value        = pill.dataset.title;
          document.getElementById('event_description').value = pill.dataset.desc;
          document.getElementById('event_priority').value    = pill.dataset.priority;
          document.getElementById('event_reward').value      = pill.dataset.reward;
          document.getElementById('eventDate').value         = pill.dataset.when.slice(0,16);
          addModal.show();
          viewElem.removeEventListener('hidden.bs.modal', handler);
        });
      };
    }
  });

  // -------- add/edit form submit --------
  document.getElementById('data-form').addEventListener('submit', async e => {
    e.preventDefault();
    const isInline = addElem.dataset.editInline === 'true';
    const payload = {
      title:       e.target.event_name.value,
      description: e.target.event_description.value,
      priority:    Number(e.target.event_priority.value),
      rewards:     Number(e.target.event_reward.value),
      due_date:    e.target.eventDate.value
    };

    try {
      if (isInline) {
        // inline edit of a client‑only event: just update in-memory then reload full
        await fetch('/update-event', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, task_id: null })
        });
      } else {
        // new event: post then reload
        await fetch('/add-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      // always re-fetch authoritative list
      await loadEvents();
      addModal.hide();
      delete addElem.dataset.editInline;
      e.target.reset();
    } catch (err) {
      console.error('save failed:', err);
    }
  });

  // -------- month nav --------
  document.getElementById('prevMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    updateHeader();
    renderCalendar();
  });
  document.getElementById('nextMonth')?.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    updateHeader();
    renderCalendar();
  });

  // -------- initialize --------
  updateHeader();
  loadEvents();
});
