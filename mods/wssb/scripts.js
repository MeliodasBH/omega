'use strict';

//require('sugar');

exports.BattleScripts = {
	randomWispStaffBrosTeam: function (side) {
		let userid = toId(side.name);
		let team = [];
		// Hardcoded sets of the available Pokemon.
		let sets = {
			// Admins.
			' jd': {
				species: 'Unown', ability: 'I\'m Not Staff', item: 'Choice Specs', gender: '',
				moves: ['Hidden Power'],
				baseSignatureMove: 'imnotsupposedtobehere', signatureMove: "I'm not supposed to be here",
				evs: {hp:4, spa:252, spe:252}, nature: 'Modest',
			},
			'~Kanabae': {
				species: 'Mawile-Mega', ability: 'Guard Skill: Harmonics', item: 'Leftovers', gender: 'F',
				moves: ['meteormash', 'suckerpunch', 'earthquake'],
				baseSignatureMove: 'guardskillhandsonic', signatureMove: "Guard Skill: Hand Sonic",
				evs: {hp:252, atk:252, def: 4}, nature: 'adamant',
			},
			'~Tailz': {
				species: 'Arcanine', ability: 'I\'m AFK', item: 'leftovers', gender: 'M',
				moves: ['flareblitz', 'extremespeed', 'earthquake'],
				baseSignatureMove: 'huh', signatureMove: "HUH?",
				evs: {hp:4, atk:252, spe:252}, nature: 'adamant',
			},
			'&Fеlicette': {
				species: 'Smeargle', ability: 'Doodles', item: 'Life Orb', gender: 'Random',
				moves: ['protect', 'boomburst', 'seedflare'],
				baseSignatureMove: 'supersketchy', signatureMove: "Super Sketchy",
				evs: {spa: 252, spd: 252, spe: 4}, nature: 'modest',
			},
			'&Nii sama': {
				species: 'Darkrai', ability: 'Goodnight', item: 'Life Orb',
				moves: ['shadowball', 'dreameater', 'nastyplot'],
				baseSignatureMove: 'shadowdrain', signatureMove: "Shadow Drain",
				evs: {hp:96, spa:252, spe: 160}, nature: 'bold',
			},
			'@13490ufd': {
				species: 'Pikachu-Cosplay', ability: 'Pika Power', item: 'Light Ball', gender: 'M',
				moves: ['nuzzle', 'knockoff', 'thunderbolt'],
				baseSignatureMove: 'donttouchme', signatureMove: "Don\'t touch me",
				evs: {hp:252, spd:4, spe:252}, nature: 'bold',
			},
			'@Alpha Ninja': {
				species: 'Weedle', ability: '420 Blaze It', item: 'Safety	Goggles', gender: 'F',
				moves: ['protect', 'sludgewave', 'bugbuzz'],
				baseSignatureMove: 'memequake', signatureMove: "Meme Quake",
				evs: {spa: 252, spd: 4, spe:252}, nature: 'timid',
			},
			'@Doctor Charizard': {
				species: 'Charizard-Mega-X', ability: 'Dragon\'s Flames', item: 'Life Orb', gender: 'M',
				moves: ['flareblitz', 'roost', 'firepunch', ' dragondance', 'dragonclaw', 'outrage', 'earthquake', 'shadowclaw', 'doubleedge', 'protect'],
				baseSignatureMove: 'dragonsrevenge', signatureMove: "Dragon\'s Revenge",
				evs: {hp:4, atk:252, spe:252}, nature: 'jolly',
			},
			'@LotusChamp Torpid': {
				species: 'zapdos', ability: 'stopbeingop', item: 'Leftovers', gender: 'M',
				moves: ['discharge', 'heatwave', 'roost'],
				baseSignatureMove: 'memedreams', signatureMove: "Meme Dreams",
				evs: {hp:252, def:4, spd:252}, nature: 'calm',
			},
			'@Rabinov': {
				species: 'Scyther', ability: 'Dread Armour', item: 'Eviolite', gender: 'F',
				moves: ['megahorn', 'boltstrike', 'crabhammer', 'crosschop', 'bravebird', 'headsmash', 'flareblitz', 'roost'],
				baseSignatureMove: 'miasmicstrike', signatureMove: "Miasmic Strike",
				evs: {hp:4, atk:252, spe:252}, nature: 'jolly',
			},
			'@Wisp Bot': {
				species: 'Ninetales', ability: 'Hot Memes', item: 'leftovers', gender: 'F', shiny: true,
				moves: ['shadowball', 'solarbeam', 'morningsun'],
				baseSignatureMove: 'mixtape', signatureMove: "Mixtape",
				evs: {hp:4, spa:252, spe:252}, nature: 'modest',
			},
			'@Viktria👻': {
				species: 'Banette-Mega', ability: 'Marionette\'s Mayhem', item: 'brightpowder', gender: 'F', happiness: 0,
				moves: ['frustration', 'spikyshield', 'shadowforce'],
				baseSignatureMove: 'noticemesenpai', signatureMove: "Notice Me, Senpai ❤ ~ !",
				evs: {hp:252, atk:252, def:4}, nature: 'adamant',
			},
			'@SuperJeenius': {
				species: 'Manaphy', ability: 'Imbue', item: 'Leftovers', gender: 'M',
				moves: ['blizzard', 'inferno', 'energyball'],
				baseSignatureMove: 'cleanwateract', signatureMove: "Clean Water Act",
				evs: {hp:4, spa:252, spe:252}, nature: 'Timid',
			},
			'%Alan KH': {
				species: 'Venusaur-Mega', ability: 'Bio-Fuel', item: 'Big Root', gender: 'M',
				moves: ['gigadrain', 'oblivionwing', 'drainingkiss'],
				baseSignatureMove: 'divineroots', signatureMove: "Divine Roots",
				evs: {hp:252, def:252, spd:4}, nature: 'bold',
			},
			'%Chief Sokka': {
				species: 'Chansey', ability: 'Pain Killers', item: 'Eviolite', gender: 'M',
				moves: ['heal bell', 'softboiled', 'psychic'],
				baseSignatureMove: 'clumsysurgeon', signatureMove: "Clumsy Surgeon",
				evs: {hp: 252, def: 252, spd: 4}, nature: 'Bold',
			},
			'%Chimechoo': {
				species: 'Ralts', ability: 'Emotional', item: 'Eviolite', gender: 'F',
				moves: ['moonblast', 'recover', 'earthpower'],
				baseSignatureMove: 'mindshock', signatureMove: "Mind Shock",
				evs: {def:4, spa:252, spe:252}, nature: 'timid',
			},
			'%Emg TechP Volco': {
				species: 'Volcanion', ability: 'Volcanic Ash', item: 'Assault Vest', gender: "M", shiny: true,
				moves: ['earthpower', 'blueflare', 'gigadrain'],
				baseSignatureMove: 'volcanosrevenge', signatureMove: "Volcano's Revenge",
				evs: {hp:4, spa:252, spe:252}, nature: 'modest',
			},
			'%iSandman': {
				species: 'Landorus', ability: 'God\'s Force', item: 'Life Orb', gender: 'M',
				moves: ['rockpolish', 'sludgewave', 'focusblast'],
				baseSignatureMove: 'antigravityfissure', signatureMove: "Anti Gravity Fissure",
				evs: {spa:252, spd:4, spe:252}, nature: 'modest',
			},
			'%Master Float': {
				species: 'Floatzel', ability: 'Magic Aura', item: 'Focus Sash', gender: 'M',
				moves: ['waterfall', 'extremespeed', 'sacredfire', 'boltstrike'],
				baseSignatureMove: 'watermirror', signatureMove: "Water Mirror",
				evs: {hp:4, atk:252, spe:252}, nature: 'Jolly',
			},
			'%Combo Breaker': {
				species: 'Gardevoir-Mega', ability: 'Combo Breaker', item: 'Assault Vest', gender: 'Male', shiny: true,
				moves: ['focusblast', 'psyshock', 'shadowball'],
				baseSignatureMove: 'starbomber', signatureMove: "Starbomber!",
				evs: {hp:8, atk:252, spe:248}, nature: 'Modest',
			},
			'+AB Dominicarus': {
				species: 'Tornadus-Therian', ability: 'Elemental No Guard', item: 'Sitrus Berry', gender: 'M', shiny: true,
				moves: ['seedflare', 'thief', 'taunt'],
				baseSignatureMove: 'hurricaneofatomsk', signatureMove: "Hurricane of Atomsk",
				evs: {spa:252, spd: 4, spe:252}, nature: 'Modest',
			},
			'+Alliance Aegis': {
				species: 'Serperior', ability: 'Regal Eye', item: 'Life Orb', gender: 'M', shiny: true,
				moves: ['leafstorm', 'dracometeor', 'overheat'],
				baseSignatureMove: 'collapsation', signatureMove: "Collapsation",
				evs: {hp:4, spa:252, spe:252}, nature: 'timid',
			},
			'+ArkenCiel': {
				species: 'Gallade-Mega', ability: 'Abyss', item: 'Life Orb', gender: 'M', shiny: true,
				moves: ['reversal', 'flail', 'hyperspacefury'],
				baseSignatureMove: 'instillfear', signatureMove: "Instill Fear",
				evs: {hp:4, atk:252, spe:252}, ivs: {hp:0, atk:31, def:0, spa:31, spd:0, spe:31}, nature: 'Naive',
			},
			'+Crystal Xman': {
				species: 'infernape', ability: 'Tipper', item: 'Life Orb', gender: 'M',
				moves: ['closecombat', 'flareblitz', 'machpunch'],
				baseSignatureMove: 'shieldbreaker', signatureMove: "Shield Breaker",
				evs: {hp:4, atk:252, spe:252}, nature: 'Jolly',
			},
			'+Escoffier': {
				species: 'Dedenne', ability: 'Sanic', item: 'Life Orb', gender: 'M',
				moves: ['voltswitch', 'uTurn', 'playrough'],
				baseSignatureMove: 'gottem', signatureMove: "GOTTEM",
				evs: {atk:252, spa:4, spe:252}, nature: 'naive',
			},
			/*'+Skyla (Full)': {
				species: 'Sylveon', ability: 'Uncompetitive', item: 'Life Orb',
				moves: ['shadowball', 'acupuncture', 'wish'],
				baseSignatureMove: 'ebat', signatureMove: "/ebat",
				evs: {hp:252, spa:232, spe:20}, nature: 'Modest',
			},*/
			'+Pegasus Jane': {
				species: 'Milotic', ability: 'Goddess of Seas', item: 'Leftovers', gender: 'F',
				moves: ['scald', 'toxic', 'rest'],
				baseSignatureMove: 'aquaticlight', signatureMove: "Aquatic Light",
				evs: {hp:252, def:252, spd: 4}, nature: 'Bold',
			},
			'+Sam Crowe': {
				species: 'Crobat', ability: 'Crowe Bat', item: 'Black Sludge', gender: 'F', shiny: true,
				moves: ['bravebird', 'roost', 'crosspoison'],
				baseSignatureMove: 'thirstysam', signatureMove: "Thirsty Sam",
				evs: {atk:252, spd: 4, spe:252}, nature: 'jolly',
			},
			'+snow': {
				species: 'Shaymin-Sky', ability: 'Fury of Nature', item: 'Life Orb',
				moves: ['airslash', 'seedflare', 'earthpower', 'hiddenpowerice'],
				baseSignatureMove: 'windblades', signatureMove: "Wind Blades ",
				evs: {hp:4, spa:252, spe:252}, nature: 'Timid',
			},
			'+St SkyMFall': {
				species: 'Archeops', ability: 'Falling Skies', item: 'Leftovers', gender: '',
				moves: ['uturn', 'bravebird', 'stoneedge'],
				baseSignatureMove: 'gitgudfam', signatureMove: "Git Gud Fam",
				evs: {hp:4, atk:252, spe:252}, nature: 'jolly',
			},
			'+Silveee': {
				species: 'Absol-Mega', ability: 'Dank Aura', item: 'Black Glasses', gender: 'F',
				moves: ['vcreate', 'extremespeed', 'boomburst'],
				baseSignatureMove: 'serverbreak', signatureMove: "Server Break",
				evs: {atk:252, spa:4, spe:252}, nature: 'naive',
			},
			// no longer staff...
			/*' Mіdnight Prоf ΕХΟ': {
				species: 'Umbreon', ability: 'Twilight Shield', item: 'Leftovers', gender: 'F', shiny: true,
				moves: ['wish', 'curse', 'protect'],
				baseSignatureMove: 'darkcausatum', signatureMove: "Dark Causatum",
				evs: {hp: 252, spd: 252, def: 4}, nature: 'careful',
			},*/
			// no longer staff
			/*' Wаndo': {
				species: 'Pichu', ability: 'Memes', item: 'Choice band', gender: 'M',
				moves: ['harden', 'splash', 'celebrate'],
				baseSignatureMove: 'nuke', signatureMove: "NUKE ",
				evs: {hp:4, atk:252, spe:252}, nature: 'adamant',
			},*/
		};
		// Generate the team randomly.
		let pool = Tools.shuffle(Object.keys(sets));
		let levels = {'~':99, '&':98, '@':97, '%':96, '$':95, '+':95, ' ': 94};
		for (let i = 0; i < 6; i++) {
			if (i === 1) {
				let monIds = pool.slice(0, 6).map(function (p) {
					return toId(p);
				});
				let monName;
				for (let mon in sets) {
					if (toId(mon) === userid) {
						monName = mon;
						break;
					}
				}
				if (monIds.indexOf(userid) === -1 && monName) {
					pool[2] = monName;
				}
			}
			let rank = pool[i].charAt(0);
			let set = sets[pool[i]];
			set.level = levels[rank];
			set.name = pool[i];
			if (!set.ivs) {
				set.ivs = {hp:31, atk:31, def:31, spa:31, spd:31, spe:31};
			} else {
				for (let iv in {hp:31, atk:31, def:31, spa:31, spd:31, spe:31}) {
					set.ivs[iv] = set.ivs[iv] ? set.ivs[iv] : 31;
				}
			}
			// Assuming the hardcoded set evs are all legal. LOLOLOLOLOL
			if (!set.evs) set.evs = {hp:84, atk:84, def:84, spa:84, spd:84, spe:84};
			set.moves = [this.sampleNoReplace(set.moves), this.sampleNoReplace(set.moves), this.sampleNoReplace(set.moves)].concat(set.signatureMove);
			team.push(set);
		}
		// Check for Illusion.
		if ((team[5].name === '+Illusio' && team[4].name === '+Kit Kasai') || (team[4].name === '+Illusio' && team[5].name === '+Kit Kasai')) {
			let temp = team[3];
			team[3] = team[5];
			team[5] = temp;
		} else if (team[5].name === '+Illusio' || team[5].name === '+Kit Kasai') {
			let temp = team[4];
			team[4] = team[5];
			team[5] = temp;
		}
		return team;
	},
	canMegaEvo: function (pokemon) {
		let altForme = pokemon.baseTemplate.otherFormes && this.getTemplate(pokemon.baseTemplate.otherFormes[0]);
		if (altForme && altForme.isMega && altForme.requiredMove && pokemon.moves.indexOf(toId(altForme.requiredMove)) >= 0) return altForme.species;
		let item = pokemon.getItem('');
		if (item.megaEvolves !== pokemon.baseTemplate.baseSpecies || item.megaStone === pokemon.species) return false;
		return item.megaStone;
	},
	runMegaEvo: function (pokemon) {
		let template = this.getTemplate(pokemon.canMegaEvo);
		let side = pokemon.side;

		// Pokémon affected by Sky Drop cannot mega evolve. Enforce it here for now.
		let foeActive = side.foe.active;
		for (let i = 0; i < foeActive.length; i++) {
			if (foeActive[i].volatiles['skydrop'] && foeActive[i].volatiles['skydrop'].source === pokemon) {
				return false;
			}
		}

		pokemon.formeChange(template);
		pokemon.baseTemplate = template; // mega evolution is permanent
		pokemon.details = template.species + (pokemon.level === 100 ? '' : ', L' + pokemon.level) + (pokemon.gender === '' ? '' : ', ' + pokemon.gender) + (pokemon.set.shiny ? ', shiny' : '');
		this.add('detailschange', pokemon, pokemon.details);
		this.add('-mega', pokemon, template.baseSpecies, template.requiredItem);
		pokemon.setAbility(template.abilities['0']);
		pokemon.baseAbility = pokemon.ability;

		// Limit one mega evolution
		for (let i = 0; i < side.pokemon.length; i++) {
			side.pokemon[i].canMegaEvo = false;
		}
		return true;
	},
};
