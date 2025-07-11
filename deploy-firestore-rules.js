#!/usr/bin/env node

/**
 * Firestore Security Rules Deployment Script
 * 
 * This script helps deploy the new secure Firestore rules and provides
 * validation checks before deployment.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RULES_FILE = 'firestore.rules';
const BACKUP_FILE = 'firestore.rules.backup';

function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  };
  
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function checkPrerequisites() {
  log('🔍 Checking prerequisites...', 'info');
  
  // Check if Firebase CLI is installed
  try {
    execSync('firebase --version', { stdio: 'pipe' });
    log('✅ Firebase CLI is installed', 'success');
  } catch (error) {
    log('❌ Firebase CLI not found. Install it with: npm install -g firebase-tools', 'error');
    process.exit(1);
  }
  
  // Check if firestore.rules exists
  if (!fs.existsSync(RULES_FILE)) {
    log('❌ firestore.rules file not found', 'error');
    process.exit(1);
  }
  log('✅ Firestore rules file found', 'success');
  
  // Check if user is logged in to Firebase
  try {
    execSync('firebase projects:list', { stdio: 'pipe' });
    log('✅ Firebase authentication verified', 'success');
  } catch (error) {
    log('❌ Not logged in to Firebase. Run: firebase login', 'error');
    process.exit(1);
  }
}

function validateRules() {
  log('🔍 Validating Firestore rules...', 'info');
  
  const rulesContent = fs.readFileSync(RULES_FILE, 'utf8');
  
  // Basic validation checks
  const checks = [
    {
      test: rulesContent.includes("rules_version = '2'"),
      message: 'Rules version 2 specified'
    },
    {
      test: rulesContent.includes('request.auth != null'),
      message: 'Authentication checks present'
    },
    {
      test: rulesContent.includes('role == \'admin\''),
      message: 'Admin role checks implemented'
    },
    {
      test: !rulesContent.includes('allow read, write: if true'),
      message: 'No open access rules found'
    },
    {
      test: !rulesContent.includes('timestamp.date(2025'),
      message: 'No temporary time-based rules found'
    }
  ];
  
  let allPassed = true;
  checks.forEach(check => {
    if (check.test) {
      log(`✅ ${check.message}`, 'success');
    } else {
      log(`❌ ${check.message}`, 'error');
      allPassed = false;
    }
  });
  
  if (!allPassed) {
    log('❌ Rules validation failed', 'error');
    process.exit(1);
  }
  
  log('✅ Rules validation passed', 'success');
}

function backupCurrentRules() {
  log('💾 Creating backup of current rules...', 'info');
  
  try {
    // Get current rules from Firebase
    const currentRules = execSync('firebase firestore:rules:get', { encoding: 'utf8' });
    fs.writeFileSync(BACKUP_FILE, currentRules);
    log(`✅ Backup created: ${BACKUP_FILE}`, 'success');
  } catch (error) {
    log('⚠️  Could not backup current rules (they might not exist yet)', 'warning');
  }
}

function deployRules() {
  log('🚀 Deploying Firestore rules...', 'info');
  
  try {
    execSync('firebase deploy --only firestore:rules', { stdio: 'inherit' });
    log('✅ Firestore rules deployed successfully!', 'success');
  } catch (error) {
    log('❌ Deployment failed', 'error');
    
    if (fs.existsSync(BACKUP_FILE)) {
      log('🔄 You can restore the backup with: firebase deploy --only firestore:rules', 'info');
      log(`   (after copying ${BACKUP_FILE} back to ${RULES_FILE})`, 'info');
    }
    
    process.exit(1);
  }
}

function showPostDeploymentChecklist() {
  log('\n📋 Post-deployment checklist:', 'info');
  log('1. Test authentication with different user roles', 'info');
  log('2. Verify admin users have role: "admin" in users collection', 'info');
  log('3. Test CRUD operations for each collection', 'info');
  log('4. Monitor Firebase Console for any permission errors', 'info');
  log('5. Update your application error handling for permission denied errors', 'info');
  
  log('\n🔗 Useful commands:', 'info');
  log('- View rules: firebase firestore:rules:get', 'info');
  log('- Test rules: firebase emulators:start --only firestore', 'info');
  log('- Monitor logs: Check Firebase Console > Firestore > Usage tab', 'info');
}

function main() {
  log('🔐 Firestore Security Rules Deployment', 'info');
  log('=====================================\n', 'info');
  
  checkPrerequisites();
  validateRules();
  backupCurrentRules();
  
  // Confirm deployment
  log('\n⚠️  This will replace your current Firestore security rules.', 'warning');
  log('   Make sure you have tested these rules thoroughly.', 'warning');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('\nDo you want to proceed with deployment? (y/N): ', (answer) => {
    readline.close();
    
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      deployRules();
      showPostDeploymentChecklist();
    } else {
      log('Deployment cancelled', 'info');
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  checkPrerequisites,
  validateRules,
  deployRules
};