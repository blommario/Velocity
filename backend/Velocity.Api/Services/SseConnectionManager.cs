using System.Collections.Concurrent;
using System.Text.Json;

namespace Velocity.Api.Services;

public sealed class SseConnectionManager
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    private readonly ConcurrentDictionary<string, ConcurrentBag<HttpResponse>> _channels = new();

    public void AddClient(string channelName, HttpResponse response)
    {
        var bag = _channels.GetOrAdd(channelName, _ => new ConcurrentBag<HttpResponse>());
        bag.Add(response);
    }

    public void RemoveClient(string channelName, HttpResponse response)
    {
        if (!_channels.TryGetValue(channelName, out var bag))
            return;

        var remaining = new ConcurrentBag<HttpResponse>(bag.Where(r => r != response));
        _channels.TryUpdate(channelName, remaining, bag);

        // Clean up empty channels
        if (remaining.IsEmpty)
            _channels.TryRemove(channelName, out _);
    }

    public async Task BroadcastAsync<T>(string channelName, string eventType, T data, CancellationToken ct = default)
    {
        if (!_channels.TryGetValue(channelName, out var bag))
            return;

        var json = JsonSerializer.Serialize(data, JsonOptions);
        var payload = $"event: {eventType}\ndata: {json}\n\n";

        var disconnected = new List<HttpResponse>();

        foreach (var response in bag)
        {
            try
            {
                await response.WriteAsync(payload, ct);
                await response.Body.FlushAsync(ct);
            }
            catch
            {
                disconnected.Add(response);
            }
        }

        foreach (var response in disconnected)
        {
            RemoveClient(channelName, response);
        }
    }

    public static async Task SendToClientAsync<T>(HttpResponse response, string eventType, T data, CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(data, JsonOptions);
        var payload = $"event: {eventType}\ndata: {json}\n\n";

        await response.WriteAsync(payload, ct);
        await response.Body.FlushAsync(ct);
    }
}
