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

var protocol = http;
if (CAS_PORT == 443) {
  protocol = https;
}

var tasks = [];

const DEPTS = fs.readFileSync("acob/directory-dept-list.json");
const departments = prepDepts(DEPTS);
// console.dir(departments);
let dkeys = Object.keys(departments);
// console.log(dkeys.length);
console.log(dkeys.length + " departments parsed");

dkeys.map(function(k) {
    let slug = departments[k].slug;
    let name = departments[k].name;
    let newTask = {
        "id" : k,
        "slug" : slug,
        "name" : name
    };
    console.log(newTask.id + ": " + newTask.slug);
    tasks.push(newTask);
});

completeTasks();

async function completeTasks() {
  var currentTask = {}
  try {
    for (let t of tasks) {
        //for each task
        // - we are given a department to lookup and download
        // - create our WP JSON API URL
        // - GET
        // - report count of fetched entries
        // - **TODO** make sure we don't have to paginate to get more?
        // - save JSON to preconfigured file name
        // - filename:  <department-slug>-<department-id>.json
        //https://business.utsa.edu/wp-json/wp/v2/faculty?faculty_departments=30&per_page=100
        var options = {
            hostname: WP_HOST,
            port: WP_PORT,
            path: WP_PATH + "faculty?faculty_departments=" + t.id + "&per_page=100"    
        }
        let peopleIndex = await getURL(options);
        console.log("fetched: " + peopleIndex.length);
        //** TODO: do we have to paginate? **/
        if (peopleIndex.length > 99) {
          console.log("***** Grabbing second page *****");
          options.path = options.path + "&offset=100";
          let peopleIndex2 = await  getURL(options);
          peopleIndex2.map(function(p) {
            peopleIndex.push(p);
          });
          console.log("\t new fetched: " + peopleIndex.length);
        }
        let targetPath = "acob/directory/" + t.id + "-" + t.slug + ".json";
        console.log("saving to: " + targetPath);
        saveSnippet(JSON.stringify(peopleIndex), targetPath);
    }
  } catch (e) {
    console.log(e);
    console.log("Error while running tasks:");
    console.dir(currentTask);
  }
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