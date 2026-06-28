const { isScheduleActive } = require('./dist/server.cjs');
const fs = require('fs');
const people = JSON.parse(fs.readFileSync('./data/people.json', 'utf8'));
people.forEach(p => {
  const active = isScheduleActive(p);
  console.log(`${p.name} | enabled: ${p.enabled} | active: ${active}`);
});
