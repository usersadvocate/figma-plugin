#!/usr/bin/env node

/**
 * Problem Resolution Script for Linter Project
 * Rule #1: Always resolve problems after code updates
 *
 * This script automates the process of:
 * 1. Building the project
 * 2. Running linting and auto-fixing
 * 3. Checking for compilation errors
 * 4. Providing status report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 Starting Problem Resolution Process...');
console.log('📋 Rule #1: Always resolve problems after code updates\n');

// Track results
const results = {
  build: { status: 'pending', details: '' },
  lint: { status: 'pending', details: '' },
  typescript: { status: 'pending', details: '' }
};

try {
  console.log('🏗️  Step 1: Building project...');
  execSync('npm run build', { stdio: 'pipe' });
  results.build = { status: '✅ PASSED', details: 'Build successful' };
  console.log('✅ Build completed successfully\n');
} catch (error) {
  results.build = { status: '❌ FAILED', details: error.stdout?.toString() || error.message };
  console.log('❌ Build failed:', error.message, '\n');
}

try {
  console.log('🔍 Step 2: Running ESLint...');

  // First, run ESLint with --fix to auto-fix issues
  try {
    execSync('npx eslint src/main.ts --fix', { stdio: 'pipe' });
  } catch (fixError) {
    // ESLint --fix may return non-zero exit code even for warnings
  }

  // Then check the actual issues by running without --fix
  const checkOutput = execSync('npx eslint src/main.ts', {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  // Count actual linting problems (exclude TypeScript version warnings and summary lines)
  const lines = checkOutput.split('\n');
  const problemLines = lines.filter(line =>
    line.includes('error') || line.includes('warning')
  ).filter(line =>
    !line.includes('You are currently running a version of TypeScript') &&
    !line.includes('problems (') &&
    !line.includes('✖')
  );

  const errorCount = problemLines.filter(line => line.includes('error')).length;
  const warningCount = problemLines.filter(line => line.includes('warning')).length;

  if (errorCount > 0) {
    results.lint = { status: '❌ FAILED', details: `${errorCount} errors, ${warningCount} warnings` };
    console.log('❌ ESLint found errors that need to be fixed\n');
  } else if (warningCount > 0) {
    results.lint = { status: '⚠️  PASSED WITH WARNINGS', details: `${warningCount} warnings (acceptable)` };
    console.log('⚠️  ESLint passed with warnings (acceptable)\n');
  } else {
    results.lint = { status: '✅ PASSED', details: 'No issues found' };
    console.log('✅ ESLint passed with no issues\n');
  }
} catch (error) {
  results.lint = { status: '❌ FAILED', details: 'ESLint configuration error' };
  console.log('❌ ESLint configuration error:', error.message, '\n');
}

try {
  console.log('🔧 Step 3: Checking TypeScript compilation...');
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  results.typescript = { status: '✅ PASSED', details: 'No TypeScript errors' };
  console.log('✅ TypeScript compilation successful\n');
} catch (error) {
  results.typescript = { status: '❌ FAILED', details: error.stdout?.toString() || error.message };
  console.log('❌ TypeScript compilation failed:', error.message, '\n');
}

// Generate report
console.log('📊 Problem Resolution Report:');
console.log('='.repeat(50));
console.log(`🏗️  Build:         ${results.build.status}`);
if (results.build.details) console.log(`   Details: ${results.build.details}`);
console.log(`🔍 Lint:          ${results.lint.status}`);
if (results.lint.details) console.log(`   Details: ${results.lint.details}`);
console.log(`🔧 TypeScript:    ${results.typescript.status}`);
if (results.typescript.details) console.log(`   Details: ${results.typescript.details}`);
console.log('='.repeat(50));

// Overall status
const allPassed = Object.values(results).every(result => result.status.includes('PASSED'));
const hasErrors = Object.values(results).some(result => result.status.includes('FAILED'));

if (allPassed) {
  console.log('🎉 All checks passed! Ready for commit.');
  console.log('💡 Next steps: Test in Figma and commit your changes.');
} else if (hasErrors) {
  console.log('❌ Issues found that need to be resolved before proceeding.');
  console.log('💡 Fix the reported issues and run this script again.');
  process.exit(1);
} else {
  console.log('⚠️  Some warnings found, but no critical errors.');
  console.log('💡 Review warnings and decide if they need to be addressed.');
}

console.log('\n📝 Remember to follow all project rules in .devrules');
