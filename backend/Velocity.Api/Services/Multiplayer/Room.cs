using System.Buffers;
using System.Buffers.Binary;
using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;
using Velocity.Api.Configuration;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Isolated multiplayer room — owns player sockets, position buffers, and background loops.
/// Each room runs its own BroadcastLoop (20Hz), ProcessControl (continuous), and HeartbeatMonitor (5s).
/// Binary positions are written directly in each player's ReceiveLoop (zero-copy, no channel).
/// JSON control messages use a separate unbounded channel (never dropped).
/// </summary>
/// <remarks>
/// Depends on: PlayerSocket, PositionSnapshot, WebSocketSettings
/// Used by: RoomManager
/// </remarks>
public sealed class Room : IAsyncDisposable
{
    // ── Binary protocol layout (client → server: 20 bytes min) ──
    private const int ClientMsgTypeOffset = 0;     // 1B
    private const int ClientPosXOffset = 1;         // 4B float32 LE
    private const int ClientPosYOffset = 5;         // 4B float32 LE
    private const int ClientPosZOffset = 9;         // 4B float32 LE
    private const int ClientYawOffset = 13;         // 2B int16 LE
    private const int ClientPitchOffset = 15;       // 2B int16 LE
    private const int ClientSpeedOffset = 17;       // 2B uint16 LE
    private const int ClientCheckpointOffset = 19;  // 1B
    private const int ClientTimestampOffset = 20;   // 4B uint32 LE (optional)
    private const int ClientMinSize = 20;
    private const int ClientSizeWithTimestamp = 24;

    // ── Binary protocol layout (server → client batch: per-player = 25 bytes) ──
    private const int BatchSlotOffset = 0;          // 1B
    private const int BatchPosXOffset = 1;          // 4B float32 LE
    private const int BatchPosYOffset = 5;          // 4B float32 LE
    private const int BatchPosZOffset = 9;          // 4B float32 LE
    private const int BatchYawOffset = 13;          // 2B int16 LE
    private const int BatchPitchOffset = 15;        // 2B int16 LE
    private const int BatchSpeedOffset = 17;        // 2B uint16 LE
    private const int BatchCheckpointOffset = 19;   // 1B
    private const int BatchTimestampOffset = 20;    // 4B uint32 LE
    private const int BytesPerPlayer = 25;          // slot(1)+pos(12)+rot(4)+speed(2)+cp(1)+ts(4)+pad(1)
    private const int BatchHeaderSize = 2;          // [1B msgType][1B playerCount]

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly Guid _roomId;
    private readonly ILogger<Room> _logger;
    private readonly PlayerSocket?[] _players = new PlayerSocket?[WebSocketSettings.MaxPlayersPerRoom];
    private readonly PositionSnapshot[] _positions = new PositionSnapshot[WebSocketSettings.MaxPlayersPerRoom];
    private readonly TaskCompletionSource[] _disconnectSignals = CreateSignals(WebSocketSettings.MaxPlayersPerRoom);
    private readonly Lock _positionLock = new();
    private readonly Lock _playerLock = new();

    /// <summary>Unbounded channel for JSON control messages only (ping, chat, finish, etc.).</summary>
    private readonly Channel<ControlMessage> _controlChannel = Channel.CreateUnbounded<ControlMessage>(
        new UnboundedChannelOptions { SingleReader = true });

    private readonly CancellationTokenSource _cts = new();

    private Task? _broadcastTask;
    private Task? _processControlTask;
    private Task? _heartbeatTask;
    private int _playerCount;
    private bool _disposed;

    public Guid RoomId => _roomId;
    public int PlayerCount => _playerCount;

    /// <summary>True once DisposeAsync has been called — used by RoomManager to guard against joining a disposing room.</summary>
    public bool IsDisposed => _disposed;

    public Room(Guid roomId, ILogger<Room> logger)
    {
        _roomId = roomId;
        _logger = logger;
        _broadcastTask = Task.Run(BroadcastLoop);
        _processControlTask = Task.Run(ProcessControlMessages);
        _heartbeatTask = Task.Run(HeartbeatMonitor);
        _logger.LogInformation("Room {RoomId} created", roomId);
    }

