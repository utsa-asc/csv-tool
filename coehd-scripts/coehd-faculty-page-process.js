const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const XLSX = require("xlsx");
var fs = require('fs');
XLSX.set_fs(fs);
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;
const SOURCE_DOCUMENT = "coehd/coehd-faculty.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-page-minimum.json");
const LINK_GROUP = fs.readFileSync("json/link-section.json");
const POST_URI = "/api/v1/create";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
const workbook = XLSX.readFile(SOURCE_DOCUMENT);
console.dir(workbook.SheetNames);
const dataSheet = workbook.Sheets['Sheet1'];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  // console.log(i);
  var newTask = {
    "last" : dataSheet['D'+i].v,
    "first" : dataSheet['E'+i].v,
    "name" : dataSheet['F'+i].v.trim(),
    "uri" : dataSheet['F'+i].v.trim(),
    "tag" : dataSheet['J'+i].v,
    "parentFolderPath" : "faculty/_blocks/" + dataSheet['J'+i].v,
    "displayName": cleanText(dataSheet['G'+i].v)
  };
  if (dataSheet['B'+i]) {
    newTask['email'] = dataSheet['B'+i].v;
  }
  if (dataSheet['H'+i]) {
    newTask['title'] = cleanText(dataSheet['H'+i].v);
  }
  if (dataSheet['I'+i]) {
    newTask['department'] = cleanText(dataSheet['I'+i].v);
  }
  // console.dir(newTask);
  // if (newTask.tag == 'counseling') {
    tasks.push(newTask);
  // }
}
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      // console.dir(newSDNs);
      const payload = preparePayload(t);
      let stringPayload = JSON.stringify(payload);
      // console.log(stringPayload);
      if (DO_POST == "YES") {
        let postedAsset = await postAsset(POST_URI, stringPayload);
        console.log(postedAsset);
        if (postedAsset.success == false) {
          console.dir(task);
        }
      } else {
        console.log("POST IS NO");
      }
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function generateBlockURI(task) {
  var blockURI ="faculty/_blocks/" + task.tag + "/" + task.uri;
  return blockURI;
}

function preparePayload(task) {
  var page = JSON.parse(PAYLOAD_DOCUMENT);
  const parentFolderPath = "faculty/profiles";
  var blockURI = generateBlockURI(task);
  var nodes = [];
  page.asset.page.structuredData.structuredDataNodes.map(function(sd) {
    if (sd.identifier == "block") {
      sd.blockPath = blockURI;
    } 
    nodes.push(sd);
  });

  page.asset.page.structuredData.structuredDataNodes = nodes;
  page.asset.page.parentFolderPath = parentFolderPath;
  page.asset.page.name = task.uri;
  page.asset.page['metadata'] = { 'displayName' : task.displayName, 'title' : task.displayName };
  
  return page;
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

function cleanText(content) {
  var contentStr = content.replaceAll('&nbsp;', '&#160;');
  contentStr = contentStr.replace(/\u00a0/g, " ");
  //curly quote unicode character, double quotes
  
  contentStr = contentStr.replace(/\u2018/g, "&#8216;");
  contentStr = contentStr.replace(/\u2019/g, "&#8217;");
  contentStr = contentStr.replace(/\u201C/g, "&#8220;");
  contentStr = contentStr.replace(/\u201D/g, "&#8221;");
  contentStr = contentStr.replaceAll('—', '&#8212;');
  //mdash
  contentStr = contentStr.replaceAll('&mdash;', '&#8212;');
  //unclosed breaks
  contentStr = contentStr.replaceAll('<br>', '<br/>');
  contentStr = contentStr.replace(/\u2013/g, "-");
  contentStr = contentStr.replaceAll('/\u00ad/g', '-');
  //ñ, ó, ü, é
  contentStr = contentStr.replaceAll('ñ', "&#241;");
  contentStr = contentStr.replaceAll('á', '&#225;');
  contentStr = contentStr.replaceAll('á', '&#225;');
  contentStr = contentStr.replaceAll('ó', '&#243;');
  contentStr = contentStr.replaceAll('ú', '&#250;');
  contentStr = contentStr.replaceAll('ü', '&#252;');
  contentStr = contentStr.replaceAll('ö', '&#246;');
  contentStr = contentStr.replaceAll('é', '&#233;');
  contentStr = contentStr.replaceAll('í', '&#237;')
  contentStr = contentStr.replaceAll('“', '&ldquo;');
  contentStr = contentStr.replaceAll('”', '&rdquo;');
  contentStr = contentStr.replaceAll('•', '&#183;');
  contentStr = contentStr.replaceAll('’', '&#8217;');
  contentStr = contentStr.replaceAll('‘', '&#8216;');
  contentStr = contentStr.replaceAll('°', '&#176;');
  contentStr = contentStr.replaceAll('®', '&#174;');
  contentStr = contentStr.replace('/\r?\n|\r/g', '');
  contentStr = contentStr.replaceAll('…', '&#8230;');  
  contentStr = contentStr.replaceAll(' ­­­', ' ');
  contentStr = contentStr.replaceAll('ê', '&#234;');
  contentStr = contentStr.replaceAll('Å', '&#197;');
  
  contentStr = contentStr.replaceAll('É', '&#201;');

  return contentStr;
}