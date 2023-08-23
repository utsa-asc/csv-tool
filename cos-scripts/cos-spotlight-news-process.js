const https = require("https");
const http = require("http");
const { execSync } = require("child_process");
const XLSX = require("xlsx");
var fs = require("fs");
XLSX.set_fs(fs);
var tasks = [];
require("dotenv").config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const DO_POST = process.env.POST;
const SOURCE_DOCUMENT = "cos/cos-spotlight-news.xlsx";
const PAYLOAD_DOCUMENT = fs.readFileSync("json/cos-news-spotlight.json");
const POST_URI = "/api/v1/create";
const SHEET_NAME = "news";

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];
const workbook = XLSX.readFile(SOURCE_DOCUMENT, { cellDates: true });
console.dir(workbook.SheetNames);
const dataSheet = workbook.Sheets[SHEET_NAME];
const sheetRange = XLSX.utils.decode_range(dataSheet["!ref"]);
const maxRow = sheetRange.e.r;

console.log(maxRow);
for (let i = 3; i < maxRow + 3; i++) {
  console.log(i);
  var newTask = {};
  try {
    var newTask = {
      title: clean(dataSheet["A" + i].v),
      year: dataSheet["B" + i].v,
      uri: parseURI(dataSheet["B" + i].v, dataSheet["E" + i].v),
      url: dataSheet["F" + i].v,
      image: dataSheet["K" + i].v,
      localPath: dataSheet["O" + i].v.trim(),
    };
    // newTask.localPath = newTask.parentFolderPath + "/" + newTask.name;
    newTask.title = newTask.title.trim();
    newTask.image = newTask.image.replace(".png", ".jpg");
    newTask.imageAlt = newTask.title;
    newTask.author = "College of Sciences";
    newTask.tags = parseTags("spotlights, news");
    newTask.parentFolderPath = "spotlights-news/" + newTask.year;
    console.dir(newTask);
    tasks.push(newTask);
  } catch (pe) {
    console.log(pe);
    console.log(
      "parse error: unable able to parse: row " + i + " skipping row"
    );
  }
}
// console.dir(testSheet.Workbook.Names);
// console.log(testSheet);
completeTasks();

// function parseURI(d, str) {
//   var uri = d.getDate();
//   if (uri < 10) {
//     uri = "0" + uri;
//   }
//   uri = uri + "-" + str.trim();
//   return uri;
// }
function parseURI(month, uri) {
  return "" + month + "/" + uri;
}

function parseTags(str) {
  var strArray = str.split(",");
  var tags = [];
  strArray.map(function (t) {
    tags.push({ name: t });
  });
  return tags;
}

function clean(str) {
  var cleanStr = str;
  cleanStr = str.replaceAll("í", "i");
  cleanStr = cleanStr.replaceAll("é", "e");
  cleanStr = cleanStr.replaceAll("á", "a");
  cleanStr = cleanStr.replaceAll(/[(]\d{4}[)][-]/g, "");
  // cleanStr = cleanStr.replaceAll("–", "-");
  cleanStr = cleanStr.replaceAll("’", "'");
  // cleanStr = cleanStr.replaceAll("(", "'");
  // cleanStr = cleanStr.replaceAll(")", "'");
  console.log(cleanStr);
  return cleanStr;
}

function parseParentFolderPath(d) {
  var monthNum = d.getMonth() + 1;
  if (monthNum < 10) {
    monthNum = "0" + monthNum;
  }
  var yearNum = d.getFullYear();
  var path = "spotlight-news/" + yearNum + "/" + monthNum;
  return path;
}

async function completeTasks() {
  var currentTask = {};
  try {
    for (let t of tasks) {
      currentTask = t;
      // console.dir(newSDNs);
      const payload = preparePayload(t);
      let stringPayload = JSON.stringify(payload);
      console.log(stringPayload);
      if (DO_POST == "YES") {
        let postedAsset = await postAsset(POST_URI, stringPayload);
        console.log(postedAsset);
        if (postedAsset.success == false) {
          console.dir(task);
        }
      } else {
        // console.log("POST IS NO");
      }
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

// function preparePayload(task) {
//   var page = JSON.parse(PAYLOAD_DOCUMENT);

//   page.asset.page.tags = task.tags;
//   page.asset.page.name = task.uri;
//   page.asset.page.parentFolderPath = task.parentFolderPath;
//   page.asset.page.metadata.title = task.title;
//   page.asset.page.metadata.author = task.author;
//   page.asset.page.metadata.startDate = task.date;

//   page.asset.page.structuredData.structuredDataNodes.map(function (sdn) {
//     if (sdn.identifier == "source") {
//       if (task.url.includes("utsa.edu/today")) {
//         sdn.text = "UTSA Today";
//       } else {
//         sdn.text = "";
//       }
//     }
//     if (sdn.identifier == "image1") {
//       sdn.structuredDataNodes = [
//         {
//           type: "asset",
//           identifier: "file",
//           filePath: "spotlight-news/" + task.image,
//           assetType: "file",
//         },
//         {
//           type: "text",
//           identifier: "alt",
//           text: task.imageAlt,
//         },
//       ];
//     }
//     if (sdn.identifier == "caption") {
//       sdn.text = task.imageAlt;
//     }
//     if (sdn.identifier == "link") {
//       sdn.structuredDataNodes = [
//         {
//           type: "text",
//           identifier: "label",
//           text: task.title,
//         },
//         {
//           type: "text",
//           identifier: "ariaLabel",
//           text: task.title,
//         },
//         {
//           type: "text",
//           identifier: "type",
//           text: "external",
//         },
//         {
//           type: "text",
//           identifier: "external",
//           text: task.url,
//         },
//         {
//           type: "text",
//           identifier: "target",
//           text: "Parent Window/Tab",
//         },
//       ];
//     }
//   });

//   return page;
// }

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

async function postAsset(uri, payload) {
  payloadObj = JSON.parse(payload);
  //do GET
  let postOptions = {
    hostname: CAS_HOST,
    port: CAS_PORT,
    path: POST_URI,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": payload.length,
      Authorization: " Bearer " + API_KEY,
    },
  };
  if (CAS_PORT == 443) {
    postOptions.requestCert = false;
    postOptions.rejectUnauthorized = false;
  }
  // console.log(payload);
  let p = new Promise((resolve, reject) => {
    const req = protocol.request(postOptions, (response) => {
      // console.log(postOptions);
      console.log(
        postOptions.headers["Content-Length"] +
          "\t" +
          payloadObj.asset.page.name
      );
      // console.log(payload);
      // console.log(payload.length);
      let chunks_of_data = [];
      response.on("data", (fragments) => {
        chunks_of_data.push(fragments);
      });

      response.on("end", () => {
        let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        resolve(responseString);
      });

      response.on("error", (error) => {
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
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // 'Content-Length': postData.length,
      Authorization: " Bearer " + API_KEY,
    },
  };
  if (CAS_PORT == 443) {
    getOptions.requestCert = false;
    getOptions.rejectUnauthorized = false;
  }
  let p = new Promise((resolve, reject) => {
    const req = protocol.request(getOptions, (response) => {
      console.log(getOptions);
      let chunks_of_data = [];

      response.on("data", (fragments) => {
        // console.log("\t pushing data");
        chunks_of_data.push(fragments);
      });

      response.on("end", () => {
        let responseBody = Buffer.concat(chunks_of_data);
        let responseString = responseBody.toString();
        let responseObj = JSON.parse(responseString);
        resolve(responseObj);
      });

      response.on("error", (error) => {
        reject(error);
      });
    });
    req.end();
  });
  return await p;
}
