const https = require('https');
const http = require('http');
var JSSoup = require('jssoup').default;
const XLSX = require("xlsx");
var fs = require('fs');
const { readFile } = require('fs/promises');
const { kMaxLength } = require('buffer');
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
const SHEET_NAME = "new-faculty";
const SOURCE_DOCUMENT = "new-faculty/new-faculty.xlsx";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
var workbook = XLSX.readFile(SOURCE_DOCUMENT, { cellDates: true });
console.dir(workbook.SheetNames);
var dataSheet = workbook.Sheets[SHEET_NAME];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  // console.log(i);
  var newTask = {}
  try {
    var newTask = {
      "row": i,
      "first": dataSheet['A' + i].v.trim(),
      "last": dataSheet['B' + i].v.trim(),
      "college": dataSheet['C' + i].v.trim(),
      "dept": dataSheet['D' + i].v.trim(),
      "title": dataSheet['E' + i].v.trim()
    };
    if (dataSheet['F' + i]) {
      newTask['degree'] = dataSheet['F' + i].v.trim();
    } else {
      newTask['degree'] = "";
    }
    if (dataSheet['G' + i]) {
      newTask['institution'] = dataSheet['G' + i].v.trim();
    } else {
      newTask['institution'] = "";
    }
    // console.log("last part:" + parts[parts.length - 1]);

    newTask.tags = parseTags(newTask.college);
    newTask.fullname = newTask.first + " " + newTask.last;
    if (newTask.degree != "") {
      newTask.fullname = newTask.fullname + ", " + newTask.degree
    }
    newTask.uri = newTask.last.toLowerCase().trim() + "-" + newTask.first.toLowerCase().trim();
    newTask.uri = newTask.uri.replaceAll(' ', '-');
    newTask.uri = newTask.uri.replaceAll("'", "");
    newTask.uri = clean(newTask.uri);
    newTask.fulltitle = newTask.title + ", " + newTask.dept;
    newTask.headshoturi = "img/2024/" + newTask.uri + ".jpg";

    if (!imageCheck(newTask.headshoturi)) {
      // modify value in D4
      let inf = "image not found, expected: " + newTask.headshoturi;
      newTask.headshoturi = "";
      let origin = "H" + newTask.row;
      console.log("updating cell: " + origin);
      XLSX.utils.sheet_add_aoa(dataSheet, [[inf]], {origin: origin});
    }

    tasks.push(newTask);
    // console.dir(newTask);
  } catch (pe) {
    console.log(pe);
    console.log("unable to parse: " + i + " skipping row");
  }
}

// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);

completeTasks(dataSheet);

async function completeTasks(dataSheet) {
  var currentTask = {}
  for (let t of tasks) {
    currentTask = t;
    //prep JSON document
    let payload = preparePayload(t);
    //POST payload
    let strPayload = JSON.stringify(payload);
    // console.log(strPayload);
    if (DO_POST == "YES") {
      try {
        let postedAsset = await postAsset(POST_URI, strPayload);
        // console.log(postedAsset);
        let respObj = JSON.parse(postedAsset);
        if (respObj.success == false) {
          console.dir(respObj);
        }
      } catch (e) {
        let msg = "unable to create block: " + currentTask.uri;
        let origin = "H" + currentTask.row;
        console.log("updating cell: " + origin);
        XLSX.utils.sheet_add_aoa(dataSheet, [[msg]], {origin: origin});
        console.log("Error while running tasks");
        console.log(e);
        console.dir(currentTask);
      }
    } else {
      console.log("POST IS NO");
    }
    //report result
  }

  XLSX.writeFile(workbook, 'new-faculty-output.xls');

}

function preparePayload(task) {
  var block = JSON.parse(PAYLOAD_DOCUMENT);

  //
  block.asset.xhtmlDataDefinitionBlock.tags = task.tags;
  block.asset.xhtmlDataDefinitionBlock.metadata.displayName = task.fullname;
  block.asset.xhtmlDataDefinitionBlock.metadata.title = task.fullname;
  block.asset.xhtmlDataDefinitionBlock.name = task.uri;

  var sdns = block.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes
  var newSDNs = [];
  //sdns[0] is the first and only struct in structuredDataNodes
  //a.k.a. the staffMember group
  sdns[0].structuredDataNodes.map(function (groupItem) {
    if (groupItem.identifier == "headshot") {
      groupItem.filePath = task.headshoturi;
    }
    if (groupItem.identifier == "title") {
      groupItem.text = task.fulltitle;
    }
    if (groupItem.identifier == "education") {
      groupItem.text = task.institution;
    }
    newSDNs.push(groupItem);
  });
  sdns[0].structuredDataNodes = newSDNs;
  block.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = sdns
  return block;
}

function parseTags(str) {
  var tags = [];
  var collegeHash = {
    "ACOB": "Alvarez College of Business",
    "COEHD": "College of Education and Human Development",
    "COLFA": "College of Liberal and Fine Arts",
    "COS": "College of Sciences",
    "HCAP": "College for Health, Community and Policy",
    "KCEID": "Klesse College of Engineering and Integrated Design",
    "UC": "University College",
    "ConTex": "ConTex"
  };
  var collegeTagElements = str.split(',');
  tags.push({ "name": "2024" });

  if (collegeTagElements.length > 1) {
    collegeTagElements.map(function (c) {
      var college = collegeHash[c];
      tags.push({ "name": college });
    })
  } else {
    var college = collegeHash[str];
    tags.push({ "name": college });
  }
  return tags;
}

function clean(str) {
  var cleanStr = str;
  cleanStr = str.replaceAll('í', 'i');
  cleanStr = cleanStr.replaceAll('é', 'e');
  cleanStr = cleanStr.replaceAll('á', 'a');
  cleanStr = cleanStr.replaceAll('–', '-');
  cleanStr = cleanStr.replaceAll("’", "'");
  cleanStr = cleanStr.replaceAll("ü", "u");
  // console.log(cleanStr);
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

function imageCheck(uri) {
  var result = false;
  let localimagepath = "new-faculty/" + uri;
  if (!fs.existsSync(localimagepath)) {
    console.log("image not found: " + localimagepath);
    result = false;
  } else {
    result = true;
  }

  return result;
}