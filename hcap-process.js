var csv = require('fast-csv');
// const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
var writableStream = fs.createWriteStream("hcap/hcap-faculty-processed.csv");
require('dotenv').config();
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const POST_URI = "/api/v1/create";
const stream = csv.format();
stream.pipe(writableStream);
headerOutput = ["Last", "First", "Title", "Research", "Education", "Discipline", "Tag", "Email", "CAS-URI"];
stream.write(headerOutput);
writableStream.on("finish", function(){ console.log("DONE!"); });

fs.createReadStream('hcap/hcap-faculty-single-dept.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    // console.log("parsing row: " + obj.id);
    var parsedData = {
      last: obj.Last,
      first: obj.First,
      title: obj.Title,
      discipline: obj.Discipline,
      tag: obj.Tag,
      email: obj.Email
    }
    tasks.push(parsedData);
    // processEachTask(parsedData);
    // execSync('sleep 1'); // block process for 1 second.
  }).on("end", function() {
  /*
  Promise.all(tasks.map(processEachTask)).then(afterAllTasks);
  // async/await notation:
  // you must be in an "async" environement to use "await"
  */
  async function wrapper () {
    console.log("task count: " + tasks.length);

    for(let t of tasks) {
      await processEachTask(t);
      // execSync('sleep 1');
    }
  }
  // async function return a promise transparently
  wrapper();

  console.log("waiting for tasks");

  function processEachTask(task, callback) {
    var name = task.last + "-" + task.first;
    name = name.toLowerCase();
    let parentFolderPath = "faculty/_blocks/" + task.tag;
    let displayName = task.first + " " + task.last;
    let casUri = parentFolderPath + "/" + name;
    console.log('CAS URI will be: ' + casUri);
    // prep our POST payload data
    var payload = JSON.parse(PAYLOAD_DOCUMENT);
    // update our JSON with this task's computed properties
    let titleNode = {
      "type": "text",
      "identifier": "title",
      "text": task.title
    }
    let primaryDepartmentNode = {
      "type": "text",
      "identifier": "primaryDepartment",
      "text": task.discipline
    }
    let emailNode = {
      "type": "text",
      "identifier": "email",
      "text": task.email
    }
    let detailsNode = {
      "type": "group",
      "identifier": "details",
      "structuredDataNodes": [
        titleNode, primaryDepartmentNode, emailNode
      ]
    }
    //update payload SDN with our new group
    payload.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = [detailsNode];
    //update our metadata
    let metadataNode = {
      "displayName": displayName
    };
    payload.asset.xhtmlDataDefinitionBlock.metadata = metadataNode;
    //update remaining computed properties
    payload.asset.xhtmlDataDefinitionBlock.parentFolderPath = parentFolderPath;
    payload.asset.xhtmlDataDefinitionBlock.tags = [{ "name" : task.tag }];
    payload.asset.xhtmlDataDefinitionBlock.name = name;

    let postData = JSON.stringify(payload);
    console.log("computed JSON payload:");
    console.log(postData);

    //do POST
    var postResponse = "";
    var postOptions = {
      hostname: CAS_HOST,
      port: CAS_PORT,
      path: POST_URI,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length,
        Authorization: ' Bearer ' + API_KEY
      }
      // ,
      // requestCert: false,
      // rejectUnauthorized: false      
    };
    console.dir(postOptions);
    const post = http.request(postOptions, res => {
      // console.log('status code: ' + res.statusCode);
      // console.log('headers:', res.headers);
      res.on('data', d => {
        postResponse = postResponse + d;
        process.stdout.write(d);
        process.stdout.write('\t' + payload.asset.xhtmlDataDefinitionBlock.parentFolderPath + "\t" + payload.asset.xhtmlDataDefinitionBlock.name);
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
  
  function saveSnippet(content, fpath) {
    var articleStream = fs.createWriteStream(fpath);
    articleStream.write(content.prettify());
    articleStream.end();
  }

  function afterAllTasks(err) {
    console.log("all promises complete");
  }
});
