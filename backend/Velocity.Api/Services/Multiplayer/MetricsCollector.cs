namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Singleton service that exposes multiplayer metrics (rooms, players, messages/s, latency).
/// Computes messages/s by snapshotting the delta of inbound message counts every second.
/// </summary>
/// <remarks>
/// Depends on: RoomManager
/// Used by: MetricsEndpoints
/// </remarks>
public sealed class MetricsCollector : IHostedService, IDisposable
{
    private readonly RoomManager _roomManager;
    private Timer? _timer;
    private long _previousTotalMessages;
    private double _messagesPerSecond;

    public MetricsCollector(RoomManager roomManager)
    {
        _roomManager = roomManager;
    }

    public int ActiveRooms { get; private set; }
    public int PlayersOnline { get; private set; }
    public double MessagesPerSecond => _messagesPerSecond;
    public double AverageLatencyMs { get; private set; }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _timer = new Timer(Tick, null, TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(1));
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    private void Tick(object? state)
    {
        var (rooms, players, totalMessages, avgLatency) = _roomManager.GetAggregateMetrics();

        ActiveRooms = rooms;
        PlayersOnline = players;
        AverageLatencyMs = avgLatency;

        var delta = totalMessages - _previousTotalMessages;
        _messagesPerSecond = delta > 0 ? delta : 0;
        _previousTotalMessages = totalMessages;
    }

    public void Dispose()
    {
        _timer?.Dispose();
    }
}
