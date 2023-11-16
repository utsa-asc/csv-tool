const https = require('https');
const http = require('http');
const {execSync} = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
var fs = require('fs');
const { stringify } = require('querystring');
var tasks = [];
require('dotenv').config();
/* defining some constants */
const CAS_HOST = process.env.CAS_HOST;
const CAS_PORT = process.env.CAS_PORT;
const API_KEY = process.env.API_KEY;
const POST_URI = "/api/v1/create";
/* WP REST API constants */
const WP_HOST = "business.utsa.edu";
const WP_PORT = "443";
const WP_PATH = "/wp-json/wp/v2/";
const YEAR_START = 2009;
const YEAR_END = 2024;

var protocol = https;
// if (CAS_PORT == 443) {
//   protocol = https;
// }

var tasks = [];
const TAG_DOC = fs.readFileSync("acob/tags.json");
const tags = prepTags(TAG_DOC);
// console.dir(departments);
let tkeys = Object.keys(tags);
// console.log(dkeys.length);
console.log(tkeys.length + " tags parsed");

var start = YEAR_START;

while (start < YEAR_END) {
  let newTask = {
    "start": start,
    "end": start + 1
  };
  start = start + 1;
  tasks.push(newTask);
}

completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
        //for each task
        // - we are given a year to lookup and download
        // - create our WP JSON API URL
        // - GET
        // - report count of fetched entries
        // - save JSON to preconfigured file name
        // - filename: news-<year>.json
        // example target request URL:
        // https://business.utsa.edu/wp-json/wp/v2/
        // posts?per_page=100&offset=0&orderby=date&after=2009-01-01 00:00:00.000&before=2010-01-01 00:00:00.000
        let uri = encodeURI("posts?per_page=100&offset=0&orderby=date&after=" + t.start + "-01-01 00:00:00.000&before=" + t.end + "-01-01 00:00:00.000");

        //https://business.utsa.edu/wp-json/wp/v2/faculty?faculty_departments=30&per_page=100
        var options = {
            hostname: WP_HOST,
            port: WP_PORT,
            path: WP_PATH + uri
        }
        console.log("attempting to get batch of news:");
        console.dir(options);
        let newsIndex = await getURL(options);
        console.log("fetched: " + newsIndex.length);
        //** TODO: do we have to paginate? **/
        let targetPath = "acob/news-" + t.start + ".json";
        console.log("saving to: " + targetPath);
        saveSnippet(JSON.stringify(newsIndex), targetPath);
    }
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    console.dir(currentTask);
  }
}

function prepTags(data) {
  var results = {};
  const originData = JSON.parse(data);
  originData.map(function(element) {
    results[element.id] = {"name": element.name, "slug": element.slug};
  })
  return results;
}

function prepDepts(data) {
  var results = {};
  const originData = JSON.parse(data);
  originData.map(function(element) {
    results[element.id] = {"name": element.name, "slug": element.slug};
  })
  return results;
}

async function getURL(options) {
    var getOptions = options;
    getOptions['method'] = 'GET';
    getOptions['headers'] = {
        'Content-Type': 'application/json'
    };
    if (getOptions.port == 443) {
        getOptions.requestCert = false;
        getOptions.rejectUnauthorized = false;
    }
    let p = new Promise((resolve, reject) => {
        const req = protocol.request(getOptions, (response) => {
            // console.log(getOptions);
            let chunks_of_data = [];
            response.on('data', (fragments) => {
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

function saveSnippet(content, fpath) {
  var snippetStream = fs.createWriteStream(fpath);
  snippetStream.write(content);
  snippetStream.end();
}