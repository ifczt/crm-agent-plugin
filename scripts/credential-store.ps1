[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("get", "set", "delete")]
    [string]$Action,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Target
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class CrmCredentialNative
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct Credential
    {
        public UInt32 Flags;
        public UInt32 Type;
        [MarshalAs(UnmanagedType.LPWStr)] public string TargetName;
        [MarshalAs(UnmanagedType.LPWStr)] public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        [MarshalAs(UnmanagedType.LPWStr)] public string TargetAlias;
        [MarshalAs(UnmanagedType.LPWStr)] public string UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredWrite(ref Credential credential, UInt32 flags);

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credential);

    [DllImport("advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

    [DllImport("advapi32.dll", SetLastError = false)]
    public static extern void CredFree(IntPtr credential);
}
"@

$credentialType = 1
$notFound = 1168

switch ($Action) {
    "get" {
        $pointer = [IntPtr]::Zero
        if (-not [CrmCredentialNative]::CredRead($Target, $credentialType, 0, [ref]$pointer)) {
            $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            if ($errorCode -eq $notFound) { exit 0 }
            throw [ComponentModel.Win32Exception]::new($errorCode)
        }
        try {
            $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
                $pointer,
                [type][CrmCredentialNative+Credential]
            )
            if ($credential.CredentialBlobSize -eq 0) { exit 0 }
            $bytes = New-Object byte[] $credential.CredentialBlobSize
            [Runtime.InteropServices.Marshal]::Copy(
                $credential.CredentialBlob,
                $bytes,
                0,
                $credential.CredentialBlobSize
            )
            [Console]::Out.Write([Text.Encoding]::UTF8.GetString($bytes))
        }
        finally {
            [CrmCredentialNative]::CredFree($pointer)
        }
    }
    "set" {
        $value = [Console]::In.ReadToEnd()
        $bytes = [Text.Encoding]::UTF8.GetBytes($value)
        if ($bytes.Length -gt 2560) {
            throw "Credential payload exceeds the Windows Credential Manager limit"
        }
        $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
        try {
            [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)
            $credential = [CrmCredentialNative+Credential]::new()
            $credential.Type = $credentialType
            $credential.TargetName = $Target
            $credential.CredentialBlobSize = $bytes.Length
            $credential.CredentialBlob = $blob
            $credential.Persist = 2
            $credential.UserName = "ifczt-crm-cli"
            if (-not [CrmCredentialNative]::CredWrite([ref]$credential, 0)) {
                throw [ComponentModel.Win32Exception]::new(
                    [Runtime.InteropServices.Marshal]::GetLastWin32Error()
                )
            }
        }
        finally {
            [Runtime.InteropServices.Marshal]::FreeHGlobal($blob)
        }
    }
    "delete" {
        if (-not [CrmCredentialNative]::CredDelete($Target, $credentialType, 0)) {
            $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
            if ($errorCode -ne $notFound) {
                throw [ComponentModel.Win32Exception]::new($errorCode)
            }
        }
    }
}
