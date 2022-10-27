var csv = require('fast-csv');
const {execSync} = require('child_process');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const https = require('https');
var fs = require('fs');
var JSSoup = require('jssoup').default;
var tasks = [];
var authors = {};
var categories = {};
var writableStream = fs.createWriteStream("text-only.csv");
//var stream = fs.createReadStream("input.csv");
const stream = csv.format();
stream.pipe(writableStream);
headerOutput = ["id", "title", "author", "epoch", "date", "url", "categories", "slug", "snippet"];
stream.write(headerOutput);

writableStream.on("finish", function(){ console.log("DONE!"); });

fs.createReadStream('blog-posts.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    // console.log("parsing row: " + obj.id);
    var parsedData = {
      id: obj.id,
      title: obj.Title,
      date: obj.Date,
      formattedDate: obj.FromattedDate,
      url: obj.Permalink,
      categories: obj.Categories,
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
    var articleURL = task.url;
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
      var divID = "post-" + task.id;
        // console.log("soup search term: " + divID);
        console.log("finished grabbing html for article: " + articleURL);
        // console.log(articleHTML);
        var soup = new JSSoup(articleHTML, false);
        var articleContent = soup.find('div', { 'id' : divID });
        var articleHeader = articleContent.find('div', {'class': 'itemHeader'});
        var author = articleHeader.find('a', {'class': 'kl-blog-post-author-link'}).getText().trim();
        task.author = author;
        authors[task.author] = author;
        var articleBody = articleContent.find('div', {'class' : 'itemBody'});
        var contentPath = "html/" + task.slug + ".html";
        task.content = contentPath
        saveSnippet(articleBody, contentPath);
        // console.log(articleHeader.prettify());
        // console.log(articleBody.prettify())
        outputResult = [task.id, task.title, author, task.date, task.formattedDate, task.url, task.categories, task.slug, contentPath];
        // console.dir(outputResult);
        stream.write(outputResult);
        // console.log("authors");
        console.log(authors);
        // console.log("categories");
        // console.log(categories);
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
