const fs = require('fs');
const path = require('path');
const assert = require('assert');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const declared = new Set(app.pages);
const failures = [];

function walk(directory, out) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === '.vscode' || entry.name.startsWith('program-backup-')) return;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  });
}

const files = [];
walk(root, files);

files.filter((file) => file.endsWith('.json')).forEach((file) => {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push('JSON: ' + path.relative(root, file) + ' — ' + error.message);
  }
});

files.filter((file) => file.endsWith('.js')).forEach((file) => {
  try {
    childProcess.execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (error) {
    failures.push('JS: ' + path.relative(root, file));
  }
});

app.pages.forEach((page) => {
  ['.js', '.json', '.wxml', '.wxss'].forEach((extension) => {
    if (!fs.existsSync(path.join(root, page + extension))) {
      failures.push('缺少页面文件: ' + page + extension);
    }
  });
});

app.tabBar.list.forEach((item) => {
  if (!declared.has(item.pagePath)) failures.push('Tab 未声明: ' + item.pagePath);
});

app.pages.forEach((page) => {
  const jsPath = path.join(root, page + '.js');
  const wxmlPath = path.join(root, page + '.wxml');
  const source = fs.readFileSync(jsPath, 'utf8');
  const markup = fs.readFileSync(wxmlPath, 'utf8');
  const handlers = Array.from(markup.matchAll(/(?:bind|catch)(?:tap|change|input|confirm|submit|longpress)="([A-Za-z_$][\w$]*)"/g))
    .map((match) => match[1]);
  handlers.forEach((handler) => {
    const found = new RegExp('(?:^|[,{\\s])' + handler.replace('$', '\\$') + '\\s*\\(').test(source);
    if (!found) failures.push('未绑定处理函数: ' + page + ' -> ' + handler);
  });
  const routes = Array.from(source.matchAll(/['"]\/(pages\/[^?'"]+)/g)).map((match) => match[1]);
  routes.forEach((route) => {
    if (!declared.has(route)) failures.push('路由未声明: ' + page + ' -> ' + route);
  });
});

assert.deepStrictEqual(failures, [], failures.join('\n'));
process.stdout.write('Static checks: PASS (' + app.pages.length + ' pages)\n');
