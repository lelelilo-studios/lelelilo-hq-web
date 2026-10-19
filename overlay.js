// What is drawn over the game's picture, crisp at any size: a name tag over each lelelilo, and the card of the one
// picked (a pillow's law label, as lelelilo.com's Tag is). The game works out where and what; this only draws it.
//
// The game calls window.hqOverlay:
//   roster(json)   once: [{ name, role, dept, color, owner? }, …], the employees then the owner (Lumina)
//   tags(numbers)  every frame: five numbers a person, in the roster's order: x, y (the point over its head) and
//                  its height on screen, in CSS pixels; status (0 working, 1 waiting for you, 2 idle, 3 not here);
//                  flags (1 pointed at, 2 picked)
//   card(json)     the picked one's card, a few times a second; null closes it
// and is told back, by a `hq-ui` event: `deselect`, or `select:<n>`.

const ui = what => dispatchEvent(new CustomEvent('hq-ui', { detail: what }));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const layer = document.getElementById('tags');
const card = document.getElementById('card');
let people = [], tagEls = [], shownCard = '', openWho = null;

// the card's look of each state: what it says, and its mark
const STATUS = {
  working: { word: 'Working', cls: 'working' },
  waiting: { word: 'Waiting for you', cls: 'waiting' },
  idle: { word: 'Idle', cls: 'idle' },
  away: { word: 'Gone home', cls: 'away' },
};

function roster(json) {
  people = JSON.parse(json);
  layer.textContent = '';
  tagEls = people.map(p => {
    const el = document.createElement('div');
    el.className = 'nametag' + (p.owner ? ' owner' : '');
    el.style.setProperty('--c', p.color);
    el.innerHTML = `<i class="dot"></i><span>${esc(p.name)}</span>`;
    layer.appendChild(el);
    return el;
  });
}

function tags(v) {
  for (let i = 0; i < tagEls.length; i++) {
    const el = tagEls[i], o = i * 5;
    const [x, y, tall, status, flags] = [v[o], v[o + 1], v[o + 2], v[o + 3], v[o + 4]];
    // (tags fade out as everyone gets small; the picked and the pointed-at keep theirs)
    const keep = flags !== 0;
    const k = status === 3 ? 0 : keep ? 1 : Math.max(0, Math.min(1, (tall - 18) / 12));
    if (k <= 0.01) { if (el.style.opacity !== '0') el.style.opacity = '0'; continue; }
    el.style.opacity = k.toFixed(2);
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    el.style.zIndex = String(Math.round(y) + (flags & 2 ? 10000 : 0));
    const cls = 'nametag' + (people[i]?.owner ? ' owner' : '') + (status === 1 ? ' waiting' : status === 2 ? ' idle' : '')
      + (flags & 1 ? ' hovered' : '') + (flags & 2 ? ' picked' : '');
    if (el.className !== cls) el.className = cls;
  }
}

function row(label, html) {
  return html ? `<dt>${label}</dt><dd>${html}</dd>` : '';
}

function employeeCard(c) {
  const s = STATUS[c.status] || STATUS.idle;
  const now = c.status === 'away' ? s.word
    : `<b class="state ${s.cls}"><i></i>${s.word}</b>${c.status === 'idle' ? '' : ` · ${esc(c.doing)}`} <small>${esc(c.since)}</small>`;
  const helpers = c.helpers.length ? c.helpers.map(h => `<span class="helper">${esc(h)}</span>`).join('') : '';
  const lately = c.log.length
    ? `<ul class="lately">${c.log.map(([ago, line]) => `<li><small>${esc(ago)}</small>${esc(line)}</li>`).join('')}</ul>` : '';
  return `
    <h2 id="card-name">${esc(c.name)}</h2>
    <p class="who">${esc(c.role)} · <span class="dept"><i></i>${esc(c.dept)}</span></p>
    <dl>
      ${row('Now', now)}
      ${row('Task', c.task ? esc(c.task) : '<span class="none">none just now</span>')}
      ${row('Helpers', helpers)}
      ${row('Folder', `<code>${esc(c.folder)}</code>`)}
      ${row('Lately', lately)}
    </dl>
    <p class="care">${esc(c.fabric)} · ${esc(c.personality.toLowerCase())} · do not remove this label</p>`;
}

function ownerCard(c) {
  const waiting = c.waiting.length
    ? `<ul class="asks">${c.waiting.map(([name, ask, ago, who]) =>
        `<li><button type="button" data-who="${who}">${esc(name)}</button> ${esc(ask)} <small>${esc(ago)}</small></li>`).join('')}</ul>`
    : '<span class="none">Nobody: everyone has what they need.</span>';
  return `
    <h2 id="card-name">${esc(c.name)}</h2>
    <p class="who">${esc(c.role)}</p>
    <dl>
      ${row('Waiting', waiting)}
      ${row('Stamped', `${c.approved} paper${c.approved === 1 ? '' : 's'} so far`)}
    </dl>
    <p class="care">Everyone here works for you. When one of them needs you, they queue at your desk with a paper.</p>`;
}

function showCard(json) {
  if (!json) {
    if (openWho !== null) { card.classList.remove('open'); document.body.classList.remove('carded'); openWho = null; shownCard = ''; }
    return;
  }
  if (json === shownCard) return;
  shownCard = json;
  const c = JSON.parse(json);
  const fresh = openWho !== c.who;
  openWho = c.who;
  const body = card.querySelector('.body');
  const scroll = body.scrollTop;
  card.style.setProperty('--c', c.color);
  card.classList.toggle('owner', !!c.owner);
  body.innerHTML = c.owner ? ownerCard(c) : employeeCard(c);
  if (fresh) {
    body.scrollTop = 0;
    card.classList.remove('open');
    void card.offsetWidth;
    card.classList.add('open');
    document.body.classList.add('carded');
  } else {
    body.scrollTop = scroll;
  }
}

card.querySelector('.close').addEventListener('click', () => ui('deselect'));
card.addEventListener('keydown', e => { if (e.key === 'Escape') { ui('deselect'); document.getElementById('lelelilo').focus(); } });
card.addEventListener('click', e => {
  const b = e.target.closest('button[data-who]');
  if (b) ui('select:' + b.dataset.who);
});

window.hqOverlay = { roster, tags, card: showCard };
