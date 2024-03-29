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
const SOURCE_DOCUMENT = "cos/cos-staff.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/faculty-block-minimum.json");
const LINK_GROUP = fs.readFileSync("json/link-section.json");
const POST_URI = "/api/v1/create";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
const workbook = XLSX.readFile(SOURCE_DOCUMENT);
console.dir(workbook.SheetNames);
const dataSheet = workbook.Sheets['staff'];
const sheetRange = XLSX.utils.decode_range(dataSheet['!ref']);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 2; i < (maxRow + 2); i++) {
  var newTask = {
    "last" : dataSheet['A'+i].v,
    "first" : dataSheet['B'+i].v,
    "name" : dataSheet['C'+i].v,
    "uri" : dataSheet['M'+i].v.trim(),
    "displayName": dataSheet['B'+i].v + " " + dataSheet['A'+i].v,
    "email" : dataSheet['J'+i].v
  };
  const parentFolderPath = newTask.uri.replace('/'+newTask.name, '');
  newTask['parentFolderPath'] = parentFolderPath;

  if (dataSheet['D'+i]) {
    newTask['honorific'] = dataSheet['D'+i].v;
    newTask['displayName'] = newTask['displayName'] + ", " + newTask['honorific'];
  }
  if (dataSheet['E'+i]) {
    newTask['title'] = dataSheet['E'+i].v;
  }
  if (dataSheet['H'+i]) {
    newTask['department'] = dataSheet['H'+i].v;
  }
  if (dataSheet['I'+i]) {
    newTask['tag'] = dataSheet['I'+i].v;
  }
  if (dataSheet['K'+i]) {
    newTask['phone'] = dataSheet['K'+i].v;
  } else { newTask['phone'] = ""; }
  if (dataSheet['L'+i]) {
    newTask['office'] = dataSheet['L'+i].v;
  } else { newTask['office'] = ""; }
  // console.dir(newTask);
  tasks.push(newTask);
}
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
      currentTask = t;
      const newSDNs = prepareDetails(currentTask);
      // console.dir(newSDNs);
      const payload = preparePayload(t, newSDNs);
      let stringPayload = JSON.stringify(payload);
      // console.log(stringPayload);
      if (DO_POST == "YES") {
        let postedAsset = await postAsset(POST_URI, stringPayload);
        console.log(postedAsset);
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

function prepareDetails(task) {
  //fill in with data from task, should be 1:1 with columns in row data
  var sdns = [
    {
      "type": "text",
      "identifier": "title",
      "text": task.title
    },
    {
      "type": "text",
      "identifier": "primaryDepartment",
      "text": task.department
    },
    {
      "type": "text",
      "identifier": "phone",
      "text": task.phone
    },
    {
      "type": "text",
      "identifier": "email",
      "text": task.email
    },
    {
      "type": "text",
      "identifier": "office",
      "text": task.office
    },
    {
      "type": "text",
      "identifier": "wysiwyg"
    },
    {
      "type": "group",
      "identifier": "cvlink",
      "structuredDataNodes": [
      ]
    }
  ];

  //for each link, create a copy of link group and append to sdns
  return sdns;
};

function preparePayload(task, nodes) {
  var facultyBlock = JSON.parse(PAYLOAD_DOCUMENT);
  // console.log(JSON.stringify(data));
  // console.log("found department id: " + departmentID);
  const tags = [{"name": task.tag}, {"name": "staff"}];

  var newSDNS = [];
  facultyBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes.map(function(sd) {
    if (sd.identifier == "details") {
      sd.structuredDataNodes = nodes;
    }
    newSDNS.push(sd);
  });
  // facultyBlock.asset.xhtmlDataDefinitionBlock.structuredData.structuredDataNodes = nodes;
  facultyBlock.asset.xhtmlDataDefinitionBlock.parentFolderPath = task.parentFolderPath;
  facultyBlock.asset.xhtmlDataDefinitionBlock.name = task.name;
  facultyBlock.asset.xhtmlDataDefinitionBlock['metadata'] = { 'displayName' : task.displayName};
  facultyBlock.asset.xhtmlDataDefinitionBlock.tags = tags;
  return facultyBlock;
}

async function postAsset(uri, payload) {
  var block = JSON.parse(payload);
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
      console.log(postOptions.headers['Content-Length'] + "\t" + block.asset.xhtmlDataDefinitionBlock.name );
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

