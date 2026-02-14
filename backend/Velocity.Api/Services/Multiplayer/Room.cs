using System.Buffers;
using System.Buffers.Binary;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Threading.Channels;
using MessagePack;
using MessagePack.Resolvers;
using Velocity.Api.Configuration;
using Velocity.Api.Contracts;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Isolated multiplayer room — owns player sockets, position buffers, and background loops.
/// Each room runs its own BroadcastLoop (20Hz), ProcessControl (continuous), and HeartbeatMonitor (5s).
/// Binary positions are written directly in each player's ReceiveLoop (zero-copy, no channel).
/// JSON control messages use a separate unbounded channel (never dropped).
/// T1: adds match state machine (Waiting→Countdown→Racing→Finished), finish tracking,
/// leave/kick, host succession, and match timeout.
/// </summary>
/// <remarks>
/// Depends on: PlayerSocket, PositionSnapshot, TransportSettings
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

    private static readonly MessagePackSerializerOptions MsgPackOptions =
        ContractlessStandardResolver.Options;

    private readonly Guid _roomId;
    private readonly ILogger<Room> _logger;
    private readonly PlayerSocket?[] _players = new PlayerSocket?[TransportSettings.MaxPlayersPerRoom];
    private readonly PositionSnapshot[] _positions = new PositionSnapshot[TransportSettings.MaxPlayersPerRoom];
    private readonly TaskCompletionSource[] _disconnectSignals = CreateSignals(TransportSettings.MaxPlayersPerRoom);
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
    private long _inboundMessageCount;

    // ── Match state (T1) ──
    private RoomStatus _status = RoomStatus.Waiting;
    private long _matchStartTime;     // epoch ms (server clock) when match_start fires
    private int _finishedCount;
    private Guid _hostPlayerId;
    private Guid _mapId;
    private long _lastActivityAt = Environment.TickCount64;

    public Guid RoomId => _roomId;
    public int PlayerCount => _playerCount;
    public RoomStatus Status => _status;
    public Guid HostPlayerId => _hostPlayerId;
    public Guid MapId => _mapId;
    public long LastActivityAt => _lastActivityAt;
    public long MatchStartTime => _matchStartTime;

    /// <summary>True once DisposeAsync has been called — used by RoomManager to guard against joining a disposing room.</summary>
    public bool IsDisposed => _disposed;

    /// <summary>Total inbound messages received (binary + JSON). Used by MetricsCollector.</summary>
    public long InboundMessageCount => Interlocked.Read(ref _inboundMessageCount);

    /// <summary>Average latency across all connected players (from ping/pong RTT).</summary>
    public double AveragePlayerLatencyMs
    {
        get
        {
            double sum = 0;
            int count = 0;
            lock (_playerLock)
            {
                for (var i = 0; i < _players.Length; i++)
                {
                    var p = _players[i];
                    if (p is null || p.LatencyMs <= 0) continue;
                    sum += p.LatencyMs;
                    count++;
                }
            }
            return count > 0 ? sum / count : 0;
        }
    }

    public Room(Guid roomId, ILogger<Room> logger)
    {
        _roomId = roomId;
        _logger = logger;
        _broadcastTask = Task.Run(BroadcastLoop);
        _processControlTask = Task.Run(ProcessControlMessages);
        _heartbeatTask = Task.Run(HeartbeatMonitor);
        _logger.LogInformation("Room {RoomId} created", roomId);
    }

    /// <summary>Sets room metadata for match lifecycle (host, map). Called after JoinRoom creates the room.</summary>
    public void SetMetadata(Guid hostPlayerId, Guid mapId)
    {
        _hostPlayerId = hostPlayerId;
        _mapId = mapId;
    }

    /// <summary>
    /// Adds a player to the room. Returns the assigned slot (or -1 if full) and a Task
    /// that completes when the player disconnects (used by the endpoint to keep the request alive).
    /// </summary>
    public (int slot, Task disconnectTask) AddPlayer(Guid playerId, string playerName, IPlayerConnection connection)
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
                    Connection = connection,
                };

                lock (_positionLock) { _positions[i] = default; }

                _disconnectSignals[i] = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _playerCount++;

                // First player becomes host if none set
                if (_hostPlayerId == Guid.Empty)
                    _hostPlayerId = playerId;

                _lastActivityAt = Environment.TickCount64;

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

    // ── Match lifecycle (T1) ──

    /// <summary>
    /// Starts the countdown sequence as a background task. Called from MultiplayerHandlers.StartMatch.
    /// Broadcasts countdown 3→2→1→0 (GO) then transitions to Racing.
    /// </summary>
    public void StartCountdown()
    {
        if (_status != RoomStatus.Waiting) return;
        _status = RoomStatus.Countdown;
        _lastActivityAt = Environment.TickCount64;
        _ = Task.Run(RunCountdownSequence);
    }

    private async Task RunCountdownSequence()
    {
        var ct = _cts.Token;

        try
        {
            for (var i = TransportSettings.CountdownSeconds; i >= 1; i--)
            {
                await BroadcastJsonAsync("countdown", new { countdown = i }, ct);
                await Task.Delay(1000, ct);
            }

            // GO!
            _matchStartTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            _status = RoomStatus.Racing;
            _finishedCount = 0;

            // Reset finish state for all players
            lock (_playerLock)
            {
                for (var i = 0; i < _players.Length; i++)
                {
                    if (_players[i] is not null)
                    {
                        _players[i]!.IsFinished = false;
                        _players[i]!.FinishTime = 0;
                        _players[i]!.Placement = 0;
                        _players[i]!.Health = TransportSettings.MaxPlayerHealth;
                        _players[i]!.IsDead = false;
                        _players[i]!.Kills = 0;
                        _players[i]!.Deaths = 0;
                        _players[i]!.LastHitEventAt = 0;
                    }
                }
            }

            await BroadcastJsonAsync("countdown", new { countdown = 0 }, ct);
            await BroadcastJsonAsync("match_start", new { matchStartTime = _matchStartTime }, ct);

            _logger.LogInformation("Room {RoomId} match started at {StartTime}", _roomId, _matchStartTime);

            // Schedule match timeout
            _ = Task.Run(() => MatchTimeoutMonitor(ct), ct);
        }
        catch (OperationCanceledException)
        {
            // Room disposed during countdown
        }
    }

    /// <summary>Force-finishes the match after timeout.</summary>
    private async Task MatchTimeoutMonitor(CancellationToken ct)
    {
        try
        {
            await Task.Delay(TransportSettings.MatchTimeoutMs, ct);

            if (_status != RoomStatus.Racing) return;

            _logger.LogInformation("Room {RoomId} match timeout — force finishing", _roomId);
            await FinishMatch(ct);
        }
        catch (OperationCanceledException)
        {
            // Normal — room disposed or match ended before timeout
        }
    }

    /// <summary>Transitions room to Finished state, broadcasts match_finished with results.</summary>
    private async Task FinishMatch(CancellationToken ct)
    {
        if (_status == RoomStatus.Finished) return;
        _status = RoomStatus.Finished;

        var results = GetFinishResults();
        await BroadcastJsonAsync("match_finished", new { results }, ct);

        _logger.LogInformation("Room {RoomId} match finished ({Count} finishers)", _roomId, results.Count);

        OnMatchFinished?.Invoke(_roomId, results);
    }

    /// <summary>Collects finish results from all players for broadcasting and DB persistence.</summary>
    public IReadOnlyList<FinishResult> GetFinishResults()
    {
        var results = new List<FinishResult>();
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                var p = _players[i];
                if (p is null) continue;

                results.Add(new FinishResult(
                    p.PlayerId,
                    p.PlayerName,
                    p.IsFinished ? p.FinishTime : null,
                    p.Placement,
                    p.Slot));
            }
        }

        return results.OrderBy(r => r.Placement == 0 ? int.MaxValue : r.Placement)
            .ThenBy(r => r.FinishTime ?? float.MaxValue)
            .ToList();
    }

    /// <summary>
    /// Broadcasts a MessagePack-encoded control message to all connected players in the room.
    /// </summary>
    public Task BroadcastJsonAsync<T>(string type, T data, CancellationToken ct = default)
    {
        var bytes = MessagePackSerializer.Serialize(new { type, data }, MsgPackOptions, ct);

        var frame = new byte[1 + bytes.Length];
        frame[0] = TransportSettings.MsgTypeMsgPack;
        bytes.CopyTo(frame, 1);

        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                var p = _players[i];
                if (p is null || !p.Connection.IsOpen) continue;
                _ = SendSafeAsync(p, frame, ct);
            }
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Sends a MessagePack-encoded control message to a specific player by slot.
    /// </summary>
    internal async Task SendJsonToPlayerAsync<T>(int slot, string type, T data, CancellationToken ct = default)
    {
        var bytes = MessagePackSerializer.Serialize(new { type, data }, MsgPackOptions);

        var frame = new byte[1 + bytes.Length];
        frame[0] = TransportSettings.MsgTypeMsgPack;
        bytes.CopyTo(frame, 1);

        PlayerSocket? player;
        lock (_playerLock) { player = _players[slot]; }

        if (player is not null && player.Connection.IsOpen)
            await SendSafeAsync(player, frame, ct);
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
        var buffer = ArrayPool<byte>.Shared.Rent(TransportSettings.ReceiveBufferSize);

        try
        {
            PlayerSocket? player;
            lock (_playerLock) { player = _players[slot]; }
            if (player is null) return;

            while (!ct.IsCancellationRequested && player.IsActive && player.Connection.IsOpen)
            {
                var result = await player.Connection.ReceiveAsync(buffer, ct);

                if (result.IsEnd)
                    break;

                player.LastSeenAt = Environment.TickCount64;

                if (result.Count == 0) continue;

                Interlocked.Increment(ref _inboundMessageCount);

                var msgType = buffer[0];

                if (msgType == TransportSettings.MsgTypePosition)
                {
                    // Only accept position data during Racing state
                    if (_status == RoomStatus.Racing)
                        ParsePositionDirect(slot, buffer.AsSpan(0, result.Count));
                }
                else if (msgType == TransportSettings.MsgTypeJson || msgType == TransportSettings.MsgTypeMsgPack)
                {
                    var controlData = buffer.AsSpan(1, result.Count - 1).ToArray();
                    _controlChannel.Writer.TryWrite(new ControlMessage(slot, controlData, IsMsgPack: msgType == TransportSettings.MsgTypeMsgPack));
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
        catch (Exception)
        {
            // Connection dropped
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(buffer);
        }

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

        if (data[ClientMsgTypeOffset] != TransportSettings.MsgTypePosition) return;

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
    /// Handles host succession and DNF during racing.
    /// </summary>
    private async Task CleanupPlayer(int slot)
    {
        bool isEmpty;
        Guid leftPlayerId;
        string leftPlayerName;
        bool wasHost;

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
            wasHost = p.PlayerId == _hostPlayerId;
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

            // Host succession: promote oldest remaining player
            if (wasHost && !isEmpty)
            {
                PromoteNewHost();
            }

            // During racing: check if all remaining players finished
            if (_status == RoomStatus.Racing && !isEmpty)
            {
                await CheckAllFinished(_cts.Token);
            }
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

    /// <summary>Promotes the oldest remaining player to host and broadcasts.</summary>
    private void PromoteNewHost()
    {
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                if (_players[i] is null) continue;

                _hostPlayerId = _players[i]!.PlayerId;

                _logger.LogInformation("Room {RoomId} host changed to {PlayerId} ({PlayerName})",
                    _roomId, _players[i]!.PlayerId, _players[i]!.PlayerName);

                _ = BroadcastJsonAsync("host_changed", new
                {
                    playerId = _players[i]!.PlayerId,
                    playerName = _players[i]!.PlayerName,
                });

                return;
            }
        }
    }

    /// <summary>Checks if all remaining active players have finished; if so, end the match.</summary>
    private async Task CheckAllFinished(CancellationToken ct)
    {
        bool allFinished;
        lock (_playerLock)
        {
            allFinished = true;
            for (var i = 0; i < _players.Length; i++)
            {
                if (_players[i] is null) continue;
                if (!_players[i]!.IsFinished)
                {
                    allFinished = false;
                    break;
                }
            }
        }

        if (allFinished)
        {
            await FinishMatch(ct);
        }
    }

    // ── ProcessControlMessages: JSON + MessagePack (unbounded channel, never drops) ──

    /// <summary>
    /// Processes control messages (JSON or MessagePack) from the unbounded channel.
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

                if (msg.IsMsgPack)
                    await ProcessMsgPackMessage(msg.Slot, msg.Data, ct);
                else
                    await ProcessJsonMessage(msg.Slot, msg.Data, ct);
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown
        }
    }

    /// <summary>
    /// Parses a JSON control message from a player and dispatches accordingly.
    /// Handles: ping, finish, leave, kick, rejoin, hit.
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
                    await HandlePing(slot, root, ct);
                    break;

                case "finish":
                    await HandleFinish(slot, root, ct);
                    break;

                case "leave":
                    await HandleLeave(slot, ct);
                    break;

                case "kick":
                    await HandleKick(slot, root, ct);
                    break;

                case "rejoin":
                    await HandleRejoin(slot, ct);
                    break;

                case CombatMessageTypes.Hit:
                    await HandleHit(slot, root, ct);
                    break;
            }

            _lastActivityAt = Environment.TickCount64;
        }
        catch (JsonException)
        {
            // Malformed JSON — ignore
        }
    }

    /// <summary>
    /// Parses a MessagePack control message from a player and dispatches accordingly.
    /// Converts to JSON internally for handler reuse until full MessagePack migration completes.
    /// </summary>
    private async Task ProcessMsgPackMessage(int slot, byte[] data, CancellationToken ct)
    {
        try
        {
            // Convert MessagePack to JSON for handler compatibility during transition
            var json = MessagePackSerializer.ConvertToJson(data, MsgPackOptions, ct);
            var jsonBytes = Encoding.UTF8.GetBytes(json);
            await ProcessJsonMessage(slot, jsonBytes, ct);
        }
        catch
        {
            // Malformed MessagePack — ignore
        }
    }

    private async Task HandlePing(int slot, JsonElement root, CancellationToken ct)
    {
        if (!root.TryGetProperty("t", out var tProp)) return;

        var clientT = tProp.GetInt64();
        var serverT = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        PlayerSocket? player;
        lock (_playerLock) { player = _players[slot]; }

        if (player is not null)
        {
            // Rough latency estimate: half the round-trip implied by clock difference.
            // The client will compute a more accurate RTT from the pong response.
            var rtt = serverT - clientT;
            if (rtt is > 0 and < 10000)
                player.LatencyMs = rtt / 2.0;
        }

        if (player is not null && player.Connection.IsOpen)
        {
            await SendJsonToPlayerAsync(slot, "pong", new { t = clientT, serverT }, ct);
        }
    }

    private async Task HandleFinish(int slot, JsonElement root, CancellationToken ct)
    {
        if (_status != RoomStatus.Racing) return;

        if (!root.TryGetProperty("finishTime", out var ftProp)) return;
        var finishTime = (float)ftProp.GetDouble();
        if (finishTime <= 0) return;

        Guid playerId;
        string playerName;

        lock (_playerLock)
        {
            var p = _players[slot];
            if (p is null || p.IsFinished) return;

            _finishedCount++;
            p.IsFinished = true;
            p.FinishTime = finishTime;
            p.Placement = _finishedCount;
            playerId = p.PlayerId;
            playerName = p.PlayerName;
        }

        _logger.LogInformation("Room {RoomId} player {PlayerId} finished — time={Time}ms placement={Place}",
            _roomId, playerId, finishTime, _finishedCount);

        await BroadcastJsonAsync("player_finished", new
        {
            playerId,
            playerName,
            finishTime,
            placement = _finishedCount,
        }, ct);

        await CheckAllFinished(ct);
    }

    private async Task HandleLeave(int slot, CancellationToken ct)
    {
        PlayerSocket? player;
        lock (_playerLock) { player = _players[slot]; }
        if (player is null) return;

        _logger.LogInformation("Room {RoomId} player {PlayerId} requested leave", _roomId, player.PlayerId);

        try
        {
            if (player.Connection.IsOpen)
                await player.Connection.CloseAsync("Player left", ct);
        }
        catch
        {
            // Connection may already be closing
        }
    }

    private async Task HandleKick(int slot, JsonElement root, CancellationToken ct)
    {
        // Only host can kick
        Guid kickerPlayerId;
        lock (_playerLock)
        {
            var kicker = _players[slot];
            if (kicker is null) return;
            kickerPlayerId = kicker.PlayerId;
        }

        if (kickerPlayerId != _hostPlayerId) return;

        if (!root.TryGetProperty("targetPlayerId", out var targetProp)) return;
        if (!Guid.TryParse(targetProp.GetString(), out var targetId)) return;

        int targetSlot = -1;
        PlayerSocket? targetPlayer;

        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                if (_players[i]?.PlayerId == targetId)
                {
                    targetSlot = i;
                    break;
                }
            }
        }

        if (targetSlot < 0) return;
        lock (_playerLock) { targetPlayer = _players[targetSlot]; }
        if (targetPlayer is null) return;

        _logger.LogInformation("Room {RoomId} host kicked player {PlayerId}", _roomId, targetId);

        await BroadcastJsonAsync("player_kicked", new
        {
            playerId = targetId,
            playerName = targetPlayer.PlayerName,
        }, ct);

        try
        {
            if (targetPlayer.Connection.IsOpen)
                await targetPlayer.Connection.CloseAsync("Kicked by host", ct);
        }
        catch
        {
            // Connection may already be closing
        }
    }

    // ── Combat ──

    /// <summary>Finds a player by their PlayerId. Returns (slot, player) or (-1, null) if not found.</summary>
    private (int slot, PlayerSocket? player) FindPlayerById(Guid playerId)
    {
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                if (_players[i]?.PlayerId == playerId)
                    return (i, _players[i]);
            }
        }

        return (-1, null);
    }

    /// <summary>
    /// Validates and applies a hit event from the attacking player.
    /// Checks: racing state, both alive, not self, distance, rate limit, damage cap.
    /// On kill: broadcasts player_killed and schedules respawn.
    /// </summary>
    private async Task HandleHit(int slot, JsonElement root, CancellationToken ct)
    {
        if (_status != RoomStatus.Racing) return;

        if (!root.TryGetProperty("data", out var data)) return;
        if (!data.TryGetProperty("targetPlayerId", out var targetProp)) return;
        if (!Guid.TryParse(targetProp.GetString(), out var targetId)) return;
        if (!data.TryGetProperty("damage", out var damageProp)) return;
        if (!data.TryGetProperty("distance", out var distanceProp)) return;

        var rawDamage = damageProp.GetInt32();
        var distance = (float)distanceProp.GetDouble();
        var weapon = data.TryGetProperty("weapon", out var weaponProp) ? weaponProp.GetString() ?? "" : "";
        var zone = data.TryGetProperty("zone", out var zoneProp) ? zoneProp.GetString() ?? HitboxZones.Torso : HitboxZones.Torso;

        // Validate attacker
        PlayerSocket? attacker;
        lock (_playerLock) { attacker = _players[slot]; }
        if (attacker is null || attacker.IsDead) return;

        // Self-hit rejected
        if (attacker.PlayerId == targetId) return;

        // Distance check
        if (distance < 0 || distance > TransportSettings.MaxHitDistance) return;

        // Rate limit
        var now = Environment.TickCount64;
        if (now - attacker.LastHitEventAt < TransportSettings.MinFireIntervalMs) return;
        attacker.LastHitEventAt = now;

        // Cap damage
        var damage = Math.Min(rawDamage, TransportSettings.MaxDamagePerHit);
        if (damage <= 0) return;

        // Validate target
        var (targetSlot, target) = FindPlayerById(targetId);
        if (target is null || target.IsDead) return;

        // Apply damage
        int healthRemaining;
        bool killed;

        lock (_playerLock)
        {
            target.Health = Math.Max(0, target.Health - damage);
            healthRemaining = target.Health;
            killed = healthRemaining <= 0;

            if (killed)
            {
                target.IsDead = true;
                target.Deaths++;
                attacker.Kills++;
            }
        }

        // Broadcast damage
        await BroadcastJsonAsync(CombatMessageTypes.PlayerDamaged, new
        {
            targetPlayerId = targetId,
            attackerPlayerId = attacker.PlayerId,
            damage,
            healthRemaining,
            weapon,
            zone,
        }, ct);

        if (killed)
        {
            _logger.LogInformation("Room {RoomId} player {AttackerId} killed {TargetId} ({Weapon}, {Zone})",
                _roomId, attacker.PlayerId, targetId, weapon, zone);

            await BroadcastJsonAsync(CombatMessageTypes.PlayerKilled, new
            {
                targetPlayerId = targetId,
                attackerPlayerId = attacker.PlayerId,
                weapon,
                zone,
            }, ct);

            _ = Task.Run(() => ScheduleRespawn(targetId, ct), ct);
        }
    }

    /// <summary>
    /// Waits RespawnDelayMs then resets the player's health and isDead, broadcasts player_respawned.
    /// </summary>
    private async Task ScheduleRespawn(Guid playerId, CancellationToken ct)
    {
        try
        {
            await Task.Delay(TransportSettings.RespawnDelayMs, ct);

            var (targetSlot, target) = FindPlayerById(playerId);
            if (target is null) return;

            lock (_playerLock)
            {
                target.Health = TransportSettings.MaxPlayerHealth;
                target.IsDead = false;
            }

            await BroadcastJsonAsync(CombatMessageTypes.PlayerRespawned, new
            {
                playerId,
                health = TransportSettings.MaxPlayerHealth,
            }, ct);

            _logger.LogInformation("Room {RoomId} player {PlayerId} respawned", _roomId, playerId);
        }
        catch (OperationCanceledException)
        {
            // Room disposed during respawn delay
        }
    }

    private async Task HandleRejoin(int slot, CancellationToken ct)
    {
        var snapshot = GetFullSnapshot(slot);
        await SendJsonToPlayerAsync(slot, "room_snapshot", snapshot, ct);
    }

    /// <summary>
    /// Returns a comprehensive room snapshot for rejoin — includes players, positions, room state, and results.
    /// </summary>
    public object GetFullSnapshot(int yourSlot)
    {
        var players = new List<object>();
        var positions = new List<object>();

        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                var p = _players[i];
                if (p is null) continue;

                players.Add(new
                {
                    playerId = p.PlayerId,
                    name = p.PlayerName,
                    slot = p.Slot,
                    isFinished = p.IsFinished,
                    finishTime = p.IsFinished ? p.FinishTime : (float?)null,
                    placement = p.Placement,
                    health = p.Health,
                    isDead = p.IsDead,
                    kills = p.Kills,
                    deaths = p.Deaths,
                });

                // Include current position data if racing
                if (_status == RoomStatus.Racing)
                {
                    PositionSnapshot pos;
                    lock (_positionLock) { pos = _positions[i]; }

                    positions.Add(new
                    {
                        slot = i,
                        posX = pos.PosX,
                        posY = pos.PosY,
                        posZ = pos.PosZ,
                        yaw = pos.Yaw,
                        pitch = pos.Pitch,
                        speed = pos.Speed,
                        checkpoint = pos.Checkpoint,
                    });
                }
            }
        }

        var results = _status == RoomStatus.Finished ? GetFinishResults() : null;

        return new
        {
            roomId = _roomId,
            players,
            yourSlot,
            status = _status.ToString().ToLowerInvariant(),
            matchStartTime = _matchStartTime,
            hostPlayerId = _hostPlayerId,
            positions,
            finishResults = results,
        };
    }

    // ── BroadcastLoop: 20Hz stable tick, fire-and-forget sends ──

    /// <summary>
    /// 20Hz broadcast loop — snapshots all dirty positions atomically, serializes to binary batch,
    /// and fires sends to all players without awaiting (no head-of-line blocking).
    /// Only broadcasts during Racing state.
    /// </summary>
    private async Task BroadcastLoop()
    {
        var ct = _cts.Token;

        var snapshotBuffer = new PositionSnapshot[TransportSettings.MaxPlayersPerRoom];
        var dirtySlots = new int[TransportSettings.MaxPlayersPerRoom];
        var tickInterval = TimeSpan.FromMilliseconds(TransportSettings.BroadcastIntervalMs);

        try
        {
            while (!ct.IsCancellationRequested)
            {
                var tickStart = Stopwatch.GetTimestamp();

                // Only broadcast position data during racing
                if (_status == RoomStatus.Racing)
                {
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
                        var batchSize = BatchHeaderSize + (BytesPerPlayer * dirtyCount);
                        var batch = ArrayPool<byte>.Shared.Rent(batchSize);

                        batch[0] = TransportSettings.MsgTypePositionBatch;
                        batch[1] = (byte)dirtyCount;

                        var span = batch.AsSpan();

                        // Server-stamped time: ms since match start (monotonic for all clients)
                        var serverTimeMs = (uint)(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - _matchStartTime);

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
                            BinaryPrimitives.WriteUInt32LittleEndian(span[(offset + BatchTimestampOffset)..], serverTimeMs);
                        }

                        var sendData = new ReadOnlyMemory<byte>(batch, 0, batchSize);
                        var sendTasks = new List<Task>();

                        lock (_playerLock)
                        {
                            for (var i = 0; i < _players.Length; i++)
                            {
                                var p = _players[i];
                                if (p is null || !p.Connection.IsOpen) continue;
                                sendTasks.Add(SendBinarySafeAsync(p, sendData, ct));
                            }
                        }

                        if (sendTasks.Count > 0)
                        {
                            _ = ReturnBufferAfterSends(sendTasks, batch);
                        }
                        else
                        {
                            ArrayPool<byte>.Shared.Return(batch);
                        }
                    }
                }

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
                await Task.Delay(TransportSettings.HeartbeatIntervalMs, ct);

                var now = Environment.TickCount64;
                var stale = new List<(int slot, PlayerSocket player)>();

                lock (_playerLock)
                {
                    for (var i = 0; i < _players.Length; i++)
                    {
                        var p = _players[i];
                        if (p is null) continue;

                        if (now - p.LastSeenAt > TransportSettings.HeartbeatTimeoutMs)
                            stale.Add((i, p));
                    }
                }

                foreach (var (slot, player) in stale)
                {
                    _logger.LogWarning("Heartbeat timeout for player {PlayerId} in room {RoomId} slot {Slot} (last seen {Ago}ms ago)",
                        player.PlayerId, _roomId, slot, now - player.LastSeenAt);

                    try
                    {
                        if (player.Connection.IsOpen)
                            await player.Connection.CloseAsync("Heartbeat timeout", CancellationToken.None);
                    }
                    catch
                    {
                        // Connection may already be closed
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
    /// Sends a control frame via the connection, catching and ignoring failures (disconnected clients).
    /// </summary>
    private static async Task SendSafeAsync(PlayerSocket player, byte[] frame, CancellationToken ct)
    {
        try
        {
            if (player.Connection.IsOpen)
                await player.Connection.SendControlFrameAsync(frame, ct);
        }
        catch
        {
            // Client disconnected — ReceiveLoop handles cleanup
        }
    }

    /// <summary>
    /// Sends a binary frame via the connection, catching and ignoring failures (disconnected clients).
    /// </summary>
    private static async Task SendBinarySafeAsync(PlayerSocket player, ReadOnlyMemory<byte> data, CancellationToken ct)
    {
        try
        {
            if (player.Connection.IsOpen)
                await player.Connection.SendBinaryAsync(data, ct);
        }
        catch
        {
            // Client disconnected — ReceiveLoop handles cleanup
        }
    }

    /// <summary>Fires when the room becomes empty (all players disconnected).</summary>
    public event Action<Guid>? OnEmpty;

    /// <summary>Fires when match finishes (all finished or timeout). Provides results for DB persistence.</summary>
    public event Action<Guid, IReadOnlyList<FinishResult>>? OnMatchFinished;

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        _logger.LogInformation("Room {RoomId} disposing ({Count} players remaining)", _roomId, _playerCount);

        await _cts.CancelAsync();

        // Close all connections gracefully
        lock (_playerLock)
        {
            for (var i = 0; i < _players.Length; i++)
            {
                var p = _players[i];
                if (p is null) continue;

                try
                {
                    if (p.Connection.IsOpen)
                    {
                        p.Connection.CloseAsync("Room closing", CancellationToken.None)
                            .AsTask().Wait(TimeSpan.FromSeconds(2));
                    }

                    p.Connection.DisposeAsync().AsTask().Wait(TimeSpan.FromSeconds(1));
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
/// Control message from a player — queued in Room's unbounded control channel.
/// Binary position data never enters this struct — it's parsed directly in ReceiveLoop.
/// </summary>
public readonly record struct ControlMessage(int Slot, byte[] Data, bool IsMsgPack = false);

/// <summary>Room status enum for in-memory room state.</summary>
public enum RoomStatus
{
    Waiting,
    Countdown,
    Racing,
    Finished,
}

/// <summary>Finish result for a player, used for broadcasting and DB persistence.</summary>
public record FinishResult(Guid PlayerId, string PlayerName, float? FinishTime, int Placement, int Slot);
