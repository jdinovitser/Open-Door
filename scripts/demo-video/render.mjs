import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const out = path.resolve(process.env.OPEN_DOOR_DEMO_DIR || "generated-artifacts/demo-video");
const variant = process.argv[2] || "";
if (variant && !/^[a-z0-9-]+$/.test(variant)) throw new Error("Use a simple lowercase variant name.");
const suffix = variant ? `-${variant}` : "";
const voiceDirectory = variant ? `${out}/${variant}-voice` : out;
const renderDirectory = `${out}/rendered${suffix}`;
const renderOnly = process.env.OPEN_DOOR_DEMO_SCENES?.split(",");
const plan = JSON.parse(readFileSync(process.env.OPEN_DOOR_DEMO_PLAN || "scripts/demo-video/plan.json", "utf8"));
const totalDuration = plan.reduce((sum, scene) => sum + scene.duration, 0);
const sceneStart = id => plan.slice(0, plan.findIndex(scene => scene.id === id)).reduce((sum, scene) => sum + scene.duration, 0);
const chimeDelays = plan[0].introMascot
  ? [(sceneStart("03-open-a-door") + 3) * 1000, (sceneStart("03-open-a-door") + 19) * 1000, (sceneStart("07-save") + 1) * 1000]
  : [20500, 46000, 138000];
