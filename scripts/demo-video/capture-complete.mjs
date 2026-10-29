import { chromium, expect } from "@playwright/test";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
const out=path.resolve("generated-artifacts/demo-complete");
const plan=JSON.parse(readFileSync(`${out}/plan.json`,"utf8"));
const base=`https://${process.env.REPLIT_DEV_DOMAIN}`;
const requested=process.env.OPEN_DOOR_CAPTURE_SCENES?.split(",");
const manifest=existsSync(`${out}/captures.json`)?JSON.parse(readFileSync(`${out}/captures.json`)): {};
const evidence=existsSync(`${out}/capture-evidence.json`)?JSON.parse(readFileSync(`${out}/capture-evidence.json`)): {liveRequests:[],errors:[],rewards:"Supplied artwork preview. No signed-in account.",voice:"Control shown; no microphone transcription."};
const browser=await chromium.launch({headless:true,executablePath:"/repl/tools/bin/chromium"});
const context=await browser.newContext({viewport:{width:1440,height:810},recordVideo:{dir:`${out}/raw`,size:{width:1440,height:810}},permissions:["clipboard-read","clipboard-write"],acceptDownloads:true,reducedMotion:"no-preference"});
const page=await context.newPage();page.setDefaultTimeout(15000);
const file=await page.video().path();const begun=Date.now();
page.on("pageerror",e=>evidence.errors.push(e.message));
const persist=()=>{writeFileSync(`${out}/captures.json`,JSON.stringify(manifest,null,2));writeFileSync(`${out}/capture-evidence.json`,JSON.stringify(evidence,null,2));};
const wants=id=>!requested||requested.includes(id);
async function scroll(target,block="center"){const l=typeof target==="string"?page.locator(target).first():target;await l.evaluate((e,b)=>e.scrollIntoView({behavior:"smooth",block:b}),block);await page.waitForTimeout(500);}
async function chapter(id,work){
 if(!wants(id))return;
 console.log("Recording",id);const s=Date.now();const duration=plan.find(x=>x.id===id).duration;
 const at=async t=>{const wait=t*1000-(Date.now()-s);if(wait>0)await page.waitForTimeout(wait);};
 await work(at);await at(duration);
 const elapsed=(Date.now()-s)/1000;
 manifest[id]={file,start:(s-begun)/1000,duration:Math.min(elapsed,duration),playbackRate:1};
 await page.screenshot({path:`${out}/${id}.jpg`});persist();console.log("Captured",id,elapsed);
}
async function live(action){
 const promise=page.waitForResponse(r=>r.url().includes("/api/agent/discover")&&r.request().method()==="POST",{timeout:90000});
 await action();const response=await promise;const events=(await response.text()).trim().split("\n").map(s=>JSON.parse(s));const done=events.find(e=>e.type==="complete");
 evidence.liveRequests.push({status:response.status(),mode:done?.journey?.mode,titles:done?.journey?.doors?.map(d=>d.title),events});persist();
 if(!done||done.journey.mode!=="live")throw Error("Live Qloo retrieval failed: "+JSON.stringify(events.at(-1)));
 await page.waitForTimeout(800);console.log("Live:",done.journey.doors.map(d=>d.title).join(" / "));
 return done.journey;
}
try{
 await page.goto(`${base}/?explore=1`);await expect(page.locator(".hero")).toBeVisible();
 await chapter("01-welcome",async at=>{await at(4);await scroll(".hero","start");await at(9);await scroll(".product-avenues","start");});
 await page.locator("#city").fill("Brooklyn, New York");
 await page.locator("#anchor-input").fill("Nina Simone");await page.getByLabel("Category for new anchor").selectOption("Music");
 await page.locator(".friendly-brief textarea").fill("A relaxed afternoon with a friend, easy walking, music and art.");
 await scroll(".friendly-brief","start");
 await chapter("02-solo",async at=>{await at(3);await page.locator(".friendly-advanced > summary").click();await scroll(".friendly-advanced","start");await at(8);await page.locator(".friendly-advanced > summary").click();await scroll(".friendly-interests");await at(12);await scroll(page.getByRole("button",{name:"Explore with Qloo",exact:true}));});
 const solo=await live(()=>page.getByRole("button",{name:"Explore with Qloo",exact:true}).click());
 if(solo.doors.length!==3)throw Error("Need three real results for door hero shot.");
 await scroll(".doors-grid","start");
 await page.evaluate(()=>window.scrollBy({top:-160,behavior:"instant"}));
 await chapter("03-doors",async at=>{
   await at(7);
   // Hold the recording camera on the artwork while the app focuses its result.
   await page.evaluate(()=>{const y=window.scrollY;const timer=setInterval(()=>window.scrollTo({top:y,behavior:"instant"}),16);setTimeout(()=>clearInterval(timer),7500);});
   await page.locator(".door-preview").first().click();
   // No scroll, cut, reduced motion, or playback-rate change during either animation.
   await at(16);await scroll(".door-card.is-expanded .door-result-expanded","start");
   await at(20);
 });
 if(!await page.locator(".door-card.is-expanded").count())await page.locator(".door-preview").first().click();
 const save=page.locator(".door-card.is-expanded").getByRole("button",{name:/^Save /});
 await save.click();evidence.guestSave=true;persist();
 if(wants("04-bridge")){
 await page.getByRole("button",{name:"Taste Bridge",exact:true}).click();
 await page.getByLabel("Person 1 name",{exact:true}).fill("Music lover");
 await page.getByLabel("Person 2 name",{exact:true}).fill("Film fan");
 await page.getByLabel("Person 1 interest 1",{exact:true}).fill("Nina Simone");await page.getByLabel("Person 1 category 1",{exact:true}).selectOption("Music");
 await page.getByLabel("Person 2 interest 1",{exact:true}).fill("Spirited Away");await page.getByLabel("Person 2 category 1",{exact:true}).selectOption("Film");
 await live(()=>page.getByRole("button",{name:"Find our bridge",exact:true}).click());
 await scroll(page.getByLabel("Person 1 name",{exact:true}),"start");
 await chapter("04-bridge",async at=>{await at(5);await scroll(page.getByRole("region",{name:"Taste Bridge results"}),"start");await at(11);await scroll(page.getByRole("heading",{name:"The Bridge",exact:true}),"start");});
 }
 if(wants("05-what-if")){
 await page.getByRole("button",{name:"What If? Explorer",exact:true}).click();
 await page.getByLabel("Start from",{exact:true}).selectOption("current-journey");
 await page.getByRole("button",{name:"Use this starting point",exact:true}).click();
 await page.getByLabel("Your private what-if scenario").fill("What if I explore Paris and want something completely different?");
 await page.getByLabel(/^Alternative city/).fill("Paris");
 await page.getByLabel(/^Alternative depth/).selectOption("Surprise me");
 await live(()=>page.getByRole("button",{name:"Explore this what-if",exact:true}).click());
 await scroll(".what-if-source","start");
 await chapter("05-what-if",async at=>{await at(4);await scroll(page.getByLabel("Your private what-if scenario"));await at(9);await scroll(page.getByRole("region",{name:"What-if alternatives"}),"start");await at(14);await scroll(".what-if-comparison","start");});
 }
 if(wants("06-debate")){
 await page.getByRole("button",{name:"Discovery Debate",exact:true}).click();
 await page.getByRole("button",{name:"Start this debate",exact:true}).click();
 const challenge=async label=>{await page.locator(".debate-quick-actions").getByRole("button",{name:label,exact:true}).click();await page.getByRole("button",{name:"Send challenge",exact:true}).click();};
 await challenge("Show the evidence");
 await page.locator(".debate-quick-actions").getByRole("button",{name:"Retrieve something more unexpected",exact:true}).click();
 await live(()=>page.getByRole("button",{name:"Send challenge",exact:true}).click());
 await scroll(page.getByRole("complementary",{name:"Currently debated recommendation"}),"start");
 await chapter("06-debate",async at=>{await at(4);await scroll(page.getByRole("list",{name:"Session transcript"}),"start");await at(11);await scroll(page.getByRole("list",{name:"Session transcript"}).locator("li").last());});
 }
 if(wants("07-others")){
 await page.goto(`${base}/?explore=1&audience=company#company-tools`);
 const tools=page.locator("#company-tools");if(await tools.evaluate(e=>e.tagName==="DETAILS"&&!e.open))await tools.locator(":scope > summary").click();
 await scroll(tools,"start");
 await chapter("07-others",async at=>{await at(2);await tools.locator("select").selectOption("celebrations");const inputs=tools.locator('input[type="text"],input:not([type])');await inputs.nth(0).fill("Brooklyn, New York");await inputs.nth(1).fill("Wedding weekend · a free afternoon");await at(7);await tools.getByRole("button",{name:/Copy guest link/i}).click();await at(10);await tools.locator('a[href^="/companies/discover?"]').first().click();await scroll(".friendly-brief","start");});
 }
 if(wants("08-lab")){
 await page.goto(`${base}/lab`);await page.getByLabel("Cultural interest",{exact:true}).fill("Nina Simone");await page.getByRole("button",{name:"Add anchor",exact:true}).click();await page.getByRole("combobox",{name:"Category for Nina Simone",exact:true}).selectOption("Music");
 await live(()=>page.getByRole("button",{name:/^Start exploring/}).click());
 await page.locator(".lab-direction").filter({hasText:"Take the Wild Door"}).click();
 await live(()=>page.locator(".lab-door-detail").getByRole("button",{name:/^Open this door/}).click());
 await expect(page.locator(".lab-compare-branch")).toHaveCount(2);
 await scroll(".lab-map","start");
 await chapter("08-lab",async at=>{await at(4);await scroll(".lab-compare","start");await at(9);await scroll(".lab-post-history","start");});
 evidence.liveLabBranches=true;
 }
 if(wants("09-planner")||wants("10-progress")){
 await page.goto(`${base}/?explore=1`);await scroll(".doors-grid","start");await page.locator(".door-preview").first().click();await page.waitForTimeout(10000);
 await page.getByRole("button",{name:"Add to Build My Day",exact:true}).click();
 const suggest=page.getByRole("button",{name:"Suggest a plan that fits",exact:true});if(await suggest.count())await suggest.click();
 await scroll(".door-result-expanded","start");
 await chapter("09-planner",async at=>{await page.getByRole("button",{name:"Uncover a hidden gem",exact:true}).click();await at(3);await scroll("#day-plan","start");await at(7);const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download day plan",exact:true}).click();await (await download).saveAs(`${out}/Recorded-day-plan.docx`);evidence.download=true;await at(10);await scroll(".story-card","start");});
 await page.goto(`${base}/?view=saved`);await scroll(page.getByRole("heading",{name:"My Doors",exact:true}),"start");
 await chapter("10-progress",async at=>{await at(6);
 const image=readFileSync("public/mascot/open-door-reward-concept.png").toString("base64");
 await page.setContent(`<html><body style="margin:0;background:#f6f3e9;color:#173e33;font-family:Arial;padding:36px 70px"><p style="color:#985437;font-size:19px">REWARDS PREVIEW · SUPPLIED ARTWORK · NOT A SIGNED-IN ACCOUNT</p><h1 style="font-family:Georgia;font-size:42px">Small discoveries. Progress worth celebrating.</h1><div style="display:flex;align-items:center;gap:35px"><img src="data:image/png;base64,${image}" width="850"><div style="font-size:25px;line-height:1.7"><b>Brave<br>Explorer<br>Door Collector</b><p>Medals · Stars · Trophies</p><p style="font-size:18px">Account progress reflects app activity.<br>No earned rewards are claimed here.</p></div></div></body></html>`);
 });
 }
 await page.goto(`${base}/trust`);await scroll("h1","start");
 await chapter("11-trust",async at=>{await at(4);await scroll(".trust-action","center");});
 persist();
}catch(e){await page.screenshot({path:`${out}/capture-error.jpg`});persist();throw e;}
finally{await context.close();await browser.close();}
