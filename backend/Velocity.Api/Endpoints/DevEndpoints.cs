using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace Velocity.Api.Endpoints;

/// <summary>
/// Dev-only endpoints for local development tooling.
/// Exposes the ephemeral ECDSA certificate SHA-256 hash for WebTransport serverCertificateHashes.
/// </summary>
/// <remarks>
/// Depends on: DevCertProvider
/// Used by: Program.cs (endpoint mapping), frontend cert-hash fetch
/// </remarks>
public static class DevEndpoints
{
    public static WebApplication MapDevEndpoints(this WebApplication app)
    {
        app.MapGet("/api/cert-hash", (DevCertProvider certProvider) =>
        {
            var hash = Convert.ToBase64String(certProvider.CertHash);
            return Results.Ok(new { hash });
        })
        .WithTags("Dev")
        .AllowAnonymous();

        return app;
    }
}

/// <summary>
/// Generates an ephemeral ECDSA P-256 certificate for dev WebTransport.
/// WebTransport serverCertificateHashes requires: ECDSA P-256/Ed25519, max 14-day validity.
/// On Windows, msquic/SChannel requires the cert to be in the certificate store,
/// so the cert is temporarily installed in CurrentUser/My and removed on dispose.
/// </summary>
public sealed class DevCertProvider : IDisposable
{
    public X509Certificate2 Certificate { get; }
    public byte[] CertHash { get; }
    private readonly string _thumbprint;

    public DevCertProvider()
    {
        Certificate = GenerateAndInstallCert();
        _thumbprint = Certificate.Thumbprint;
        CertHash = SHA256.HashData(Certificate.RawData);
    }

    public void Dispose()
    {
        // Remove from cert store on shutdown
        try
        {
            using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
            store.Open(OpenFlags.ReadWrite);
            var found = store.Certificates.Find(X509FindType.FindByThumbprint, _thumbprint, false);
            foreach (var cert in found)
            {
                store.Remove(cert);
                cert.Dispose();
            }
        }
        catch
        {
            // Best effort cleanup
        }

        Certificate.Dispose();
    }

    private static X509Certificate2 GenerateAndInstallCert()
    {
        using var key = ECDsa.Create(ECCurve.NamedCurves.nistP256);
        var request = new CertificateRequest(
            "CN=localhost",
            key,
            HashAlgorithmName.SHA256);

        // SAN for localhost
        var sanBuilder = new SubjectAlternativeNameBuilder();
        sanBuilder.AddDnsName("localhost");
        sanBuilder.AddIpAddress(System.Net.IPAddress.Loopback);
        sanBuilder.AddIpAddress(System.Net.IPAddress.IPv6Loopback);
        request.CertificateExtensions.Add(sanBuilder.Build());

        var cert = request.CreateSelfSigned(
            DateTimeOffset.UtcNow.AddMinutes(-5),
            DateTimeOffset.UtcNow.AddDays(13));

        // Re-import with persistent key (required by msquic/SChannel on Windows)
        var persistedCert = X509CertificateLoader.LoadPkcs12(
            cert.Export(X509ContentType.Pfx),
            null,
            X509KeyStorageFlags.UserKeySet | X509KeyStorageFlags.Exportable);

        // Install in CurrentUser/My so msquic can access it
        using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
        store.Open(OpenFlags.ReadWrite);
        store.Add(persistedCert);

        return persistedCert;
    }
}
