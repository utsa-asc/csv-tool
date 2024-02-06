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
    for (let t of tasks) {
      currentTask = t;
      // GET image
      var newDocPath =  getDoc(t.cv, t);
      try {
        download(t.cv, newDocPath, function(){
          console.log('downloaded: ');
          console.dir(this.path);
        });
      } catch (e) {
        console.log("Error while running tasks");
        console.log(e);
        console.dir(currentTask);
      }
      // var image = await grabImage(t.headshot, imageNewPath);
    }
}

function getDoc(cv, task) {
  console.log("given cv: " + cv); 
  var hparts = cv.split('/');
  var fname = hparts[hparts.length - 1];
  var froot = fname.split('.');
  fname = task.uri + '.' + froot[froot.length - 1];
  var fpath = grabNewDocFilePath(task) + fname;
  console.log("fpath computed:" + fpath);
  return fpath;
}

function grabNewDocFilePath(task) {
  var filePath = "";
  var testURI = "coehd/docs/faculty/cv/" + task.tag + "/";
  return testURI;
}

function download(uri, filename, callback){
  request.head(uri, function(err, res, body){
    // console.log('content-type:', res.headers['content-type']);
    // console.log('content-length:', res.headers['content-length']);
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

