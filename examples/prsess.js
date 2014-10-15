var fs = require("fs");
var buf = new Buffer(0); 


process.stdin.on("readable", function () {
  var chunk = process.stdin.read();

  if (chunk)
    buf = Buffer.concat( [buf, chunk] );
});

process.stdin.on("end", function () {
  var obj = JSON.parse(buf.toString());
  console.log(obj.sessid);
});
