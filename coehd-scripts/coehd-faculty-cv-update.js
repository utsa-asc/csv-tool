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
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const LINK_GROUP = fs.readFileSync("json/link-section.json");
const POST_URI = "/api/v1/edit";
const GET_URI = "/api/v1/read/block/COEHD-VPAA-DLS-HALSTORE/"
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
  var newTask = {
    "uri" : dataSheet['F'+i].v.trim(),
    "tag" : dataSheet['J'+i].v,
    "fullName": cleanText(dataSheet['G'+i].v.trim())
  };
  if (dataSheet['C'+i]) {
    newTask['cv'] = dataSheet['C'+i].v.trim();
    if (newTask.cv != "") {
      tasks.push(newTask);
    }
  }
    //"faculty/_blocks/" + dataSheet['I'+i].v + "/staff/" + dataSheet['C'+i].v.trim()
  // console.dir(newTask);
}
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      // GET block
      var blockURI = "faculty/_blocks/" + t.tag + "/" + t.uri;
      var asset = await getAsset(blockURI);
      if (asset.success) {
        // update block
        asset = updateAsset(asset, t);
        // POST block
        let stringPayload = JSON.stringify(asset);
        // console.log(stringPayload);
        if (DO_POST == "YES") {
          let postedAsset = await postAsset(POST_URI, stringPayload);
          console.log(postedAsset);
        } else {
          console.log("POST IS NO");
        }
      }
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function generateFilePath(t) {
  var parts = t.cv.split('.');
  // console.dir(parts);
  var suffix = parts[parts.length - 1];
  var newFilePath = "faculty/cv/" + t.tag + "/" + t.uri + "." + suffix;
  console.log("new file path:" + newFilePath);
  return newFilePath;
}

function updateAsset(asset, task) {
  // console.dir(asset.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes[0].structuredDataNodes[6].structuredDataNodes);
  var updatedAsset = asset;
  // const newFilePath = generateFilePath(task);
  // // console.log(newFilePath);

  var cvArr = [
    {
      type: 'text',
      identifier: 'type',
      text: 'internal',
      recycled: false
    },
    {
      type: 'text',
      identifier: 'label',
      text: cleanText('CV for ' + task.fullName),
      recycled: false
    },
    { type: 'text', identifier: 'ariaLabel', recycled: false },
    {
      type: 'asset',
      identifier: 'internal',
      filePath: generateFilePath(task),
      assetType: 'page,file,symlink',
      recycled: false
    },
    { type: 'text', identifier: 'anchor', recycled: false },
    {
      type: 'text',
      identifier: 'external',
      text: 'https://',
      recycled: false
    },
    {
      type: 'text',
      identifier: 'target',
      text: 'Parent Window/Tab',
      recycled: false
    }
  ];
  if (updatedAsset.asset.xhtmlDataDefinitionBlock) {
    updatedAsset.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes[0].structuredDataNodes[6].structuredDataNodes = cvArr;
  } else {
    console.log('unable to read asset structure');
    console.dir(updatedAsset);
  }
  return updatedAsset;
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
      // console.log(postOptions.headers['Content-Length'] + "\t" + payloadObj.asset.xhtmlDataDefinitionBlock.name);
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
      // console.log(getOptions);
			let chunks_of_data = [];

			response.on('data', (fragments) => {
        // console.log("\t pushing data");
				chunks_of_data.push(fragments);
			});

			response.on('end', () => {
				let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        try {
          let responseObj = JSON.parse(responseString);
          resolve(responseObj);
        } catch (e) {
          console.log('caught non json response');
          console.dir(e);
          resolve({'error':"non json response returned", "success":false});
        }

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