const captures = JSON.parse(readFileSync(`${out}/captures.json`, "utf8"));
const font = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const serif = "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf";
mkdirSync(renderDirectory, { recursive: true });
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stderr}`);
  return result.stdout;
}
function duration(file) {
  return Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim());
}
function text(id, suffix, value) {
  const file = `${out}/${id}-${suffix}.txt`;
  writeFileSync(file, value);
  return file;
}
function draw(file, x, y, size, color = "0x173e33", face = font) {
  return `drawtext=fontfile='${face}':textfile='${file}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}`;
}
function stamp(seconds, ass = false) {
  const precision = ass ? 100 : 1000;
  const ticks = Math.round(seconds * precision);
  const whole = Math.floor(ticks / precision);
  const h = Math.floor(whole / 3600);
  const m = Math.floor(whole % 3600 / 60);
  const s = whole % 60;
  const fraction = ticks % precision;
  return ass
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`
    : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(fraction).padStart(3, "0")}`;
}
function chunks(value) {
  const groups = [];
  let group = [];
  for (const word of value.split(/\s+/)) {
    if (group.length && (group.join(" ").length + word.length > 85 || group.length >= 14)) {
      groups.push(group.join(" "));
      group = [];
    }
    group.push(word);
    if (/[.!?]$/.test(word) && group.length >= 5) {
      groups.push(group.join(" "));
      group = [];
    }
  }
  if (group.length) groups.push(group.join(" "));
  return groups;
}
let offset = 0;
const srt = [];
const report = [];
const sceneFiles = [];
for (const [index, scene] of plan.entries()) {
  console.log(`${renderOnly && !renderOnly.includes(scene.id) ? "Reusing" : "Rendering"} ${scene.id}`);
  const voice = `${voiceDirectory}/${scene.id}.mp3`;
  const voiceDuration = duration(voice);
  const speed = Math.max(variant === "upbeat" ? 0.96 : 0.84, Math.min(variant === "upbeat" ? 1.4 : 1.18, voiceDuration / (scene.duration - 2)));
  const spokenDuration = voiceDuration / speed;
  if (spokenDuration > scene.duration - 0.9) throw new Error(`${scene.id}: narration is too long for its scene.`);
  const captionChunks = chunks(scene.voice);
  const weights = captionChunks.map(value => value.length);
  const sum = weights.reduce((a, b) => a + b, 0);
  let captionStart = 0.8;
  const lines = [];
  captionChunks.forEach((value, i) => {
    const end = captionStart + spokenDuration * weights[i] / sum;
    lines.push(`Dialogue: 0,${stamp(captionStart, true)},${stamp(end, true)},Default,,0,0,0,,${value.replaceAll("\n", "\\N")}`);
    srt.push(`${srt.length + 1}\n${stamp(offset + captionStart)} --> ${stamp(offset + end)}\n${value}\n`);
    captionStart = end;
  });
  const assFile = `${out}/${scene.id}${suffix}.ass`;
  writeFileSync(assFile, `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,30,&H00FFFFFF,&H00FFFFFF,&H001B352C,&H001B352C,0,0,0,0,100,100,0,0,1,0,0,2,100,100,35,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join("\n")}\n`);
  const titleFile = text(scene.id, "title", scene.title);
  const kickerFile = text(scene.id, "kicker", scene.kicker);
  const labelFile = text(scene.id, "label", scene.label);
  const inputArgs = [];
  let base;
  let voiceIndex;
  if (index === 0 && scene.introMascot) {
    inputArgs.push("-f", "lavfi", "-i", `color=c=0xf4f3eb:s=1920x1080:r=24:d=${scene.duration}`,
      "-stream_loop", "-1", "-i", "attached_assets/a051ea45-aa64-4a38-86da-f3032d124566_1792509667580.gif", "-i", voice);
    voiceIndex = 2;
    base = `[1:v]scale=1000:562:flags=lanczos,setsar=1[mascot];[0:v][mascot]overlay=x=900:y=260:shortest=1,${draw(kickerFile, 110, 155, 22, "0x947233", bold)},${draw(text(scene.id, "headline", scene.headline), 110, 290, 76, "0x173e33", serif)},${draw(text(scene.id, "subhead", "Open Door\nDiscover a day that feels like you."), 115, 725, 30)},${draw(labelFile, 110, 930, 21, "0x66746B")}[base]`;
  } else if (index === 0) {
    inputArgs.push("-loop", "1", "-framerate", "24", "-i", `${out}/arrival.jpg`, "-i", voice);
    voiceIndex = 1;
    base = `[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='1+on*0.00009':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1920x1080:fps=24,drawbox=x=0:y=0:w=1030:h=1080:color=0x102d25@0.76:t=fill,${draw(kickerFile, 110, 155, 23, "0xE5C487", bold)},${draw(text(scene.id, "headline", "A new address.\nA personal\nbeginning."), 110, 290, 83, "white", serif)},${draw(text(scene.id, "subhead", "Open Door\nFind your place. Find your people."), 115, 690, 31, "0xF2E9D8")},${draw(labelFile, 110, 930, 21, "0xE5C487")}[base]`;
  } else if (index === plan.length - 1) {
    inputArgs.push("-f", "lavfi", "-i", `color=c=0xf4f3eb:s=1920x1080:r=24:d=${scene.duration}`,
      "-stream_loop", "-1", "-i", "attached_assets/a051ea45-aa64-4a38-86da-f3032d124566_1792509667580.gif",
      "-i", voice);
    voiceIndex = 2;
    base = `[1:v]scale=800:450:flags=lanczos,setsar=1[mascot];[0:v][mascot]overlay=x=1010:y=250:shortest=1,${draw(kickerFile, 120, 145, 25, "0x947233", bold)},${draw(text(scene.id, "brand", "Open Door"), 115, 305, 112, "0x173e33", serif)},${draw(text(scene.id, "tagline", scene.tagline || "Find your place.\nFind your people."), 120, 475, 62, "0x173e33", serif)},${draw(text(scene.id, "directions", "FAMILIAR   /   ADJACENT   /   UNEXPECTED"), 125, 735, 22, "0x947233", bold)},${draw(text(scene.id, "guide", "Explore the app. Judge's Guide in the footer."), 125, 845, 26)},${draw(text(scene.id, "credits", scene.introMascot || plan[0].introMascot ? "Real product recording | Your mascot artwork | AI-generated narration" : "Real product capture + labeled UI preview | AI narration and illustrative opening"), 125, 936, 19, "0x66746B")}[base]`;
  } else {
    if (captures[scene.id].start) inputArgs.push("-ss", String(captures[scene.id].start));
    inputArgs.push("-i", captures[scene.id].file, "-i", voice);
    voiceIndex = 1;
    const clip = captures[scene.id];
    base = `[0:v]trim=duration=${clip.duration},setpts=(PTS-STARTPTS)/${clip.playbackRate || 1},fps=24,scale=1440:810:flags=lanczos,setsar=1,tpad=stop_mode=clone:stop_duration=${scene.duration},trim=duration=${scene.duration},pad=1920:1080:240:170:color=0xf4f3eb,drawbox=x=232:y=162:w=1456:h=826:color=0xCCD3C8:t=2,${draw(kickerFile, 240, 26, 18, "0x947233", bold)},${draw(titleFile, 238, 62, 48, "0x173e33", serif)},${draw(labelFile, 240, 128, scene.id === "06-progress" ? 18 : 20, "0x66746B")}[base]`;
  }
  const filter = `${base};[base]drawbox=x=0:y=990:w=1920:h=90:color=0x173e33:t=fill,ass='${assFile}',fade=t=in:st=0:d=0.3,fade=t=out:st=${scene.duration - 0.3}:d=0.3,format=yuv420p[v];[${voiceIndex}:a]atempo=${speed},loudnorm=I=-16:TP=-1.5:LRA=7,adelay=800:all=1,apad,atrim=duration=${scene.duration},aresample=48000[a]`;
  const output = `${renderDirectory}/${scene.id}.mp4`;
  if (!renderOnly || renderOnly.includes(scene.id)) {
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...inputArgs,
    "-filter_complex", filter, "-map", "[v]", "-map", "[a]", "-t", String(scene.duration),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-threads", "2",
    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k", "-movflags", "+faststart", output]);
  } else if (!existsSync(output)) {
    throw new Error(`Cannot reuse missing scene: ${output}`);
  }
  sceneFiles.push(output);
  report.push({ scene: scene.id, start: offset, duration: scene.duration, voiceDuration, speed, spokenDuration });
  offset += scene.duration;
}
writeFileSync(`${out}/Open-Door-Captions${suffix}.srt`, srt.join("\n"));
writeFileSync(`${out}/render-report${suffix}.json`, JSON.stringify(report, null, 2));
writeFileSync(`${out}/concat${suffix}.txt`, sceneFiles.map(file => `file '${file}'`).join("\n"));
console.log("Mixing original music, narration, and door chimes");
run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y",
  "-f", "concat", "-safe", "0", "-i", `${out}/concat${suffix}.txt`,
  "-stream_loop", "-1", "-i", `${out}/music.mp3`, "-i", `${out}/door-chime.mp3`,
  "-filter_complex",
  `[1:a]loudnorm=I=-29:TP=-6:LRA=7,afade=t=in:d=3,afade=t=out:st=${totalDuration - 6}:d=6[music];` +
  `[2:a]asplit=3[c1][c2][c3];[c1]volume=0.15,adelay=${chimeDelays[0]}:all=1[s1];[c2]volume=0.13,adelay=${chimeDelays[1]}:all=1[s2];[c3]volume=0.12,adelay=${chimeDelays[2]}:all=1[s3];` +
  "[0:a][music][s1][s2][s3]amix=inputs=5:duration=first:normalize=0,alimiter=limit=0.94[a]",
  "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
  "-t", String(totalDuration), "-movflags", "+faststart",
  "-metadata", plan[0].introMascot ? "title=Open Door — A Day That Feels Like You" : "title=Open Door — Find Your Place. Find Your People.",
  "-metadata", plan[0].introMascot ? "comment=Real app recording with labeled demo examples; rewards component preview uses sample milestones. No live Qloo response or signed-in account shown. AI-generated narration. User-supplied mascot artwork." : "comment=Authored Demo footage; no live Qloo response shown. Rewards sequence is a labeled component UI preview. AI narration and illustrative opening.",
  `${out}/Open-Door-Demo${suffix}.mp4`]);
console.log(`Finished: ${out}/Open-Door-Demo${suffix}.mp4`);
