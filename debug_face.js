const {JSDOM} = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync('face.html','utf8');
const dom = new JSDOM(html);
// just static check: ensure our code contains PM-C removal logic
const s = html;
console.log('PM-C skip logic present:', s.includes("isDermaRollerDay && tk === 'PM-C'"));
console.log('Ledger guard present:', s.includes('delete ledger[k]'));
console.log('Pattern present:', s.includes('dayNum % 12 === 8'));
