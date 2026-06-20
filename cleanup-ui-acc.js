const fs = require('fs');
const path = require('path');

const directory = 'd:/TelyuTask/01_Akademik_Semester/semester_4/PT/zadd-hotel-pms/src/app/app/acc';

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
    
    // Fix missed classes
    result = result.replace(/focus:border-console-ink/g, 'focus:border-blue-500 focus:ring-blue-500/20');
    result = result.replace(/border-console-ink/g, 'border-slate-300 hover:border-slate-400');
    result = result.replace(/accent-console-accent/g, 'accent-blue-600');
    result = result.replace(/accent-console-ink/g, 'accent-blue-600');
    result = result.replace(/bg-console-accent/g, 'bg-blue-600');
    result = result.replace(/text-console-accent/g, 'text-blue-600');
    result = result.replace(/divide-console-border/g, 'divide-slate-200');
    result = result.replace(/bg-console-border/g, 'bg-slate-200');
    
    // Fix inputs and selects that don't have border-radius
    result = result.replace(/border border-slate-400 bg-white/g, 'rounded-xl border border-slate-300 bg-white');
    
    // Clean up focus shadows
    result = result.replace(/focus:shadow-\[0_0_0_3px_rgba\(15,23,42,0\.08\)\]/g, 'focus:ring-4 focus:ring-blue-500/10 focus:outline-none');
    
    // Fix any stray rounded-none
    result = result.replace(/rounded-none/g, 'rounded-xl');
    
    if (data !== result) {
      fs.writeFile(filepath, result, 'utf8', err => {
        if (err) throw err;
        console.log('Updated', filepath);
      });
    }
  });
}

walk(directory, replaceInFile);
