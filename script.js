
// ══════════════════════════════════════════
//  DATA
// ══════════════════════════════════════════
const LIST_COLORS = ['#7c6af5','#3ecf8e','#f56565','#f6a623','#60adf5','#f5d060','#f06292','#4dd0e1','#aed581'];

let lists = JSON.parse(localStorage.getItem('sc_lists') || 'null') || [
  {id:'l1',name:'My Tasks',  color:'#7c6af5'},
  {id:'l2',name:'Work',      color:'#60adf5'},
  {id:'l3',name:'Personal',  color:'#3ecf8e'},
];

let tasks = JSON.parse(localStorage.getItem('sc_tasks') || 'null') || [
  {id:'t1',listId:'l1',text:'Welcome to SkillCraft Tasks! 👋',done:false,priority:'low',date:'',notes:'',created:Date.now()-5000},
  {id:'t2',listId:'l1',text:'Add your first task using the bar above',done:false,priority:'none',date:'',notes:'',created:Date.now()-4000},
  {id:'t3',listId:'l2',text:'Review project proposal',done:false,priority:'high',date:new Date(Date.now()+3600000).toISOString().slice(0,16),notes:'',created:Date.now()-3000},
  {id:'t4',listId:'l2',text:'Team standup meeting',done:true,priority:'medium',date:'',notes:'',created:Date.now()-2000},
  {id:'t5',listId:'l3',text:'Buy groceries',done:false,priority:'medium',date:new Date(Date.now()+86400000).toISOString().slice(0,16),notes:'',created:Date.now()-1000},
];

let currentListId = 'l1';
let currentFilter = 'all';
let currentSort = 'created'; // created | priority | date | alpha
let editingTaskId = null;
let editingListId = null;
let selectedColor = LIST_COLORS[0];
let selectedPriorityEdit = 'none';

// ══════════════════════════════════════════
//  PERSISTENCE
// ══════════════════════════════════════════
function save() {
  localStorage.setItem('sc_lists', JSON.stringify(lists));
  localStorage.setItem('sc_tasks', JSON.stringify(tasks));
}

// ══════════════════════════════════════════
//  RENDER
// ══════════════════════════════════════════
function render() {
  renderNav();
  renderMain();
  renderStats();
}

function renderNav() {
  const nav = document.getElementById('listNav');
  nav.innerHTML = lists.map(l => {
    const count = tasks.filter(t => t.listId === l.id && !t.done).length;
    return `<div class="list-item ${l.id === currentListId ? 'active' : ''}" onclick="switchList('${l.id}')">
      <span class="list-dot" style="color:${l.color}"></span>
      <span class="list-name">${esc(l.name)}</span>
      ${count ? `<span class="list-count">${count}</span>` : ''}
      <button class="list-del" onclick="deleteList('${l.id}',event)" title="Delete list">×</button>
    </div>`;
  }).join('');
}

