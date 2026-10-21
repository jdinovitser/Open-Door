type Category = "Music" | "Art" | "Film" | "Books" | "Food" | "Design" | "Outdoors" | "Experiences" | "Other";
type Activity = [title: string, benefit: string, firstStep: string];
const activities: Record<Category, Activity[]> = {
  Music: [
    ["Make a three-song playlist", "Compare moods and discover what you enjoy about a sound.", "Pick a song you love, a song by the same artist, and one you have never heard. Listen to the first minute of each."],
    ["Give a painting a soundtrack", "Bring music and visual art together in a small, creative experiment.", "Open an image you like. Choose a song that matches its mood, then try a very different song and notice what changes."],
    ["Listen to two versions of one song", "Hear how different performers put their own personality into the same music.", "Find two recordings of a song you know. Compare the opening minute: which version would you play again?"],
  ],
  Art: [
    ["Explore an online art collection", "Enjoy art at your own pace, without planning a trip.", "Open a museum’s online collection. Choose three pictures that catch your eye and save the link to your favorite."],
    ["Make a postcard-sized sketch", "Turn something you notice into a small piece of your own art.", "Choose a photo or object nearby. Spend five minutes drawing its shapes. A few simple lines are enough."],
    ["Create a color collection", "Find a visual theme in things you already enjoy.", "Choose three images you like. Pick one color they share and look for it in your surroundings."],
  ],
  Film: [
    ["Watch a short film", "Try a new story without committing to a whole evening.", "Choose a short film available through a library or a service you already use. Watch ten minutes and decide whether you want to continue."],
    ["Listen to a film’s soundtrack", "Discover how music helps a scene tell its story.", "Choose a scene you know. Listen once without looking at the screen, then watch it again with the picture."],
    ["Compare two opening scenes", "Notice the kinds of stories and atmosphere you enjoy.", "Pick two films you can access. Watch the first two minutes of each and choose which opening makes you curious."],
  ],
  Books: [
    ["Try the first page of a new book", "Find a new voice without having to finish a whole book.", "Open a library preview or a book you already have. Read one page. If it catches your interest, save the title."],
    ["Read a poem with a song", "Explore how words and music can create a shared mood.", "Choose a short poem and a song you enjoy. Read the poem before and after the song, and notice which line stays with you."],
    ["Ask for one book recommendation", "Start a conversation around a story someone else loves.", "Ask a friend or librarian for one book they would happily read again, and what they love about it."],
  ],
  Food: [
    ["Explore the story of a favorite dish", "Connect a familiar taste with the people and traditions behind it.", "Pick a dish you enjoy. Find a recipe or interview by someone who makes it and read why it matters to them."],
    ["Make a recipe playlist", "Bring your tastes in food and music into the same afternoon.", "Choose a recipe you already know and three songs you would play while making it. You can plan the pairing without cooking or buying anything."],
    ["Share a food memory", "Discover a personal story through something familiar.", "Ask someone about a meal they remember fondly. What made it special: the food, the place, or the company?"],
  ],
  Design: [
    ["Look closer at an everyday object", "Discover the small design decisions that shape daily life.", "Pick a mug, chair, or lamp. Notice one detail you like and one you would change. Photograph or sketch it if you want."],
    ["Make a small mood board", "Put your favorite colors, shapes, and textures in one place.", "Collect three images that match the feeling you want in a room or outfit. Name what they have in common."],
    ["Explore an online design collection", "Find new ideas without needing to visit a museum.", "Browse a design museum’s online collection. Pick an object you would like to learn how to make."],
  ],
  Outdoors: [
    ["Try a five-minute nature break", "Make a little room to notice your surroundings.", "From a window, garden, or other comfortable spot, find three different shapes or colors. Stay seated if you prefer."],
    ["Photograph three small details", "Turn a familiar place into a simple creative challenge.", "Choose a comfortable place and photograph three textures or patterns. You can use objects at home instead of going out."],
    ["Draw the view from your window", "Combine observation and art without needing to travel.", "Pick one part of the view. Spend five minutes sketching its main shapes, or describe it in three sentences."],
  ],
  Experiences: [
    ["Swap favorite discoveries with a friend", "Find something new through someone you already know.", "Each choose one song, image, or short story. Take turns sharing why you picked it. A message exchange works too."],
    ["Plan a small culture break", "Make time for an interest without filling your whole day.", "Choose one song and one artwork to enjoy together. Set aside ten minutes, with no need to do anything else afterward."],
    ["Make a mini exhibition at home", "Give your interests a personal place in your day.", "Choose three images or objects you like. Arrange them together and give your little collection a title."],
  ],
  Other: [
    ["Choose a ten-minute taster", "Find out whether an idea interests you before committing more time.", "Choose one short video, article, or image about your interest. Spend ten minutes with it, then decide what you would like to try next."],
    ["Make a curiosity list", "Turn a broad interest into a few things you can actually explore.", "Write down three questions about something you enjoy. Pick the one you would most like answered today."],
    ["Share one favorite thing", "Enjoy a low-pressure conversation about what matters to you.", "Send someone a song, picture, or short article you like, with one sentence explaining why you chose it."],
  ],
};

