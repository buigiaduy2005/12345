using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.GridFS;
using InsiderThreat.Server.Models;
using InsiderThreat.Shared;
using System.Security.Claims;
using MongoDB.Bson.Serialization.Attributes;

namespace InsiderThreat.Server.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class GroupsController : ControllerBase
    {
        private readonly IMongoCollection<Group> _groups;
        private readonly IMongoCollection<InsiderThreat.Shared.User> _users;
        private readonly IMongoCollection<ProjectTask> _tasks;
        private readonly IMongoCollection<SharedDocument> _documents;
        private readonly IGridFSBucket _gridFS;
        private readonly ILogger<GroupsController> _logger;
        private readonly IMongoDatabase _database;

        public GroupsController(IMongoDatabase database, IGridFSBucket gridFS, ILogger<GroupsController> logger)
        {
            _database = database;
            _groups = database.GetCollection<Group>("Groups");
            _users = database.GetCollection<InsiderThreat.Shared.User>("Users");
            _tasks = database.GetCollection<ProjectTask>("ProjectTasks");
            _documents = database.GetCollection<SharedDocument>("SharedDocuments");
            _gridFS = gridFS;
            _logger = logger;
        }

        // GET: api/Groups
        [HttpGet]
        public async Task<IActionResult> GetGroups()
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var groups = await _groups
                    .Find(g => g.MemberIds.Contains(userId!) || g.Privacy.ToLower() == "public")
                    .SortBy(g => g.Name)
                    .ToListAsync();
                return Ok(groups);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error fetching groups", error = ex.Message });
            }
        }

        // GET: api/Groups/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetGroupById(string id)
        {
            try
            {
                var group = await _groups.Find(g => g.Id == id).FirstOrDefaultAsync();
                if (group == null) return NotFound();
                return Ok(group);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // POST: api/Groups
        [HttpPost]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest request)
        {
            try
            {
                var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userId)) return Unauthorized();

                var group = new Group
                {
                    Name = request.Name,
                    Description = request.Description,
                    Type = request.Type ?? "Project",
                    Privacy = request.Privacy ?? "Public",
                    AdminIds = new List<string> { userId },
                    MemberIds = request.MemberIds ?? new List<string> { userId },
                    IsProject = request.IsProject,
                    ProjectStartDate = request.ProjectStartDate,
                    ProjectEndDate = request.ProjectEndDate,
                    CreatedAt = DateTime.UtcNow
                };

                await _groups.InsertOneAsync(group);
                return CreatedAtAction(nameof(GetGroupById), new { id = group.Id }, group);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ex.Message);
            }
        }

        // PATCH: api/Groups/{id}
        [HttpPatch("{id}")]
        public async Task<IActionResult> UpdateGroup(string id, [FromBody] UpdateGroupRequest request)
        {
            var update = Builders<Group>.Update
                .Set(g => g.Name, request.Name)
                .Set(g => g.Description, request.Description)
                .Set(g => g.ProjectStartDate, request.ProjectStartDate)
                .Set(g => g.ProjectEndDate, request.ProjectEndDate)
                .Set(g => g.UpdatedAt, DateTime.UtcNow);

            await _groups.UpdateOneAsync(g => g.Id == id, update);
            return Ok(new { message = "Cập nhật thành công" });
        }

        // GET: api/Groups/{id}/members-details
        [HttpGet("{id}/members-details")]
        public async Task<IActionResult> GetGroupMembers(string id)
        {
            var group = await _groups.Find(g => g.Id == id).FirstOrDefaultAsync();
            if (group == null) return NotFound();

            var users = await _users.Find(u => group.MemberIds.Contains(u.Id!)).ToListAsync();
            return Ok(users.Select(u => new { u.Id, u.Username, u.FullName, u.AvatarUrl, IsAdmin = group.AdminIds.Contains(u.Id!) }));
        }

        // ─── TASK MANAGEMENT ──────────────────────────

        [HttpGet("{id}/tasks")]
        public async Task<IActionResult> GetTasks(string id)
        {
            var tasks = await _tasks.Find(t => t.GroupId == id).SortByDescending(t => t.CreatedAt).ToListAsync();
            return Ok(tasks);
        }

        [HttpPost("{id}/tasks")]
        public async Task<IActionResult> CreateTask(string id, [FromBody] CreateTaskRequest taskReq)
        {
            try
            {
                var task = new ProjectTask
                {
                    GroupId = id,
                    Title = taskReq.Title ?? "Untitled Task",
                    Description = taskReq.Description ?? "",
                    Status = taskReq.Status ?? "Todo",
                    Priority = taskReq.Priority ?? "Normal",
                    AssignedTo = taskReq.AssignedTo,
                    CreatedAt = DateTime.UtcNow
                };

                // Parse dates if provided
                if (taskReq.StartDate.HasValue)
                {
                    task.StartDate = taskReq.StartDate.Value;
                }
                
                if (taskReq.Deadline.HasValue)
                {
                    task.Deadline = taskReq.Deadline.Value;
                }

                await _tasks.InsertOneAsync(task);
                return Ok(task);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating task for group {GroupId}", id);
                return StatusCode(500, new { message = "Lỗi hệ thống khi tạo nhiệm vụ", error = ex.Message });
            }
        }

        [HttpPatch("{id}/tasks/{taskId}")]
        public async Task<IActionResult> UpdateTask(string id, string taskId, [FromBody] ProjectTask taskUpdate)
        {
            try
            {
                var filter = Builders<ProjectTask>.Filter.And(
                    Builders<ProjectTask>.Filter.Eq(t => t.Id, taskId),
                    Builders<ProjectTask>.Filter.Eq(t => t.GroupId, id)
                );

                var update = Builders<ProjectTask>.Update
                    .Set(t => t.Title, taskUpdate.Title)
                    .Set(t => t.Description, taskUpdate.Description)
                    .Set(t => t.Status, taskUpdate.Status)
                    .Set(t => t.Priority, taskUpdate.Priority)
                    .Set(t => t.AssignedTo, taskUpdate.AssignedTo)
                    .Set(t => t.Progress, taskUpdate.Progress)
                    .Set(t => t.StartDate, taskUpdate.StartDate)
                    .Set(t => t.Deadline, taskUpdate.Deadline);

                if (taskUpdate.Status == "Done")
                {
                    update = update.Set(t => t.CompletedAt, DateTime.UtcNow);
                }

                await _tasks.UpdateOneAsync(filter, update);
                return Ok(new { message = "Task updated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating task {TaskId}", taskId);
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpDelete("{id}/tasks/{taskId}")]
        public async Task<IActionResult> DeleteTask(string id, string taskId)
        {
            try
            {
                var filter = Builders<ProjectTask>.Filter.And(
                    Builders<ProjectTask>.Filter.Eq(t => t.Id, taskId),
                    Builders<ProjectTask>.Filter.Eq(t => t.GroupId, id)
                );

                var result = await _tasks.DeleteOneAsync(filter);
                if (result.DeletedCount == 0) return NotFound();

                return Ok(new { message = "Task deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting task {TaskId}", taskId);
                return StatusCode(500, "Internal server error");
            }
        }

        // ─── FILE MANAGEMENT ──────────────────────────

        [HttpGet("{id}/files")]
        public async Task<IActionResult> GetFiles(string id)
        {
            var filesCollection = _database.GetCollection<ProjectFileRecord>("ProjectFiles");
            var files = await filesCollection.Find(f => f.GroupId == id).SortByDescending(f => f.UploadedAt).ToListAsync();
            return Ok(files);
        }

        [HttpPost("{id}/files")]
        public async Task<IActionResult> AddFile(string id, [FromBody] ProjectFileRecord file)
        {
            file.GroupId = id;
            file.UploadedAt = DateTime.UtcNow;
            var filesCollection = _database.GetCollection<ProjectFileRecord>("ProjectFiles");
            await filesCollection.InsertOneAsync(file);
            return Ok(file);
        }

        [HttpPost("{id}/members")]
        public async Task<IActionResult> AddMember(string id, [FromBody] AddMemberRequest request)
        {
            var update = Builders<Group>.Update.AddToSet(g => g.MemberIds, request.UserId);
            await _groups.UpdateOneAsync(g => g.Id == id, update);
            return Ok(new { message = "Added" });
        }
    }

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public class CreateTaskRequest
    {
        public string? Title { get; set; }
        public string? Description { get; set; }
        public string? AssignedTo { get; set; }
        public string? Status { get; set; }
        public string? Priority { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? Deadline { get; set; }
    }

    public class CreateGroupRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string? Type { get; set; }
        public string? Privacy { get; set; }
        public List<string>? MemberIds { get; set; }
        public bool IsProject { get; set; }
        public DateTime? ProjectStartDate { get; set; }
        public DateTime? ProjectEndDate { get; set; }
    }

    public class UpdateGroupRequest
    {
        public string? Name { get; set; }
        public string? Description { get; set; }
        public DateTime? ProjectStartDate { get; set; }
        public DateTime? ProjectEndDate { get; set; }
    }

    public class AddMemberRequest
    {
        public string UserId { get; set; } = string.Empty;
    }

    public class ProjectFileRecord
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string? Id { get; set; }
        public string GroupId { get; set; } = string.Empty;
        public string FileId { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long Size { get; set; }
        public DateTime UploadedAt { get; set; }
    }
}
