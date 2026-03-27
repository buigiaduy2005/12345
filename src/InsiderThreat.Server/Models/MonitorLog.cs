using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

namespace InsiderThreat.Server.Models
{
    /// <summary>
    /// Server-side model for monitoring logs received from the MonitorAgent.
    /// Stored in MongoDB "MonitorLogs" collection.
    /// </summary>
    public class MonitorLog
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        [JsonPropertyName("id")]
        public string? Id { get; set; }

        /// <summary>Type: "Screenshot", "KeywordDetected", "NetworkDisconnect"</summary>
        [BsonElement("logType")]
        public string LogType { get; set; } = string.Empty;

        /// <summary>Severity string: "Critical", "High", "Medium", "Low", "Info"</summary>
        [BsonElement("severity")]
        public string Severity { get; set; } = "Info";

        /// <summary>Numeric severity score 1-10</summary>
        [BsonElement("severityScore")]
        public int SeverityScore { get; set; }

        /// <summary>Full log message description</summary>
        [BsonElement("message")]
        public string Message { get; set; } = string.Empty;

        /// <summary>Machine hostname</summary>
        [BsonElement("computerName")]
        public string ComputerName { get; set; } = string.Empty;

        /// <summary>Machine IP address</summary>
        [BsonElement("ipAddress")]
        public string IpAddress { get; set; } = string.Empty;

        /// <summary>Action taken or risk assessment</summary>
        [BsonElement("actionTaken")]
        public string ActionTaken { get; set; } = string.Empty;

        /// <summary>The detected sensitive keyword</summary>
        [BsonElement("detectedKeyword")]
        public string? DetectedKeyword { get; set; }

        /// <summary>The message context containing the keyword</summary>
        [BsonElement("messageContext")]
        public string? MessageContext { get; set; }

        /// <summary>Application where the event occurred</summary>
        [BsonElement("applicationName")]
        public string? ApplicationName { get; set; }

        /// <summary>Window title at the time of detection</summary>
        [BsonElement("windowTitle")]
        public string? WindowTitle { get; set; }

        /// <summary>Windows username on the monitored machine</summary>
        [BsonElement("computerUser")]
        public string? ComputerUser { get; set; }

        /// <summary>Timestamp of the event</summary>
        [BsonElement("timestamp")]
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
