export interface CodeSnippet {
  id: string;
  language: string;
  name: string;
  iconName: string;
  description: string;
  filename: string;
  code: (publicKey: string, defaultProductId?: string) => string;
}

export const CODE_SNIPPETS: CodeSnippet[] = [
  {
    id: 'python',
    language: 'python',
    name: 'Python',
    iconName: 'Code',
    description: 'Python projelerinde cryptography kütüphanesi ile çevrimdışı (internetsiz) RSA-SHA256 lisans doğrulama.',
    filename: 'license_verifier.py',
    code: (publicKey: string, defaultProductId = 'urun-adi') => `# ==============================================================================
# Python Lisans Doğrulama Modülü (Çevrimdışı / Offline RSA-SHA256)
# Gerekli Kütüphane: pip install cryptography
# ==============================================================================

import base64
import json
from datetime import datetime, timezone
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.serialization import load_pem_public_key

# Yönetici panelinden dışa aktarılan RSA Public Key
PUBLIC_KEY_PEM = """${publicKey}"""

class LicenseVerifier:
    def __init__(self, public_key_pem: str = PUBLIC_KEY_PEM):
        self.public_key = load_pem_public_key(public_key_pem.encode('utf-8'))

    def verify_license(self, license_key_str: str, expected_product_id: str = None, current_machine_id: str = None):
        """
        Lisans anahtarını doğrular.
        Format: base64(payload).base64(signature)
        Dönüş: (is_valid: bool, message: str, payload_data: dict)
        """
        try:
            if not license_key_str or "." not in license_key_str:
                return False, "Geçersiz lisans formatı (Payload ve İmza ayracı bulunamadı)", None

            payload_b64, sig_b64 = license_key_str.strip().split(".", 1)

            # Base64 decode
            payload_bytes = base64.b64decode(payload_b64)
            sig_bytes = base64.b64decode(sig_b64)

            # 1. Kriptografik RSA-SHA256 Dijital İmza Doğrulaması
            self.public_key.verify(
                sig_bytes,
                payload_bytes,
                padding.PKCS1v15(),
                hashes.SHA256()
            )

            # 2. JSON Payload Çözümleme
            payload = json.loads(payload_bytes.decode('utf-8'))

            # 3. Ürün Kodu Kontrolü
            if expected_product_id and payload.get('product_id') != expected_product_id:
                return False, f"Ürün uyuşmazlığı! Beklenen: {expected_product_id}, Lisans: {payload.get('product_id')}", payload

            # 4. Süre (Expiration) Kontrolü - UTC
            expires_at_str = payload.get('expires_at')
            if expires_at_str:
                expires_at = datetime.fromisoformat(expires_at_str.replace('Z', '+00:00'))
                now_utc = datetime.now(timezone.utc)
                if now_utc > expires_at:
                    return False, f"Lisans süresi dolmuş! Bitiş: {expires_at_str}", payload

            # 5. Makine ID (Hardware Fingerprint) Kilidi Kontrolü (Opsiyonel)
            locked_machine = payload.get('machine_id')
            if locked_machine and current_machine_id:
                if locked_machine.lower() != current_machine_id.lower():
                    return False, f"Donanım kimliği eşleşmedi! Lisans Makinesi: {locked_machine}", payload

            return True, "Lisans geçerli ve imzası doğrulandı.", payload

        except Exception as e:
            return False, f"Lisans doğrulanamadı veya tahrif edilmiş: {str(e)}", None


# --- KULLANIM ÖRNEĞİ ---
if __name__ == "__main__":
    verifier = LicenseVerifier()
    
    # Müşteriden alınan lisans anahtarı
    sample_license = "BURAYA_LISANS_ANAHTARINI_YAPISTIRIN"
    
    is_valid, msg, data = verifier.verify_license(sample_license, expected_product_id="${defaultProductId}")
    
    if is_valid:
        print("✅ [BAŞARILI] Lisans Geçerli!")
        print(f"Müşteri: {data['customer']}")
        print(f"Lisans Tipi: {data['license_type']}")
        print(f"Bitiş Tarihi: {data['expires_at']}")
    else:
        print(f"❌ [HATA] {msg}")
`,
  },
  {
    id: 'nodejs',
    language: 'typescript',
    name: 'Node.js / TypeScript',
    iconName: 'FileCode',
    description: 'Node.js veya Electron projelerinde yerleşik "crypto" kütüphanesi ile sıfır bağımlılıkla doğrulama.',
    filename: 'licenseVerifier.ts',
    code: (publicKey: string, defaultProductId = 'urun-adi') => `// ==============================================================================
// Node.js / TypeScript Lisans Doğrulama (Yerleşik 'crypto' ile Sıfır Bağımlılık)
// ==============================================================================

import crypto from 'crypto';

// Lisans Üretici Panelinden dışa aktarılan RSA Public Key
const PUBLIC_KEY_PEM = \`${publicKey}\`;

export interface LicensePayload {
  license_id: string;
  product_id: string;
  license_type: 'demo' | 'yearly' | 'custom';
  customer: string;
  issued_at: string;
  expires_at: string;
  machine_id: string | null;
  extra?: Record<string, unknown>;
}

export interface VerificationResponse {
  isValid: boolean;
  message: string;
  payload: LicensePayload | null;
}

export function verifyLicense(
  licenseKey: string,
  expectedProductId?: string,
  currentMachineId?: string
): VerificationResponse {
  try {
    if (!licenseKey || !licenseKey.includes('.')) {
      return { isValid: false, message: 'Geçersiz lisans formatı', payload: null };
    }

    const [payloadB64, signatureB64] = licenseKey.trim().split('.');
    const payloadBuffer = Buffer.from(payloadB64, 'base64');
    const signatureBuffer = Buffer.from(signatureB64, 'base64');

    // 1. RSA-SHA256 Dijital İmza Doğrulaması
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payloadBuffer);
    verifier.end();

    const isSignatureValid = verifier.verify(PUBLIC_KEY_PEM, signatureBuffer);
    if (!isSignatureValid) {
      return { isValid: false, message: 'Dijital imza geçersiz! Lisans tahrif edilmiş olabilir.', payload: null };
    }

    // 2. JSON Payload'ı ayrıştır
    const payload: LicensePayload = JSON.parse(payloadBuffer.toString('utf8'));

    // 3. Ürün Kodu Doğrulaması
    if (expectedProductId && payload.product_id !== expectedProductId) {
      return { isValid: false, message: \`Ürün uyuşmazlığı! Beklenen: \${expectedProductId}, Gelen: \${payload.product_id}\`, payload };
    }

    // 4. Son Kullanma Tarihi Kontrolü (UTC)
    const now = new Date();
    const expiresAt = new Date(payload.expires_at);
    if (now.getTime() > expiresAt.getTime()) {
      return { isValid: false, message: \`Lisans süresi dolmuş (\${payload.expires_at})\`, payload };
    }

    // 5. Cihaz / Makine ID Kilidi Kontrolü (Opsiyonel)
    if (payload.machine_id && currentMachineId) {
      if (payload.machine_id.toLowerCase() !== currentMachineId.toLowerCase()) {
        return { isValid: false, message: 'Bu lisans farklı bir donanım için tanımlanmış.', payload };
      }
    }

    return {
      isValid: true,
      message: 'Lisans başarıyla doğrulandı.',
      payload,
    };
  } catch (error: any) {
    return {
      isValid: false,
      message: \`Doğrulama hatası: \${error?.message || 'Bilinmeyen hata'}\`,
      payload: null,
    };
  }
}
`,
  },
  {
    id: 'csharp',
    language: 'csharp',
    name: 'C# / .NET',
    iconName: 'FileBox',
    description: 'C# .NET Core / WPF / Windows Forms projeleri için yerleşik RSACryptoServiceProvider ile doğrulama.',
    filename: 'LicenseVerifier.cs',
    code: (publicKey: string, defaultProductId = 'urun-adi') => `// ==============================================================================
// C# / .NET Lisans Doğrulama Modülü (RSA-SHA256 Offline Verification)
// .NET 6.0+, .NET Framework 4.8+, .NET Core uyumludur.
// ==============================================================================

using System;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

public class LicensePayload
{
    public string license_id { get; set; }
    public string product_id { get; set; }
    public string license_type { get; set; }
    public string customer { get; set; }
    public string issued_at { get; set; }
    public string expires_at { get; set; }
    public string machine_id { get; set; }
}

public class LicenseVerifier
{
    private static readonly string PublicKeyPem = @"${publicKey}";

    public static bool VerifyLicense(string licenseKey, string expectedProductId, out LicensePayload payload, out string errorMessage)
    {
        payload = null;
        errorMessage = string.Empty;

        try
        {
            if (string.IsNullOrWhiteSpace(licenseKey) || !licenseKey.Contains("."))
            {
                errorMessage = "Geçersiz lisans formatı.";
                return false;
            }

            string[] parts = licenseKey.Trim().Split('.');
            if (parts.Length != 2)
            {
                errorMessage = "Lisans formatı bozuk.";
                return false;
            }

            byte[] payloadBytes = Convert.FromBase64String(parts[0]);
            byte[] signatureBytes = Convert.FromBase64String(parts[1]);

            // 1. RSA-SHA256 Dijital İmza Doğrulaması
            using (RSA rsa = RSA.Create())
            {
                rsa.ImportFromPem(PublicKeyPem);
                bool isValidSig = rsa.VerifyData(payloadBytes, signatureBytes, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

                if (!isValidSig)
                {
                    errorMessage = "Dijital imza doğrulanamadı! Lisans tahrif edilmiş.";
                    return false;
                }
            }

            // 2. Payload Deserialization
            string jsonString = Encoding.UTF8.GetString(payloadBytes);
            payload = JsonSerializer.Deserialize<LicensePayload>(jsonString);

            // 3. Ürün Kodu Kontrolü
            if (!string.IsNullOrEmpty(expectedProductId) && payload.product_id != expectedProductId)
            {
                errorMessage = $"Ürün kodu uyuşmuyor: {payload.product_id}";
                return false;
            }

            // 4. Tarih Kontrolü (UTC)
            if (DateTime.TryParse(payload.expires_at, out DateTime expiresAtUtc))
            {
                if (DateTime.UtcNow > expiresAtUtc.ToUniversalTime())
                {
                    errorMessage = $"Lisansın süresi dolmuş ({payload.expires_at})";
                    return false;
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            errorMessage = $"Doğrulama hatası: {ex.Message}";
            return false;
        }
    }
}
`,
  },
  {
    id: 'php',
    language: 'php',
    name: 'PHP',
    iconName: 'Server',
    description: 'PHP 7.4+ ve 8.x web projelerinde yerleşik openssl_verify fonksiyonu ile lisans denetimi.',
    filename: 'LicenseVerifier.php',
    code: (publicKey: string, defaultProductId = 'urun-adi') => `<?php
// ==============================================================================
// PHP Lisans Doğrulama Modülü (RSA-SHA256)
// ==============================================================================

class LicenseVerifier {
    private string $publicKeyPem = <<<EOT
${publicKey}
EOT;

    public function verify(string $licenseKey, ?string $expectedProductId = null): array {
        if (empty($licenseKey) || !str_contains($licenseKey, '.')) {
            return ['valid' => false, 'message' => 'Geçersiz lisans formatı', 'payload' => null];
        }

        [$payloadB64, $sigB64] = explode('.', trim($licenseKey), 2);
        $payloadRaw = base64_decode($payloadB64, true);
        $signature = base64_decode($sigB64, true);

        if ($payloadRaw === false || $signature === false) {
            return ['valid' => false, 'message' => 'Base64 çözme hatası', 'payload' => null];
        }

        // 1. RSA-SHA256 Dijital İmza Doğrulaması
        $pubKeyResource = openssl_pkey_get_public($this->publicKeyPem);
        if (!$pubKeyResource) {
            return ['valid' => false, 'message' => 'Public Key yüklenemedi', 'payload' => null];
        }

        $verifyResult = openssl_verify($payloadRaw, $signature, $pubKeyResource, OPENSSL_ALGO_SHA256);
        if ($verifyResult !== 1) {
            return ['valid' => false, 'message' => 'Dijital imza doğrulanamadı!', 'payload' => null];
        }

        // 2. JSON Çözümleme
        $payload = json_decode($payloadRaw, true);
        if (!$payload) {
            return ['valid' => false, 'message' => 'Payload JSON parse hatası', 'payload' => null];
        }

        // 3. Ürün Doğrulama
        if ($expectedProductId && ($payload['product_id'] ?? '') !== $expectedProductId) {
            return ['valid' => false, 'message' => 'Ürün kodu uyuşmuyor', 'payload' => $payload];
        }

        // 4. Süre Doğrulama (UTC)
        if (isset($payload['expires_at'])) {
            $expiresAt = new DateTime($payload['expires_at'], new DateTimeZone('UTC'));
            $now = new DateTime('now', new DateTimeZone('UTC'));
            if ($now > $expiresAt) {
                return ['valid' => false, 'message' => 'Lisans süresi dolmuş', 'payload' => $payload];
            }
        }

        return ['valid' => true, 'message' => 'Lisans onaylandı', 'payload' => $payload];
    }
}
`,
  },
  {
    id: 'golang',
    language: 'go',
    name: 'Go (Golang)',
    iconName: 'Terminal',
    description: 'Go standart kütüphanesi (crypto/rsa, crypto/x509) ile yüksek performanslı çevrimdışı doğrulama.',
    filename: 'verifier.go',
    code: (publicKey: string, defaultProductId = 'urun-adi') => `// ==============================================================================
// Go (Golang) Lisans Doğrulama Modülü (RSA-SHA256)
// ==============================================================================

package main

import (
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"strings"
	"time"
)

const PublicKeyPEM = \`${publicKey}\`

type LicensePayload struct {
	LicenseID   string \`json:"license_id"\`
	ProductID   string \`json:"product_id"\`
	LicenseType string \`json:"license_type"\`
	Customer    string \`json:"customer"\`
	IssuedAt    string \`json:"issued_at"\`
	ExpiresAt   string \`json:"expires_at"\`
	MachineID   string \`json:"machine_id,omitempty"\`
}

func VerifyLicense(licenseKey string, expectedProductID string) (*LicensePayload, error) {
	parts := strings.Split(strings.TrimSpace(licenseKey), ".")
	if len(parts) != 2 {
		return nil, errors.New("geçersiz lisans formatı (payload.signature)")
	}

	payloadBytes, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, errors.New("payload base64 hatası")
	}

	signatureBytes, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, errors.New("imza base64 hatası")
	}

	// 1. Parse Public Key
	block, _ := pem.Decode([]byte(PublicKeyPEM))
	if block == nil {
		return nil, errors.New("public key PEM okunamadı")
	}

	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("RSA public key değil")
	}

	// 2. Verify SHA256 Signature
	hashed := sha256.Sum256(payloadBytes)
	err = rsa.VerifyPKCS1v15(rsaPub, crypto.SHA256, hashed[:], signatureBytes)
	if err != nil {
		return nil, errors.New("dijital imza geçersiz veya veri değiştirilmiş")
	}

	// 3. Decode JSON
	var payload LicensePayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, err
	}

	// 4. Product Check
	if expectedProductID != "" && payload.ProductID != expectedProductID {
		return nil, fmt.Errorf("ürün kodu uyuşmuyor: %s", payload.ProductID)
	}

	// 5. Expiration Check (UTC)
	expiresAt, err := time.Parse(time.RFC3339, payload.ExpiresAt)
	if err == nil && time.Now().UTC().After(expiresAt) {
		return nil, fmt.Errorf("lisans süresi dolmuş (%s)", payload.ExpiresAt)
	}

	return &payload, nil
}
`,
  },
  {
    id: 'curl',
    language: 'bash',
    name: 'Online REST API (cURL)',
    iconName: 'Globe',
    description: 'Lisans İptal (Revoke) durumunu da denetleyen merkezi sunucu çevrimiçi doğrulama endpointi.',
    filename: 'verify.sh',
    code: (publicKey: string, defaultProductId = 'urun-adi') => `#!/bin/bash
# ==============================================================================
# Çevrimiçi Lisans & İptal (Revocation) Kontrolü (cURL)
# ==============================================================================

LICENSE_KEY="BURAYA_LISANS_ANAHTARINI_YAPISTIRIN"
SERVER_URL="https://ais-dev-qqw2dimyibjb3x6o6y6p5d-473432640493.europe-west2.run.app"

curl -X POST "$SERVER_URL/api/v1/verify" \\
  -H "Content-Type: application/json" \\
  -d '{
    "license_key": "'"$LICENSE_KEY"'",
    "product_id": "${defaultProductId}",
    "machine_id": "OPSIYONEL_DONANIM_KODU"
  }'
`,
  },
];
