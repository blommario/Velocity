using System.Runtime.InteropServices;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Pre-allocated position data for one player slot. Mutated in-place by ProcessInbound.
/// Binary layout matches the client protocol: 25 bytes per player.
/// </summary>
/// <remarks>
/// Depends on: nothing (mutable struct)
/// Used by: Room (PositionBuffer array)
/// </remarks>
[StructLayout(LayoutKind.Sequential, Pack = 1)] // Optional optimization
public struct PositionSnapshot
{
    public float PosX;
    public float PosY;
    public float PosZ;
    public short Yaw;
    public short Pitch;
    public ushort Speed;
    public byte Checkpoint;
    public uint Timestamp;
    public bool Dirty;
}
