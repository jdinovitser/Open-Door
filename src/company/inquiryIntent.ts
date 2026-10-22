const intents = {
  partnership: {
    id: "partnership",
    heading: "Let’s explore a partnership.",
    intro: "Tell us how Open Door could help your guests, visitors or customers. We’re exploring paid pilots, branded experiences and transparent referral or sponsorship models—not offering live ad inventory or guaranteed results.",
    details: "Partnership inquiry: I would like to discuss Open Door for our guests or customers. Our audience, occasion and goals are: ",
    typeDescription: "",
  },
  investment: {
    id: "investment",
    heading: "Let’s talk about Open Door’s future.",
    intro: "Interested in the free-for-individuals, company-funded model? Share your perspective and what you would like to discuss. This is an invitation to a conversation, not an offer of securities or a claim of existing revenue.",
    details: "Investment conversation: I would like to learn more about Open Door’s company-funded model, partnership pilots and growth plans. My background and questions are: ",
    typeDescription: "Investment conversation about Open Door",
  },
} as const;

export function inquiryIntentFromSearch(search: string) {
  const value = new URLSearchParams(search).get("inquiry");
  return value === "partnership" || value === "investment" ? intents[value] : null;
}
