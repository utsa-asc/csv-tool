const mysql = require('mysql');
const connection = mysql.createConnection({
  host: '192.168.7.44',
  user: 'eeuser',
  password: 'supersecret',
  database: 'expression'
});

connection.connect((err) => {
  if (err) throw err;
  console.log('Connected!');

  connection.query('SELECT titles.entry_id, titles.title, titles.url_title as uri, titles.status, data.location, data.description, FROM_UNIXTIME(data.date1, \'%Y-%m-%d %H:%i:%s\') as date, data.num2 FROM exp_channel_data as data INNER JOIN exp_channel_titles as titles ON (data.entry_id = titles.entry_id) order by data.date1 desc LIMIT 3;', (err, rows) => {
    if(err) throw err;

    console.log('Data rows received from DB:');
    console.log(rows);
  });
});