export type DemoOptions = { seenTitles?: string[]; focusCategory?: string; intent?: string };
export function demoIdeas(
  interests: { label: string; category: string }[],
  scenario: string, depth: string, feedback: string[], iteration: number, options: DemoOptions = {},
) {
  const selected = interests.filter(interest => !/· step \d+/.test(interest.label));
  const musicAndArt = /\b(?:love|enjoy|like|interested in)\s+(?:both\s+)?music\s+and\s+art\b/i.test(scenario);
  const base = musicAndArt ? ["Music", "Art"] : selected.map(interest => interest.category);
  const allCategories = ["Books", "Art", "Music", "Film", "Food", "Design", "Outdoors", "Experiences", "Other"];
  const preferred = base.filter(category => category in activities);
  const pool = [...new Set(depth === "Close to home" || feedback.includes("Too far")
    ? preferred.length ? preferred : allCategories
    : [...preferred, ...allCategories])] as Category[];
  if (depth === "Surprise me" || depth === "Take me somewhere unexpected") {
    const detour = pool.find(category => !preferred.includes(category));
    if (detour) { pool.splice(pool.indexOf(detour), 1); pool.splice(depth === "Surprise me" ? 2 : 0, 0, detour); }
  }
  const focus = options.focusCategory as Category | undefined;
  if (focus && pool.includes(focus)) { pool.splice(pool.indexOf(focus), 1); pool.unshift(focus); }
  if (feedback.includes("Not my scene") || feedback.includes("Just not interested")) pool.push(pool.shift()!);
  if (feedback.includes("Too familiar") || depth === "Take me somewhere unexpected") pool.push(pool.shift()!);
  const seen = new Set(options.seenTitles || []);
  const choices = pool.flatMap(category => {
    const list = activities[category] || activities.Other;
    const offset = iteration % list.length;
    return [...list.slice(offset), ...list.slice(0, offset)]
      .filter(([title]) => !seen.has(title))
      .map(activity => ({ category, activity }));
  });
  // Prefer variety, then use another unseen activity if a favorite category is exhausted.
  const chosen = pool.flatMap(category => choices.find(choice => choice.category === category) || []).slice(0, 3);
  for (const choice of choices) {
    if (chosen.length === 3) break;
    if (!chosen.includes(choice)) chosen.push(choice);
  }
  const root = musicAndArt ? "music and art" : selected.slice(0, 2).map(interest => interest.label).join(" and ") || "trying something new";
  return chosen.map(({ category, activity }, index) => ({
    category, title: activity[0], why: `You said you enjoy ${root}. ${activity[1]}`,
    now: `${activity[2]}${feedback.includes("Too expensive") ? " Start with something you already have or can access for free." : ""}${feedback.includes("Wrong time") ? " Try just five minutes whenever it fits your day." : ""}${options.intent === "Find my people" ? " If you would like company, invite a friend to try it with you or share it in a message." : ""}`,
    source: root, kind: category,
    tier: (["Familiar", "Adjacent", "Unexpected"] as const)[index],
    evidence: "An example activity written by Open Door, not a live Qloo recommendation or a confirmed place or event.",
    thread: `More ways to enjoy ${root}`,
  }));
}
