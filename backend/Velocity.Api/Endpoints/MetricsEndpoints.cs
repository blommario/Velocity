using System.Globalization;
using System.Text;
using Velocity.Api.Services.Multiplayer;

namespace Velocity.Api.Endpoints;

/// <summary>
/// Exposes multiplayer metrics in Prometheus text format and JSON.
/// </summary>
/// <remarks>
/// Depends on: MetricsCollector
/// Used by: Program.cs (endpoint mapping)
/// </remarks>
public static class MetricsEndpoints
{
    public static WebApplication MapMetricsEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin")
            .WithTags("Admin")
            .RequireAuthorization();

        group.MapGet("/metrics", (HttpContext context, MetricsCollector metrics) =>
        {
            var format = context.Request.Query["format"].FirstOrDefault();

            if (string.Equals(format, "json", StringComparison.OrdinalIgnoreCase))
            {
                return Results.Ok(new
                {
                    activeRooms = metrics.ActiveRooms,
                    playersOnline = metrics.PlayersOnline,
                    messagesPerSecond = Math.Round(metrics.MessagesPerSecond, 1),
                    averageLatencyMs = Math.Round(metrics.AverageLatencyMs, 1),
                });
            }

            // Prometheus text exposition format
            var sb = new StringBuilder(512);
            WriteGauge(sb, "velocity_active_rooms", "Number of active multiplayer rooms", metrics.ActiveRooms);
            WriteGauge(sb, "velocity_players_online", "Total connected players", metrics.PlayersOnline);
            WriteGauge(sb, "velocity_messages_per_second", "Inbound messages per second", metrics.MessagesPerSecond);
            WriteGauge(sb, "velocity_average_latency_ms", "Average player latency in milliseconds", metrics.AverageLatencyMs);

            return Results.Text(sb.ToString(), "text/plain; version=0.0.4; charset=utf-8");
        });

        return app;
    }

    private static void WriteGauge(StringBuilder sb, string name, string help, double value)
    {
        sb.Append("# HELP ").Append(name).Append(' ').AppendLine(help);
        sb.Append("# TYPE ").Append(name).AppendLine(" gauge");
        sb.Append(name).Append(' ').AppendLine(value.ToString("F1", CultureInfo.InvariantCulture));
    }
}
