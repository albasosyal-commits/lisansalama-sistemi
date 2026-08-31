export type LicenseType = 'demo' | 'yearly' | 'custom';
export type LicenseStatus = 'active' | 'revoked' | 'paused' | 'expired';

export interface LicenseActivityLog {
  id: string;
  timestamp: string;
  action: 'created' | 'extended' | 'paused' | 'unpaused' | 'revoked' | 'reactivated' | 'activated' | 'used' | 'reset_usage';
  description: string;
  details?: Record<string, any>;
}

export interface Product {
  id: string;
  name: string;
  productId: string;
  description: string;
  version: string;
  created_at: string;
  licenseCount?: number;
  activeLicenseCount?: number;
}

export interface LicensePayload {
  license_id: string;
  product_id: string;
  license_type: LicenseType;
  customer: string;
  issued_at: string;
  expires_at: string;
  machine_id: string | null;
  extra?: Record<string, unknown>;
}

export interface StoredLicense {
  license_id: string;
  product_id: string;
  product_name?: string;
  license_type: LicenseType;
  customer: string;
  issued_at: string;
  expires_at: string;
  machine_id: string | null;
  status: 'active' | 'revoked' | 'paused';
  raw_key: string;
  created_at: string;
  revoked_at?: string | null;
  paused_at?: string | null;
  notes?: string;
  extra?: Record<string, unknown>;
  logs?: LicenseActivityLog[];
  // Uygulama Giriş & Kullanım Bilgisi (Usage Status)
  is_used?: boolean;
  first_used_at?: string | null;
  last_used_at?: string | null;
  usage_count?: number;
  last_machine_id?: string | null;
  app_version?: string | null;
}

export interface DashboardStats {
  totalLicenses: number;
  activeLicenses: number;
  revokedLicenses: number;
  expiredLicenses: number;
  totalProducts: number;
  demoCount: number;
  yearlyCount: number;
  customCount: number;
  usedCount: number;
  unusedCount: number;
}

export interface KeyMetadata {
  algorithm: string;
  keySize: number;
  created_at: string;
  fingerprint: string;
  publicKey: string;
}

export interface SystemStatusResponse {
  success: boolean;
  stats: DashboardStats;
  keyInfo: {
    algorithm: string;
    fingerprint: string;
    created_at: string;
  };
}

export interface CreateLicenseParams {
  product_id: string;
  customer: string;
  license_type: LicenseType;
  custom_issued_at?: string;
  custom_expires_at?: string;
  days?: number;
  machine_id?: string;
  notes?: string;
  extra?: Record<string, unknown>;
}

export interface VerificationResult {
  valid: boolean;
  tampered: boolean;
  expired: boolean;
  message: string;
  payload: LicensePayload | null;
  machineMatched?: boolean | null;
}
