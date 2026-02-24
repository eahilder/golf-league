export type CourseCategory = 'links' | 'coastal' | 'parkland' | 'desert' | 'resort' | 'championship';

export interface Course {
  name: string;
  location: string;
  par: number;
  description: string;
  flag: string;
  category: CourseCategory;
}

export const ALL_COURSES: Course[] = [
  // Korn Ferry / Mid-difficulty
  {
    name: 'Del Monte',
    location: 'Monterey, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "One of the oldest continuously operating courses west of the Mississippi, Del Monte has welcomed golfers since 1897 amid the storied pines of the Monterey Peninsula. Its classic tree-lined fairways and undulating greens offer a round steeped in American golf history.",
  },
  {
    name: 'MacGregor Downs',
    location: 'Cary, NC',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "A respected private club in the heart of North Carolina's Research Triangle, MacGregor Downs winds through mature Piedmont hardwoods with tight fairways and well-bunkered greens. Precision is rewarded at every turn on this demanding test.",
  },
  {
    name: 'Blue Hill Challenger A',
    location: 'Canton, MA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Nestled in the Blue Hills Reservation south of Boston, this Challenger routing winds through classic New England hardwoods with rolling terrain and subtle green complexes. A fair but engaging test of all aspects of the game.",
  },
  {
    name: 'Blue Hill Challenger B',
    location: 'Canton, MA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "The second Challenger layout at Blue Hill offers a fresh perspective on the scenic Massachusetts reservation terrain. Tight driving corridors and firm, undulating greens make this an excellent match-play battleground.",
  },
  {
    name: 'Blue Hill Championship',
    location: 'Canton, MA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Blue Hill's flagship layout stretches through rolling New England terrain with demanding par-4s and deceptively quick greens. The most challenging of the three Blue Hill routings, it rewards patience and course management.",
  },
  {
    name: 'Brookside',
    location: 'Pasadena, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Set in the shadow of the Rose Bowl and alongside the Arroyo Seco in Pasadena, Brookside's two courses meander through towering sycamores and have hosted professional events for decades. A beloved public course with a rich Southern California pedigree.",
  },
  {
    name: 'Country Club of Roswell',
    location: 'Roswell, GA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "A polished private club in the affluent northern suburbs of Atlanta, Country Club of Roswell winds through elegant Georgia pines with a variety of challenging par-4s. The layout rewards precision over power and features immaculate conditioning year-round.",
  },
  {
    name: 'Longview Golf Course',
    location: 'Georgetown, KY',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Situated in the rolling horse country of central Kentucky, Longview provides a genuine Bluegrass State parkland experience with generous fairways and receptive greens. The gentle landscape belies the strategic demands of the layout.",
  },
  {
    name: 'Mutton Town Country Club',
    location: 'East Norwich, NY',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Tucked away on Long Island's exclusive North Shore, Mutton Town is a classic private club with a mature tree-lined layout dating to the early 20th century. Fast, tricky greens and traditional conditioning make it a stern test of the short game.",
  },
  {
    name: 'The Club at Renaissance',
    location: 'Fort Myers, FL',
    par: 72,
    flag: '🇺🇸',
    category: 'resort',
    description: "A dramatic design winding through the lush preserve land of Fort Myers, The Club at Renaissance offers sweeping elevation changes rare for Southwest Florida. Pristine conditioning and a tranquil setting make it one of the Gulf Coast's finest private experiences.",
  },
  {
    name: 'The Country Club at Woodmore',
    location: 'Woodmore, MD',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Located in the upscale Maryland suburbs just outside Washington D.C., Woodmore is a respected private club with a classic parkland character. Bermuda fairways and Bentgrass greens provide a true year-round challenge in a refined setting.",
  },
  {
    name: 'The Golf Club of Amelia Island',
    location: 'Fernandina Beach, FL',
    par: 72,
    flag: '🇺🇸',
    category: 'coastal',
    description: "Set on the pristine barrier island of Fernandina Beach in northern Florida, this coastal course weaves through native maritime forest and salt marshes. Ocean breezes add a strategic dimension to the layout that makes club selection crucial.",
  },
  {
    name: 'The Sagamore Club',
    location: 'Noblesville, IN',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "A private gem north of Indianapolis, The Sagamore Club delivers one of Indiana's finest parkland experiences with manicured Bentgrass throughout and thoughtful routing over subtly rolling terrain. Every club in the bag gets a workout here.",
  },
  {
    name: 'Twin Oaks Golf Course',
    location: 'San Marcos, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Set in the hills above San Marcos with views of the San Pasqual Valley, Twin Oaks offers Southern California parkland golf in consistent year-round conditions. Wide driving corridors give way to small, well-protected greens that demand precise approaches.",
  },
  {
    name: 'Vero Beach Country Club',
    location: 'Vero Beach, FL',
    par: 72,
    flag: '🇺🇸',
    category: 'resort',
    description: "One of Florida's premier private clubs, Vero Beach Country Club features a classic layout in the affluent Treasure Coast community. Lush fairways, stately palms, and a gentle coastal breeze define the experience at this storied Florida institution.",
  },
  {
    name: 'West Lake Country Club',
    location: 'Augusta, GA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Situated just a short drive from Augusta National, West Lake plays through the rolling Georgia Piedmont with tree-lined fairways and Augusta-style Bermuda turf. Competition here carries special weight given its legendary golfing neighborhood.",
  },
  {
    name: 'White Manor Country Club',
    location: 'Malvern, PA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "A venerable private club in the Philadelphia Main Line tradition, White Manor features a tight, wooded layout with classic Bentgrass greens. The course has hosted numerous prestigious amateur events in the Mid-Atlantic region over the decades.",
  },

  // PGA / Championship
  {
    name: 'Pebble Beach Golf Links',
    location: 'Pebble Beach, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'coastal',
    description: "Perhaps the most beloved public golf course on earth, Pebble Beach has hosted six U.S. Opens along the dramatic cliffs of the Monterey Peninsula. The combination of ocean views, gnarled Monterey cypress, and world-class design is simply unmatched.",
  },
  {
    name: 'Spyglass Hill Golf Course',
    location: 'Pebble Beach, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'coastal',
    description: "Beginning atop the Del Monte Forest before descending to the Pacific dunes, Spyglass Hill blends parkland and links golf in one of the world's most visually stunning settings. Ranked consistently among America's best, it demands every shot in the bag.",
  },
  {
    name: 'The Links at Spanish Bay',
    location: 'Pebble Beach, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'links',
    description: "Designed by Robert Trent Jones Jr., Tom Watson, and Sandy Tatum to emulate Scotland's windswept links, Spanish Bay delivers a true links experience on the California coast. The tradition of a lone bagpiper playing at sunset makes every round unforgettable.",
  },
  {
    name: 'Tobacco Road Golf Club',
    location: 'Sanford, NC',
    par: 71,
    flag: '🇺🇸',
    category: 'championship',
    description: "One of golf's most unconventional designs, Tobacco Road winds through ancient North Carolina sand hills with massive mounds, blind shots, and wildly contoured greens. Mike Strantz's daring masterpiece polarizes opinions but never, ever bores.",
  },
  {
    name: 'Rams Hill Golf Club',
    location: 'Borrego Springs, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'desert',
    description: "Carved from the Borrego Valley in Anza-Borrego Desert State Park, Rams Hill is a remote high-desert gem with sweeping panoramas of the Peninsular Ranges. Tom Fazio's design navigates rocky outcroppings, desert washes, and native flora with artful precision.",
  },
  {
    name: 'The Farms Golf Club',
    location: 'Rancho Santa Fe, CA',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "An ultra-private enclave in the exclusive community of Rancho Santa Fe, The Farms is strikingly beautiful parkland set among avocado groves and coastal sage scrub. The serene atmosphere and polished layout make it one of San Diego County's finest rounds.",
  },
  {
    name: 'Rich Harvest Farms Golf',
    location: 'Sugar Grove, IL',
    par: 72,
    flag: '🇺🇸',
    category: 'championship',
    description: "Carved from the rich agricultural land of the Fox River Valley, Rich Harvest Farms has hosted major amateur and professional events with a championship layout featuring dramatic contouring on a largely flat Illinois landscape. A hidden gem of the Midwest.",
  },
  {
    name: 'Sand Creek CC Creek/Lake',
    location: 'Chesterton, IN',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Sand Creek's Creek/Lake routing in northwestern Indiana combines water and mature tree corridors as the primary defenses on a classic American parkland layout. Bentgrass throughout ensures superb playing conditions that reward controlled ball-striking.",
  },
  {
    name: 'Sand Creek CC Lake/Marsh',
    location: 'Chesterton, IN',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "The Lake/Marsh routing at Sand Creek introduces added risk-reward decisions around wetlands and shimmering water hazards. Precise iron play is rewarded on this scenic northwestern Indiana layout with classic parkland conditioning.",
  },
  {
    name: 'Sand Creek CC Marsh/Creek',
    location: 'Chesterton, IN',
    par: 72,
    flag: '🇺🇸',
    category: 'parkland',
    description: "Playing through both the marsh and creek portions of Sand Creek's diverse property, this routing provides the most varied challenge of the three combinations. It tests every facet of course management on this acclaimed Indiana layout.",
  },
  {
    name: 'Pinehurst No. 2',
    location: 'Pinehurst, NC',
    par: 70,
    flag: '🇺🇸',
    category: 'championship',
    description: "Donald Ross's masterpiece in the Carolina Sandhills has hosted more major championships than any other American venue and is often called the cradle of American golf. Its crowned, turtleback greens reject all but the most precise approach shots — come prepared to scramble.",
  },
  {
    name: 'Royal Troon Golf Club',
    location: 'Scotland, UK',
    par: 71,
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    category: 'links',
    description: "One of Scotland's most celebrated links courses, Royal Troon traces the Firth of Clyde coastline with the infamous Postage Stamp par-3 and a punishing back nine into the prevailing wind. The Open Championship has been decided here nine times.",
  },

  // International
  {
    name: 'La Cala Campo Europa',
    location: 'Spain',
    par: 72,
    flag: '🇪🇸',
    category: 'resort',
    description: "The Europa course at La Cala Resort in the Mijas hills above Marbella offers classic Andalusian parkland golf with sweeping Mediterranean views. Manicured fairways wind through olive trees and native Mediterranean flora in an idyllic Costa del Sol setting.",
  },
  {
    name: 'La Cala Campo America',
    location: 'Spain',
    par: 72,
    flag: '🇪🇸',
    category: 'resort',
    description: "The America course at La Cala features dramatic elevation changes through the Mijas hills with wider fairways and a slightly more generous character than its sister layouts. Stunning panoramas of the Spanish coast make every round here a visual treat.",
  },
  {
    name: 'La Cala Campo Asia',
    location: 'Spain',
    par: 72,
    flag: '🇪🇸',
    category: 'resort',
    description: "Inspired by Asian golf design philosophy, the Asia course at La Cala incorporates creative water features and tranquil garden-style landscaping into the dramatic Spanish hillside. It offers a distinctly serene character compared to the resort's other two tracks.",
  },
  {
    name: 'Belle Selva',
    location: 'Japan',
    par: 72,
    flag: '🇯🇵',
    category: 'parkland',
    description: "A beautifully manicured parkland course set among the serene Japanese countryside, Belle Selva features lush fairways and pristine conditioning reflective of the meticulous care Japanese golf culture brings to its courses. A tranquil and demanding test.",
  },
  {
    name: 'Castle x Seoul',
    location: 'South Korea',
    par: 72,
    flag: '🇰🇷',
    category: 'parkland',
    description: "Combining modern design with classic parkland principles, Castle Golf Club near Seoul weaves through sculpted terrain with dramatic water features and impeccably maintained turf. A showcase of South Korea's rapidly growing reputation for outstanding golf.",
  },
  {
    name: 'PAJU Country Club',
    location: 'South Korea',
    par: 72,
    flag: '🇰🇷',
    category: 'parkland',
    description: "Located north of Seoul near the scenic Imjin River, PAJU Country Club offers a peaceful and exacting parkland experience far from the city's bustle. Pristine conditioning and dramatic seasonal foliage define play at this respected Korean club.",
  },
  {
    name: 'SHILLA E/S',
    location: 'South Korea',
    par: 72,
    flag: '🇰🇷',
    category: 'resort',
    description: "The SHILLA Golf Club's East/South routing combines sweeping mountain panoramas with demanding highland parkland golf in South Korea's picturesque highlands. Impeccable conditioning and an exclusive private-club atmosphere make this a premier Korean experience.",
  },
  {
    name: 'SHILLA W/E',
    location: 'South Korea',
    par: 72,
    flag: '🇰🇷',
    category: 'resort',
    description: "The West/East combination at SHILLA Golf Club delivers a comprehensive tour of one of Korea's most prestigious mountain courses. Dramatic elevation changes and valley vistas reward those willing to tackle this challenging highland layout.",
  },
  {
    name: 'SHILLA W/S',
    location: 'South Korea',
    par: 72,
    flag: '🇰🇷',
    category: 'resort',
    description: "Playing the West and South nines at SHILLA maximizes the dramatic contouring and mountain views that define this renowned Korean highland venue. The combination is considered the most scenic and demanding of SHILLA's three routings.",
  },

  // LIV / Premium
  {
    name: 'Trump National Golf Club',
    location: 'Bedminster, NJ',
    par: 72,
    flag: '🇺🇸',
    category: 'championship',
    description: "Rolling through 600 acres of pristine New Jersey countryside, Trump National Bedminster has hosted the PGA Championship and U.S. Women's Open on its Tom Fazio-designed layouts. Dramatic water features, waterfalls, and mature hardwood forests frame every hole.",
  },
  {
    name: 'Centurion Club',
    location: 'St Albans, UK',
    par: 72,
    flag: '🇬🇧',
    category: 'parkland',
    description: "A private parkland gem set in Hertfordshire north of London, the Centurion Club hosted the inaugural LIV Golf event in 2022 and has deep roots in British golf history. Towering oaks, testing greens, and a quintessentially English atmosphere define every round.",
  },
  {
    name: 'Pumpkin Ridge Golf Club',
    location: 'North Plains, OR',
    par: 71,
    flag: '🇺🇸',
    category: 'championship',
    description: "Nestled in the Tualatin Valley wine country west of Portland, Pumpkin Ridge has hosted the U.S. Amateur, U.S. Women's Open, and multiple Nike Tour championships. Bob Cupp's design winds through dense Oregon fir forest with fast, sloped Bentgrass greens.",
  },
  {
    name: 'Valderrama',
    location: 'Sotogrande, Spain',
    par: 71,
    flag: '🇪🇸',
    category: 'championship',
    description: "Known as the Augusta National of Europe, Valderrama's dense cork oak forest and infamously diabolical par-5 17th have defined this Ryder Cup and World Golf Championship venue for decades. Seve Ballesteros personally redesigned the 17th to make it even more treacherous.",
  },
  {
    name: 'Sentosa Golf Club',
    location: 'Singapore',
    par: 71,
    flag: '🇸🇬',
    category: 'resort',
    description: "Set on the exclusive resort island just off Singapore's southern tip, Sentosa Golf Club has hosted the SMBC Singapore Open and overlooks one of the world's busiest shipping lanes. The Serapong course weaves through lush tropical foliage with dramatic sea vistas.",
  },
  {
    name: 'Stonehill Golf Course',
    location: 'Bangkok, Thailand',
    par: 72,
    flag: '🇹🇭',
    category: 'resort',
    description: "Stonehill Golf Course features a modern championship layout amid lush tropical vegetation on the outskirts of Bangkok, blending Thai landscape artistry with world-class conditioning. Wide fairways give way to creative green complexes influenced by Thailand's rich golfing tradition.",
  },
  {
    name: 'Greenbrier Old White TPC',
    location: 'White Sulphur Springs, WV',
    par: 70,
    flag: '🇺🇸',
    category: 'resort',
    description: "Dating to 1914, the Old White course at The Greenbrier is one of America's most historic resort layouts, having hosted presidents, dignitaries, and champions for over a century. The C.B. Macdonald and Seth Raynor design winds through the West Virginia mountains with classic template holes.",
  },
];

/** Look up a course by exact name */
export function getCourseByName(name: string): Course | undefined {
  return ALL_COURSES.find(c => c.name === name);
}

/** Pick a random course from the full list */
export function getRandomCourse(): Course {
  return ALL_COURSES[Math.floor(Math.random() * ALL_COURSES.length)];
}

/** Pick N unique random courses */
export function getRandomCourses(count: number): Course[] {
  const shuffled = [...ALL_COURSES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
