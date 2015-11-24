var fs = require('fs');
var https = require('https');
var express = require('express');
var bodyParser = require('body-parser');
var MongoClient = require('mongodb').MongoClient;

var app = express();
//app.use(express.bodyParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var ipUrl = "http://169.254.169.254/latest/meta-data/public-ipv4";

// getting the keys
var options = {
    key : fs.readFileSync('../keys/trendserver.key'),
    cert : fs.readFileSync('../keys/trendserver.crt')
}

var config = JSON.parse(fs.readFileSync("../mongoconfig.json"));
var login = 'mongodb://'+config.host+':'+config.port+'/'+config.database
console.log(login);

var db;
var mycollection = config.collection;

MongoClient.connect(login, function(err, database){
    if (err) throw err;

    db = database;

    //app.listen(process.env.PORT || 80);
    https.createServer(options, app).listen(process.env.PORT || 443);
    console.log("MongoDB Server Started!");
});

var getInfo = function(shorturl, callback){
    var cursor = db.collection(mycollection).findOne({shorturl:shorturl}, function(err,doc){
        if (doc != null){
            callback(doc);
        } else {
            callback(null);
        }
    });
};

var insertInfo = function(data, callback){ 
    //checking to see if shorturl exist already
    getInfo(data.shorturl, function(result){
        if (result == null){
            db.collection(mycollection).insertOne(data, function(err, result){
                if (!err){
                    console.log("Inserted a new entry.");
                    callback("success");
                }else{
                    console.log("Error: Not able to insert!");
                    callback("fail");
                }
            });
        } else {
            console.log("Entry already exists, no insert has done.");
            callback("success");
        }
    });
};

var updateInfo = function(data, callback) {
    //checking to make sure data exist
    getInfo(data.shorturl, function(result){
        if (result != null){
            var newcount = parseInt(result.count) + parseInt(data.count);
            db.collection(mycollection).updateOne( 
                {shorturl:data.shorturl},
                {
                    $set: {source: data.source,
                           count: newcount
                    }
                }, function(err, result){
                    if (!err) {
                        console.log("Update complete!");
                        callback("success");
                    } else {
                        console.log("Error: Not able to update!");
                        callback("fail");
                    }
                });
        }else{
            console.log("Error: No such data found!");
            callback("not found");
        }
    });
};

var handle_post = function (req, res) {
    console.log("Post: ..." );
    console.log(req.body);
    if (req.body.action == "find"){
        getInfo(req.body.shorturl, function(result){
            res.setHeader('Content-Type', 'application/json');
            if (result != null){
                result.status = "found";
                delete result._id;
                res.json(result);
            } else {
                res.json({status:"not found"});
            }
        });
    } else if (req.body.action == "insert"){
        data = req.body
        delete data.action;
        insertInfo(data,function(state){
            res.setHeader('Content-Type', 'application/json');
            var data = {status:state};
            res.json(data);
        });
    } else if (req.body.action == "update") {
        updateInfo(req.body, function(state){
            res.setHeader('Content-Type', 'application/json');
            var data = {status:state};
            res.json(data);
        });
    }
}

app.post("*", handle_post );
//app.listen(process.env.PORT || 80);
//https.createServer(options, app).listen(process.env.PORT || 443);
