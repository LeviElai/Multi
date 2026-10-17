// Curated clues keep Guess playable without paying a model to invent definitions.
// Artwork and clue banks are bundled once, rather than stored per account.
type Entry=readonly [word:string,clue:string];
const football:Entry[]=[
 ['GOAL','The score awarded when the ball crosses the line between the posts and beneath the crossbar.'],
 ['KEEPER','The player tasked with guarding the net.'],
 ['STRIKER','An attacking player whose main job is to score.'],
 ['PITCH','The playing field used for a football match.'],
 ['PASS','Send the ball to a teammate.'],
 ['TACKLE','Challenge an opponent to win possession of the ball.'],
 ['CORNER','A restart taken from where the side and end lines meet.'],
 ['HEADER','A shot or pass made using the head.'],
 ['WHISTLE','The small instrument a referee blows to stop play.'],
 ['REFEREE','The official who enforces the rules on the field.'],
 ['DEFENDER','A player whose main job is to stop opponents from scoring.'],
 ['NET','The mesh stretched behind the posts.'],
 ['BOOT',"A player's studded shoe."],
 ['TEAM','A group of players competing together.'],
 ['MATCH','A contest between two football sides.'],
 ['LEAGUE','A competition in which clubs earn places in a table.'],
 ['CAPTAIN','The player chosen to lead the side on the field.'],
 ['CROSS','A ball sent across the field toward the area in front of the net.'],
 ['PENALTY','A kick taken from the spot after a qualifying foul inside the area.'],
 ['STADIUM','A large sporting venue with a field and seating for spectators.'],
 ['BENCH','Where substitutes sit while waiting to play.'],
 ['SCORE','The tally of goals in a match.'],
 ['PRESS','Try to regain the ball by closing down opponents.'],
];
const space:Entry[]=[
 ['ORBIT','The path of one celestial body around another.'],['COMET','An icy visitor that can develop a glowing tail near the Sun.'],
 ['ROCKET','A vehicle propelled by expelling hot gas.'],['GALAXY','A huge system of stars, gas and dust held together by gravity.'],
 ['PLANET','A large world circling a star.'],['MOON','A natural satellite of a planet.'],['STAR','A luminous ball of hot gas, like the Sun.'],
 ['CRATER','A bowl-shaped depression left by an impact.'],['METEOR','The bright streak seen when a space rock burns through the atmosphere.'],
 ['ASTEROID','A rocky body smaller than a planet that travels around the Sun.'],['TELESCOPE','An instrument used to view distant objects in the sky.'],
 ['LUNAR','An adjective meaning related to the Moon.'],['SOLAR','An adjective meaning related to the Sun.'],['GRAVITY','The attraction that keeps your feet on the ground.'],
 ['ECLIPSE','An event in which one celestial body blocks the view or light of another.'],['COSMOS','Another word for the universe.'],
 ['SATELLITE','An object that travels around a larger body in space.'],['NEBULA','A cloud of gas and dust in space.'],['LAUNCH','Send a spacecraft on its journey.'],
 ['CAPSULE','The enclosed compartment in which a spacecraft crew can travel.'],
];
const nature:Entry[]=[
 ['ACORN','The hard-shelled fruit of an oak tree.'],['FOREST','A large area covered mainly with trees.'],['LEAF','The usually flat, green part of a plant that catches sunlight.'],
 ['ROOT','The part of a plant that anchors it and absorbs water.'],['FLOWER','The blossom of a plant.'],['RIVER','A natural flowing watercourse.'],
 ['OCEAN','One of the great connected bodies of salt water on Earth.'],['DESERT','A region that receives very little precipitation.'],
 ['MOUNTAIN','A natural rise of land much higher than the surrounding area.'],['POLLEN','The fine powder produced by the male parts of flowers.'],
 ['BIRD','A feathered animal with a beak.'],['FISH','An aquatic animal that typically breathes through gills.'],['MAMMAL','An animal whose young are fed with milk.'],
 ['INSECT','A small animal with six legs and three main body sections.'],['FEATHER',"One of the light structures covering a bird's body."],
 ['NEST','A structure in which a bird can lay its eggs.'],['SEED','A plant structure from which a new plant can grow.'],['BARK','The outer covering of a tree trunk.'],
 ['MOSS','A small, soft green plant that often grows in damp places.'],['MEADOW','An open area of grassland, often filled with wildflowers.'],
];
const everyday:Entry[]=[
 ['BRIDGE','A structure that carries a path across a gap.'],['CLOCK','An instrument that displays the time.'],['POCKET','A small pouch sewn into clothing.'],
 ['PENCIL','A writing tool with a graphite core.'],['MIRROR','A surface that reflects your image.'],['WINDOW','An opening with glass that lets light into a room.'],
 ['CANDLE','A stick of wax with a wick that burns for light.'],['LADDER','Two side rails joined by steps for climbing.'],['BASKET','A container woven from strips of material.'],
 ['BUTTON','A small fastener pushed through a hole in clothing.'],['ANCHOR','A heavy object lowered to hold a boat in place.'],['COMPASS','An instrument with a needle that points north.'],
 ['RIBBON','A narrow strip of fabric used for tying or decorating.'],['GARDEN','A plot where flowers or vegetables are grown.'],['SHELF','A flat surface fixed to a wall for holding objects.'],
 ['DOOR','A movable barrier at the entrance to a room.'],['PILLOW','A soft cushion that supports your head while sleeping.'],['BLANKET','A large covering used to keep warm in bed.'],
 ['SCREEN','The flat display on which you see a computer image.'],['KEYBOARD','A set of keys used to type into a computer.'],
];
export const WORD_BANKS=[football,space,nature,everyday] as const;
export function curatedWord(topic:string,suggestion:string,used:Set<string>):Entry{
 const bank=/football|soccer/i.test(topic)?football:/space|astronom|planet|solar|galax/i.test(topic)?space:/nature|animal|plant|forest|wildlife|bird|ocean/i.test(topic)?nature:everyday;
 const available=bank.filter(([word])=>!used.has(word));
 const choices=available.length?available:bank;
 const normalized=suggestion.trim().toUpperCase();
 const selected=choices.find(([word])=>word===normalized)??choices[crypto.getRandomValues(new Uint32Array(1))[0]%choices.length];
 used.add(selected[0]);return selected;
}
