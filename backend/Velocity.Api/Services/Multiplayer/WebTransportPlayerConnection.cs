using System.Buffers;
using System.Buffers.Binary;
using Microsoft.AspNetCore.Connections;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// WebTransport player connection using two bidirectional QUIC streams:
/// one for binary position data and one for JSON/MessagePack control messages.
/// Client opens both streams and writes a single type byte (0x01 = position, 0x02 = control)
/// as the first byte on each stream. Server reads this byte to route streams correctly,
/// avoiding reliance on non-deterministic QUIC stream accept order.
/// </summary>
/// <remarks>
/// Depends on: IPlayerConnection, TransportSettings, ConnectionContext
/// Used by: WebTransportEndpoints
/// </remarks>
public sealed class WebTransportPlayerConnection(
    ConnectionContext positionCtx,
    ConnectionContext controlCtx,
    Action abortSession)
    : IPlayerConnection
{
    private volatile bool _isOpen = true;

    public bool IsOpen => _isOpen;

    public async ValueTask SendBinaryAsync(ReadOnlyMemory<byte> data, CancellationToken ct)
    {
        if (!_isOpen) return;
        var writer = positionCtx.Transport.Output;
        var result = await writer.WriteAsync(data, ct);
        if (result.IsCompleted) _isOpen = false;
    }

    public async ValueTask SendControlFrameAsync(ReadOnlyMemory<byte> frame, CancellationToken ct)
    {
        if (!_isOpen) return;

        // Write length-prefixed frame: [4B length LE] + [payload]
        // Use pipe's internal buffer to avoid allocating a new byte[4] per send.
        var writer = controlCtx.Transport.Output;
        var header = writer.GetMemory(4);
        BinaryPrimitives.WriteInt32LittleEndian(header.Span, frame.Length);
        writer.Advance(4);

        var result = await writer.WriteAsync(frame, ct);
        if (result.IsCompleted) _isOpen = false;
    }

    public async ValueTask<ReceiveResult> ReceiveAsync(Memory<byte> buffer, CancellationToken ct)
    {
        if (!_isOpen)
            return new ReceiveResult(0, true);

        // Read from position stream (binary position data from client).
        var reader = positionCtx.Transport.Input;
        var readResult = await reader.ReadAsync(ct);

        if (readResult.IsCanceled || readResult.IsCompleted)
        {
            _isOpen = false;
            return new ReceiveResult(0, true);
        }

        var sequence = readResult.Buffer;
        var bytesToCopy = (int)Math.Min(sequence.Length, buffer.Length);

        // CopyTo handles both single-segment and multi-segment buffers internally.
        sequence.Slice(0, bytesToCopy).CopyTo(buffer.Span);

        reader.AdvanceTo(sequence.GetPosition(bytesToCopy));

        return new ReceiveResult(bytesToCopy, false);
    }

    public ValueTask CloseAsync(string reason, CancellationToken ct)
    {
        if (!_isOpen) return ValueTask.CompletedTask;
        _isOpen = false;

        try
        {
            abortSession();
        }
        catch
        {
            // Best effort
        }

        return ValueTask.CompletedTask;
    }

    public async ValueTask DisposeAsync()
    {
        _isOpen = false;

        try { positionCtx.Abort(); } catch { /* best effort */ }
        try { controlCtx.Abort(); } catch { /* best effort */ }
        try { await positionCtx.DisposeAsync(); } catch { /* best effort */ }
        try { await controlCtx.DisposeAsync(); } catch { /* best effort */ }
    }
}
