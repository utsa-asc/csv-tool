const https = require('https');
const http = require('http');
var JSSoup = require('jssoup').default;
const XLSX = require("xlsx");
var fs = require('fs');
const { readFile } = require('fs/promises');
XLSX.set_fs(fs);
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;
const FETCH = process.env.FETCH;
const SAVE = process.env.SAVE;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/cos-news-link.json");
const POST_URI = "/api/v1/create";
const SHEET_NAME = "alumni";
const TEASER = "#AwesomeAlum";
const SOURCE_DOCUMENT = "cos/cos-spotlight-" + SHEET_NAME + ".xlsx";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
var workbook = XLSX.readFile(SOURCE_DOCUMENT, {cellDates:true});
console.dir(workbook.SheetNames);
var dataSheet = workbook.Sheets[SHEET_NAME];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  console.log(i);
  var newTask = {}
  try {
    var newTask = {
      "row": i,
      "title": dataSheet['A'+i].v,
      "year": dataSheet['B'+i].v,
      "month": dataSheet['C'+i].v,
      "parentFolderPath": dataSheet['N'+i].v.trim(),
      "localPath": dataSheet['O'+i].v.trim(),
      "name": dataSheet['E'+i].v.trim(),
      "type": dataSheet['G'+i].v.trim(),
      "class": dataSheet['H'+i].v.trim(),
      "image": dataSheet['K'+i].v.trim(),
      "tags": dataSheet['I'+i].v.trim()
    };
    var parts = newTask.title.split('–');
    // console.log("last part:" + parts[parts.length - 1]);
    newTask.title = parts[parts.length - 1].trim();
    newTask.author = "College of Sciences";
    tasks.push(newTask);
    // console.dir(newTask);
  } catch(pe) {
    console.log(pe);
    console.log("unable to parse: " + i + " skipping row");
  }
}
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
completeTasks(dataSheet);

async function completeTasks(dataSheet) {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      //prep JSON document
      let payload = preparePayload(t);
      //POST payload
      let strPayload = JSON.stringify(payload);
      // console.log(strPayload);
      if (DO_POST == "YES") {
        let postedAsset = await postAsset(POST_URI, strPayload);
        console.log(postedAsset);
        if (postedAsset.success == true) {
          console.dir(task);
        }
      } else {
        console.log("POST IS NO");
      }
      //report result
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function preparePayload(task) {
  var page = JSON.parse(PAYLOAD_DOCUMENT);
  task.tags = parseTags(task.tags);
  //
  page.asset.page.tags = task.tags;
  page.asset.page.tags.push({ "name": "spotlight" });
  page.asset.page.tags.push({ "name": task.class });
  page.asset.page.name = task.name;
  page.asset.page.parentFolderPath = task.parentFolderPath;
  page.asset.page.metadata.title = task.title;
  page.asset.page.metadata.teaser = TEASER;
  page.asset.page.metadata.author = task.author;
  page.asset.page.metadata.startDate = createDate(task);
  // page.asset.page.metadata.startDate = new Date(task.year, 1, 15, 0, 0, 0, 0);

  page.asset.page.structuredData.structuredDataNodes.map(function(sdn) {
    if (sdn.identifier == "source") {
      sdn.text = "College of Sciences";
    }
    if (sdn.identifier == "image1") {
      sdn.structuredDataNodes = [
        {
          "type": "asset",
          "identifier": "file",
          "filePath": task.image,
          "assetType": "file"
        },
        {
          "type": "text",
          "identifier": "alt",
          "text": task.title
        }
      ];
    }
    if (sdn.identifier == "caption") {
      sdn.text = task.title;
    }
    if (sdn.identifier == "link") {
      sdn.structuredDataNodes = [];
    }
  });
  let contentHTML = sanitizeText(fs.readFileSync(task.localPath, 'utf8'));
  // console.log("parsed html content is");
  // console.log(contentHTML);
  let contentNode = {
    "type": "text",
    "identifier": "wysiwyg",
    "text": contentHTML
  };
  page.asset.page.structuredData.structuredDataNodes.push(contentNode);

  return page;
}

async function content(path) {
  return await readFile(path, 'utf8');
}

function parseTags(str) {
  var strArray = str.split(',');
  var tags = [];
  strArray.map(function(t) {
    tags.push({"name":t});
  });
  return tags;
}

function clean(str) {
  var cleanStr = str;
  cleanStr = str.replaceAll('í', 'i');
  cleanStr = cleanStr.replaceAll('é', 'e');
  cleanStr = cleanStr.replaceAll('á', 'a');
  cleanStr = cleanStr.replaceAll('–', '-');
  cleanStr = cleanStr.replaceAll("’", "'");
  console.log(cleanStr);
  return cleanStr;
}

function createDate(t) {
  let dateStr = t.month + " 1, " + t.year;
  let d = new Date(Date.parse(dateStr));
  console.log("date: " + dateStr + " parsed as : " + d);
  console.log(d.toISOString());
  return d.toISOString();
}

async function postAsset(uri, payload) {
  payloadObj = JSON.parse(payload);
  //do GET
  let postOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: POST_URI,
    method: 'POST',
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': payload.length,
        Authorization: ' Bearer ' + API_KEY
    }
  };
  if (CAS_PORT == 443) {
    postOptions.requestCert = false;
    postOptions.rejectUnauthorized = false;
  }
  // console.log(payload);
  let p = new Promise((resolve, reject) => {
		const req = protocol.request(postOptions, (response) => {
      // console.log(postOptions);
      console.log(postOptions.headers['Content-Length'] + "\t" + payloadObj.asset.page.name);
      // console.log(payload);
      // console.log(payload.length);
			let chunks_of_data = [];
			response.on('data', (fragments) => {
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
				let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        resolve(responseString);
			});

			response.on('error', (error) => {
				reject(error);
			});
		});
    req.write(payload);
    req.end();
	});

  return await p;
}

async function getAsset(uri) {
  //do GET
  let getOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: GET_URI + uri,
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // 'Content-Length': postData.length,
      Authorization: ' Bearer ' + API_KEY
    }
  };
  if (CAS_PORT == 443) {
    getOptions.requestCert = false;
    getOptions.rejectUnauthorized = false;
  }
  let p = new Promise((resolve, reject) => {
    const req = protocol.request(getOptions, (response) => {
      console.log(getOptions);
			let chunks_of_data = [];

			response.on('data', (fragments) => {
        // console.log("\t pushing data");
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
				let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        let responseObj = JSON.parse(responseString);
				resolve(responseObj);
			});

			response.on('error', (error) => {
				reject(error);
			});
    });
    req.end();
  });
  return await p;
}

function sanitizeText(content) {
  var contentStr = content;
  contentStr = contentStr.replace('&nbsp;', '&#160;');
  contentStr = contentStr.replace(/\u00a0/g, " ");
  contentStr = contentStr.replace(/\u2013/g, "-");
  contentStr = contentStr.replace(/\u2019/g, "'");
  contentStr = contentStr.replace(/\r?\n|\r/g, "");
  contentStr = contentStr.replace('“', '"');
  contentStr = contentStr.replace('”', '"');
  contentStr = contentStr.replace('’', "'");
  contentStr = contentStr.replace('&mdash;', '&#8212;');
  contentStr = contentStr.replace('<br>', '<br/>');
  contentStr = contentStr.replace('<hr>', '<hr/>');
  contentStr = contentStr.replace(/[^\x00-\x7F]/g, "");
  return contentStr;
}