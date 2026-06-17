const fs = require('fs');
const path = require('path');

const directory = 'd:/TelyuTask/01_Akademik_Semester/semester_4/PT/zadd-hotel-pms/src/app/app/hk';

function walk(dir, callback) {
  fs.readdir(dir, (err, files) => {
    if (err) throw err;
    files.forEach(file => {
      const filepath = path.join(dir, file);
      fs.stat(filepath, (err, stats) => {
        if (stats.isDirectory()) {
          walk(filepath, callback);
        } else if (stats.isFile() && filepath.endsWith('.tsx')) {
          callback(filepath);
        }
      });
    });
  });
}

function replaceInFile(filepath) {
  fs.readFile(filepath, 'utf8', (err, data) => {
    if (err) throw err;
    let result = data;
    
    // Cards: Apply rounded-2xl, border, shadow-sm
    result = result.replace(/border border-console-border bg-console-surface/g, 'rounded-2xl border border-slate-200 bg-white shadow-sm');
    // Smaller blocks (like table headers or list headers) that had ink bg
    result = result.replace(/border border-console-border bg-console-ink/g, 'rounded-xl border border-slate-200 bg-slate-900 shadow-sm');
    
    // Table specific:
    // If there is an odd/even zebra row logic, make it cleaner
    result = result.replace(/odd:bg-white even:bg-console-bg/g, 'odd:bg-white even:bg-slate-50');
    
    // Links / Buttons (often bg-console-surface or console-ink)
    result = result.replace(/bg-console-surface hover:bg-console-bg/g, 'bg-white hover:bg-slate-50');
    result = result.replace(/border-console-ink bg-console-ink/g, 'rounded-xl bg-blue-600 border-blue-600 shadow-sm');
    result = result.replace(/border border-console-ink/g, 'border border-blue-600');
    result = result.replace(/hover:bg-slate-800/g, 'hover:bg-blue-700');
    
    // Text colors
    result = result.replace(/text-console-ink/g, 'text-slate-900');
    result = result.replace(/text-console-accent/g, 'text-blue-600');
    
    // Headers inside cards that were console-ink
    result = result.replace(/border-b border-console-border bg-console-ink/g, 'border-b border-slate-200 bg-slate-50/50 rounded-t-2xl');
    
    // General background replacements (fallback for things not matching above)
    result = result.replace(/bg-console-bg/g, 'bg-slate-50');
    result = result.replace(/bg-console-surface/g, 'bg-white');
    result = result.replace(/border-console-border-soft/g, 'border-slate-100');
    result = result.replace(/border-console-border/g, 'border-slate-200');
    result = result.replace(/bg-console-ink/g, 'bg-slate-900');
    
    // Typography (Font Inter and Softening uppercase)
    result = result.replace(/font-mono/g, 'font-inter');
    result = result.replace(/uppercase tracking-\[0\.08em\]/g, 'font-medium tracking-tight');
    result = result.replace(/uppercase tracking-\[0\.04em\]/g, 'font-medium tracking-tight');
    result = result.replace(/uppercase tracking-\[0\.02em\]/g, 'font-semibold tracking-tight');
    result = result.replace(/uppercase tracking-\[0\.06em\]/g, 'font-medium tracking-tight');
    result = result.replace(/uppercase tracking-\[0\.10em\]/g, 'font-medium tracking-tight');
    
    // specific blue fixes if text-console-accent on dark bg became text-blue-600 (we might want it white but manual fix later)
    
    if (data !== result) {
      fs.writeFile(filepath, result, 'utf8', err => {
        if (err) throw err;
        console.log(`Updated ${filepath}`);
      });
    }
  });
}

walk(directory, replaceInFile);
