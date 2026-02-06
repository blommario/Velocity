namespace Velocity.Api.Contracts;

public record SubmitReplayRequest(string ReplayDataJson);

public record ReplayResponse(Guid RunId, string ReplayDataJson);
