var csv = require('fast-csv');
const https = require('https');
var fs = require('fs');
var moment = require('moment');
moment().format();
//"Apr 18, 2022, 8:09:58 PM"
const dateFormat = "MMM D, yyyy, h:mm:ss A";
// const { assert } = require('console');
var JSSoup = require('jssoup').default;
var tasks = [];
const payloadText = fs.readFileSync("post.json");
var POST_URI = "/api/v1/create";
require('dotenv').config();
var CAS_HOST = process.env.CAS_HOST;
var API_KEY = process.env.API_KEY;

var authors = {
  'utsaengineer': 'Klesse College',
  'rorydew': 'Rory Dew',
  'seangarnsey': 'Sean Garnsey'
};
var catHash = {
  'CACP': 'architecture-planning',
  'Civil and Environmental Engineering': 'civil-environmental-construction-management',
  'COE Announcements': ['announcement', 'klesse-college'],
  'UTSA COE': 'klesse-college',
  'Electrical and Computer Engineering': 'electrical-computer',
  'Mechanical Engineering': 'mechanical',
  'Mechanical Announcements': ['mechanical', 'announcement'],
  'Biomedical Engineering': 'biomedical-chemical'
};

var writableStream = fs.createWriteStream("exported.csv");
//var stream = fs.createReadStream("input.csv");
const stream = csv.format();
stream.pipe(writableStream);
headerOutput = ["id", "title", "author", "epoch", "date", "url", "categories", "slug", "image", "snippet", "cas"];
stream.write(headerOutput);
writableStream.on("finish", function(){ console.log("DONE!"); });

fs.createReadStream('curated.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    var parsedData = obj;
    tasks.push(parsedData);
  }).on("end", function() {

  async function wrapper () {
      await Promise.all(tasks.map(processEachTask));
      afterAllTasks();
  }
  wrapper();

  function processEachTask(task, callback) {
    // read csv row

    // read in snippet
    let articleContentPath = "broken/" + task.snippet;
    console.log(articleContentPath);
    var snippetHtml = fs.readFileSync(articleContentPath);
    var soup = new JSSoup(snippetHtml, false);
    // var innerElements = soup.find('div', {'class': 'itemBody'}).contents;
    // let payloadHtml = "";
    // console.dir(innerElements);
    // innerElements.map(inner => {
      // console.log(inner);
      // payloadHtml = payloadHtml + inner.prettify();
    // });
    // console.log("attempting content:");
    // console.log(payloadHtml);
    
    // read in json template
    let payload = JSON.parse(payloadText);
    // update json template
    // console.log(payload);
    let sdn = payload.asset.page.structuredData.structuredDataNodes; //array
    // sdn[1].structuredDataNodes[0].filePath = "College-PROTOTYPE:college-dls/college/images/News_Blog-1.png";
    sdn[1].structuredDataNodes[0].filePath = task.image;
    var snippetText = soup.prettify('', '');
    snippetText = snippetText
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2014\u2013]/g, '-');
    sdn[6].text = snippetText;
    console.log("***************");
    console.log(snippetText);
    console.log("***************");
    // sdn[6].text = "wysiwyg text";
    // sdn[6].text = "wysiwyg text";
    // asset.page.tags = [ categories ];
    var categories = []
    var rawCats = task.categories.split('|');

    rawCats.map(cat => {
      var newCats = catHash[cat.trim()];
      console.log("attempting to add new cats: " + newCats);
      if (Array.isArray(newCats)) {
        newCats.map(innerCat => {
          categories.push({"name" : innerCat });
        });
      } else {
        categories.push({ "name": newCats });
      }
    });
    payload.asset.page.tags = categories;
    // asset.page.name = slug without .html
    payload.asset.page.name = task.slug;
    // asset.page.metadata.title = title
    payload.asset.page.metadata.title = task.title;
    // asset.page.metadata.author = author
    payload.asset.page.metadata.author = authors[task.author];
    // asset.page.metadata.startDate = "Sep 12, 2022, 12:00:00 AM"
    payload.asset.page.metadata.startDate = task.date;
    var date = moment(task.date, dateFormat);
    var year = date.year();
    var month = date.month() + 1;
    if (month < 10) {
      month = '0' + month;
    }
    payload.asset.page.parentFolderPath = "news/" + year + "/" + month;
    // console.log(payload.asset.page.parentFolderPath);
    // POST to CAS
    var postData = JSON.stringify(payload);
    console.log(postData);
    console.log("\n");
    var postResponse = "";
    var postOptions = {
      hostname: CAS_HOST,
      port: 443,
      path: POST_URI,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        Authorization: ' Bearer ' + API_KEY
      }
    };
    const post = https.request(postOptions, res => {
      // console.log('status code: ' + res.statusCode);
      // console.log('headers:', res.headers);
      res.on('data', d => {
        postResponse = postResponse + d;
        process.stdout.write(d);
        process.stdout.write('\t' + payload.asset.page.parentFolderPath + "\t" + payload.asset.page.name);
        process.stdout.write('\n');
      });
    });
    post.on('error', (e) => {
      console.log('error on POST');
      console.error(e);
    })
    post.write(postData);
    post.end();
  }

  function afterAllTasks(err) {
    console.log("all promises complete");
  }
});
/*
csv.parseStream(stream, {headers : true}).on("data", function(obj){
}).on("end", function() {
*/
