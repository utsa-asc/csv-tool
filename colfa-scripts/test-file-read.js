/* Image Process Tasks:
    // refinement from HCAP tasks, only focusing on image download and content rewriting of <img> src attributes
    // we save html entity and category fixing for other steps
  0) read incoming CSV
  1) read snippet html from local disk
  2) find any <img> in snippet content
  3) download any image src references to local disk
  4) rewrite img src attributes with new upload location "/<yyyy>/images/<image-file-name>"
  5) save updated snippet content
  */
  //"Apr 18, 2022, 8:09:58 PM", we will need to parse our target date based on the current article's post date
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const https = require('https');
const http = require('http');
var fs = require('fs');
const SOURCE_DIR = "/Users/garza/Downloads/tmp/testing/car";
require('dotenv').config();
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const GET_URI = "/api/v1/read/file/FILE-BLOB-TESTING";
const POST_URI = "/api/v1/edit";
var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}
var tasks = [];
fs.readdir(SOURCE_DIR, function (err, files) {
  //handling error
  if (err) {
      return console.log('Unable to scan directory: ' + err);
  } 
  //listing all files using forEach
  files.forEach(function (f) {
      // Do whatever you want to do with the file
      if (f.indexOf('.pdf') > 0) {
        let taskData = {
          "filePath": SOURCE_DIR + "/" + f,
          "fileName": f,
          "assetURL": "/_documents/car/" + f
        }
        tasks.push(taskData);
        console.log("adding: " + f + " to tasks"); 
      }
  });
  completeTasks();
});


async function completeTasks() {
  for (let t of tasks) {
    getByteArray(t.filePath);
  }
}


function getByteArray(fpath){
  let fdata = fs.readFileSync(fpath).toString('hex');
  var arrByte = new Int8Array(Buffer.from(fdata, 'hex'));
  var simpleArray = [].slice.call(arrByte)
  console.log(arrByte);
  console.log(simpleArray);
  return simpleArray;
}