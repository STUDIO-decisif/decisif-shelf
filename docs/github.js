export const STORAGE = 'storage';
export const MAX_FILE_SIZE = 25 * 1024 * 1024;
const API = 'https://api.github.com';
const encodePath = path => path.split('/').map(encodeURIComponent).join('/');

export function storagePath(relative = '') {
  if (relative.startsWith('/') || relative.includes('\\') || relative.split('/').some(p => p === '.' || p === '..')) throw new Error('无效的存储路径。');
  return relative ? `${STORAGE}/${relative}` : STORAGE;
}
export function validateFile(file) {
  if (!file.name || /[/\\\u0000-\u001f]/.test(file.name) || ['.', '..', '.gitkeep'].includes(file.name)) throw new Error('文件名称不可用，请重命名后重试。');
  if (file.size > MAX_FILE_SIZE) throw new Error('超过本站单文件 25 MiB 的限制。');
}
export function fileCategory(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['png','jpg','jpeg','gif','webp','svg','avif','heic','bmp','ico'].includes(ext)) return 'image';
  if (['pdf','doc','docx','ppt','pptx','xls','xlsx','csv','txt','md','rtf','json','c','h','cpp','js','html','css','py'].includes(ext)) return 'document';
  return 'other';
}
export function formatSize(bytes) {
  if (bytes < 1000) return `${bytes} B`;
  const units = ['KB','MB','GB']; let n = bytes / 1000, i = 0;
  while (n >= 1000 && i < units.length - 1) { n /= 1000; i++; }
  return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
}
function base64(buffer) {
  const bytes = new Uint8Array(buffer); let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export class GitHubStorage {
  constructor({owner, repo, branch, token = ''}, fetcher = globalThis.fetch) {
    if (!/^[A-Za-z0-9-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo) || ['.', '..'].includes(repo) || !branch?.trim()) throw new Error('请填写有效的用户名、仓库名和分支。');
    this.config = {owner, repo, branch}; this.token = token; this.fetcher = fetcher;
    this.root = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  }
  async request(path, {method = 'GET', body, raw = false} = {}) {
    const headers = {Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28'};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    if (body) headers['Content-Type'] = 'application/json';
    let response;
    try { response = await this.fetcher(API + this.root + path, {method, headers, body: body ? JSON.stringify(body) : undefined, cache:'no-store', signal:AbortSignal.timeout(120000)}); }
    catch { throw new Error('请求未完成，请检查网络。上传时可先刷新列表，确认是否已经保存，再重试。'); }
    if (!response.ok) {
      const messages = {401:'令牌无效或已过期，请在连接设置中重新填写。',403:'请求被拒绝。请检查令牌 Contents 权限、仓库访问权或 API 频率限制。',404:'找不到仓库、分支或文件，或当前令牌没有访问权限。',409:'仓库有冲突或分支尚未初始化，请刷新列表后重试。',422:'无法保存，请检查文件名称、分支保护规则或仓库写入权限。',429:'请求过于频繁，请稍后再试。'};
      const error = new Error(messages[response.status] || `GitHub 请求失败（${response.status}），请稍后重试。`); error.status = response.status; throw error;
    }
    return raw ? response.blob() : response.json();
  }
  async connect() {
    const repo = await this.request('');
    await this.request(`/branches/${encodeURIComponent(this.config.branch)}`);
    return repo;
  }
  contentURL(relative = '') { return `/contents/${encodePath(storagePath(relative))}`; }
  async list(relative = '') {
    try {
      const data = await this.request(`${this.contentURL(relative)}?ref=${encodeURIComponent(this.config.branch)}`);
      if (!Array.isArray(data)) throw new Error('这个路径不是文件夹。');
      return data.filter(item => item.name !== '.gitkeep' && ['file','dir'].includes(item.type));
    } catch (error) {
      // An absent root is normal in a new repository. Verify access and branch
      // before treating 404 as empty, so expired access is never hidden.
      if (error.status === 404 && !relative) { await this.connect(); return []; }
      throw error;
    }
  }
  async upload(file, relative = '') {
    validateFile(file);
    if (!this.token) throw new Error('上传需要访问令牌，请打开连接设置填写。');
    const path = relative ? `${relative}/${file.name}` : file.name;
    // No SHA is supplied: GitHub rejects existing paths instead of overwriting.
    return this.request(this.contentURL(path), {method:'PUT', body:{message:`Shelf: upload ${file.name}`, branch:this.config.branch, content:base64(await file.arrayBuffer())}});
  }
  download(relative) { return this.request(`${this.contentURL(relative)}?ref=${encodeURIComponent(this.config.branch)}`, {raw:true}); }
}
