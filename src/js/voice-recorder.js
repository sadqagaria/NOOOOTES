import { Capacitor } from '@capacitor/core';
import { CapacitorAudioRecorder } from '@capgo/capacitor-audio-recorder';
import { Filesystem } from '@capacitor/filesystem';

let session = null;
let timer = null;
let meter = null;
let saving = false;
let pendingResult = null;
let onSaved = null;

const $ = selector => document.querySelector(selector);
const isNative = () => Capacitor.isNativePlatform();

function explain(error) {
  const message = String(error?.message || error || '');
  if (/denied|permission|microphone|audio capture|notallowed/i.test(message)) {
    return 'الميكروفون غير مسموح. افتح إعدادات الهاتف ← التطبيقات ← مفكرتي ← الأذونات ← الميكروفون، ثم اسمح به.';
  }
  if (/notfound|no device/i.test(message)) return 'تعذر العثور على ميكروفون يعمل على هذا الجهاز.';
  if (/notreadable|busy|in use/i.test(message)) return 'الميكروفون مستخدم في تطبيق آخر. أغلقه وحاول مرة أخرى.';
  return 'حصلت مشكلة في التسجيل: ' + message.slice(0,180);
}
function status(text, error=false) {
  const node=$('#recording-status');
  if (node) {node.textContent=text;node.dataset.error=String(error);}
}
function updateUI() {
  const recording=!!session;
  const panel=$('#recording-indicator');
  if (!panel) return;
  panel.hidden=!recording;
  panel.dataset.state=session?.paused?'paused':recording?'recording':'idle';
  const stop=$('#recording-stop'),pause=$('#recording-pause'),cancel=$('#recording-cancel'),start=$('#add-record');
  if(stop){stop.disabled=saving;stop.textContent=pendingResult?'إعادة حفظ التسجيل':'إيقاف وحفظ';}
  if(pause){pause.disabled=saving||!!pendingResult;pause.textContent=session?.paused?'متابعة التسجيل':'إيقاف مؤقت';}
  if(cancel)cancel.disabled=saving;
  if(start)start.disabled=recording;
}
function elapsed() {
  if(!session)return 0;
  return Math.max(0,Math.floor(((session.paused?session.pauseStarted:Date.now())-session.start-session.pausedDuration)/1000));
}
function updateClock() {
  const clock=$('#recording-timer');if(!clock||!session)return;
  const secs=elapsed(); clock.textContent=String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');
}
function clearTimers() {
  if(timer)clearInterval(timer);
  if(meter)clearInterval(meter);
  timer=null;meter=null;
}
function stopUI() {
  clearTimers();
  session=null;pendingResult=null;onSaved=null;saving=false;
  updateUI();
}
function paintMeter(value) {
  const level=Math.max(0,Math.min(1,Number(value)||0));
  const bars=document.querySelectorAll('#recording-wave span');
  bars.forEach((bar,index)=>{
    const wave=.26+Math.abs(Math.sin(index*.77+Date.now()/280))*.26+level*.95;
    bar.style.transform='scaleY('+Math.min(1,Math.max(.12,wave)).toFixed(3)+')';
  });
}
async function readRecordedBlob(result) {
  if(result.blob instanceof Blob)return result.blob;
  if(!result.uri)throw new Error('لم يتم استلام ملف التسجيل من نظام أندرويد.');
  let data;
  try {
    const file=await Filesystem.readFile({path:result.uri});
    data=file.data;
  }catch(error){
    console.warn('Native file read failed',error);
    const localURL=Capacitor.convertFileSrc(result.uri);
    const response=await fetch(localURL);
    if(!response.ok)throw new Error('تعذر قراءة ملف التسجيل المحفوظ على الهاتف.');
    return await response.blob();
  }
  if(data instanceof Blob)return data;
  if(typeof data!=='string')throw new Error('محتوى التسجيل غير مدعوم.');
  // Chunked base64 conversion prevents stack overflows on long voice memos.
  const b64=data.includes(',')?data.slice(data.indexOf(',')+1):data;
  const raw=atob(b64.replace(/\s/g,''));
  const chunks=[];
  for(let i=0;i<raw.length;i+=32768){
    const part=raw.slice(i,i+32768),bytes=new Uint8Array(part.length);
    for(let j=0;j<part.length;j++)bytes[j]=part.charCodeAt(j);
    chunks.push(bytes);
  }
  return new Blob(chunks,{type:isNative()?'audio/mp4':'audio/webm'});
}
export async function beginVoiceRecording(callback) {
  if(session){status('يوجد تسجيل جاري بالفعل.');return false;}
  if(typeof callback!=='function')throw new Error('Missing audio callback');
  onSaved=callback;
  pendingResult=null;
  try{
    const permission=await CapacitorAudioRecorder.requestPermissions();
    if(permission?.recordAudio && permission.recordAudio!=='granted')throw new Error('Microphone permission denied');
    await CapacitorAudioRecorder.startRecording({bitRate:128000,sampleRate:44100});
    session={start:Date.now(),paused:false,pausedDuration:0,pauseStarted:0};
    status('جاري التسجيل... اضغط إيقاف وحفظ عند الانتهاء.');
    updateUI();updateClock();
    timer=setInterval(updateClock,250);
    meter=setInterval(async()=>{
      if(!session||session.paused)return;
      try{const output=await CapacitorAudioRecorder.getCurrentAmplitude();paintMeter(output?.value);}
      catch{paintMeter(.18);}
    },170);
    return true;
  }catch(error){
    console.error('Failed to start recorder',error);
    onSaved=null;session=null;
    updateUI();
    status(explain(error),true);
    // Surface a visible error even though the recording panel is not shown.
    const note=$('#recording-error');
    if(note){note.hidden=false;note.textContent=explain(error);}
    return false;
  }
}
export async function pauseOrResumeVoiceRecording() {
  if(!session||saving||pendingResult)return;
  try{
    if(!session.paused){
      await CapacitorAudioRecorder.pauseRecording();
      session.paused=true;session.pauseStarted=Date.now();
      status('التسجيل متوقف مؤقتًا. اضغط متابعة للرجوع.');
    }else{
      await CapacitorAudioRecorder.resumeRecording();
      session.pausedDuration+=Date.now()-session.pauseStarted;
      session.paused=false;session.pauseStarted=0;
      status('جاري التسجيل...');
    }
    updateUI();updateClock();
  }catch(error){status(explain(error),true);}
}
export async function finishVoiceRecording() {
  if(!session||saving)return;
  saving=true;updateUI();
  status(pendingResult?'إعادة قراءة التسجيل...':'جاري حفظ التسجيل...');
  try{
    if(!pendingResult)pendingResult=await CapacitorAudioRecorder.stopRecording();
    const blob=await readRecordedBlob(pendingResult);
    if(!(blob instanceof Blob)||blob.size<128)throw new Error('الملف المسجل فارغ أو غير صالح.');
    const extension=isNative()?'m4a':blob.type.includes('ogg')?'ogg':'webm';
    const mime=blob.type|| (isNative()?'audio/mp4':'audio/webm');
    const filename='voice-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+extension;
    await onSaved({blob,name:filename,mime,size:blob.size,duration:pendingResult.duration||elapsed()*1000});
    stopUI();
    const note=$('#recording-error');if(note)note.hidden=true;
    return true;
  }catch(error){
    console.error('Failed to save recording',error);
    status('تعذر إلحاق التسجيل: '+explain(error)+' يمكنك الضغط على إعادة حفظ.',true);
    saving=false;updateUI();return false;
  }
}
export async function cancelVoiceRecording(){
  if(!session||saving)return;
  saving=true;updateUI();
  try{if(!pendingResult)await CapacitorAudioRecorder.cancelRecording();}
  catch(error){console.warn('Cancel recording failed',error);}
  stopUI();
}
export function isVoiceRecording(){return !!session;}
export function prepareVoiceRecorderUI(){
  $('#recording-stop')?.addEventListener('click',finishVoiceRecording);
  $('#recording-pause')?.addEventListener('click',pauseOrResumeVoiceRecording);
  $('#recording-cancel')?.addEventListener('click',cancelVoiceRecording);
  updateUI();
}
