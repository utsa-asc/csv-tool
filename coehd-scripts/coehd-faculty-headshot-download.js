const https = require('https');
const http = require('http');
const request = require('request'); 
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
const GET_URI = "/api/v1/read/block/COS-VPAA-ASC-HALSTORE/"
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
  };
  if (dataSheet['A'+i]) {
    newTask['headshot'] = dataSheet['A'+i].v.trim();
    tasks.push(newTask);
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
      // GET image
      var imageNewPath =  getImage(t.headshot, t);
      download(t.headshot, imageNewPath, function(){
        console.log('downloaded: ' + this);
      });
      // var image = await grabImage(t.headshot, imageNewPath);
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

function getImage(headshot, task) {
  var hparts = headshot.split('/');
  var fname = hparts[hparts.length - 1];
  var froot = fname.split('.');
  fname = task.uri + '.' + froot[froot.length - 1];
  var fpath = grabNewImageFilePath(task) + fname;
  console.log("fpath computed:" + fpath);
  return fpath;
}

function grabNewImageFilePath(task) {
  var filePath = "";
  var testURI = "coehd/images/faculty/headshots/" + task.tag + "/";
  return testURI;
  // try {
  //   if (fs.existsSync(testURI)) {
  //     filePath = testURI;
  //   } else {
  //     console.log("image not found: " + testURI);
  //   }
  // } catch (e) {
  //   console.error("error while trying to search for headshot: ");
  //   console.dir(task);
  // }
  // return filePath;
}

async function grabImage(url, fpath) {
  try {
    if (!fs.existsSync(fpath)) {
      let image_promise = getPromise(url, fpath);
      let image = await image_promise;
      console.log("attempting to save to disk:" + fpath);
      fs.writeFileSync( fpath, image );
    } else {
      console.log("image already cached! " + fpath);
    }

    return true
  } catch (error) {
    console.log(error);
    console.log(url);
    return false
  }
}

function getPromise(url, fpath) {
  return new Promise((resolve, reject) => {
    https.get(url, function(response) {
      response.pipe(fs.createWriteStream(fpath))
      .on('error', function(e) {
        reject(e);
      })
      .once('close', function() {
        resolve(fpath);
      });
    }).end();
  });
}

function download(uri, filename, callback){
  request.head(uri, function(err, res, body){
    // console.log('content-type:', res.headers['content-type']);
    // console.log('content-length:', res.headers['content-length']);
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

