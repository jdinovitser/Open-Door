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
