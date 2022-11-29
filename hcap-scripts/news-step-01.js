  /* Process Tasks:
    1) parse cateogories
    2) HTTP GET article html
    3) JSSoup the article html content and parse out just the post content html
    4) save snippet content to disk
    5) output new csv data with snippet URI
    */
var csv = require('fast-csv');
const {execSync} = require('child_process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const https = require('https');
var fs = require('fs');
var JSSoup = require('jssoup').default;
var tasks = [];
var authors = {};
var categories = {};
var YEAR = "2018";
var targetInput = "hcap/hcap-news-" + YEAR + ".csv";
var targetOutput = "hcap/hcap-news-" + YEAR + "-step-01.csv";
var writableStream = fs.createWriteStream(targetOutput);
//var stream = fs.createReadStream("input.csv");
const stream = csv.format();
stream.pipe(writableStream);
//format on incoming CSV file
//ID,Title,Date,Post Type,Permalink,Image URL,Image Title,Image Alt Text,Image Featured,Categories,Department,page_description,Status,Author Username,Author Email,Slug,Post Modified Date
//format of outgoing CSV file - only adding savinged snippet file URI (local disk)
headerOutput = ["id", "title", "date", "permalink", "imageURL", "imageTitle", "imageAltText", "categories", "department", "status", "author", "authorEmail", "slug", "snippetURI"];
stream.write(headerOutput);

writableStream.on("finish", function(){ console.log("DONE!"); });

fs.createReadStream(targetInput)
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    // console.log("parsing row: " + obj.id);
    //ID,Title,Date,Post Type,Permalink,Image URL,Image Title,Image Alt Text,Image Featured,Categories,Department,page_description,Status,Author Username,Author Email,Slug
    var parsedData = {
      id: obj.ID,
      title: obj.Title,
      date: obj.Date,
      permalink: obj.Permalink,
      imageURL: obj["Image URL"],
      imageTitle: obj["Image Title"],
      imageAltText: obj["Image Alt Text"],
      categories: obj.Categories,
      department: obj.Department,
      status: obj.Status,
      author: obj["Author Username"],
      authorEmail: obj["Author Email"],
      slug: obj.Slug
    }
    tasks.push(parsedData);
    // processEachTask(parsedData);
    // execSync('sleep 1'); // block process for 1 second.
  }).on("end", function() {
  /*
  Promise.all(tasks.map(processEachTask)).then(afterAllTasks);
  // async/await notation:
  // you must be in an "async" environement to use "await"
  */
  async function wrapper () {
    console.log("task count: " + tasks.length);

    for(let t of tasks) {
      await processEachTask(t);
      // execSync('sleep 1');
    }
    console.dir(categories);

      // tasks.map(async task => {
      //   await Promise.all([task].map(processEachTask));
      //   // execSync('sleep 1');
      // });
  }
  // async function return a promise transparently
  wrapper();

  console.log("waiting for tasks");

  function processEachTask(task, callback) {
    var articleURL = task.permalink;
    var articleName = task.id + "-" + task.slug + ".html";
    console.log('article file name will be: ' + articleName);
    var cats = task.categories.split('|');
    console.dir(cats);
    cats.map(element => {
      categories[element.trim()] = element.trim();
    });
    
    var articleHTML = "";
    const req = https.request(articleURL, res => {
      // console.log('status code: ' + res.statusCode);
  
      res.on('data', d => {
        articleHTML = articleHTML + d;
        // process.stdout.write(d);
      });
  
      res.on('end', () => {
        // execSync('sleep 1');
        var divID = "post-content";
        divID = "df-wysiwyg-layout";
        console.log("soup search term: " + divID);
        console.log("finished grabbing html for article: " + articleURL + " for ID: " + task.id);
        // console.log(articleHTML);
        var soup = new JSSoup(articleHTML, false);
        var articleContent = soup.find('section', { 'class' : divID });
        if (articleContent) {
          var articleBody = articleContent.find('div', {'class' : 'cell'});
          var contentPath = "hcap/html/" + YEAR + "/" + task.id + "-" + task.slug + ".html";
          task.content = contentPath
          saveSnippet(articleBody, contentPath);
          // console.log(articleHeader.prettify());
          // console.log(articleBody.prettify())
          //headerOutput = ["id", "title", "date", "permalink", "imageURL", "imageTitle", "imageAltText", "categories", "department", "status", "author", "authorEmail", "slug", "snippetURI"];
          outputResult = [task.id, task.title, task.date, task.permalink, task.imageURL, task.imageTitle, task.imageAltText, task.categories, task.department, task.status, task.author, task.authorEmail, task.slug, contentPath];
          // console.dir(outputResult);
          stream.write(outputResult);
          // console.log("authors");
          console.log(authors);
          // console.log("categories");
          // console.log(categories);
        }
      });
    });
    req.end();
  }
  
  function saveSnippet(content, fpath) {
    var articleStream = fs.createWriteStream(fpath);
    articleStream.write(content.prettify());
    articleStream.end();
  }

  function afterAllTasks(err) {
    console.log("all promises complete");
  }
});
