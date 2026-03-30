using MongoDB.Driver;
using MongoDB.Bson;
using System;
using System.Linq;

var connectionString = "mongodb://admin:admin123@192.168.203.142:27017/?authSource=admin";
var client = new MongoClient(connectionString);
var db = client.GetDatabase("InsiderThreatDB");
var users = db.GetCollection<BsonDocument>("Users");

var u = users.Find(Builders<BsonDocument>.Filter.Regex("FullName", new BsonRegularExpression("Bùi Gia Duy1"))).FirstOrDefault();
if (u != null)
{
    Console.WriteLine(u.ToJson(new MongoDB.Bson.IO.JsonWriterSettings { Indent = true }));
}
