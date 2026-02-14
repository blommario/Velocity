namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Transport-agnostic abstraction for a player's real-time connection.
/// Allows the Room to operate independently of WebTransport or WebSocket.
/// </summary>
/// <remarks>
/// Depends on: nothing
/// Used by: Room, PlayerSocket
/// </remarks>
public interface IPlayerConnection : IAsyncDisposable
{
    /// <summary>Whether the connection is currently open and can send/receive data.</summary>
    bool IsOpen { get; }

    /// <summary>Sends binary data (position batches) to the client.</summary>
    ValueTask SendBinaryAsync(ReadOnlyMemory<byte> data, CancellationToken ct);

    /// <summary>Sends a pre-framed control message to the client (includes type prefix byte).</summary>
    ValueTask SendControlFrameAsync(ReadOnlyMemory<byte> frame, CancellationToken ct);

    /// <summary>Receives the next message from the client into the provided buffer.</summary>
    ValueTask<ReceiveResult> ReceiveAsync(Memory<byte> buffer, CancellationToken ct);

    /// <summary>Gracefully closes the connection with the given reason.</summary>
    ValueTask CloseAsync(string reason, CancellationToken ct);
}

/// <summary>
/// Result of a receive operation from a player connection.
/// </summary>
public readonly record struct ReceiveResult(int Count, bool IsEnd);
