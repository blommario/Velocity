using Velocity.Api.Handlers;
using Velocity.Api.Services;

namespace Velocity.Api.Endpoints;

public static class SseEndpoints
{
    public static WebApplication MapSseEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/sse")
            .WithTags("SSE");

        group.MapGet("/leaderboard/{mapId:guid}", async (
            Guid mapId,
            SseConnectionManager sse,
            HttpContext context,
            CancellationToken ct) =>
        {
            context.Response.ContentType = "text/event-stream";
            context.Response.Headers.CacheControl = "no-cache";
            context.Response.Headers.Connection = "keep-alive";

            var channelName = SseChannels.Leaderboard(mapId);
            sse.AddClient(channelName, context.Response);

            // Send initial connection confirmation
            await SseConnectionManager.SendToClientAsync(
                context.Response,
                "connected",
                new { Channel = channelName },
                ct);

            try
            {
                // Keep connection alive until client disconnects
                await Task.Delay(Timeout.Infinite, ct);
            }
            catch (OperationCanceledException)
            {
                // Client disconnected — expected
            }
            finally
            {
                sse.RemoveClient(channelName, context.Response);
            }
        });

        group.MapGet("/multiplayer/{roomId:guid}", async (
            Guid roomId,
            SseConnectionManager sse,
            HttpContext context,
            CancellationToken ct) =>
        {
            context.Response.ContentType = "text/event-stream";
            context.Response.Headers.CacheControl = "no-cache";
            context.Response.Headers.Connection = "keep-alive";

            var channelName = SseChannels.Multiplayer(roomId);
            sse.AddClient(channelName, context.Response);

            await SseConnectionManager.SendToClientAsync(
                context.Response,
                "connected",
                new { Channel = channelName },
                ct);

            try
            {
                await Task.Delay(Timeout.Infinite, ct);
            }
            catch (OperationCanceledException)
            {
                // Client disconnected — expected
            }
            finally
            {
                sse.RemoveClient(channelName, context.Response);
            }
        });

        group.MapGet("/activity", async (
            SseConnectionManager sse,
            HttpContext context,
            CancellationToken ct) =>
        {
            context.Response.ContentType = "text/event-stream";
            context.Response.Headers.CacheControl = "no-cache";
            context.Response.Headers.Connection = "keep-alive";

            sse.AddClient(SseChannels.Activity, context.Response);

            await SseConnectionManager.SendToClientAsync(
                context.Response,
                "connected",
                new { Channel = SseChannels.Activity },
                ct);

            try
            {
                await Task.Delay(Timeout.Infinite, ct);
            }
            catch (OperationCanceledException)
            {
                // Client disconnected — expected
            }
            finally
            {
                sse.RemoveClient(SseChannels.Activity, context.Response);
            }
        });

        return app;
    }
}
