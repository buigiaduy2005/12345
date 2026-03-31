using MongoDB.Driver;
using MongoDB.Bson;
using System;
using System.Linq;

var connectionString = "mongodb://admin:admin123@127.0.0.1:27017/?authSource=admin";
var client = new MongoClient(connectionString);
var db = client.GetDatabase("InsiderThreatDB");
var users = db.GetCollection<BsonDocument>("Users");

var usersList = users.Find(new BsonDocument()).ToList();
Console.WriteLine($"Found {usersList.Count} users:");
foreach (var user in usersList)
{
    Console.WriteLine(user.ToJson(new MongoDB.Bson.IO.JsonWriterSettings { Indent = true }));
}
