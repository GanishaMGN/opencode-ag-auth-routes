#!/usr/bin/env node

/**
 * Script untuk memperkuat plugin ag auth dengan native fingerprint
 * Membuat semua akun menggunakan fingerprint yang konsisten dan native-like
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ACCOUNTS_FILE = path.join(__dirname, 'antigravity-accounts.json');
const BACKUP_FILE = path.join(__dirname, 'antigravity-accounts.json.backup');

// Generate atau gunakan machine ID yang konsisten
function getOrCreateMachineId() {
  const machineIdFile = path.join(__dirname, '.machine-id');
  
  if (fs.existsSync(machineIdFile)) {
    return fs.readFileSync(machineIdFile, 'utf8').trim();
  }
  
  // Generate machine ID yang konsisten berdasarkan hostname dan username
  const os = require('os');
  const hostname = os.hostname();
  const username = os.userInfo().username;
  const seed = `${hostname}-${username}`;
  
  // Generate UUID v5 (deterministic) dari seed
  const namespace = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID namespace DNS
  const hash = crypto.createHash('sha1');
  hash.update(namespace + seed);
  const digest = hash.digest();
  
  // Format sebagai UUID
  const machineId = [
    digest.slice(0, 4).toString('hex'),
    digest.slice(4, 6).toString('hex'),
    digest.slice(6, 8).toString('hex'),
    digest.slice(8, 10).toString('hex'),
    digest.slice(10, 16).toString('hex')
  ].join('-');
  
  fs.writeFileSync(machineIdFile, machineId);
  console.log(`✓ Generated new machine ID: ${machineId}`);
  
  return machineId;
}

// Deteksi platform dan arsitektur yang sebenarnya
function getNativePlatformInfo() {
  const os = require('os');
  const platform = os.platform();
  const arch = os.arch();
  
  let platformName, platformEnum, userAgentPlatform;
  
  if (platform === 'win32') {
    platformName = 'WINDOWS';
    platformEnum = 'WINDOWS';
    userAgentPlatform = 'win32';
  } else if (platform === 'darwin') {
    platformName = 'MACOS';
    platformEnum = 'MACOS';
    userAgentPlatform = 'darwin';
  } else {
    platformName = 'LINUX';
    platformEnum = 'LINUX';
    userAgentPlatform = 'linux';
  }
  
  // Normalize arch
  const archName = arch === 'x64' ? 'x64' : arch === 'arm64' ? 'arm64' : 'x64';
  
  return {
    platformName,
    platformEnum,
    userAgentPlatform,
    arch: archName
  };
}

// Generate session token yang unik per akun (tetap random)
function generateSessionToken() {
  return crypto.randomBytes(16).toString('hex');
}

// Strengthen fingerprint untuk semua akun
function strengthenFingerprints() {
  console.log('🔧 Strengthening Antigravity Auth Plugin with Native Fingerprint...\n');
  
  // Backup file asli
  if (fs.existsSync(ACCOUNTS_FILE)) {
    fs.copyFileSync(ACCOUNTS_FILE, BACKUP_FILE);
    console.log(`✓ Backup created: ${BACKUP_FILE}\n`);
  }
  
  // Load accounts
  const data = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
  
  if (!data.accounts || data.accounts.length === 0) {
    console.error('❌ No accounts found in antigravity-accounts.json');
    process.exit(1);
  }
  
  // Get consistent machine ID
  const machineId = getOrCreateMachineId();
  
  // Get native platform info
  const platformInfo = getNativePlatformInfo();
  
  console.log('📋 Native Platform Info:');
  console.log(`   Platform: ${platformInfo.platformEnum}`);
  console.log(`   Architecture: ${platformInfo.arch}`);
  console.log(`   User-Agent: antigravity/1.18.3 ${platformInfo.userAgentPlatform}/${platformInfo.arch}`);
  console.log(`   Machine ID: ${machineId}\n`);
  
  // Update fingerprint untuk setiap akun
  let updatedCount = 0;
  
  data.accounts.forEach((account, index) => {
    const oldFingerprint = account.fingerprint ? { ...account.fingerprint } : null;
    
    // Generate session token unik per akun (tetap random untuk keamanan)
    const sessionToken = generateSessionToken();
    
    // Set native fingerprint
    account.fingerprint = {
      deviceId: machineId, // SEMUA akun gunakan machine ID yang sama
      sessionToken: sessionToken, // Session token tetap unik per akun
      userAgent: `antigravity/1.18.3 ${platformInfo.userAgentPlatform}/${platformInfo.arch}`,
      apiClient: 'google-cloud-sdk vscode/1.86.0',
      clientMetadata: {
        ideType: 'ANTIGRAVITY',
        platform: platformInfo.platformEnum,
        pluginType: 'GEMINI'
      },
      createdAt: Date.now()
    };
    
    // Simpan history jika ada perubahan
    if (oldFingerprint && oldFingerprint.deviceId !== machineId) {
      if (!account.fingerprintHistory) {
        account.fingerprintHistory = [];
      }
      
      account.fingerprintHistory.push({
        fingerprint: oldFingerprint,
        timestamp: Date.now(),
        reason: 'strengthened_to_native'
      });
    }
    
    updatedCount++;
    
    console.log(`✓ Account ${index + 1}: ${account.email}`);
    console.log(`  Old deviceId: ${oldFingerprint?.deviceId || 'none'}`);
    console.log(`  New deviceId: ${machineId}`);
    console.log(`  Platform: ${oldFingerprint?.clientMetadata?.platform || 'none'} → ${platformInfo.platformEnum}`);
    console.log(`  User-Agent: ${oldFingerprint?.userAgent || 'none'}`);
    console.log(`             → ${account.fingerprint.userAgent}\n`);
  });
  
  // Save updated accounts
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
  
  console.log(`\n✅ Successfully strengthened ${updatedCount} account(s)`);
  console.log(`\n📝 Summary:`);
  console.log(`   - All accounts now use consistent machine ID: ${machineId}`);
  console.log(`   - Platform normalized to: ${platformInfo.platformEnum}`);
  console.log(`   - User-Agent standardized to: antigravity/1.18.3 ${platformInfo.userAgentPlatform}/${platformInfo.arch}`);
  console.log(`   - Each account has unique session token for security`);
  console.log(`\n🔒 Security Benefits:`);
  console.log(`   ✓ Fingerprint identical to native IDE`);
  console.log(`   ✓ Reduced detection risk from Google`);
  console.log(`   ✓ Consistent device signature across all accounts`);
  console.log(`   ✓ Lower chance of account bans`);
  console.log(`\n💡 Next Steps:`);
  console.log(`   1. Test with: opencode run "hello" --model=google/gemini-3-flash`);
  console.log(`   2. Monitor for any 403 errors`);
  console.log(`   3. Check quota with: opencode auth login (select "Check quotas")`);
  console.log(`\n   Backup saved to: ${BACKUP_FILE}`);
}

// Run
try {
  strengthenFingerprints();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
