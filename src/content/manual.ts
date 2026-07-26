/**
 * The Park Manual codex (GAME_DESIGN.md §12): searchable, article-based,
 * zero mandatory reading. Plain-English rules in the Wanderpark voice.
 */

export interface ManualArticle {
  id: string;
  icon: string;
  title: string;
  body: string[];
}

export const MANUAL_ARTICLES: ManualArticle[] = [
  {
    id: "paths",
    icon: "🛤",
    title: "Paths & queues",
    body: [
      "Guests only walk on paths. Your park effectively IS its path network — connect it to the entrance gate or nobody gets in.",
      "Queues are a special surface painted from a path to a ride. Guests wait on them (impatiently — see Queues & patience).",
      "Bulldoze refunds 50%; scenery removed within 30 seconds refunds fully.",
    ],
  },
  {
    id: "rides",
    icon: "🎡",
    title: "Rides & queues",
    body: [
      "Rides run cycles: load → run → unload. Each has excitement, intensity and nausea (0–10). Guests pick rides that fit their thrill preference.",
      "Every ride needs a queue connected to a path. No queue, no riders, no money.",
      "Waiting guests lose patience; entertainers and short queues keep them aboard. Ticket price is judged against excitement — greed breeds refusals.",
    ],
  },
  {
    id: "coasters",
    icon: "🎢",
    title: "Building coasters",
    body: [
      "Coasters dock → pick a family → drop the station beside a path (R rotates), then chain pieces with the buttons or W/A/D/R/F/L keys.",
      "The circuit must close back at the station. The green ring is home; the amber arrow is your build head.",
      "Stats come from the geometry: drops, loops, speed and turns raise excitement. The physics are honest — a lift too small strands a slow train.",
      "Chain lifts pull the train up slopes; everything after is gravity, so build a drop after the climb.",
    ],
  },
  {
    id: "needs",
    icon: "🍔",
    title: "Guest needs & mood",
    body: [
      "Guests track hunger, thirst, bladder, energy and fun. Needs drift every park hour; thought bubbles and the Guests tab tell you what's trending.",
      "Stalls restore needs — food, drinks and (free) toilets are the survival kit. Souvenirs top up fun.",
      "Mood blends needs with experiences. Happy guests spend more, stay longer, and lift your rating as they wander.",
    ],
  },
  {
    id: "money",
    icon: "💰",
    title: "Money & pricing",
    body: [
      "Income: entry tickets, ride tickets, stall sales. Expenses: construction, upkeep, goods, wages, interest, repairs, research, marketing.",
      "Entry price gates arrivals: pricey gates thin the crowd, free entry packs paths and bets on ticket-and-snack spending. Both work.",
      "Every price is judged for fairness. 'Rip-off' thoughts sink your value rating — watch the Finances panel's daily books.",
    ],
  },
  {
    id: "rating",
    icon: "⭐",
    title: "Park rating",
    body: [
      "A 0–1000 composite of five terms: happiness, ride portfolio, cleanliness, scenery and value for money.",
      "The Rating tab shows each term and names the weakest — fix that first.",
      "Rating drives guest arrivals and milestone tiers. It is the closest thing Wanderpark has to a score.",
    ],
  },
  {
    id: "staff",
    icon: "🧹",
    title: "Staff",
    body: [
      "Janitors sweep litter, mechanics fix breakdowns, entertainers cheer the longest queue. All self-assign to wherever the work is.",
      "Wages land weekly. Skill grows with jobs done — a veteran mechanic is twice the mechanic.",
      "No staff means the overnight litter fairy retires and broken rides stay broken (unless you pay the contractor).",
    ],
  },
  {
    id: "breakdowns",
    icon: "💥",
    title: "Breakdowns & maintenance",
    body: [
      "Rides wear down (reliability 0–100). Low reliability breeds mid-cycle breakdowns — comedy smoke, grumpy queue, zero income.",
      "A mechanic repairs free; the Call Repair button pays a $250 contractor for speed. Renovate (40% of build cost) resets reliability completely.",
      "Random safety inspections fine parks with shabby rides. Maintain before they visit.",
    ],
  },
  {
    id: "research",
    icon: "🔬",
    title: "Research",
    body: [
      "Four branches — Thrill, Family, Food & Retail, Operations — each six nodes of rides, stalls, scenery and park-wide perks.",
      "Pick a branch and a funding tier (Paused / Standard / Turbo); progress lands at each day rollover.",
      "In Freeplay parks everything is unlocked from day one, but perk nodes are still worth researching.",
    ],
  },
  {
    id: "loans",
    icon: "🏦",
    title: "Loans & the bank",
    body: [
      "Borrow in $5,000 tranches against your park's value. Each tranche adds +1.5% APR. Interest is charged daily.",
      "Miss a payment (cash below the day's interest) and penalties stack. Three misses and the bank starts auctioning your rides.",
      "Nothing left to seize? The bank owns the fun. Repay tranches whenever cash allows — future-you says thanks.",
    ],
  },
  {
    id: "weather",
    icon: "🌦",
    title: "Weather & events",
    body: [
      "Sun, cloud, rain, storm, heatwave — arrivals and thirst shift with the sky. Storms empty the park outright.",
      "The top-bar chip shows the current weather; hover it for the forecast.",
      "Dynamic events (VIPs, inspections, streamers, the Coaster Club…) drop in every few days with their own twists.",
    ],
  },
  {
    id: "marketing",
    icon: "📣",
    title: "Marketing",
    body: [
      "Four campaign types multiply arrivals for a few days. Unlocked by the Operations 'Marketing Licence' node.",
      "Over-promise at a low rating and the post-campaign hangover dips arrivals — deliver the park the ads sold.",
    ],
  },
  {
    id: "zones",
    icon: "🏰",
    title: "Theming zones",
    body: [
      "Cluster 8+ same-theme scenery pieces near a ride and a named zone forms — Pirate Cove, Star Harbor, Frostfair…",
      "Zone rides earn bonus excitement. Click the zone banner to rename it.",
      "Zones make scenery pay: beauty feeds the rating AND the thrill.",
    ],
  },
  {
    id: "opportunities",
    icon: "🎯",
    title: "Opportunities & milestones",
    body: [
      "Opportunities are optional side-quests rolled from your park's actual state, with rewards: cash, research surges, ad campaigns, exclusive scenery.",
      "Accept, reroll or decline in the Goals tab. Declining is always free; expiry is always quiet.",
      "Milestones are the long game: five named tiers with cash awards as rating and lifetime guests climb.",
    ],
  },
  {
    id: "saving",
    icon: "💾",
    title: "Saving & parks",
    body: [
      "Autosave runs every park day, on tab-hide and on exit. Manual save lives in the pause menu (Esc).",
      "Parks export as .wanderpark.json files — back them up, share them with friends, import them anywhere.",
      "Everything is local to your browser. No accounts, no cloud, no nonsense.",
    ],
  },
];
