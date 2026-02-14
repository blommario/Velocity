/// <summary>
/// Minimal binary patcher for Microsoft.AspNetCore.Server.Kestrel.Core.dll
/// Removes the sec-webtransport-http3-draft02 header check so Chrome (draft-09+)
/// can establish WebTransport sessions without that header.
///
/// Strategy: Patch ONLY the ProcessHeadersFrameAsync state machine in Http3Stream.
/// Do NOT change SETTINGS IDs — Chrome accepts the original ones fine.
///
/// Patches applied:
/// 1. EnableWebTransport equality check → pop+pop+br (skip throw, fix stack)
/// 2. H3Datagram equality check → pop+pop+br (skip throw, fix stack)
/// 3. NOP out header+version check block → fall through to set_IsWebTransportRequest
/// 4. AcceptAsync response header → renamed to harmless header
/// </summary>
#nullable enable
using dnlib.DotNet;
using dnlib.DotNet.Emit;

const string SourceDll = @"F:\GitProjects\Velocity\backend\PatchedKestrel\Microsoft.AspNetCore.Server.Kestrel.Core.dll.ORIGINAL";
const string OutputDll = @"F:\GitProjects\Velocity\backend\PatchedKestrel\Microsoft.AspNetCore.Server.Kestrel.Core.dll";

Directory.CreateDirectory(Path.GetDirectoryName(OutputDll)!);
var module = ModuleDefMD.Load(SourceDll);
var patchCount = 0;

// Find the async state machine for ProcessHeadersFrameAsync
MethodDef? targetMethod = null;
foreach (var type in module.GetTypes())
{
    if (!type.Name.Contains("<ProcessHeadersFrameAsync>")) continue;
    foreach (var method in type.Methods)
    {
        if (method.Name != "MoveNext" || method.Body == null) continue;
        targetMethod = method;
        break;
    }
    if (targetMethod != null) break;
}

if (targetMethod == null)
{
    Console.Error.WriteLine("FATAL: Could not find ProcessHeadersFrameAsync state machine MoveNext method!");
    return 1;
}

Console.WriteLine($"Found target: {targetMethod.DeclaringType!.Name}.{targetMethod.Name}");
Console.WriteLine($"  Instructions: {targetMethod.Body.Instructions.Count}");

var instructions = targetMethod.Body.Instructions;

// ============================================================
// PATCH 1 & 2: Change EnableWebTransport and H3Datagram equality
// checks to always skip the throw block.
//
// Original IL:
//   callvirt get_EnableWebTransport()   ← pushes uint32
//   ... (load other peer settings)
//   callvirt get_EnableWebTransport()   ← pushes uint32
//   beq.s IL_XXXX                       ← pops 2, branches if equal
//
// beq.s consumes 2 stack values. br.s consumes 0.
// So we can't just change beq.s→br.s — that leaves 2 extra values on stack.
//
// Fix: Change the FIRST getter call to nop (and its ldloc+ldfld+callvirt chain)
// and the SECOND getter call chain to nop, then change beq.s to br.s.
// Actually simpler: replace the beq.s with pop+pop+br.s by using the
// instruction before it. Or just nop the entire load+compare block.
//
// Cleanest approach: nop all instructions from the first ldloc through beq.s,
// then insert a single br.s to the target.
// ============================================================
string[] equalityGetters = ["get_EnableWebTransport", "get_H3Datagram"];
foreach (var getterName in equalityGetters)
{
    bool patched = false;
    for (int i = 0; i < instructions.Count - 1 && !patched; i++)
    {
        if (instructions[i].OpCode != OpCodes.Callvirt) continue;
        if (instructions[i].Operand is not IMethod m1 || m1.Name != getterName) continue;

        // Find second callvirt to same getter
        for (int j = i + 1; j < Math.Min(i + 7, instructions.Count); j++)
        {
            if (instructions[j].OpCode != OpCodes.Callvirt) continue;
            if (instructions[j].Operand is not IMethod m2 || m2.Name != getterName) continue;

            // Find beq.s right after
            for (int k = j + 1; k < Math.Min(j + 2, instructions.Count); k++)
            {
                if (instructions[k].OpCode != OpCodes.Beq_S && instructions[k].OpCode != OpCodes.Beq) continue;

                var branchTarget = (Instruction)instructions[k].Operand!;

                // Find start of the comparison block — walk back from first getter
                // to find the ldloc that loads 'this' for the ClientPeerSettings chain
                // Pattern: ldloc.1 → ldfld _context → callvirt get_ClientPeerSettings → callvirt get_XXX
                // So first getter (i) is preceded by 3 instructions
                int blockStart = i - 3;
                if (blockStart < 0) continue;

                Console.WriteLine($"  PATCH {++patchCount}: NOP [{blockStart}]-[{k}] + br.s for {getterName} equality (was [{blockStart}] through beq.s at [{k}])");

                // NOP everything from blockStart to k-1
                for (int n = blockStart; n < k; n++)
                {
                    instructions[n].OpCode = OpCodes.Nop;
                    instructions[n].Operand = null;
                }
                // Change beq.s to br.s (now stack-clean since we nop'd the pushes)
                instructions[k].OpCode = OpCodes.Br_S;
                instructions[k].Operand = branchTarget;

                patched = true;
                break;
            }
            break;
        }
    }

    if (!patched)
        Console.WriteLine($"  WARNING: Could not find equality check for {getterName}");
}