function renderMain() {
  const list = lists.find(l => l.id === currentListId);
  if (!list) return;

  // toolbar
  document.getElementById('listTitleInput').value = list.name;
  document.getElementById('currentDot').style.color = list.color;

  // filter tasks
  let filtered = tasks.filter(t => t.listId === currentListId);
  if (currentFilter === 'active') filtered = filtered.filter(t => !t.done);
  if (currentFilter === 'done')   filtered = filtered.filter(t => t.done);

  // sort
  filtered = sortTasks(filtered);

  const area = document.getElementById('taskArea');

  if (filtered.length === 0) {
    area.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-text">${currentFilter === 'done' ? 'No completed tasks' : 'No tasks yet'}</div>
      <div class="empty-sub">${currentFilter === 'done' ? 'Complete a task and it will appear here.' : 'Add a task above to get started!'}</div>
    </div>`;
    return;
  }

  // group by done
  const active = filtered.filter(t => !t.done);
  const done   = filtered.filter(t => t.done);

  let html = '';
  if (active.length) {
    if (done.length) html += groupHeader(`Active — ${active.length}`);
    html += active.map(t => taskCard(t)).join('');
  }
  if (done.length) {
    html += groupHeader(`Completed — ${done.length}`);
    html += done.map(t => taskCard(t)).join('');
  }
  area.innerHTML = html;
}

function groupHeader(label) {
  return `<div class="group-header"><span class="group-label">${label}</span><span class="group-line"></span></div>`;
}

function taskCard(t) {
  const list = lists.find(l => l.id === t.listId);
  const dateStr = formatDate(t.date);
  const dateClass = getDateClass(t.date);
  const pBadge = t.priority !== 'none' ? `<span class="priority-badge p-${t.priority}">${t.priority}</span>` : '';
  const dateBadge = dateStr ? `<span class="task-date ${dateClass}">📅 ${dateStr}</span>` : '';
  const noteBadge = t.notes ? `<span class="task-date">📝</span>` : '';
  const listTag = currentListId !== t.listId && list ? `<span class="task-list-tag" style="color:${list.color}">${esc(list.name)}</span>` : '';

  return `<div class="task-card ${t.done ? 'done' : ''}" id="tc_${t.id}">
    <div class="task-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
    <div class="task-body">
      <div class="task-text">${esc(t.text)}</div>
      <div class="task-meta">${pBadge}${dateBadge}${noteBadge}${listTag}</div>
    </div>
    <div class="task-actions">
      <button class="task-btn edit-btn" title="Edit" onclick="openTaskModal('${t.id}')">✎</button>
      <button class="task-btn del-btn"  title="Delete" onclick="deleteTask('${t.id}')">🗑</button>
    </div>
  </div>`;
}

function renderStats() {
  const total   = tasks.length;
  const done    = tasks.filter(t => t.done).length;
  const pending = total - done;
  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statPending').textContent = pending;
}

// ══════════════════════════════════════════
//  SORT
// ══════════════════════════════════════════
const sortModes = ['created','priority','date','alpha'];
const sortLabels = ['Date Created','Priority','Due Date','A → Z'];
const sortIcons  = ['↕','↑','📅','🔤'];
let sortIdx = 0;

function cycleSort() {
  sortIdx = (sortIdx + 1) % sortModes.length;
  currentSort = sortModes[sortIdx];
  document.getElementById('sortLabel').textContent = sortLabels[sortIdx];
  document.getElementById('sortIcon').textContent  = sortIcons[sortIdx];
  renderMain();
}

const priorityOrder = {high:0,medium:1,low:2,none:3};
function sortTasks(arr) {
  if (currentSort === 'priority') return [...arr].sort((a,b) => (priorityOrder[a.priority]??3) - (priorityOrder[b.priority]??3));
  if (currentSort === 'date')     return [...arr].sort((a,b) => { if(!a.date&&!b.date)return 0; if(!a.date)return 1; if(!b.date)return -1; return new Date(a.date)-new Date(b.date); });
  if (currentSort === 'alpha')    return [...arr].sort((a,b) => a.text.localeCompare(b.text));
  return [...arr].sort((a,b) => b.created - a.created); // created desc
}

// ══════════════════════════════════════════
//  LIST ACTIONS
// ══════════════════════════════════════════
function switchList(id) {
  currentListId = id;
  currentFilter = 'all';
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.f === 'all'));
  render();
}

function deleteList(id, e) {
  e.stopPropagation();
  if (lists.length === 1) { toast('You need at least one list.','error'); return; }
  if (!confirm('Delete this list and all its tasks?')) return;
  tasks = tasks.filter(t => t.listId !== id);
  lists = lists.filter(l => l.id !== id);
  if (currentListId === id) currentListId = lists[0].id;
  save(); render();
  toast('List deleted','info');
}

function renameCurrentList(name) {
  const list = lists.find(l => l.id === currentListId);
  if (list && name.trim()) { list.name = name.trim(); save(); renderNav(); }
}

// new list modal
function openNewListModal() {
  editingListId = null;
  document.getElementById('listModalTitle').textContent = 'New List';
  document.getElementById('newListName').value = '';
  selectedColor = LIST_COLORS[0];
  renderColorSwatches();
  document.getElementById('listModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('newListName').focus(), 50);
}

function openEditListModal() {
  const list = lists.find(l => l.id === currentListId);
  if (!list) return;
  editingListId = list.id;
  document.getElementById('listModalTitle').textContent = 'Edit List';
  document.getElementById('newListName').value = list.name;
  selectedColor = list.color;
  renderColorSwatches();
  document.getElementById('listModal').classList.remove('hidden');
}

function closeListModal() { document.getElementById('listModal').classList.add('hidden'); }

function renderColorSwatches() {
  document.getElementById('colorRow').innerHTML = LIST_COLORS.map(c =>
    `<div class="color-swatch ${c===selectedColor?'selected':''}" style="background:${c}"
      onclick="pickColor('${c}')"></div>`).join('');
}

function pickColor(c) { selectedColor = c; renderColorSwatches(); }

function saveList() {
  const name = document.getElementById('newListName').value.trim();
  if (!name) { toast('Please enter a list name','error'); return; }
  if (editingListId) {
    const list = lists.find(l => l.id === editingListId);
    list.name = name; list.color = selectedColor;
  } else {
    const id = 'l_' + Date.now();
    lists.push({id, name, color: selectedColor});
    currentListId = id;
  }
  save(); render(); closeListModal();
  toast(editingListId ? 'List updated' : 'List created ✓','success');
}

// ══════════════════════════════════════════
//  TASK ACTIONS
// ══════════════════════════════════════════
function quickAddTask() {
  const text = document.getElementById('quickAdd').value.trim();
  if (!text) { toast('Type a task name first','error'); return; }
  const date = document.getElementById('quickDate').value;
  const priority = document.getElementById('quickPriority').value;
  addTask(text, date, priority, '', currentListId);
  document.getElementById('quickAdd').value = '';
  document.getElementById('quickDate').value = '';
  document.getElementById('quickPriority').value = 'none';
  toast('Task added ✓','success');
}

function addTask(text, date, priority, notes, listId) {
  const id = 't_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
  tasks.unshift({id, listId, text, done:false, priority: priority||'none', date: date||'', notes: notes||'', created: Date.now()});
  save(); render();
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  save(); renderMain(); renderStats(); renderNav();
  toast(t.done ? '✓ Task completed!' : 'Task reopened','success');
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save(); render();
  toast('Task deleted','info');
}

// ──  TASK MODAL ──
function openTaskModal(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;
  editingTaskId = id;
  document.getElementById('editText').value  = t.text;
  document.getElementById('editDate').value  = t.date;
  document.getElementById('editNotes').value = t.notes;
  selectedPriorityEdit = t.priority;
  renderPriorityRadios();
  // list select
  document.getElementById('editList').innerHTML = lists.map(l =>
    `<option value="${l.id}" ${l.id===t.listId?'selected':''}>${l.name}</option>`).join('');
  document.getElementById('taskModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('editText').focus(), 50);
}

function closeTaskModal() { document.getElementById('taskModal').classList.add('hidden'); editingTaskId=null; }

function selectPriority(p) { selectedPriorityEdit = p; renderPriorityRadios(); }
function renderPriorityRadios() {
  document.querySelectorAll('.p-radio').forEach(r =>
    r.classList.toggle('selected', r.dataset.p === selectedPriorityEdit));
}

function saveTask() {
  const text = document.getElementById('editText').value.trim();
  if (!text) { toast('Task name cannot be empty','error'); return; }
  const t = tasks.find(x => x.id === editingTaskId);
  if (!t) return;
  t.text     = text;
  t.date     = document.getElementById('editDate').value;
  t.priority = selectedPriorityEdit;
  t.notes    = document.getElementById('editNotes').value.trim();
  t.listId   = document.getElementById('editList').value;
  save(); render(); closeTaskModal();
  toast('Task updated ✓','success');
}

// ══════════════════════════════════════════
//  FILTER
// ══════════════════════════════════════════
function setFilter(f, el) {
  currentFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderMain();
}

// ══════════════════════════════════════════
//  DATE HELPERS
// ══════════════════════════════════════════
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target - today) / 86400000);
  const time = d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  if (diff < 0)  return `Overdue · ${d.toLocaleDateString([], {month:'short',day:'numeric'})}`;
  if (diff === 0) return `Today ${time}`;
  if (diff === 1) return `Tomorrow ${time}`;
  if (diff <= 7)  return `${d.toLocaleDateString([], {weekday:'short',month:'short',day:'numeric'})} ${time}`;
  return d.toLocaleDateString([], {month:'short',day:'numeric',year:'numeric'});
}

function getDateClass(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return '';
  const diff = Math.round((d - new Date()) / 86400000);
  if (diff < 0)  return 'overdue';
  if (diff < 1)  return 'today';
  if (diff <= 3) return 'soon';
  return '';
}

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function toast(msg, type='info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.style.animation='toastIn .3s ease reverse both', 2200);
  setTimeout(() => el.remove(), 2600);
}

// ══════════════════════════════════════════
//  CLOSE MODALS ON BACKDROP CLICK
// ══════════════════════════════════════════
document.getElementById('taskModal').addEventListener('click', e => { if(e.target===e.currentTarget)closeTaskModal(); });
document.getElementById('listModal').addEventListener('click', e => { if(e.target===e.currentTarget)closeListModal(); });

// ══════════════════════════════════════════
//  ESCAPE KEY
// ══════════════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTaskModal(); closeListModal(); }
});

// ══════════════════════════════════════════
//  UTIL
// ══════════════════════════════════════════
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
render();
