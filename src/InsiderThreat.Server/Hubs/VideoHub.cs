using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;
using System.Security.Claims;

namespace InsiderThreat.Server.Hubs;

[Authorize]
public class VideoHub : Hub
{
    private static readonly ConcurrentDictionary<string, VideoRoom> _rooms = new();
    private static readonly ConcurrentDictionary<string, string> _connectionToRoom = new(); // connectionId -> roomCode

    public async Task<string> CreateRoom()
    {
        var roomCode = GenerateRoomCode();
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var displayName = Context.User?.FindFirst("FullName")?.Value ?? Context.User?.Identity?.Name ?? "Guest";

        var room = new VideoRoom
        {
            RoomCode = roomCode,
            CreatedAt = DateTime.UtcNow
        };

        if (!_rooms.TryAdd(roomCode, room))
        {
            roomCode = GenerateRoomCode();
            room.RoomCode = roomCode;
            _rooms.TryAdd(roomCode, room);
        }

        // Auto-join the creator
        var participant = new VideoParticipant
        {
            ConnectionId = Context.ConnectionId,
            UserId = userId,
            DisplayName = displayName
        };

        room.Participants.TryAdd(Context.ConnectionId, participant);
        _connectionToRoom.TryAdd(Context.ConnectionId, roomCode);
        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        return roomCode;
    }

    public async Task<List<VideoParticipant>> JoinRoom(string roomCode)
    {
        roomCode = roomCode.Trim().ToUpper();

        if (!_rooms.TryGetValue(roomCode, out var room))
        {
            throw new HubException("Phòng không tồn tại!");
        }

        if (room.Participants.Count >= 20)
        {
            throw new HubException("Phòng đã đầy (tối đa 20 người)!");
        }

        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var displayName = Context.User?.FindFirst("FullName")?.Value ?? Context.User?.Identity?.Name ?? "Guest";

        var participant = new VideoParticipant
        {
            ConnectionId = Context.ConnectionId,
            UserId = userId,
            DisplayName = displayName
        };

        // Get existing participants BEFORE adding new one
        var existingParticipants = room.Participants.Values.ToList();

        room.Participants.TryAdd(Context.ConnectionId, participant);
        _connectionToRoom.TryAdd(Context.ConnectionId, roomCode);
        await Groups.AddToGroupAsync(Context.ConnectionId, roomCode);

        // Notify existing members about the new participant
        await Clients.OthersInGroup(roomCode).SendAsync("UserJoined", participant);

        return existingParticipants;
    }

    public async Task LeaveRoom()
    {
        await RemoveFromRoom(Context.ConnectionId);
    }

    public async Task SendOffer(string targetConnectionId, string sdp)
    {
        var userId = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";
        var displayName = Context.User?.FindFirst("FullName")?.Value ?? Context.User?.Identity?.Name ?? "Guest";

        await Clients.Client(targetConnectionId).SendAsync("ReceiveOffer", Context.ConnectionId, sdp, displayName);
    }

    public async Task SendAnswer(string targetConnectionId, string sdp)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveAnswer", Context.ConnectionId, sdp);
    }

    public async Task SendIceCandidate(string targetConnectionId, string candidate)
    {
        await Clients.Client(targetConnectionId).SendAsync("ReceiveIceCandidate", Context.ConnectionId, candidate);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await RemoveFromRoom(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }

    private async Task RemoveFromRoom(string connectionId)
    {
        if (_connectionToRoom.TryRemove(connectionId, out var roomCode))
        {
            if (_rooms.TryGetValue(roomCode, out var room))
            {
                room.Participants.TryRemove(connectionId, out _);
                await Groups.RemoveFromGroupAsync(connectionId, roomCode);
                await Clients.Group(roomCode).SendAsync("UserLeft", connectionId);

                // Clean up empty rooms
                if (room.Participants.IsEmpty)
                {
                    _rooms.TryRemove(roomCode, out _);
                }
            }
        }
    }

    private static string GenerateRoomCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}

public class VideoRoom
{
    public string RoomCode { get; set; } = string.Empty;
    public ConcurrentDictionary<string, VideoParticipant> Participants { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class VideoParticipant
{
    public string ConnectionId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}