    /// <summary>
    /// Adds a player to the room. Returns the assigned slot (or -1 if full) and a Task
    /// that completes when the player disconnects (used by the endpoint to keep the request alive).
    /// </summary>
    public (int slot, Task disconnectTask) AddPlayer(Guid playerId, string playerName, WebSocket socket)
    {
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                if (_players[i] is not null) continue;

                _players[i] = new PlayerSocket
                {
                    Slot = i,
                    PlayerId = playerId,
                    PlayerName = playerName,
                    Socket = socket,
                };

                lock (_positionLock) { _positions[i] = default; }

                _disconnectSignals[i] = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _playerCount++;

                _logger.LogInformation("Player {PlayerId} ({PlayerName}) joined room {RoomId} slot {Slot} ({Count} players)",
                    playerId, playerName, _roomId, i, _playerCount);

                _ = Task.Run(() => ReceiveLoop(i));

                return (i, _disconnectSignals[i].Task);
            }
        }

        return (-1, Task.CompletedTask);
    }

    private static TaskCompletionSource[] CreateSignals(int count)
    {
        var signals = new TaskCompletionSource[count];
        for (var i = 0; i < count; i++)
            signals[i] = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        return signals;
    }

    /// <summary>
    /// Removes a player from the room by slot. Returns true if the room is now empty.
    /// </summary>
    public bool RemovePlayer(int slot)
    {
        lock (_playerLock)
        {
            if (_players[slot] is null) return _playerCount == 0;

            _players[slot]!.IsActive = false;
            _players[slot] = null;
            lock (_positionLock) { _positions[slot] = default; }
            _playerCount--;

            return _playerCount == 0;
        }
    }

    /// <summary>
    /// Removes a player by playerId. Returns the slot removed, or -1 if not found.
    /// Also returns whether the room is now empty.
    /// </summary>
    public (int slot, bool isEmpty) RemovePlayerById(Guid playerId)
    {
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                if (_players[i]?.PlayerId != playerId) continue;

                _players[i]!.IsActive = false;
                _players[i] = null;
                lock (_positionLock) { _positions[i] = default; }
                _playerCount--;

                return (i, _playerCount == 0);
            }
        }

        return (-1, _playerCount == 0);
    }

    /// <summary>
    /// Broadcasts a JSON message to all connected players in the room.
    /// </summary>
    public async Task BroadcastJsonAsync<T>(string type, T data, CancellationToken ct = default)
    {
        var payload = JsonSerializer.Serialize(new { type, data }, JsonOptions);
        var bytes = Encoding.UTF8.GetBytes(payload);

        var frame = new byte[1 + bytes.Length];
        frame[0] = WebSocketSettings.MsgTypeJson;
        bytes.CopyTo(frame, 1);

        var segment = new ArraySegment<byte>(frame);

        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                var p = _players[i];
                if (p is null || p.Socket.State != WebSocketState.Open) continue;
                _ = SendSafeAsync(p, segment, ct);
            }
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Returns a snapshot of current player info for reconnect/state sync.
    /// </summary>
    public IReadOnlyList<(Guid PlayerId, string Name, int Slot)> GetPlayerSnapshot()
    {
        var result = new List<(Guid, string, int)>();
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                if (_players[i] is not null)
                    result.Add((_players[i]!.PlayerId, _players[i]!.PlayerName, i));
            }
        }

        return result;
    }

    // ── ReceiveLoop: per-player, zero-copy binary, channel for JSON only ──

    /// <summary>
    /// Receive loop for a single player. Binary position messages are parsed directly
    /// into the position buffer (zero allocation). JSON control messages are queued to
    /// the unbounded control channel (never dropped).
    /// </summary>
    private async Task ReceiveLoop(int slot)
    {
        var ct = _cts.Token;
        var buffer = ArrayPool<byte>.Shared.Rent(WebSocketSettings.ReceiveBufferSize);

        try
        {
            PlayerSocket? player;
            lock (_playerLock) { player = _players[slot]; }
            if (player is null) return;

            while (!ct.IsCancellationRequested && player.IsActive &&
                   player.Socket.State == WebSocketState.Open)
            {
                var result = await player.Socket.ReceiveAsync(
                    new ArraySegment<byte>(buffer), ct);

                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                player.LastSeenAt = Environment.TickCount64;

                if (result.Count == 0) continue;

                if (result.MessageType == WebSocketMessageType.Binary)
                {
                    // Zero-copy: parse directly from the receive buffer into _positions
                    ParsePositionDirect(slot, buffer.AsSpan(0, result.Count));
                }
                else if (result.MessageType == WebSocketMessageType.Text)
                {
                    // JSON is rare — allocation acceptable, queued to unbounded channel
                    var jsonData = buffer.AsSpan(0, result.Count).ToArray();
                    _controlChannel.Writer.TryWrite(new ControlMessage(slot, jsonData));
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
        catch (WebSocketException)
        {
            // Connection dropped
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }

        // Clean up this player (runs after try/catch/finally)
        await CleanupPlayer(slot);
    }

    /// <summary>
    /// Parses a binary position update directly from the receive buffer into the position buffer.
    /// Zero allocation — the receive buffer is parsed in-place under _positionLock.
    /// </summary>
    private void ParsePositionDirect(int slot, ReadOnlySpan<byte> data)
    {
        if (data.Length < ClientMinSize)
        {
            _logger.LogDebug("Room {RoomId} slot {Slot}: malformed binary packet ({Len} bytes, min {Min})",
                _roomId, slot, data.Length, ClientMinSize);
            return;
        }

        if (data[ClientMsgTypeOffset] != WebSocketSettings.MsgTypePosition) return;

        lock (_positionLock)
        {
            ref var pos = ref _positions[slot];
            pos.PosX = BinaryPrimitives.ReadSingleLittleEndian(data[ClientPosXOffset..]);
            pos.PosY = BinaryPrimitives.ReadSingleLittleEndian(data[ClientPosYOffset..]);
            pos.PosZ = BinaryPrimitives.ReadSingleLittleEndian(data[ClientPosZOffset..]);
            pos.Yaw = BinaryPrimitives.ReadInt16LittleEndian(data[ClientYawOffset..]);
            pos.Pitch = BinaryPrimitives.ReadInt16LittleEndian(data[ClientPitchOffset..]);
            pos.Speed = BinaryPrimitives.ReadUInt16LittleEndian(data[ClientSpeedOffset..]);
            pos.Checkpoint = data[ClientCheckpointOffset];

            if (data.Length >= ClientSizeWithTimestamp)
                pos.Timestamp = BinaryPrimitives.ReadUInt32LittleEndian(data[ClientTimestampOffset..]);

            pos.Dirty = true;
        }
    }

    /// <summary>
    /// Removes a player from the room and notifies others. Called from ReceiveLoop cleanup.
    /// </summary>
    private async Task CleanupPlayer(int slot)
    {
        bool isEmpty;
        Guid leftPlayerId;
        string leftPlayerName;

        lock (_playerLock)
        {
            var p = _players[slot];
            if (p is null)
            {
                _disconnectSignals[slot].TrySetResult();
                return;
            }

            leftPlayerId = p.PlayerId;
            leftPlayerName = p.PlayerName;
            p.IsActive = false;
            _players[slot] = null;
            lock (_positionLock) { _positions[slot] = default; }
            _playerCount--;
            isEmpty = _playerCount == 0;
        }

        _logger.LogInformation("Player {PlayerId} ({PlayerName}) left room {RoomId} slot {Slot} ({Count} remaining)",
            leftPlayerId, leftPlayerName, _roomId, slot, _playerCount);

        try
        {
            await BroadcastJsonAsync("player_left", new { playerId = leftPlayerId, playerName = leftPlayerName, slot });
        }
        catch
        {
            // Room may be shutting down
        }

        _disconnectSignals[slot].TrySetResult();

        if (isEmpty)
        {
            OnEmpty?.Invoke(_roomId);
        }
    }

    // ── ProcessControlMessages: JSON only (unbounded channel, never drops) ──

    /// <summary>
    /// Processes JSON control messages from the unbounded channel.
    /// Binary position data never enters this path — it's parsed directly in ReceiveLoop.
    /// </summary>
    private async Task ProcessControlMessages()
    {
        var ct = _cts.Token;

        try
        {
            await foreach (var msg in _controlChannel.Reader.ReadAllAsync(ct))
            {
                if (msg.Data.Length == 0) continue;
                await ProcessJsonMessage(msg.Slot, msg.Data, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
    }

    /// <summary>
    /// Parses a JSON message from a player and dispatches accordingly.
    /// Currently handles: ping (for clock calibration).
    /// T1+ will add: finish, leave, chat, ready, etc.
    /// </summary>
    private async Task ProcessJsonMessage(int slot, byte[] data, CancellationToken ct)
    {
        try
        {
            using var doc = JsonDocument.Parse(data);
            var root = doc.RootElement;

            if (!root.TryGetProperty("type", out var typeProp)) return;
            var type = typeProp.GetString();

            switch (type)
            {
                case "ping":
                {
                    if (root.TryGetProperty("t", out var tProp))
                    {
                        var clientT = tProp.GetInt64();
                        var serverT = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

                        PlayerSocket? player;
                        lock (_playerLock) { player = _players[slot]; }

                        if (player?.Socket.State == WebSocketState.Open)
                        {
                            var pong = JsonSerializer.Serialize(
                                new { type = "pong", t = clientT, serverT }, JsonOptions);
                            var pongBytes = Encoding.UTF8.GetBytes(pong);
                            var frame = new byte[1 + pongBytes.Length];
                            frame[0] = WebSocketSettings.MsgTypeJson;
                            pongBytes.CopyTo(frame, 1);

                            await SendSafeAsync(player, new ArraySegment<byte>(frame), ct);
                        }
                    }

                    break;
                }
                // T1+ message types will be added here
            }
        }
        catch (JsonException)
        {
            // Malformed JSON — ignore
        }
    }

    // ── BroadcastLoop: 20Hz stable tick, fire-and-forget sends ──

    /// <summary>
    /// 20Hz broadcast loop — snapshots all dirty positions atomically, serializes to binary batch,
    /// and fires sends to all players without awaiting (no head-of-line blocking).
    /// Uses Stopwatch for stable tick timing regardless of send latency.
    /// </summary>
    private async Task BroadcastLoop()
    {
        var ct = _cts.Token;

        // Pre-allocated buffers — zero GC per tick
        var snapshotBuffer = new PositionSnapshot[WebSocketSettings.MaxPlayersPerRoom];
        var dirtySlots = new int[WebSocketSettings.MaxPlayersPerRoom];
        var tickInterval = TimeSpan.FromMilliseconds(WebSocketSettings.BroadcastIntervalMs);

        try
        {
            while (!ct.IsCancellationRequested)
            {
                var tickStart = Stopwatch.GetTimestamp();

                // Atomic snapshot: copy dirty positions and reset flags under lock
                var dirtyCount = 0;

                lock (_positionLock)
                {
                    for (var i = 0; i < _positions.Length; i++)
                    {
                        if (!_positions[i].Dirty) continue;

                        snapshotBuffer[dirtyCount] = _positions[i];
                        dirtySlots[dirtyCount] = i;
                        _positions[i].Dirty = false;
                        dirtyCount++;
                    }
                }

                if (dirtyCount > 0)
                {
                    // Build batch from snapshot (outside lock)
                    var batchSize = BatchHeaderSize + (BytesPerPlayer * dirtyCount);
                    var batch = ArrayPool<byte>.Shared.Rent(batchSize);

                    batch[0] = WebSocketSettings.MsgTypePositionBatch;
                    batch[1] = (byte)dirtyCount;

                    var span = batch.AsSpan();

                    for (var d = 0; d < dirtyCount; d++)
                    {
                        var offset = BatchHeaderSize + (d * BytesPerPlayer);
                        ref readonly var pos = ref snapshotBuffer[d];

                        span[offset + BatchSlotOffset] = (byte)dirtySlots[d];
                        BinaryPrimitives.WriteSingleLittleEndian(span[(offset + BatchPosXOffset)..], pos.PosX);
                        BinaryPrimitives.WriteSingleLittleEndian(span[(offset + BatchPosYOffset)..], pos.PosY);
                        BinaryPrimitives.WriteSingleLittleEndian(span[(offset + BatchPosZOffset)..], pos.PosZ);
                        BinaryPrimitives.WriteInt16LittleEndian(span[(offset + BatchYawOffset)..], pos.Yaw);
                        BinaryPrimitives.WriteInt16LittleEndian(span[(offset + BatchPitchOffset)..], pos.Pitch);
                        BinaryPrimitives.WriteUInt16LittleEndian(span[(offset + BatchSpeedOffset)..], pos.Speed);
                        span[offset + BatchCheckpointOffset] = pos.Checkpoint;
                        BinaryPrimitives.WriteUInt32LittleEndian(span[(offset + BatchTimestampOffset)..], pos.Timestamp);
                    }

                    var segment = new ArraySegment<byte>(batch, 0, batchSize);

                    // Fire-and-forget sends — no head-of-line blocking from slow clients.
                    // Track completion to return the pooled buffer safely.
                    var sendTasks = new List<Task>();

                    lock (_playerLock)
                    {
                        for (var i = 0; i < _players.Length; i++)
                        {
                            var p = _players[i];
                            if (p is null || p.Socket.State != WebSocketState.Open) continue;
                            sendTasks.Add(SendSafeAsync(p, segment, ct));
                        }
                    }

                    // Return buffer to pool only after all sends complete (they reference it).
                    // This runs in background — BroadcastLoop continues to next tick immediately.
                    if (sendTasks.Count > 0)
                    {
                        _ = ReturnBufferAfterSends(sendTasks, batch);
                    }
                    else
                    {
                        ArrayPool<byte>.Shared.Return(batch);
                    }
                }

                // Stable tick: compensate for snapshot + serialization time
                var elapsed = Stopwatch.GetElapsedTime(tickStart);
                var delay = tickInterval - elapsed;
                if (delay > TimeSpan.Zero)
                    await Task.Delay(delay, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
    }

    /// <summary>
    /// Returns a pooled buffer after all send tasks have completed.
    /// Runs as a fire-and-forget continuation so BroadcastLoop isn't blocked.
    /// </summary>
    private static async Task ReturnBufferAfterSends(List<Task> sendTasks, byte[] buffer)
    {
        try
        {
            await Task.WhenAll(sendTasks);
        }
        catch
        {
            // SendSafeAsync already handles individual failures
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }
    }

    // ── HeartbeatMonitor ──

    /// <summary>
    /// Heartbeat monitor — checks LastSeenAt for all players, kicks stale ones.
    /// </summary>
    private async Task HeartbeatMonitor()
    {
        var ct = _cts.Token;

        try
        {
            while (!ct.IsCancellationRequested)
            {
                await Task.Delay(WebSocketSettings.HeartbeatIntervalMs, ct);

                var now = Environment.TickCount64;
                var stale = new List<(int slot, PlayerSocket player)>();

                lock (_playerLock)
                {
                    for (var i = 0; i < _players.Length; i++)
                    {
                        var p = _players[i];
                        if (p is null) continue;

                        if (now - p.LastSeenAt > WebSocketSettings.HeartbeatTimeoutMs)
                            stale.Add((i, p));
                    }
                }

                foreach (var (slot, player) in stale)
                {
                    _logger.LogWarning("Heartbeat timeout for player {PlayerId} in room {RoomId} slot {Slot} (last seen {Ago}ms ago)",
                        player.PlayerId, _roomId, slot, now - player.LastSeenAt);

                    try
                    {
                        if (player.Socket.State == WebSocketState.Open)
                        {
                            await player.Socket.CloseAsync(
                                WebSocketCloseStatus.PolicyViolation,
                                "Heartbeat timeout",
                                CancellationToken.None);
                        }
                    }
                    catch
                    {
                        // Socket may already be closed
                    }
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
    }

    // ── Send helper ──

    /// <summary>
    /// Sends a WebSocket binary frame, catching and ignoring failures (disconnected clients).
    /// </summary>
    private static async Task SendSafeAsync(PlayerSocket player, ArraySegment<byte> data, CancellationToken ct)
    {
        try
        {
            if (player.Socket.State == WebSocketState.Open)
            {
                await player.Socket.SendAsync(data, WebSocketMessageType.Binary, true, ct);
            }
        }
        catch
        {
            // Client disconnected — ReceiveLoop handles cleanup
        }
    }

    /// <summary>Fires when the room becomes empty (all players disconnected).</summary>
    public event Action<Guid>? OnEmpty;

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        _logger.LogInformation("Room {RoomId} disposing ({Count} players remaining)", _roomId, _playerCount);

        await _cts.CancelAsync();

        // Close all sockets gracefully
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                var p = _players[i];
                if (p is null) continue;

                try
                {
                    if (p.Socket.State == WebSocketState.Open)
                    {
                        p.Socket.CloseAsync(
                            WebSocketCloseStatus.NormalClosure,
                            "Room closing",
                            CancellationToken.None).Wait(TimeSpan.FromSeconds(2));
                    }
                }
                catch
                {
                    // Best-effort close
                }

                _players[i] = null;
            }

            _playerCount = 0;
        }

        // Wait for background tasks to complete
        var tasks = new[] { _broadcastTask, _processControlTask, _heartbeatTask }
            .Where(t => t is not null)
            .Select(t => t!);

        try
        {
            await Task.WhenAll(tasks).WaitAsync(TimeSpan.FromSeconds(5));
        }
        catch
        {
            // Tasks may have already completed or been cancelled
        }

        _controlChannel.Writer.TryComplete();
        _cts.Dispose();
    }
}

/// <summary>
/// JSON control message from a player — queued in Room's unbounded control channel.
/// Binary position data never enters this struct — it's parsed directly in ReceiveLoop.
/// </summary>
public readonly record struct ControlMessage(int Slot, byte[] Data);
