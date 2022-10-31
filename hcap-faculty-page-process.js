var csv = require('fast-csv');
const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
var writableStream = fs.createWriteStream("hcap/hcap-faculty-all-profiles-posted.csv");
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-page-minimum.json");
const POST_URI = "/api/v1/create";
const stream = csv.format({quoteColumns: true});
stream.pipe(writableStream);

headerOutput = ["Last", "First", "LastFirst", "Title", "Research", "Education", "Discipline", "Tag", "Email", "CAS-URI", "CAS-ASSET-ID", "uuid", "PROFILE-URI", "PROFILE-ASSET-ID"];
stream.write(headerOutput);
writableStream.on("finish", function(){ console.log("DONE!"); });

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

fs.createReadStream('hcap/hcap-all-faculty.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    // console.log("parsing row: " + obj.id);
    var parsedData = {
      last: obj.Last,
      first: obj.First,
      title: obj.Title,
      discipline: obj.Discipline,
      tag: obj.Tag,
      email: obj.Email,
      research: obj.Research,
      education: obj.Education,
      blockURI: obj.casURI,
      blockID: obj.casAssetID,
      uuid: obj.uuid
    }
    console.log(parsedData);
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
    let casUri = task.casURI;
    // prep our POST payload data
    var payload = JSON.parse(PAYLOAD_DOCUMENT);
    // update our JSON with this task's computed properties

    //academic analytics base structured data objects
    let sdn = [
      {
        "type": "group",
        "identifier": "awards",
        "structuredDataNodes": [
          {
            "type": "text",
            "identifier": "awardInfo",
            "text": "utsaDiscovery"
          }
        ]
      },
      {
        "type": "group",
        "identifier": "presentations",
        "structuredDataNodes": [
          {
            "type": "text",
            "identifier": "presentationsInfo",
            "text": "utsaDiscovery"
          }
        ]
      },
      {
        "type": "group",
        "identifier": "grants",
        "structuredDataNodes": [
          {
            "type": "text",
            "identifier": "grantsInfo",
            "text": "utsaDiscovery"
          }
        ]
      },
      {
        "type": "group",
        "identifier": "publications",
        "structuredDataNodes": [
          {
            "type": "text",
            "identifier": "publicationInfo",
            "text": "utsaDiscovery"
          }
        ]
      }
    ]

    let blockNode = {
      "type": "asset",
      "identifier": "block",
      "blockPath": task.blockURI,
      "assetType": "block"
    };
    let uuidNode = {
      "type": "text",
      "identifier": "uuid",
      "text": task.uuid
    };
    let researchNode = {
      "type": "text",
      "identifier": "researchInterests",
      "text": task.research
    };
    let degreesNode = {
      "type": "text",
      "identifier": "degrees",
      "text": task.education
    };

    sdn.push(blockNode);
    sdn.push(uuidNode);
    sdn.push(researchNode);
    sdn.push(degreesNode);

    //update payload SDN with our new group
    payload.asset.page.structuredData.structuredDataNodes = sdn;

    //update our metadata
    let metadataNode = {
      "title": displayName
    };
    payload.asset.page.metadata = metadataNode;
    //update remaining computed properties
    payload.asset.page.tags = [{ "name" : task.tag }];
    payload.asset.page.name = name;

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
          process.stdout.write('\t' + payload.asset.page.parentFolderPath + "\t" + payload.asset.page.name);
          process.stdout.write('\n');
          let assetID = responseObj.createdAssetId;
          //["Last", "First", "Title", "Research", "Education", "Discipline", "Tag", "Email", "CAS-URI", "CAS-ASSET-ID", "uuid", "CAS-Page-URI", "CAS-Page-ID"];
          outputResult = [
            task.last,
            task.first,
            task.title,
            task.research,
            task.education,
            task.discipline,
            task.tag,
            task.email,
            task.blockURI,
            task.blockID,
            task.uuid,
            payload.asset.page.parentFolderPath + "/" + payload.asset.page.name,
            assetID,
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
