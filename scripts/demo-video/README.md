# Open Door demo video

The production plan is in `plan.json`. The output is a 165-second, 1920×1080
H.264/AAC MP4 with burned-in captions, plus a separate SRT caption file.
All generated recordings, speech, music, and renders live in the ignored
`generated-artifacts/demo-video/` directory, not the public application bundle.

## Production

1. Start the existing application workflow.
2. Generate one narration MP3 per plan entry, `music.mp3`, `door-chime.mp3`,
   and `arrival.jpg` in the output directory using the media-generation tools.
3. Run `node scripts/demo-video/capture.mjs` to record the actual app through
   its Replit development domain. This uses an isolated browser context and
   does not touch a real member account.
4. Run `node scripts/demo-video/render.mjs` to assemble the film. The renderer
   normalizes narration, fits each scene to its allotted time, burns captions,
   mixes the music and chimes, and writes `Open-Door-Demo.mp4`.
5. Inspect the output before sharing. The script also writes a render report
   and `Open-Door-Captions.srt`.

For a different narrator, generate matching MP3 filenames under a named
`<variant>-voice/` subdirectory, then run `node scripts/demo-video/render.mjs <variant>`.
This preserves the original export and writes variant-specific scenes, captions,
and MP4. The `upbeat` variant preserves a more energetic natural speaking pace.

## Evidence boundaries

- The opening image and narrator are AI-generated illustrative material, not
  a real family testimonial. The opening and credits disclose this.
- Product footage is real browser capture. Sample discovery paths retain the
  app's Demo labels and are not represented as provider results or real venues.
- The Qloo section records the existing architecture, not a live API response.
  Replace both the footage and corresponding narration only after recording a
  successful real response.
- The rewards sequence renders the actual Progress component in an isolated
  browser-only preview with sample gold milestones. Its persistent chapter
  label explicitly identifies the preview. This does not sign in, bypass
  production authentication, populate an account, or prove cloud sync.
- The optional sign-in screen is captured separately. No passwords, session
  tokens, user IDs, emails, or other private account information are recorded.
- Discovery Lab is shown as browser-local. Rewards are in-app activity
  milestones, not verified visits or community-engagement scores.

The plan and recording scripts do not add routes or features to the website.

## Updated multi-occasion walkthrough

`refresh-plan.json` tells a broader story: a first week in a new home, a day
with a friend, a solo afternoon, and other personal occasions. It includes the
inline recommendations, personal considerations, hidden gems, printable and
Word recommendations, flexible planner, and existing Lab.

Generate narration into `generated-artifacts/demo-refresh/upbeat-voice/`
with matching scene IDs, then run:

```sh
node scripts/demo-video/capture-refresh.mjs --check
node scripts/demo-video/capture-refresh.mjs
OPEN_DOOR_DEMO_DIR=generated-artifacts/demo-refresh \
OPEN_DOOR_DEMO_PLAN=scripts/demo-video/refresh-plan.json \
node scripts/demo-video/render.mjs upbeat
```

The recorder uses real UI interactions in a fresh guest browser, checks the
Maps URL, and downloads an actual Word document. Browser print styling is
shown without opening a native print dialog. It does not forge a Live result
or a signed-in account. The rewards sequence renders the existing component
with explicitly labeled sample milestones, not real member activity. This
version uses the existing mascot artwork for its opening, rather than the
earlier moving-house illustration. The finished cut is 179 seconds.

## Story-led demo

The approved narrative in `story-plan.json` follows one problem and one
journey: too many options, personal constraints, Open Door as the solution,
Qloo's role, useful tools, and a positive payoff. It does not repeatedly
enumerate the occasion options.

Generate matching new narration under
`generated-artifacts/demo-story/upbeat-voice/`, then run:

```sh
node scripts/demo-video/capture-story.mjs --check
node scripts/demo-video/capture-story.mjs
OPEN_DOOR_DEMO_DIR=generated-artifacts/demo-story \
OPEN_DOOR_DEMO_PLAN=scripts/demo-video/story-plan.json \
node scripts/demo-video/render.mjs upbeat
```

The setup and Qloo chapters are freshly recorded. The verified recommendation,
Maps/planner/download, Lab, save/sign-in, and labeled rewards-preview footage
from the multi-occasion version is reused with the new narration. The Lab
footage is modestly accelerated to fit its chapter. The final cut is 179
seconds, and the earlier exports are preserved.
