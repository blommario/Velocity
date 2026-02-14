using System.Runtime.InteropServices;

namespace Velocity.Api.Services.Multiplayer;

/// <summary>
/// Pre-allocated position data for one player slot. Mutated in-place by ReceiveLoop.
/// Stored for room_snapshot (late joiners); relayed immediately on receive.
/// </summary>
/// <remarks>
/// Depends on: nothing (mutable struct)
/// Used by: Room (PositionBuffer array)
/// </remarks>
[StructLayout(LayoutKind.Sequential, Pack = 1)]
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
}
