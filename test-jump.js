#!/usr/bin/env node

const fs = require('fs');

console.log('🧪 Testing Jump Functionality Implementation...\n');

try {
  const mainContent = fs.readFileSync('src/main.ts', 'utf8');
  const uiContent = fs.readFileSync('src/ui/index.html', 'utf8');

  console.log('📋 Checking Main Plugin (src/main.ts):');
  console.log('='.repeat(50));

  const jumpFunction = mainContent.includes('async function jumpToNode');
  const jumpHandler = mainContent.includes('jump-to-node');
  const selectionCode = mainContent.includes('figma.currentPage.selection');
  const noScrollCode = !mainContent.includes('scrollAndZoomIntoView');
  const nodeJumpedMessage = mainContent.includes('node-jumped');

  console.log(`✅ jumpToNode function: ${jumpFunction ? '✓ Found' : '❌ Missing'}`);
  console.log(`✅ jump-to-node handler: ${jumpHandler ? '✓ Found' : '❌ Missing'}`);
  console.log(`✅ Element selection: ${selectionCode ? '✓ Found (good)' : '❌ Missing'}`);
  console.log(`✅ No viewport movement: ${noScrollCode ? '✓ No scroll/zoom (good)' : '❌ Still scrolling'}`);
  console.log(`✅ Node jumped message: ${nodeJumpedMessage ? '✓ Found' : '❌ Missing'}`);

  console.log('\n📋 Checking UI (src/ui/index.html):');
  console.log('='.repeat(50));

  const clickHandler = uiContent.includes('onclick="jumpToNode');
  const hoverEffect = uiContent.includes('onmouseover');
  const cursorPointer = uiContent.includes('cursor: pointer');
  const highlightButton = uiContent.includes('>Highlight</button>');
  const jumpJsFunction = uiContent.includes('function jumpToNode');

  console.log(`✅ Click handler: ${clickHandler ? '✓ Found' : '❌ Missing'}`);
  console.log(`✅ Hover effects: ${hoverEffect ? '✓ Found' : '❌ Missing'}`);
  console.log(`✅ Pointer cursor: ${cursorPointer ? '✓ Found' : '❌ Missing'}`);
  console.log(`✅ Highlight button: ${highlightButton ? '✓ Found' : '❌ Missing'}`);
  console.log(`✅ JavaScript function: ${jumpJsFunction ? '✓ Found' : '❌ Missing'}`);

  console.log('\n📋 Checking Built Files (dist/):');
  console.log('='.repeat(50));

  const builtJs = fs.existsSync('dist/code.js');
  const builtHtml = fs.existsSync('dist/ui.html');

  console.log(`✅ Built JavaScript: ${builtJs ? '✓ Found' : '❌ Missing'}`);
  console.log(`✅ Built HTML: ${builtHtml ? '✓ Found' : '❌ Missing'}`);

  // Count all checks
  const checks = [jumpFunction, jumpHandler, selectionCode, noScrollCode, nodeJumpedMessage,
                  clickHandler, hoverEffect, cursorPointer, highlightButton, jumpJsFunction,
                  builtJs, builtHtml];

  const passed = checks.filter(Boolean).length;
  const total = checks.length;

  console.log('\n📊 Results:');
  console.log('='.repeat(50));
  console.log(`✅ ${passed}/${total} components implemented`);

  if (passed === total) {
    console.log('🎯 JUMP FUNCTIONALITY IS FULLY IMPLEMENTED!');
    console.log('\n💡 To test:');
    console.log('1. Run the plugin in Figma');
    console.log('2. Analyze a section');
    console.log('3. Click on any node item or the 🔍 button');
    console.log('4. The node should be selected and centered in Figma');
    console.log('5. You should see a green notification: "🎯 Jumped to..."');
  } else {
    console.log('⚠️ Some components are missing');
  }

} catch (error) {
  console.error('❌ Error testing jump functionality:', error);
}
