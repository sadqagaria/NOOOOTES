import fs from 'node:fs';
const path = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(path)) {
  console.error('Android project not found. Run: npx cap add android');
  process.exit(1);
}
let xml = fs.readFileSync(path, 'utf8');
const permission = '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />';
if (!xml.includes('android.permission.SCHEDULE_EXACT_ALARM')) {
  xml = xml.replace('<application', `    ${permission}\n\n    <application`);
  fs.writeFileSync(path, xml);
  console.log('Added SCHEDULE_EXACT_ALARM permission.');
} else {
  console.log('Exact alarm permission already present.');
}
