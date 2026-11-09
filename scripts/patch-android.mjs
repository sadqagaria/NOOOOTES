import fs from 'node:fs';
const path = 'android/app/src/main/AndroidManifest.xml';
if (!fs.existsSync(path)) throw Error('Android project missing. Run npx cap add android');
let xml = fs.readFileSync(path, 'utf8');
for (const name of ['SCHEDULE_EXACT_ALARM','RECORD_AUDIO','MODIFY_AUDIO_SETTINGS']) {
  const value='android.permission.'+name;
  if (!xml.includes(value)) xml=xml.replace('<application', '    <uses-permission android:name="'+value+'" />\n\n    <application');
}
fs.writeFileSync(path,xml);
console.log('Android manifest verified: microphone and notification permissions.');
