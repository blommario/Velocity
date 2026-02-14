using System.Reflection;

var asm = Assembly.LoadFrom(@"C:\Program Files\dotnet\shared\Microsoft.AspNetCore.App\10.0.3\Microsoft.AspNetCore.Server.Kestrel.Core.dll");
var types = asm.GetTypes().Where(t => t.Name.Contains("WebTransport")).ToArray();

Console.WriteLine($"Found {types.Length} WebTransport types:\n");

foreach (var t in types)
{
    Console.WriteLine($"=== {t.FullName} ===");

    // Fields (constants)
    foreach (var f in t.GetFields(BindingFlags.Static | BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic))
    {
        try
        {
            var val = f.IsStatic && f.IsLiteral ? f.GetRawConstantValue() : null;
            Console.WriteLine($"  const {f.Name} = \"{val}\"");
        }
        catch { }
    }

    // Methods
    foreach (var m in t.GetMethods(BindingFlags.Static | BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly))
    {
        Console.WriteLine($"  method {m.Name}({string.Join(", ", m.GetParameters().Select(p => p.ParameterType.Name + " " + p.Name))})");
    }
    Console.WriteLine();
}