// ============================================================
// PATCH 3: NOP out header+version check block.
// When protocol == "webtransport", skip straight to set_IsWebTransportRequest(true).
// ============================================================
int headerCheckStart = -1;
int headerCheckEnd = -1;

for (int i = 0; i < instructions.Count; i++)
{
    if (instructions[i].OpCode != OpCodes.Ldstr) continue;
    if (instructions[i].Operand is not string s || s != "sec-webtransport-http3-draft02") continue;
    if (!targetMethod.DeclaringType!.Name.Contains("ProcessHeadersFrameAsync")) continue;

    Console.WriteLine($"  Found header string at [{i}]");
    headerCheckStart = i - 2; // ldloc.1 → call get_HttpRequestHeaders → ldstr

    for (int j = i + 1; j < Math.Min(i + 15, instructions.Count); j++)
    {
        if (instructions[j].OpCode == OpCodes.Call &&
            instructions[j].Operand is IMethod cm && cm.Name == "set_IsWebTransportRequest")
        {
            headerCheckEnd = j - 3; // last instruction before ldloc.1+ldc.i4.1+call set_
            Console.WriteLine($"  set_IsWebTransportRequest at [{j}], NOP range: [{headerCheckStart}]-[{headerCheckEnd}]");
            break;
        }
    }
    break;
}

if (headerCheckStart >= 0 && headerCheckEnd >= headerCheckStart)
{
    for (int i = headerCheckStart; i <= headerCheckEnd; i++)
    {
        instructions[i].OpCode = OpCodes.Nop;
        instructions[i].Operand = null;
    }
    Console.WriteLine($"  PATCH {++patchCount}: NOP'd [{headerCheckStart}]-[{headerCheckEnd}] ({headerCheckEnd - headerCheckStart + 1} instructions)");
}
else
{
    Console.WriteLine("  WARNING: Could not find header check block to NOP!");
}

// ============================================================
// PATCH 4: Rename response header in AcceptAsync
// ============================================================
Console.WriteLine("\n=== Scanning for version response header in AcceptAsync ===");
foreach (var type in module.GetTypes())
{
    foreach (var method in type.Methods)
    {
        if (method.Body == null) continue;
        if (type.Name.Contains("ProcessHeadersFrameAsync")) continue;

        var instrs = method.Body.Instructions;
        for (int i = 0; i < instrs.Count; i++)
        {
            if (instrs[i].OpCode != OpCodes.Ldstr) continue;
            if (instrs[i].Operand is not string str || str != "sec-webtransport-http3-draft02") continue;

            Console.WriteLine($"  Found in {type.Name}.{method.Name} at [{i}]");
            instrs[i].Operand = "x-patched-unused";
            Console.WriteLine($"  PATCH {++patchCount}: Changed header name to \"x-patched-unused\"");
        }
    }
}

// ============================================================
// Ensure MaxStack is recalculated and mark as IL-only
// ============================================================
targetMethod.Body.KeepOldMaxStack = false;
module.IsILOnly = true;

// ============================================================
// Verify: dump patched region
// ============================================================
Console.WriteLine("\n=== Patched IL (instructions 168-248) ===");
for (int dbg = 168; dbg < Math.Min(248, instructions.Count); dbg++)
{
    var di = instructions[dbg];
    string op;
    if (di.Operand is IField ff) op = ff.Name;
    else if (di.Operand is IMethod mm) op = mm.Name;
    else if (di.Operand is string ss) op = $"\"{ss}\"";
    else if (di.Operand is Instruction ti) op = $"IL_{ti.Offset:X4}";
    else op = di.Operand?.ToString() ?? "";
    Console.WriteLine($"  [{dbg:D4}] {di.OpCode,-15} {op}");
}

// ============================================================
// Save
// ============================================================
if (patchCount < 4)
{
    Console.Error.WriteLine($"ERROR: Only {patchCount} patches applied (expected at least 4)!");
    return 1;
}

Console.WriteLine($"\n=== Applied {patchCount} patches, saving... ===");
var opts = new dnlib.DotNet.Writer.ModuleWriterOptions(module)
{
    Logger = DummyLogger.NoThrowInstance
};
module.Write(OutputDll, opts);
Console.WriteLine($"Saved to: {OutputDll}");
Console.WriteLine("Done!");
return 0;
