import {GitHubStorage, validateFile, fileCategory, formatSize} from './github.js';
const $ = id => document.getElementById(id);
const PREFS = 'decisif-shelf.repository.v1';
let client = null, entries = [], directory = '', filter = 'all', uploading = false, loading = false, connecting = false, listVersion = 0, toastTimer;
const categoryNames = {image:'图片',document:'文档',other:'其他'};
const filterNames = {all:'全部文件',document:'文档',image:'图片',other:'其他文件'};
function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg','use');
  use.setAttribute('href',`#i-${name}`); svg.setAttribute('aria-hidden','true'); svg.append(use); return svg;
}
function syncFilters() {
  document.querySelectorAll('[data-filter]').forEach(button => { const active = button.dataset.filter === filter; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
}
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 6500); }
function openSettings() { if (!$('settings').open) $('settings').showModal(); }
function setBusy() {
  for (const id of ['empty-upload','upload-button','refresh','connect-submit','disconnect','queue-close']) $(id).disabled = uploading || loading || connecting;
  $('dropzone').setAttribute('aria-busy',String(loading || uploading));
  for (const button of $('breadcrumbs').querySelectorAll('button')) button.disabled = uploading || loading;
}
function updateConnection() {
  $('connect-open').classList.toggle('connected', Boolean(client));
  $('connection-dot').classList.toggle('connected',Boolean(client));
  document.querySelector('.workspace-footer').classList.toggle('connected',Boolean(client));
  $('connection-banner').hidden = Boolean(client);
  $('connection-label').textContent = client ? `${client.config.owner} / ${client.config.repo}` : '尚未连接仓库';
  $('storage-summary').textContent = client ? `${client.config.branch} / storage · 文件直接保存在 GitHub` : '由你的 GitHub 仓库存储';
}
function renderBreadcrumbs() {
  const root = document.createElement('button'); root.append(icon('folder'),document.createTextNode('所有文件')); root.onclick = () => { if (client) refresh(''); else { filter = 'all'; syncFilters(); render(); } };
  $('breadcrumbs').replaceChildren(root);
  let path = '';
  for (const part of directory.split('/').filter(Boolean)) {
    path += (path ? '/' : '') + part;
    const target = path, separator = document.createElement('span'), button = document.createElement('button');
    separator.textContent = '/'; button.textContent = part; button.onclick = () => refresh(target); $('breadcrumbs').append(separator, button);
  }
}
function render() {
  const search = $('search').value.trim().toLocaleLowerCase();
  const sort = $('sort').value;
  const visible = entries.filter(item => item.name.toLocaleLowerCase().includes(search) && (filter === 'all' || (item.type !== 'dir' && fileCategory(item.name) === filter))).sort((a,b) => {
    const folders = (a.type === 'dir' ? 0 : 1) - (b.type === 'dir' ? 0 : 1);
    const names = a.name.localeCompare(b.name,'zh-CN',{numeric:true});
    return folders || (sort.startsWith('size') ? ((a.size - b.size) * (sort === 'size-desc' ? -1 : 1) || names) : names * (sort === 'name-desc' ? -1 : 1));
  });
  $('page-title').textContent = filterNames[filter];
  $('page-description').textContent = directory ? `正在浏览 ${directory} 文件夹` : filter === 'all' ? '所有值得保存的，都在这里。' : `查看当前文件夹中的${filterNames[filter]}。`;
  for (const name of ['all','document','image','other']) $('count-' + name).textContent = entries.filter(item => name === 'all' || (item.type !== 'dir' && fileCategory(item.name) === name)).length;
  $('file-list').replaceChildren();
  for (const item of visible) {
    const row = document.createElement('tr'), nameCell = document.createElement('td'), size = document.createElement('td'), type = document.createElement('td'), action = document.createElement('td');
    const isDir = item.type === 'dir', cat = fileCategory(item.name), wrap = document.createElement(isDir ? 'button' : 'div'), icon = document.createElement('span'), label = document.createElement('span');
    wrap.className = `filename${isDir ? ' folder-button' : ''}`; icon.className = `file-icon ${isDir ? 'folder' : cat}`;
    const glyph = document.createElementNS('http://www.w3.org/2000/svg','svg'), use = document.createElementNS('http://www.w3.org/2000/svg','use');
    use.setAttribute('href',`#i-${isDir ? 'folder' : cat === 'other' ? 'box' : cat}`); glyph.setAttribute('aria-hidden','true'); glyph.append(use); icon.append(glyph);
    label.className = 'file-name'; label.textContent = item.name; label.title = item.name; wrap.append(icon,label); nameCell.append(wrap);
    const relative = directory ? `${directory}/${item.name}` : item.name;
    if (isDir) { wrap.onclick = () => refresh(relative); wrap.disabled = uploading || loading; }
    else { const button = document.createElement('button'); button.className = 'download'; button.append(makeDownloadIcon()); button.title = `下载 ${item.name}`; button.setAttribute('aria-label',`下载 ${item.name}`); button.onclick = () => download(item, relative, button); action.append(button); }
    size.textContent = isDir ? '—' : formatSize(item.size); type.textContent = isDir ? '文件夹' : categoryNames[cat]; row.append(nameCell,size,type,action); $('file-list').append(row);
  }
  $('file-count').textContent = `${visible.length} 个项目`;
  $('folder-size').textContent = formatSize(visible.reduce((sum,item) => sum + (item.type === 'dir' ? 0 : item.size),0));
  $('empty-state').hidden = visible.length > 0;
  const filtered = Boolean(search) || filter !== 'all';
  $('empty-title').textContent = loading ? '正在读取文件' : !client ? '留一处，给值得收藏的。' : filtered ? '没有找到匹配的文件' : '从第一份收藏开始。';
  $('empty-description').textContent = loading ? '请稍候，正在获取当前文件夹的内容。' : !client ? '连接你的仓库，让文档、影像与灵感各有归处。' : filtered ? '试试其他关键词，或清除当前搜索与分类。' : '将文件拖到这里，或点击下方按钮上传。';
  $('empty-connect').hidden = Boolean(client) || loading;
  $('empty-upload').hidden = !client || filtered || loading;
  $('clear-search').hidden = !client || !filtered || loading;
  $('empty-hint').hidden = filtered || loading;
  renderBreadcrumbs(); setBusy();
}
function makeDownloadIcon() { return icon('download'); }
function setTypography(mode) {
  document.documentElement.setAttribute('data-type',mode);
  for (const type of ['serif','modern']) { $('type-' + type).classList.toggle('active',mode === type); $('type-' + type).setAttribute('aria-pressed',String(mode === type)); }
  try { localStorage.setItem('decisif-shelf.typography',mode); } catch { /* Optional local preference. */ }
}
for (const mode of ['serif','modern']) $('type-' + mode).onclick = () => setTypography(mode);
try { if (localStorage.getItem('decisif-shelf.typography') === 'modern') setTypography('modern'); } catch { /* Optional local preference. */ }
async function refresh(target = directory) {
  if (!client) { openSettings(); return; }
  if (uploading || loading) return;
  const active = client, version = ++listVersion; loading = true; render();
  try { const data = await active.list(target); if (version === listVersion && client === active) { entries = data; directory = target; if (data.length >= 999) toast('文件夹接近 API 的 1000 项上限，建议使用子文件夹整理。'); } }
  catch (error) { toast(error.message); }
  finally { if (version === listVersion) { loading = false; render(); } }
}
async function download(item, path, button) {
  const active = client; if (!active) return;
  button.disabled = true; button.textContent = '读取中…';
  try {
    const blob = await active.download(path), url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = item.name; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url),60000); toast(`已发起下载：${item.name}`);
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.replaceChildren(makeDownloadIcon()); }
}
function chooseFiles() {
  if (uploading || loading) return;
  if (!client || !client.token) { toast('请先连接仓库并填写具有写入权限的令牌。'); openSettings(); return; }
  $('file-input').click();
}
async function uploadFiles(files) {
  if (!files.length) return;
  if (uploading || loading || connecting) { toast('请等待当前操作完成。'); return; }
  if (!client?.token) { toast('请先连接仓库并填写具有写入权限的令牌。'); openSettings(); return; }
  const active = client, target = directory;
  uploading = true; render(); $('transfer-panel').hidden = false; $('queue').hidden = false; $('queue').replaceChildren(); $('transfer-title').textContent = `正在上传 ${files.length} 个文件`;
  let success = 0; const knownNames = new Set(entries.map(item => item.name));
  for (const file of files) {
    const status = document.createElement('div'); status.textContent = `${file.name} · 正在上传…`; $('queue').append(status);
    try {
      validateFile(file);
      if (knownNames.has(file.name)) throw new Error('已有同名文件，已跳过。请重命名后上传。');
      await active.upload(file,target); knownNames.add(file.name); success++; status.className = 'done'; status.textContent = `${file.name} · 已保存到仓库`;
    } catch (error) { status.className = 'failed'; status.textContent = `${file.name} · ${error.message}`; }
  }
  uploading = false; $('transfer-title').textContent = `上传完成 · ${success} / ${files.length} 个成功`; setBusy(); toast(`${success} / ${files.length} 个文件已保存到 GitHub。`); await refresh(target);
}
for (const id of ['settings-open','connect-open','empty-connect','footer-settings','banner-connect']) $(id).onclick = openSettings;
$('settings-close').onclick = () => { if (!connecting) $('settings').close(); };
$('settings').addEventListener('cancel',event => { if (connecting) event.preventDefault(); });
for (const id of ['empty-upload','upload-button']) $(id).onclick = chooseFiles;
$('sort').onchange = render;
$('queue-close').onclick = () => { if (!uploading) $('transfer-panel').hidden = true; };
$('clear-search').onclick = () => { $('search').value = ''; filter = 'all'; syncFilters(); render(); };
for (const view of ['list','grid']) $('view-' + view).onclick = () => {
  $('table-wrap').classList.toggle('grid-view',view === 'grid');
  for (const mode of ['list','grid']) { $('view-' + mode).classList.toggle('active',mode === view); $('view-' + mode).setAttribute('aria-pressed',String(mode === view)); }
};
$('file-input').onchange = event => { const files = Array.from(event.target.files); event.target.value = ''; uploadFiles(files); };
$('refresh').onclick = () => refresh(); $('search').oninput = render;
for (const button of document.querySelectorAll('[data-filter]')) button.onclick = () => { filter = button.dataset.filter; syncFilters(); render(); };
document.addEventListener('keydown',event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !$('settings').open) { event.preventDefault(); $('search').focus(); $('library').scrollIntoView(); } });
document.addEventListener('keydown',event => { if ((event.metaKey || event.ctrlKey) && event.key === ',') { event.preventDefault(); openSettings(); } });
if (/Mac|iPhone|iPad/.test(navigator.platform)) $('search-shortcut').textContent = '⌘ K';
let dragDepth = 0;
const zone = $('dropzone');
zone.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; zone.classList.add('dragover'); });
zone.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
zone.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; zone.classList.remove('dragover'); } });
zone.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; zone.classList.remove('dragover'); const items = Array.from(event.dataTransfer.items || []); if (items.some(i => i.webkitGetAsEntry?.()?.isDirectory)) { toast('暂不支持拖入整个文件夹，请打开文件夹后选择其中的文件。'); return; } uploadFiles(Array.from(event.dataTransfer.files)); });
window.addEventListener('dragover', event => event.preventDefault()); window.addEventListener('drop', event => event.preventDefault());
window.addEventListener('beforeunload',event => { if (uploading) { event.preventDefault(); event.returnValue = ''; } });
$('settings-form').onsubmit = async event => {
  event.preventDefault(); if (uploading || loading || connecting) return;
  const config = {owner:$('owner').value.trim(),repo:$('repo').value.trim(),branch:$('branch').value.trim(),token:$('token').value.trim()};
  connecting = true; setBusy(); $('settings-error').textContent = ''; $('connect-submit').textContent = '连接中…';
  try {
    const candidate = new GitHubStorage(config), info = await candidate.connect();
    if (config.token && info.permissions && !info.permissions.push) throw new Error('此账号没有仓库写入权限。可以清空令牌，以只读方式连接公开仓库。');
    const data = await candidate.list('');
    client = candidate; entries = data; directory = ''; $('search').value = ''; filter = 'all';
    syncFilters();
    try { localStorage.setItem(PREFS,JSON.stringify(candidate.config)); } catch { /* Storage may be disabled. */ }
    $('token').value = ''; $('settings').close(); updateConnection(); render(); toast(config.token ? '仓库已连接。现在可以上传文件。' : '已连接，只读浏览模式。填写令牌后可上传。');
  } catch (error) { $('settings-error').textContent = error.message; }
  finally { connecting = false; $('connect-submit').textContent = '连接仓库'; setBusy(); }
};
$('disconnect').onclick = () => {
  if (uploading || loading || connecting) return;
  client = null; entries = []; directory = ''; listVersion++;
  try { localStorage.removeItem(PREFS); } catch { /* Storage may be disabled. */ }
  $('settings-form').reset(); $('settings-error').textContent = ''; $('queue').hidden = true; $('transfer-panel').hidden = true; $('settings').close(); updateConnection(); render(); toast('已断开仓库，连接信息和令牌已清除。');
};
try { const saved = JSON.parse(localStorage.getItem(PREFS)); if (saved) for (const key of ['owner','repo','branch']) if (typeof saved[key] === 'string') $(key).value = saved[key]; } catch { /* Ignore invalid or unavailable saved preferences. */ }
render();
