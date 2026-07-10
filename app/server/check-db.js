const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'orbitpage.db');
const db = new sqlite3.Database(dbPath);

console.log('Checking database at:', dbPath);

db.serialize(() => {
  db.all('SELECT id, title, LENGTH(icon) as icon_length, LENGTH(icon_type) as type_length FROM links', (err, rows) => {
    if (err) {
      console.error('Error querying database:', err);
      return;
    }
    
    console.log('Links in database:');
    console.table(rows);
    
    const longIcons = rows.filter(row => row.icon_length > 200 || row.type_length > 200);
    if (longIcons.length > 0) {
      console.log('\nLinks with long values:');
      console.table(longIcons);
    } else {
      console.log('\nNo links with long values found');
    }
  });
});

db.close();
