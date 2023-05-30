const https = require('https');
const http = require('http');
const puppeteer = require('puppeteer');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const PAYLOAD_DOCUMENT = fs.readFileSync("json/program-block-minimum.json");
const DEPTS = fs.readFileSync("cos/departments.json");
const CERTS = fs.readFileSync("cos/certificate.json");
const UGRAD = fs.readFileSync("cos/undergraduate.json");
const GRAD = fs.readFileSync("cos/graduate.json");
const DOCT = fs.readFileSync("cos/doctoral.json");
const TEST = fs.readFileSync("cos/test.json");

const SELECTOR = "section.content-img-design img.clip-mask-top-right";
//.attr('src')";
const IMAGE_PATH = "images/cos/";
var tasks = [];

// JSON.parse(CERTS).map(function(c) {
//   let taskData = c;
//   taskData.type = "certificate";
//   taskData.tag = "Certificate";
//   tasks.push(taskData);
// });

// JSON.parse(UGRAD).map(function(c) {
//   let taskData = c;
//   taskData.type = "undergraduate";
//   taskData.tag = "Undergraduate";
//   tasks.push(taskData);
// });

// JSON.parse(GRAD).map(function(c) {
//   let taskData = c;
//   taskData.type = "graduate";
//   taskData.tag = "Graduate";
//   tasks.push(taskData);
// });

// JSON.parse(DOCT).map(function(c) {
//   let taskData = c;
//   taskData.type = "doctoral";
//   taskData.tag = "Doctoral";
//   tasks.push(taskData);
// });

JSON.parse(TEST).map(function(c) {
  let taskData = c;
  taskData.type = "graduate";
  taskData.tag = "Graduate";
  tasks.push(taskData);
});

completeTasks();

async function completeTasks() {
  var currentTask = {}
  console.log("Task count: " + tasks.length);
  try {
    for (let t of tasks) {
      currentTask = t;
      let imageURL = await grabImageLink(t);
      console.dir(imageURL);
    }
  } catch (e) {
    console.log("Error while running tasks");
    console.log(e);
    console.dir(currentTask);
  }
}

async function grabImageLink(task) {
  const browser = await puppeteer.launch({ headless: "new"});
  const pageURL = task.link;
  try {
    const page = await browser.newPage();
    const response = await page.goto(pageURL);
    const imageSelector = SELECTOR;
    let imageStr = await page.evaluate((sel) => {
      return document.querySelector(sel).getAttribute('onerror').replaceAll("'", "");
    }, imageSelector);

    let imgArray = imageStr.split('=');
    let imgURL = imgArray[(imgArray.length - 1)];
    let imgPieces = imgURL.split('.');
    let imgType = imgPieces[(imgPieces.length - 1)];
    console.log("parsed image url:" + imgURL);
    const newFilePath = IMAGE_PATH + task.type + "-" + task.slug + "." + imgType;
    console.log("new file name will be: " + newFilePath);
    await browser.close();
    return await grabImage(imgURL, newFilePath);
  } catch(e) {
    console.log("error while trying to fetch image on page");
    console.log(e);
    console.dir(task);
  }
}

async function grabImage(url, fpath) {
  try {
    if (!fs.existsSync(fpath)) {
      let image_promise = downloadImage(url, fpath);
      let image = await image_promise;
      console.log("attempting to save to disk:" + fpath);
      // fs.writeFileSync( fpath, image );
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

function downloadImage(url, filepath) {
  console.log(url);
  return new Promise((resolve, reject) => {
      https.get(url, (res) => {
          if (res.statusCode === 200) {
              res.pipe(fs.createWriteStream(filepath))
                  .on('error', reject)
                  .once('close', () => resolve(filepath));
          } else {
              // Consume response data to free up memory
              res.resume();
              reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
          }
      });
  });
}
