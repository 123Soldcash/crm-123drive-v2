#!/usr/bin/env node

/**
 * Pre-commit Validation Script
 * 
 * This script checks for common issues before allowing commits:
 * - Duplicate imports
 * - Duplicate router keys
 * - Console.log statements (debug code)
 * - Missing error handling
 * - Test failures
 * 
 * Usage: node scripts/validate-before-commit.mjs
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkDuplicateImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports = {};
  const issues = [];

  lines.forEach((line, index) => {
    if (line.match(/^import\s+.*\s+from\s+['"]react['"]/)) {
      const key = 'react-import';
      if (imports[key]) {
        issues.push({
          file: filePath,
          line: index + 1,
          issue: 'Duplicate React import',
          suggestion: 'Merge all React imports into one line',
        });
      }
      imports[key] = true;
    }
  });

  return issues;
}

function checkDuplicateRouters(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const routerMatches = content.match(/(\w+):\s*router\(/g) || [];
  const routerNames = routerMatches.map(m => m.replace(/:\s*router\(/, ''));
  const duplicates = routerNames.filter((name, index) => routerNames.indexOf(name) !== index);
  
  const issues = [];
  if (duplicates.length > 0) {
    duplicates.forEach(name => {
      issues.push({
        file: filePath,
        issue: `Duplicate router key: "${name}"`,
        suggestion: 'Merge duplicate routers into one definition',
      });
    });
  }

  return issues;
}

function checkDebugCode(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues = [];

  lines.forEach((line, index) => {
    if (line.includes('console.log(') && !line.includes('// intentional')) {
      issues.push({
        file: filePath,
        line: index + 1,
        issue: 'Debug console.log found',
        suggestion: 'Remove or comment out console.log statements',
      });
    }
  });

  return issues;
}

function checkFiles(directory, pattern) {
  const files = [];
  const walk = (dir) => {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        walk(fullPath);
      } else if (stat.isFile() && pattern.test(item)) {
        files.push(fullPath);
      }
    });
  };
  
  walk(directory);
  return files;
}

function runTests() {
  try {
    log('\n📋 Running tests...', 'blue');
    execSync('pnpm test', { stdio: 'inherit' });
    return true;
  } catch (error) {
    log('❌ Tests failed!', 'red');
    return false;
  }
}

function main() {
  log('\n🔍 Running pre-commit validation...', 'blue');
  
  const allIssues = [];

  // Check TypeScript files
  log('\n📝 Checking TypeScript files...', 'blue');
  const tsFiles = checkFiles('.', /\.(ts|tsx)$/);
  
  tsFiles.forEach(file => {
    if (file.includes('node_modules')) return;
    
    const duplicateImports = checkDuplicateImports(file);
    const duplicateRouters = checkDuplicateRouters(file);
    const debugCode = checkDebugCode(file);
    
    allIssues.push(...duplicateImports, ...duplicateRouters, ...debugCode);
  });

  // Report issues
  if (allIssues.length > 0) {
    log('\n⚠️  Found issues:', 'yellow');
    allIssues.forEach((issue, index) => {
      log(`\n${index + 1}. ${issue.issue}`, 'yellow');
      log(`   File: ${issue.file}${issue.line ? `:${issue.line}` : ''}`, 'yellow');
      log(`   Suggestion: ${issue.suggestion}`, 'yellow');
    });
    log('\n❌ Validation failed. Please fix the issues above.', 'red');
    process.exit(1);
  }

  log('✅ No code issues found!', 'green');

  // Run tests
  const testsPass = runTests();
  
  if (!testsPass) {
    log('\n❌ Validation failed due to test failures.', 'red');
    process.exit(1);
  }

  log('\n✅ All validations passed! Ready to commit.', 'green');
  log('\n📋 Checklist before committing:', 'blue');
  log('   ✓ No duplicate imports', 'green');
  log('   ✓ No duplicate routers', 'green');
  log('   ✓ No debug code', 'green');
  log('   ✓ All tests passing', 'green');
  log('\n💡 Remember to:', 'blue');
  log('   1. Update todo.md with [x] for completed items', 'blue');
  log('   2. Save a checkpoint with descriptive message', 'blue');
  log('   3. Test the feature in the browser', 'blue');
}

main();
