var csv = require('fast-csv');
const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
var writableStream = fs.createWriteStream("colfa/colfa-faculty-posted.csv");
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const stream = csv.format({quoteColumns: true});
stream.pipe(writableStream);
const POST_URI = "/api/v1/create";
headerOutput = ["Last", "First", "LastFirst", "honorific", "Title", "Research", "Education", "Discipline", "Tag", "Email", "casURI", "casAssetID", "uuid", "Notes"];
stream.write(headerOutput);
writableStream.on("finish", function(){ console.log("DONE!"); });
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

fs.createReadStream('colfa/colfa-faculty-all.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    // console.log("parsing row: " + obj.id);
    var parsedData = {
      last: obj.Last,
      first: obj.First,
      lastFirst: obj.LastFirst,
      title: obj.Title,
      discipline: obj.Discipline,
      tag: obj.Tag,
      email: obj.Email,
      casURI: obj.casURI,
      research: obj.Research,
      education: obj.Education
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
    name = name.replace(" ", "-").toLowerCase();
    let parentFolderPath = "faculty/_blocks/" + task.tag;
    let displayName = task.first + " " + task.last;
    var casUri = task.casURI.replace(" ", "-");
    console.log('CAS URI will be: ' + casUri);
    // prep our POST payload data
    var payload = JSON.parse(PAYLOAD_DOCUMENT);
    // update our JSON with this task's computed properties
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
        primaryDepartmentNode, emailNode
      ]
    }

    let rawTitles = task.title.split(',');
    if (Array.isArray(rawTitles)) {
      rawTitles.map(innerTitle => {
        detailsNode.structuredDataNodes.push({
          "type": "text",
          "identifier": "title",
          "text": innerTitle.trim()
        });
      });
    } else {
      detailsNode.structuredDataNodes.push({
        "type": "text",
        "identifier": "title",
        "text": task.title
      });
    }

    //https://cms.lehgarza.family/entity/open.act?id=209e33aaac1600055b7549d118f4ca25&type=file
    let imageNode = {
      "type": "group",
      "identifier": "image",
      "structuredDataNodes": [
        {
          "type": "asset",
          "identifier": "file",
          "filePath": "faculty/headshots/_utsa-profile-placeholder-400x500.svg",
          "assetType": "file"
        },
        {
          "type": "text",
          "identifier": "alt",
          "text": displayName
        },
        {
          "type": "text",
          "identifier": "type",
          "text": "No Link"
        }
      ]
    };

    //update payload SDN with our new group
    payload.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = [detailsNode, imageNode];
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
    };
    if (CAS_PORT == 443) {
      postOptions.requestCert = false;
      postOptions.rejectUnauthorized = false;
    }

    // console.dir(postOptions);
    const post = protocol.request(postOptions, res => {
      // console.log('status code: ' + res.statusCode);
      // console.log('headers:', res.headers);
      res.on('data', d => {
        postResponse = postResponse + d;
        let responseObj = JSON.parse(d);
          process.stdout.write(d);
          process.stdout.write('\t' + payload.asset.xhtmlDataDefinitionBlock.parentFolderPath + "\t" + payload.asset.xhtmlDataDefinitionBlock.name);
          process.stdout.write('\n');
          let assetID = responseObj.createdAssetId;
          //["Last", "First", "Title", "Research", "Education", "Discipline", "Tag", "Email", "CAS-URI", "CAS-ASSET-ID"];
          outputResult = [
            task.last,
            task.first,
            task.title,
            task.research,
            task.education,
            task.discipline,
            task.tag,
            task.email,
            payload.asset.xhtmlDataDefinitionBlock.parentFolderPath + "/" + payload.asset.xhtmlDataDefinitionBlock.name,
            assetID
          ];
          stream.write(outputResult);
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
