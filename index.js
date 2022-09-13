var csv = require('fast-csv');
var fs = require('fs');
var JSSoup = require('jssoup').default;

var tasks = [];
var writableStream = fs.createWriteStream("output.csv");
//var stream = fs.createReadStream("input.csv");
const stream = csv.format();
stream.pipe(writableStream);

writableStream.on("finish", function(){ console.log("DONE!"); });
//csvStream.pipe(writableStream);

fs.createReadStream('blog-posts.csv')
  .pipe(csv.parse({ headers: true }))
  .on('data', function(obj) {
    console.log('adding row');
    var parsedData = {
      slug: obj.Slug,
      url: obj.Permalink
    }
    tasks.push(parsedData);
  }).on("end", function() {

    /*
    Promise.all(emailTasks.map(processEachTask)).then(afterAllTasks);
    // async/await notation:
    // you must be in an "async" environement to use "await"
    */
    async function wrapper () {
        await Promise.all(tasks.map(processEachTask));
        //finish();
    }
    // async function return a promise transparently
    wrapper();

    /*
    console.log("waiting for tasks");
    async.forEachOfSeries(emailTasks, processEachTask, afterAllTasks);
    */
    function processEachTask(task, callback) {
      console.log('lookup slug: ' + task.slug);
      stream.write([task.slug, task.url]);
    }

    function afterAllTasks(err) {
      console.log("all done?");
    }
});
/*
csv.parseStream(stream, {headers : true}).on("data", function(obj){
}).on("end", function() {
*/
