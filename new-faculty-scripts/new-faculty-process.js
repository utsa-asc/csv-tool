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
const PAYLOAD_DOCUMENT = fs.readFileSync("json/new-faculty-block.json");
const POST_URI = "/api/v1/create";
const SHEET_NAME = "errors";
const SOURCE_DOCUMENT = "new-faculty/faculty.xlsx";

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
      "college": dataSheet['A'+i].v.trim(),
      "dept": dataSheet['B'+i].v.trim(),
      "first": dataSheet['C'+i].v.trim(),
      "last": dataSheet['D'+i].v.trim(),
      "name": dataSheet['E'+i].v.trim(),
      "title": dataSheet['F'+i].v.trim(),
      "uri": dataSheet['M'+i].v
    };
    if (dataSheet['H'+i]) {
      newTask['edu'] = dataSheet['H'+i].v.trim();
    } else {
      newTask['edu'] = "";
    }
    if (dataSheet['K'+i]) {
      newTask['image'] = dataSheet['L'+i].v.trim();
    } else {
      newTask['image'] = "";
    }
    // console.log("last part:" + parts[parts.length - 1]);
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
  var block = JSON.parse(PAYLOAD_DOCUMENT);
  task.tags = parseTags(task.college);
  //
  block.asset.xhtmlDataDefinitionBlock.tags = task.tags;
  block.asset.xhtmlDataDefinitionBlock.metadata.displayName = task.name;
  block.asset.xhtmlDataDefinitionBlock.metadata.title = task.name;
  block.asset.xhtmlDataDefinitionBlock.name = task.uri;

  var sdns = block.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes
  var newSDNs = [];
  //sdns[0] is the first and only struct in structuredDataNodes
  //a.k.a. the staffMember group
  sdns[0].structuredDataNodes.map(function(groupItem) {
    if (groupItem.identifier == "headshot") {
      groupItem.filePath = task.image;
    }
    if (groupItem.identifier == "title") {
      groupItem.text = task.title;
    }
    if (groupItem.identifier == "education") {
      groupItem.text = task.edu;
    }
    newSDNs.push(groupItem);
  });
  sdns[0].structuredDataNodes = newSDNs;
  block.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = sdns
  return block;
}

function parseTags(str) {
  var collegeHash = {
    "COLFA": "College of Liberal and Fine Arts",
    "COS": "College of Sciences",
    "ACOB": "Alvarez College of Business",
    "HCAP": "College for Health, Community and Policy",
    "COEHD": "College of Education and Human Development",
    "UC": "University College",
    "CEID": "Klesse College of Engineering and Integrated Design",
  };
  var college = collegeHash[str];
  var tags = [];
  tags.push({"name": "2023"});
  tags.push({"name": college });
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
      console.log(postOptions.headers['Content-Length'] + "\t" + payloadObj.asset.xhtmlDataDefinitionBlock.name);
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
