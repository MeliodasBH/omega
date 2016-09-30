'use strict';

let database = new sqlite3.Database('config/psgo.db', function () {
	database.run("CREATE TABLE IF NOT EXISTS cards (userid TEXT, uid TEXT, id TEXT, rarity TEXT, points INTEGER)");
	database.run("CREATE TABLE IF NOT EXISTS cardladder (userid TEXT UNIQUE, points INT)");
	database.run("CREATE TABLE IF NOT EXISTS trades (id TEXT, fromUser TEXT, toUser TEXT, fromCard TEXT, toCard TEXT)");
});

const fs = require('fs');
const uuid = require('uuid');

let cardData = {};
let sortedCards = {};
let shop = {};
let packs = {};

let managers = [];
let shopPacks = [];
let claimPacks = [];
if (!Users.userPacks) Users.userPacks = [];


try {
	cardData = JSON.parse(fs.readFileSync('./config/psgo/card-data.json', 'utf8'));
} catch (e) {}
try {
	shop = JSON.parse(fs.readFileSync('./config/psgo/shop.json', 'utf8'));
	for (let i in shop) {
		shopPacks.push(shop[i].name);
		if (shop[i].price === 10) claimPacks.push(shop[i].name);
	}
} catch (e) {}
try {
	packs = JSON.parse(fs.readFileSync('./config/psgo/packs.json', 'utf8'));
} catch (e) {}
try {
	managers = fs.readFileSync('./config/psgo/card-managers.csv', 'utf8').split(',');
} catch (e) {}

const colors = {
	mythic: '#D82A2A',
	legendary: '#E8AB03',
	epic: '#73DF14',
	rare: '#2DD1B6',
	uncommon: '#2D3ED1',
	common: '#000',
};

const tourRarity = ['No Card', 'Common', 'Uncommon', 'Rare', 'Epic', 'Epic', 'Legendary', 'Legendary', 'Mythic'];
const cardRarity = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

function sortCards() {
	// sortedCards.rarity.pack.cardid
	sortedCards = {};
	for (let card in cardData) {
		let cur = cardData[card];
		if (!sortedCards[toId(cur.rarity)]) sortedCards[toId(cur.rarity)] = {};
		for (let set in cur.collection) {
			if (!sortedCards[toId(cur.rarity)][toId(cur.collection[set])]) sortedCards[toId(cur.rarity)][toId(cur.collection[set])] = [];
			sortedCards[toId(cur.rarity)][toId(cur.collection[set])].push(cur.id);
		}
	}
	Rooms.sortedCards = sortedCards;
}
sortCards();

function saveCards() {
	let data = "{\n";
	for (let u in cardData) {
		data += '\t"' + u + '": ' + JSON.stringify(cardData[u]) + ",\n";
	}
	data = data.substr(0, data.length - 2); // remove the last comma
	data += "\n}";
	fs.writeFileSync('config/psgo/card-data.json', data);
}

function log(message) {
	if (!message) return false;
	fs.appendFile('logs/psgo.log', '[' + new Date().toUTCString() + '] ' + message + '\n');
}

Wisp.tourCard = function (tourSize, userid) {
	if (tourSize > 32) tourSize = 32;
	let rarity = toId(tourRarity[Math.floor(tourSize / 4)]);
	if (rarity === 'No Card') return; // var rand = myArray[Math.floor(Math.random() * myArray.length)];

	let randPack = Object.keys(sortedCards[rarity])[Math.floor(Math.random() * Object.keys(sortedCards[rarity]).length)];
	let rand = Math.round(Math.random() * (sortedCards[rarity][randPack].length - 1));
	let card = cardData[sortedCards[rarity][randPack][rand]];

	addCard(userid, card.id);
	return [colors[toId(card.rarity)], card.rarity, card.id, card.name];
};

function updatePoints(user) {
	let userid = toId(user);
	database.all("SELECT SUM(points) FROM cards WHERE userid=$userid;", {$userid: userid}, function (err, rows) {
		if (err) return console.log("updatePoints 1: " + err);
		let points = rows[0]['SUM(points)'];
		database.run("UPDATE cardladder SET points=$points WHERE userid=$userid;", {$points: points, $userid: userid}, function (err) {
			if (err) return console('updatePoints 2: ' + err);
			database.run("INSERT OR IGNORE INTO cardladder (userid, points) VALUES ($userid, $points)", {$userid: userid, $points: points}, function (err) {
				if (err) return console.log("updatePoints 3: " + err);
			});
		});
	});
}

function addCard(name, card, callback) {
	if (!cardData[card]) return false;
	let userid = toId(name);
	database.run("INSERT INTO cards(userid, uid, id, rarity, points) VALUES ($userid, $uid, $id, $rarity, $points)",
		{
			$userid: userid, $uid: uuid.v1(), $id: cardData[card].id,
			$rarity: cardData[card].rarity, $points: cardData[card].points,
		}, function (err) {
			if (err) return console.log("addCard: " + err);
			updatePoints(userid);
			if (callback) return callback();
		});
}
Wisp.addCard = addCard;

function getCards(name, callback) {
	let userid = toId(name);
	database.all("SELECT * FROM cards WHERE userid=$userid", {$userid: userid}, function (err, rows) {
		if (err) return console.log('getCards: ' + err);
		if (rows.length < 1) return callback(false);
		let cardIds = [];
		for (let u in rows) cardIds.push(rows[u].id);
		return callback(cardIds);
	});
}

function takeCard(userid, card, callback) {
	userid = toId(userid);
	card = toId(card);
	database.all("SELECT * FROM cards WHERE userid=$userid AND id=$card", {$userid: userid, $card: card}, function (err, rows) {
		if (err) return console.log("takeCard 1: " + err);
		if (rows.length < 1) {
			if (callback) return callback(false);
		} else {
			database.run("DELETE FROM cards WHERE userid=$userid AND uid=$uid", {$userid: userid, $uid: rows[0].uid}, function (err) {
				if (err) return console.log("takeCard 3: " + err);
				updatePoints(userid);
				if (callback) return callback(true);
			});
		}
	});
}

function takeAllCards(card, callback) {
	card = toId(card);
	database.all("SELECT userid, points FROM cards WHERE id=$card", {$card: card}, function (err, rows) {
		database.run("DELETE FROM cards WHERE id=$card", {$card: card}, function (err) {
			if (err) return console.log("takeCard 3: " + err);
			for (let u in rows) {
				updatePoints(rows[u].userid);
			}
		});
	});
}
Wisp.takeAllCards = takeAllCards;
function getPoints(userid, callback) {
	database.all("SELECT SUM(points) FROM cards WHERE userid=$userid;", {$userid: userid}, function (err, rows) {
		if (err) return console.log("getPoints 1: " + err);
		return callback((rows[0]['SUM(points)'] ? rows[0]['SUM(points)'] : 0));
	});
}

function getShopDisplay(shop) {
	let display = "<table width='100%' border='1' style='border-collapse: collapse; color: #444; box-shadow: 2px 3px 5px rgba(0, 0, 0, 0.2);' cellpadding='5'>" +
		"<tr><th class='card-th' style='background-image: -moz-linear-gradient(center top , #EBF3FC, #DCE9F9); box-shadow: 0px 1px 0px rgba(255, 255, 255, 0.8) inset;'>Command</th><th class='card-th' style='background-image: -moz-linear-gradient(center top , #EBF3FC, #DCE9F9); box-shadow: 0px 1px 0px rgba(255, 255, 255, 0.8) inset;'>Description</th><th class='card-th' style='background-image: -moz-linear-gradient(center top , #EBF3FC, #DCE9F9); box-shadow: 0px 1px 0px rgba(255, 255, 255, 0.8) inset;'>Cost</th></tr>";
	for (let u in shop) {
		display += "<tr>" + "<td class='card-td'><button name='send' value='/buypack " + u + "' style='border-radius: 12px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2) inset;'><b>" + Tools.escapeHTML(shop[u].name) + "</b></button></td>" +
			"<td class='card-td'>" + Tools.escapeHTML(shop[u].desc) + "</td>" +
			"<td class='card-td'>" + shop[u].price + "</td>" +
			"</tr>";
	}
	display += "</table><center>To buy a pack from the shop, use /buypack <em>pack</em>.</center>";
	return display;
}

function claimPackPopup(user, message) {
	if (!user.lastClaimCmd) user.lastClaimCmd = "claimpackcmd2";

	let cmd = (user.lastClaimCmd === "claimpackcmd" ? "claimpackcmd2" : "claimpackcmd");
	let output = "";
	if (message) output += message + "<br />";
	output += '<small>(note: you can use /claimpacks to return to this popup)</small><br />';
	output += '<table border="0" cellpadding="3" cellspacing="0">';
	let count = 0;
	for (let u in claimPacks) {
		if (count === 0) output += '<tr>';
		output += '<td><button name="send" value="/' + cmd + ' ' + toId(claimPacks[u]) + '">' + Tools.escapeHTML(claimPacks[u]) + '</button></td>';
		count++;
		if (count >= 5) {
			output += '</tr>';
			count = 0;
		}
	}
	user.popup("|wide||modal||html|" + output);
}
Wisp.claimPackPopup = claimPackPopup;

function saveShop() {
	fs.writeFileSync('./config/psgo/shop.json', JSON.stringify(shop));
	shopPacks = [];
	claimPacks = [];
	for (let i in shop) {
		shopPacks.push(shop[i].name);
		if (shop[i].price === 10) claimPacks.push(shop[i].name);
	}
}

function showPacks(user) {
	if (!Users.userPacks[user] || Users.userPacks[user].length < 1) return (user === user.userid ? 'You have' : user + ' has') + ' no packs.';
	let output = '<div class="infobox infobox-limited"<u><b>List of packs:</b></u>';
	for (let i = 0; i < Users.userPacks[user].length; i++) {
		output += '<br /><button name="send" value="/openpack ' + Users.userPacks[user][i] + '"> Press to open <b>' + Tools.escapeHTML(packs[Users.userPacks[user][i]]) + '</b> pack</button>';
	}
	output += '</div>';
	return output;
}

function sortShowcaseBy(userid, sortBy) {
	userid = toId(userid);
	Wisp.database.all("SELECT * FROM users WHERE userid=$userid", {$userid: userid}, function (err, rows) {
		if (err) return console.log("sortShowcaseBy 1: " + err);
		if (rows.length < 1) {
			Wisp.database.run("INSERT INTO users(userid, showcaseSort) VALUES ($userid, $sortBy)", {$userid: userid, $sortBy: sortBy}, function (err) {
				if (err) return console.log("sortShowcaseBy 2: " + err);
			});
		} else {
			Wisp.database.run("UPDATE users SET showcaseSort=$sortBy WHERE userid=$userid", {$sortBy: sortBy, $userid: userid}, function (err) {
				if (err) return console.log("sortShowcaseBy 3: " + err);
			});
		}
	});
}

function logTrade(message) {
	if (!message) return false;
	fs.appendFile('logs/trades.log', '[' + new Date().toUTCString() + '] ' + message + '\n');
}

exports.commands = {
	claimpack: 'claimpacks',
	claimpacks: function (target, room, user) {
		if (!user.claimPacks || user.claimPacks < 1) return this.errorReply("You have no packs to claim.");
		claimPackPopup(user, "You have " + user.claimPacks + " more " + (user.claimPacks === 1 ? "pack" : "packs") + " to claim.");
	},

	claimpackcmd2: 'claimpackcmd',
	claimpackcmd: function (target, room, user, connection, cmd) {
		if (!target) return this.parse("/help claimpack");
		if (!user.claimPacks || user.claimPacks < 1) return user.popup("You need to purchase a ticket before you can claim packs.");
		if (user.lastClaimCmd && user.lastClaimCmd === cmd) return;
		let claimPackIds = [];
		for (let i in claimPacks) claimPackIds.push(toId(claimPacks[i]));
		if (!claimPackIds.includes(toId(target))) return user.popup("That's not a valid pack to claim.");

		user.lastClaimCmd = cmd;
		user.claimPacks--;

		if (!Users.userPacks[user.userid]) Users.userPacks[user.userid] = [];
		Users.userPacks[user.userid].push(toId(target));

		this.sendReplyBox('You have claimed the pack "' + Tools.escapeHTML(target) + '"<br /><button name="send" value="/openpack ' + toId(target) + '">Use <b>/openpack ' + toId(target) + '</b> to open</button>');
		if (user.claimPacks > 0) return claimPackPopup(user, "You have " + user.claimPacks + " more " + (user.claimPacks === 1 ? "pack" : "packs") + " to claim.");
		user.popup("|modal|You have claimed all the packs from your ticket. See /packs to open them.");
	},
	claimpackhelp: ["/claimpack [pack] - Claims a psgo pack after you've bought a ticket."],

	psgo: {
		set: 'add',
		add: function (target, room, user) {
			if (!user.can('hotpatch') && !managers.includes(user.userid)) return this.errorReply("Access denied.");
			if (!target) return this.parse("/help psgo");
			let targets = target.split(',');
			for (let u in targets) targets[u] = targets[u].trim();
			if (!targets[5]) return this.parse("/help psgo");
			let id = toId(targets[0]), name = targets[1], image = targets[2];
			let rarity = targets[3], points = Math.round(Number(targets[4]));
			let collections = targets.slice(5);

			if (id.length < 1) return this.errorReply("ids may not be less than one character.");
			if (id.length > 30) return this.errorReply("ids may not be longer than 30 charcters.");
			if (cardData[id]) return this.errorReply("That card already exists.");
			if (name.length < 1) return this.errorReply("Names may not be less than one character.");
			if (name.length > 30) return this.errorReply("Names may not be longer than 30 characters.");
			if (image.length < 1) return this.errorReply("Invalid card image.");
			if (image.length > 100) return this.errorReply("Image URLs may not be longer than 100 characters.");
			if (!cardRarity.toString().toLowerCase().split(',').includes(rarity.toLowerCase())) return this.errorReply("Invalid rarity. (Valid rarities: " + cardRarity.join(', ') + ")");
			if (isNaN(points)) return this.errorReply("Points must be a number.");
			if (points < 1) return this.errorReply("Points must be greater than 0.");
			if (points > 100) return this.errorReply("Points may not be greater than 100.");
			for (let c in collections) {
				if (!collections[c]) return this.errorReply("Invalid collection.");
				if (toId(collections[c]).length < 1) return this.errorReply("Collection names must be longer than 1 character.");
				if (toId(collections[c]).length > 30) return this.errorReply("Collection names may not be longer than 30 characters.");
				if (!packs[toId(collections[c])]) return this.errorReply("The pack \"" + collections[c] + "\" does not exist. Add it with /psgo pack add [pack].");
				collections[c] = toId(collections[c]);
			}

			cardData[id] = {
				'id': id,
				'name': name,
				'image': image,
				'rarity': rarity,
				'collection': collections,
				'points': points,
			};
			saveCards();
			sortCards();
			log(user.name + ' has added the card "' + id + '". Name: "' + name + '". Card image: "' +
				image + '". Rarity: "' + rarity + '". Points: "' + points + '". Collection: "' + collections.join(', ') + '".');
			this.parse("/card " + id);
		},
		edit: function (target, room, user) {
			if (!user.can('hotpatch') && !managers.includes(user.userid)) return this.errorReply("Access denied.");
			if (!target) return this.parse("/help psgo");
			let targets = target.split(',');
			for (let u in targets) targets[u] = targets[u].trim();
			if (!targets[5]) return this.parse("/help psgo");
			let id = toId(targets[0]), name = targets[1], image = targets[2];
			let rarity = targets[3], points = Math.round(Number(targets[4]));
			let collections = targets.slice(5);

			if (id.length < 1) return this.errorReply("ids may not be less than one character.");
			if (id.length > 30) return this.errorReply("ids may not be longer than 30 charcters.");
			if (!cardData[id]) return this.errorReply("That card doesn't exists.");
			if (name.length < 1) return this.errorReply("Names may not be less than one character.");
			if (name.length > 30) return this.errorReply("Names may not be longer than 30 characters.");
			if (image.length < 1) return this.errorReply("Invalid card image.");
			if (image.length > 100) return this.errorReply("Image URLs may not be longer than 100 characters.");
			if (!cardRarity.toString().toLowerCase().split(',').includes(rarity.toLowerCase())) return this.errorReply("Invalid rarity. (Valid rarities: " + cardRarity.join(', ') + ")");
			if (isNaN(points)) return this.errorReply("Points must be a number.");
			if (points < 1) return this.errorReply("Points must be greater than 0.");
			if (points > 100) return this.errorReply("Points may not be greater than 100.");
			for (let c in collections) {
				if (!collections[c]) return this.errorReply("Invalid collection.");
				if (toId(collections[c]).length < 1) return this.errorReply("Collection names must be longer than 1 character.");
				if (toId(collections[c]).length > 30) return this.errorReply("Collection names may not be longer than 30 characters.");
				if (!packs[toId(collections[c])]) return this.errorReply("The pack \"" + collections[c] + "\" does not exist. Add it with /psgo pack add [pack].");
			}

			let oldData = cardData[id];
			cardData[id] = {
				'id': id,
				'name': name,
				'image': image,
				'rarity': rarity,
				'collection': collections,
				'points': points,
			};
			saveCards();
			sortCards();

			if (oldData.rarity !== cardData[id].rarity || oldData.points !== cardData[id].points) {
				database.all("UPDATE cards SET rarity=$rarity, points=$points WHERE id=$card",
				{$card: id, $rarity: cardData[id].rarity, $points: cardData[id].points},
				function (err, rows) {
					if (err) return console.log("psgo edit 1: " + err);
				});
			}

			log(user.name + ' has edited the card "' + id + '". Name: "' + name + '". Card image: "' +
				image + '". Rarity: "' + rarity + '". Points: "' + points + '". Collection: "' + collections.join(', ') + '".');
			this.parse("/card " + id);
		},
		del: 'delete',
		remove: 'delete',
		rem: 'delete',
		delete: function (target, room, user) {
			if (!user.can('hotpatch') && !managers.includes(user.userid)) return this.errorReply("Access denied.");
			if (!target) return this.parse("/help psgo");
			let card = toId(target);
			if (!cardData[card]) return this.errorReply("That card does not exist.");

			delete cardData[card];
			takeAllCards(card);
			saveCards();
			sortCards();
			this.sendReply("You've deleted the card \"" + toId(card) + "\".");
			log(user.name + " has deleted the card \"" + toId(card) + "\".");
		},
		'': function (target, room, user) {
			this.parse("/help psgo");
		},
		odds: function (target, room, user) {
			if (!this.can('psgoadmin')) return false;
			if (!target) return this.sendReply("Usage: /psgo odds [number]");
			let number = Math.round(Number(target));
			if (isNaN(number)) return this.errorReply("Please specify a valid number.");
			if (number > 10000) return this.errorReply("Please use a number less than 1000.");
			if (number < 1) return this.errorReply("Please use a number greater than 0.");
			if (!this.runBroadcast()) return;

			let pulls = {
				'common': 0,
				'uncommon': 0,
				'rare': 0,
				'epic': 0,
				'legendary': 0,
				'mythic': 0,
			};

			for (let i = 0; i < number; i++) {
				let rand = Math.floor(Math.random() * 100) + 1;
				let rarity;

				if (rand <= 33) rarity = 'common';
				if (rand >= 34 && rand <= 62) rarity = 'uncommon';
				if (rand >= 63 && rand <= 79) rarity = 'rare';
				if (rand >= 80 && rand <= 90) rarity = 'epic';
				if (rand >= 91 && rand <= 98) rarity = 'legendary';
				if (rand >= 99) rarity = 'mythic';
				pulls[rarity]++;
			}
			let output = 'Rarities from ' + number + ' random cards:';
			for (let u in pulls) {
				output += '<br /><font color="' + colors[u] + '">' + u.charAt(0).toUpperCase() + u.slice(1) + ':</font> ' + pulls[u];
				output += ' (' + Math.round((pulls[u] * 100) / number) + '%)';
			}
			this.sendReplyBox(output);
		},
		manager: {
			set: 'add',
			add: function (target, room, user) {
				if (!this.can('hotpatch')) return false;
				if (toId(target).length < 1 || toId(target).length > 19) return this.errorReply("Invalid name.");
				if (managers.includes(toId(target))) return this.errorReply("That user is already a card manager.");
				managers.push(toId(target));
				fs.writeFileSync('config/psgo/card-managers.csv', managers.join(','));
				this.sendReply("You've set " + target + " as a card manager.");
				if (Users(target) && Users(target).connected) Users(target).send("|popup||html|" + Wisp.nameColor(user.name) + " has set you as a card manager.");
				log(user.name + " set " + target + " as a card manager.");
			},
			del: 'delete',
			remove: 'delete',
			rem: 'delete',
			delete: function (target, room, user) {
				if (!this.can('hotpatch')) return false;
				if (toId(target).length < 1 || toId(target).length > 19) return this.errorReply("Invalid name.");
				if (!managers.includes(toId(target))) return this.errorReply("That user is not a card manager");
				managers.splice(managers.indexOf(toId(target)), 1);
				fs.writeFileSync('config/psgo/card-managers.csv', managers.join(','));
				this.sendReply("You've removed " + target + "'s card manager status.");
				if (Users(target) && Users(target).connected) Users(target).send("|popup||html|" + Wisp.nameColor(user.name) + " has removed your card manager status.");
				log(user.name + " removed " + target + "'s card manager status.");
			},
			view: 'list',
			list: function (target, room, user) {
				if (!this.runBroadcast()) return;
				if (managers.length < 1) return this.sendReplyBox("There are no card managers.");
				let output = [];
				for (let u in managers) output.push(Wisp.nameColor(managers[u], true));
				this.sendReplyBox("The current card managers are:<br />" + output.join(', '));
			},
			help: '',
			'': function (target, room, user) {
				if (!this.runBroadcast()) return;
				return this.sendReplyBox(
					"PSGO Card Manager commands:<br />" +
					"/psgo manager add [user] - Adds a card manager.<br />" +
					"/psgo manager remove [user] - Removes a card manager.<br />" +
					"/psgo manager list - Lists all card managers."
				);
			},
		},
		pack: {
			add: function (target, room, user) {
				if (!user.can('hotpatch') && !managers.includes(user.userid)) return this.errorReply("Access denied.");
				if (!target) return this.errorReply("Please specify a name for the pack.");
				if (target.length < 1) return this.errorReply("Pack names may not be less than one character long.");
				if (target.length > 40) return this.errorReply("Pack names may not be longer than 40 characters.");
				if (packs[toId(target)]) return this.errorReply("That pack already exists.");
				packs[toId(target)] = target;
				fs.writeFileSync('config/psgo/packs.json', JSON.stringify(packs));
				this.sendReply("The pack has been added.");
				log(user.name + " has added a pack named " + target);
			},
			delete: function (target, room, user) {
				if (!user.can('hotpatch') && !managers.includes(user.userid)) return this.errorReply("Access denied.");
				if (!target) return this.errorReply("Please specify a pack to delete.");
				if (!packs[toId(target)]) return this.errorReply("That pack does not exist.");
				delete packs[toId(target)];
				fs.writeFileSync('config/psgo/packs.json', JSON.stringify(packs));
				this.sendReply("That pack has been removed.");
				log(user.name + " has removed the pack named " + target);
			},
			list: function (target, room, user) {
				let output = [];
				for (let u in packs) output.push(packs[u]);
				this.sendReplyBox("Packs: <br />" + Tools.escapeHTML(output.join(', ')));
			},
			'': 'packhelp',
			packhelp: function (target, room, user) {
				if (!this.runBroadcast()) return;
				this.sendReplyBox(
					"PSGO Pack Admin Commands:<br />" +
					"/psgo pack add [pack name] - Adds a pack.<br />" +
					"/psgo pack delete [pack name] - Deletes a pack.<br />" +
					"/psgo pack list - Lists all packs."
				);
			},
		},
		shop: {
			add: function (target, room, user) {
				if (!user.can('hotpatch') && !managers.includes(user.userid)) return this.errorReply("Access denied.");
				if (!target) return this.parse("/help psgo");
				let targets = target.split(',');
				for (let u in targets) targets[u] = targets[u].trim();
				if (!targets[2]) return this.parse("/help psgo");
				let pack = targets[0], desc = targets[1], price = Math.round(Number(targets[2]));

				if (shop[toId(pack)]) return this.errorReply("That pack is already in the shop.");
				if (!packs[toId(pack)]) return this.errorReply("That pack does not exist.");
				pack = packs[toId(pack)];
				if (desc.length < 1) return this.errorReply("Description may not be less than one character.");
				if (desc.length > 100) return this.errorReply("Description may not be longer than 100 characters.");
				if (isNaN(price)) return this.errorReply("Price must be a number.");
				if (price < 1) return this.errorReply("Price must be at least 1 buck.");
				if (price > 100) return this.errorReply("Price may not be more than 100 bucks.");

				shop[toId(pack)] = {'name': pack, 'desc': desc, 'price': price};
				saveShop();
				log(user.name + " has added the pack " + pack + " to the pack shop.");
				this.sendReply("You've added the pack " + pack + " to the shop.");
			},
			delete: function (target, room, user) {
				if (!user.can('hotpatch') && !managers.includes(user.userid)) return this.errorReply("Access denied.");
				if (!target) return this.parse("/help psgo");
				if (!shop[toId(target)]) return this.errorReply("That pack isn't currently in the shop.");

				delete shop[toId(target)];
				saveShop();
				log(user.name + " has deleted the pack " + target + " from the pack shop.");
				this.sendReply("You've removed the pack " + target + " from the shop.");
			},
			'': 'shophelp',
			shophelp: function (target, room, user) {
				if (!this.runBroadcast()) return;
				this.sendReplyBox(
					"PSGO Shop Admin Commands:<br />" +
					"/psgo shop add [pack], [description], [price] - Adds a pack to the shop.<br />" +
					"/psgo shop delete [pack] - Deletes a pack from the shop."
				);
			},
		},
	},
	psgohelp: [
		"PSGO Adminsitrator Commands:",
		"/psgo add [id], [name], [card image], [rarity], [points], [collection(s)] (ex: XY-Promo, XY-Roaring Skies) - Adds a card.",
		"/psgo edit [id], [name], [card image], [rarity], [points], [collection(s)] (ex: XY-Promo, XY-Roaring Skies) - Edits a card.",
		"/psgo delete [id] - Deletes a card.",
		"/psgo manager add [user] - Gives a user card manager access.",
		"/psgo manager delete [user] - Removes a users card manager access.",
		"/psgo manager list - List the current card managers.",
		"/psgo pack add [pack name] - Adds a pack.",
		"/psgo pack delete [pack name] - Deletes a pack.",
		"/psgo pack list - List all the packs.",
		"/psgo shop add [pack], [description], [price] - Adds a pack to the shop.",
		"/psgo shop delete [pack] - Deletes a pack from the shop.",
		"/givepack [user], [pack] - Gives a user a pack.",
		"/takepack [user], [pack] - Takes an unopened pack from a user.",
		"/givecard [user], [card] - Gives a user a card.",
		"/takecard [user], [card] - Takes a card from a user.",
		"/deletecards - Deletes all of your cards.",
		"PSGO User Commands:",
		"/packshop - Displays the pack shop.",
		"/buypack [pack] - Buys a pack from the pack shop.",
		"/packs - Displays any unopened packs you have.",
		"/openpack [pack] - Opens a pack after you buy one.",
		"/showcase [user (optional)] - Displays a users card showcase.",
		"/sortshowcase [type] - Changes how your showcase sorts. (See /help sortshowcase)",
		"/card [card id] - Displays a card.",
		"/cardladder - Displays the card ladder.",
		"/cardsearch - Displays the card search popup.",
		"/trade [card you want to trade], [user to trade with], [card you want] - Sends a trade offer to a user.",
		"/trades - Views your pending trades.",
		"/transfercard [user], [card] - Transfers a card to another user.",
		"/transferallcards [user] - Transfers ALL of your cards to another user.",
	],

	packs: 'pack',
	pack: function (target, room, user) {
		if (!this.runBroadcast()) return;
		if (!target) target = user.name;
		target = toId(target);
		this.sendReply('|uhtml|packs-' + target + '|' + showPacks(target));
	},

	buypacks: 'buypack',
	buypack: function (target, room, user) {
		if (!target) return this.parse("/help buypack");
		let packId = toId(target);
		if (!packs[packId]) return this.sendReply("This is not a valid pack. Use /packshop to see all packs.");
		if (!shop[packId]) return this.sendReply("This pack is not currently in circulation.  Please use /packshop to see the current packs.");
		let cost = shop[packId].price;
		Economy.readMoney(user.userid, amount => {
			if (cost > amount) return this.sendReply("You need " + (cost - amount) + " more bucks to buy this pack.");
			Economy.writeMoney(user.userid, -1 * cost, () => {
				this.sendReply('|raw|You have bought ' + Tools.escapeHTML(packs[packId]) + ' pack for ' + cost + ' bucks. Use <button name="send" value="/openpack ' + packId + '"><b>/openpack ' + Tools.escapeHTML(packs[packId]) + '</b></button> to open your pack.');
				this.sendReply("You have until the server restarts to open your pack.");
				if (!Users.userPacks[user.userid]) Users.userPacks[user.userid] = [];
				Users.userPacks[user.userid].push(packId);
			});
		});
	},
	buypackhelp: ["/buypack [pack] - Buys a pack from the shop."],

	packshop: function (target, room, user) {
		if (!this.runBroadcast()) return;
		return this.sendReply('|raw|<div class="infobox" style="max-height: 310px; overflow-y: scroll;">' + getShopDisplay(shop) + '</div>');
	},

	'!openpack': true,
	openpacks: 'openpack',
	openpack: function (target, room, user) {
		if (!this.runBroadcast()) return;
		if (!target) {
			this.parse("/openpack [pack] - Opens a pack after you buy one.");
			return this.parse('/packs');
		}
		let packId = toId(target);
		if (!packs[packId]) return this.sendReply("This pack does not exist.");
		if (!Users.userPacks[user.userid] || Users.userPacks[user.userid].length < 1) return this.sendReply("You have no packs.");
		if (!Users.userPacks[user.userid].includes(packId)) return this.sendReply("You do not have this pack.");

		for (let i = 0; i < 3; i++) {
			let rand = Math.floor(Math.random() * 100) + 1;
			let rarity;

			while (!sortedCards[rarity] || !sortedCards[rarity][packId]) {
				if (rand <= 33) rarity = 'common';
				if (rand >= 34 && rand <= 62) rarity = 'uncommon';
				if (rand >= 63 && rand <= 79) rarity = 'rare';
				if (rand >= 80 && rand <= 90) rarity = 'epic';
				if (rand >= 91 && rand <= 98) rarity = 'legendary';
				if (rand >= 99) rarity = 'mythic';
				rand = Math.floor(Math.random() * 100) + 1;
			}


			let card = cardData[sortedCards[rarity][packId][Math.floor(Math.random() * sortedCards[rarity][packId].length)]];
			addCard(user.userid, card.id);

			this.sendReplyBox(Wisp.nameColor(user.name, true) + ' got a <font color="' + colors[rarity] + '">' + card.rarity + '</font> ' +
				'<button name="send" value="/card ' + card.id + '"><b>' + Tools.escapeHTML(card.name) + '</b></button> from a ' +
				'<button name="send" value="/buypack ' + packId + '">' + Tools.escapeHTML(packs[packId]) + ' Pack</button>.'
			);
		}
		Users.userPacks[user.userid].splice(Users.userPacks[user.userid].indexOf(packId), 1);
		user.send('|uhtmlchange|packs-' + user.userid + '|' + showPacks(user.userid));
	},
	openpackhelp: ["/openpack [pack] - Opens a pack after you buy one."],

	givepacks: 'givepack',
	givepack: function (target, room, user) {
		if (!this.can('psgoadmin')) return false;
		if (!target) return this.parse("/help givepack");
		let targets = target.split(',');
		for (let u in targets) targets[u] = targets[u].trim();
		if (!targets[0]) return this.parse("/help givepack");
		if (!targets[1]) return this.errorReply("Please specify a pack to give.");

		let packId = toId(targets[1]);
		let targetUser = Users(targets[0]);

		if (!packs[packId]) return this.sendReply("This pack does not exist.");
		if (!targetUser || !targetUser.connected) return this.errorReply("That user is not online.");

		if (!Users.userPacks[targetUser.userid]) Users.userPacks[targetUser.userid] = [];
		Users.userPacks[targetUser.userid].push(packId);
		this.logModCommand(user.name + " has given the pack " + packs[packId] + " to " + targetUser.name);
		this.sendReply(targetUser.name + " was given the pack " + packs[packId] + ". This user now has " + Users.userPacks[targetUser.userid].length + (Users.userPacks[targetUser.userid].length === 1 ? " pack." : " packs."));
		targetUser.popup('|html|' +
			Wisp.nameColor(user.name, true) + ' has given you the pack ' + Tools.escapeHTML(packs[packId]) + '. You have until the server restarts to open your pack.<br />'
		);
		targetUser.send(
			'|raw|<div class="infobox">' + Wisp.nameColor(user.name, true) + ' has given you the pack ' + Tools.escapeHTML(packs[packId]) +
			'. You have until the server restarts to open your pack.<br />' +
			'Use <button name="send" value="/openpack ' + packId + '"><b>/openpack ' + Tools.escapeHTML(packs[packId]) + '</b></button> to open your pack.</div>'
		);
	},
	givepackhelp: ["/givepack [user], [pack] - Gives a user a PSGO pack."],

	takepacks: 'takepack',
	takepack: function (target, room, user) {
		if (!user.can('psgoadmin')) return this.errorReply("/takepack - Access denied.");
		if (!target) return this.parse("/help takepack");
		let targets = target.split(',');
		for (let u in targets) targets[u] = targets[u].trim();
		if (!targets[0]) return this.parse("/help takepack");
		if (!targets[1]) return this.errorReply("Please specify a pack to take.");

		let packId = toId(targets[1]);
		let targetUser = Users(targets[0]);

		if (!packs[packId]) return this.sendReply("This pack does not exist.");
		if (!targetUser || !targetUser.connected) return this.errorReply("That user is not online.");
		if (!Users.userPacks[targetUser.userid]) Users.userPacks[targetUser.userid] = [];
		if (!Users.userPacks[targetUser.userid].includes(packId)) return this.sendReply("This user does not have this pack.");

		Users.userPacks[targetUser.userid].splice(Users.userPacks[targetUser.userid].indexOf(packId), 1);

		this.sendReply("You've removed the pack " + packs[packId] + " from " + targetUser.name + ". They now have " + Users.userPacks[targetUser.userid].length +
			Users.userPacks[targetUser.userid].length + (Users.userPacks[targetUser.userid].length === 1 ? " pack." : " packs."));
		targetUser.popup('|html|' + Wisp.nameColor(user.name, true) + " has taken the pack " + Tools.escapeHTML(packs[packId]) + " from you.<br />" +
			"You now have " + Users.userPacks[targetUser.userid].length + Users.userPacks[targetUser.userid].length + (Users.userPacks[targetUser.userid].length === 1 ? " pack." : " packs."));
	},
	takepackhelp: ["/takepack [user], [pack] - Takes an unopened pack from a user."],

	showcasesort: 'sortshowcase',
	sortshowcase: {
		help: '',
		'': function (target, room, user) {
			this.sendReplyBox(
				"Usage: /sortshowcase [type]<br />" +
				"/sortshowcase alphabetical - Sorts alphabetically by card id.<br />" +
				"/sortshowcase alphabetical reverse - Sorts alphabetically (z-a) by card id.<br />" +
				"/sortshowcase rarity - Sorts by rarity (Mythic to Common).<br />" +
				"/sortshowcase rarity reverse - Sorts by rarity (Common to Mythic).<br />" +
				"/sortshowcase off - Disables showcase sorting."
			);
		},
		off: function (target, room, user) {
			sortShowcaseBy(user.userid, 'none');
			this.sendReply("Your showcase will no longer be sorted.");
		},
		alphabetical: function (target, room, user) {
			let status = 'alpha';
			if (target && toId(target) === 'reverse') status = 'alphar';
			sortShowcaseBy(user.userid, status);
			this.sendReply("Your showcase will now sort " + (status === 'alphar' ? "reverse alphabetically." : "alphabetically."));
		},
		rarity: function (target, room, user) {
			let status = 'rare';
			if (target && toId(target) === 'reverse') status = 'rarer';
			sortShowcaseBy(user.userid, status);
			this.sendReply("Your showcase will now sort by rarity. (" + (status === 'rare' ? "Mythic to Common" : "Common to Mythic") + ")");
		},
	},
	sortshowcasehelp: function (target, room, user) {
		return this.parse('/sortshowcase help');
	},

	showcards: 'showcase',
	showcard: 'showcase',
	showcase: function (target, room, user) {
		if (!this.runBroadcast()) return;
		if (!target) target = user.userid;
		getCards(toId(target), cards => {
			if (!cards) {
				this.sendReplyBox(Wisp.nameColor(target, true) + " has no cards.");
				return room.update();
			}
			Wisp.database.all("SELECT * FROM users WHERE userid=$userid", {$userid: toId(target)}, (err, rows) => {
				if (err) return console.log('showcase: ' + err);
				let sortBy;
				if (!rows[0] || !rows[0].showcaseSort) {
					sortBy = 'none';
				} else {
					sortBy = rows[0].showcaseSort;
				}
				let sortMsg = '';
				switch (sortBy) {
				case 'alpha':
					cards.sort();
					sortMsg = "Alphabetically (A-Z)";
					break;
				case 'alphar':
					cards.sort().reverse();
					sortMsg = "Reverse Alphabetically (Z-A)";
					break;
				case 'rare':
					cards.sort(function (a, b) {
						return cardData[b].points - cardData[a].points;
					});
					sortMsg = " by Rarity (Mythic to Common)";
					break;
				case 'rarer':
					cards.sort(function (a, b) {
						return cardData[a].points - cardData[b].points;
					});
					sortMsg = " by Rarity (Common to Mythic)";
					break;
				}
				getPoints(toId(target), points => {
					let output = '<div style="max-height: 300px; overflow-y: scroll;">';
					for (let u in cards) {
						let card = cardData[cards[u]];
						if (!card) continue;
						output += '<button name="send" value="/card ' + card.id + '" style="border-radius: 12px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2) inset;" class="card-button">';
						output += '<img src="' + card.image + '" width="80" height="111" title="' + Tools.escapeHTML(card.name) + '"></button>';
					}
					output += '</div><br /><center>' + Wisp.nameColor(target, true) + ' has ' + cards.length + ' cards and ' + points + ' points.</center>';
					if (sortMsg !== '') output += '<br /><center>Sorting ' + sortMsg + '</center>';
					this.sendReplyBox(output);
					room.update();
				});
			});
		});
	},

	'!card': true,
	card: function (target, room, user) {
		if (!target) return this.parse("/help card");
		if (!this.runBroadcast()) return;
		let cardId = toId(target);
		if (!cardData[cardId]) return this.sendReply(target + ": card not found.");
		let card = cardData[cardId];
		let collections = [];
		for (let u in card.collection) {
			if (packs[toId(card.collection[u])]) collections.push(packs[toId(card.collection[u])]);
		}
		let output = '';
		output += '<div class="' + (this.targetUser ? 'infobox"' : 'card-div card-td" style="box-shadow: 2px 3px 5px rgba(0, 0, 0, 0.2);') + '">';
		if (!this.targetUser) {
			output += '<img src="' + card.image + '" height="220" title="' + Tools.escapeHTML(card.name) + '" align="right">';
			output += '<h1>' + Tools.escapeHTML(card.name) + '</h1>';
			output += '<br /><br /><h1><font color="' + colors[toId(card.rarity)] + '">' + Tools.escapeHTML(card.rarity) + '</font></h1>';
		} else {
			output += '<img src="' + card.image + '" width="108" height="150" title="' + Tools.escapeHTML(card.name) + '" align="right">';
			output += '<br /><br /><font color="#AAA"><i>Name:</i></font> ' + Tools.escapeHTML(card.name);
			output += '<br /><br /><font color="#AAA"><i>Rarity:</i></font> <font color="' + colors[toId(card.rarity)] + '">' + Tools.escapeHTML(card.rarity) + '</font>';
		}
		output += '<br /><br /><font color="#AAA"><i>Points:</i></font> ' + card.points;
		output += '<br /><br /><font color="#AAA"><i>Card ID:</i></font> ' + card.id;
		output += '<br /><br /><font color="#AAA"><i>Found in Packs:</i></font> ' + Tools.escapeHTML(collections.join(', '));
		output += '<br clear="all">';
		this.sendReply('|raw|' + output);
	},
	cardhelp: ["/card [name] - Displays information about a card."],

	deletecards: function (target, room, user) {
		if (!this.can('psgoadmin')) return false;
		if (!user.confirmDelete) {
			user.confirmDelete = true;
			return this.sendReply("This command will delete all of your cards. If you are sure you want to do this, type '/deletecards' again.");
		}
		delete user.confirmDelete;
		database.run("DELETE FROM cards WHERE userid=$userid", {$userid: user.userid}, err => {
			if (err) return console.log('deletecards: ' + err);
			updatePoints(user.userid);
			return this.sendReply("You have deleted all of your cards.");
		});
	},

	'!cardladder': true,
	cardladder: function (target, room, user) {
		if (!this.runBroadcast()) return;
		database.all("SELECT * FROM cardladder ORDER BY points DESC LIMIT 100", (err, rows) => {
			if (err) return console.log('cardladder: ' + err);
			const ladderTitle = '<center><h4><u>Card Ladder</u></h4></center>';
			const thStyle = 'class="rankladder-headers default-td" style="background: -moz-linear-gradient(#576468, #323A3C); background: -webkit-linear-gradient(#576468, #323A3C); background: -o-linear-gradient(#576468, #323A3C); background: linear-gradient(#576468, #323A3C); box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.3) inset, 1px 1px 1px rgba(255, 255, 255, 0.7) inset;"';
			const tableTop = '<div style="max-height: 310px; overflow-y: scroll;">' +
				'<table style="width: 100%; border-collapse: collapse;">' +
				'<tr>' +
					'<th ' + thStyle + '>Rank</th>' +
					'<th ' + thStyle + '>Username</th>' +
					'<th ' + thStyle + '>Points</th>' +
				'</tr>';
			const tableBottom = '</table></div>';
			const tdStyle = 'class="rankladder-tds default-td" style="box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.3) inset, 1px 1px 1px rgba(255, 255, 255, 0.7) inset;"';
			const first = 'class="first default-td important" style="box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.3) inset, 1px 1px 1px rgba(255, 255, 255, 0.7) inset;"';
			const second = 'class="second default-td important" style="box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.3) inset, 1px 1px 1px rgba(255, 255, 255, 0.7) inset;"';
			const third = 'class="third default-td important" style="box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.3) inset, 1px 1px 1px rgba(255, 255, 255, 0.7) inset;"';
			let midColumn;

			let tableRows = '';

			for (let i = 0; i < rows.length; i++) {
				if (i === 0) {
					midColumn = '</td><td ' + first + '>';
					tableRows += '<tr><td ' + first + '>' + (i + 1) + midColumn + Wisp.nameColor(rows[i].userid, true) + midColumn + rows[i].points + '</td></tr>';
				} else if (i === 1) {
					midColumn = '</td><td ' + second + '>';
					tableRows += '<tr><td ' + second + '>' + (i + 1) + midColumn + Wisp.nameColor(rows[i].userid, true) + midColumn + rows[i].points + '</td></tr>';
				} else if (i === 2) {
					midColumn = '</td><td ' + third + '>';
					tableRows += '<tr><td ' + third + '>' + (i + 1) + midColumn + Wisp.nameColor(rows[i].userid, true) + midColumn + rows[i].points + '</td></tr>';
				} else {
					midColumn = '</td><td ' + tdStyle + '>';
					tableRows += '<tr><td ' + tdStyle + '>' + (i + 1) + midColumn + Wisp.nameColor(rows[i].userid, true) + midColumn + rows[i].points + '</td></tr>';
				}
			}
			this.sendReplyBox(ladderTitle + tableTop + tableRows + tableBottom);
			if (room) room.update();
		});
	},

	cs: 'searchcard',
	cardsearch: 'searchcard',
	searchcard: function (target, room, user) {
		const letters = "abcdefghijklmnopqrstuvwxyz".split("");
		const categories = {
			Rarity: ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'], // rarities
			Packs: Tools.escapeHTML(shopPacks.join(', ')).split(', '),
			Types: ['Water', 'Fire', 'Fighting', 'Fairy', 'Dragon', 'Colorless', 'Psychic', 'Lightning', 'Darkness', 'Grass', 'Metal'],
			Tiers: ['OU-Pack', 'UU-Pack', 'Uber-Pack', 'PU-Pack', 'NU-Pack', 'RU-Pack', 'LC-Pack', 'BL-Pack', 'BL2-Pack', 'BL3-Pack'],
			Generation: ['Gen1', 'Gen2', 'Gen3', 'Gen4', 'Gen5', 'Gen6'],
			Miscellaneous: ['Trainer', 'Supporter', 'Item', 'Stadium', 'Energy', 'Delta', 'EX-Pack', 'Mega', 'Legendary', 'Full', 'Event', 'BREAK'],
		};

		const scrollable = "<div style=\"max-height: 300px; overflow-y: scroll\">"; // code for scrollable html
		const divEnd = "</div>";
		const definePopup = "|wide||html|<center><b>CardSearch</b></center><br />";
		const generalMenu = "<center>" +
			'<button name="send" value="/searchcard letter" style="background-color:aliceblue;height:30px">Alphabetical</button>&nbsp;&nbsp;' + // alphabetical
			'<button name="send" value="/searchcard category" style="background-color:aliceblue;height:30px">Categories</button>&nbsp;&nbsp;' + // category
			'</center><br />';
		if (!target) {
			return user.popup(definePopup + generalMenu);
		}
		// quick fix for when target ends with a comma
		target = target.replace(/\,[\s]+$/i, "");
		let parts = target.split(",");
		let actionCommand = parts.shift();
		let cardDisplay;
		switch (toId(actionCommand)) {
		case 'letter':
			let letter = toId(parts[0]);

			const letterMenu = '<center>' + letters.map(l => {
				return '<button name="send" value="/searchcard letter, ' + l + '" ' + (letter === l ? "style=\"background-color:lightblue;height:30px;width:35px\"" : "style=\"background-color:aliceblue;height:30px;width:35px\"") + ">" + l.toUpperCase() + "</button>";
			}).join("&nbsp;") + "</center><br />";

			if (!letter || letters.indexOf(letter) === -1) {
				// invalid letter to search for, or none given
				// only show menu
				return user.popup(definePopup + generalMenu + letterMenu);
			}
			// sort cards by letter
			let letterMons = {};
			for (let m in cardData) {
				if (!letterMons[m.charAt(0)]) letterMons[m.charAt(0)] = {};
				letterMons[m.charAt(0)][m] = 1;
			}

			if (!letterMons[letter]) return user.popup(definePopup + generalMenu + letterMenu);
			// make graphics for the letter
			cardDisplay = Object.keys(letterMons[letter]).sort().map(m => {
				let card = cardData[m];
				return '<button name="send" value="/searchcard card, ' + card.id + '" style="border-radius: 12px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2) inset;" class="card-button"><img src="' + card.image + '" width="100" title="' + card.name + '"></button>';
			}).join("&nbsp;");
			// send the popup
			user.lastCardSearch = target;
			user.popup(definePopup + generalMenu + letterMenu + scrollable + cardDisplay + divEnd);
			break;
		case 'category':
			// clean all the parts first
			parts = parts.map(p => {
				return toId(p);
			});

			// create category menu
			let categoryMenu = "";
			for (let c in categories) {
				categoryMenu += '<b>' + c + ' -</b> ' + categories[c].map(k => {
					let m = toId(k);
					// add a special search condition for rarity
					if (c === "Rarity") m += "rarity";

					// new params for the search
					// clone parts
					let newParams = parts.slice(0);
					if (parts.indexOf(m) > -1) {
						// remove it
						newParams.splice(newParams.indexOf(m), 1);
					} else {
						newParams.push(m);
					}

					let style = (parts.indexOf(m) > -1 ? "style=\"background-color:lightblue;height:23\"" : "style=\"background-color:aliceblue;height:23\""); // button style checking if currently searching

					return '<button name="send" value="/searchcard category, ' + newParams.join(", ") + '" ' + style + '>' + k + '</button>';
				}).join("&nbsp;") + "<br />";
			}
			if (!parts.length) {
				return user.popup(definePopup + generalMenu + categoryMenu);
			}
			// now clone the cards and delete the ones who dont match the categories
			let paramCards = Object.assign({}, cardData);

			// filter out the unneeded ones; ignore rarity
			for (let i = 0; i < parts.length; i++) {
				let param = parts[i];
				// ignore rarity
				if (/rarity$/i.test(param)) continue;
				for (let c in paramCards) {
					let cardParams = paramCards[c].collection.join("~").toLowerCase().replace(/[^a-z0-9\~]/g, "").split("~");
					if (cardParams.indexOf(param) === -1) delete paramCards[c]; // remove the card from the currently searched ones.
				}
			}

			// seperate check for rarity
			let rarityCheck = parts.some(a => {
				return /rarity$/i.test(a);
			});
			if (rarityCheck) {
				for (let c in paramCards) {
					let cardRare = toId(paramCards[c].rarity);
					for (let i = 0; i < parts.length; i++) {
						if (/rarity$/i.test(parts[i])) {
							// check if rarity is the card's rarity
							if (parts[i].replace(/rarity$/i, "") !== cardRare) {
								// remove if not matched
								delete paramCards[c];
							}
						}
					}
				}
			}

			// no cards left
			if (!Object.keys(paramCards).length) {
				return user.popup(definePopup + generalMenu + categoryMenu + '<br /><center><font color="red"><b>Nothing matches your search</b></font></center>');
			}
			user.lastCardSearch = target;
			// build the display
			cardDisplay = Object.keys(paramCards).sort().map(m => {
				let card = paramCards[m];
				return '<button name="send" value="/searchcard card, ' + card.id + '" style="border-radius: 12px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2) inset;" class="card-button"><img src="' + card.image + '" width="100" title="' + card.name + '"></button>';
			}).join("&nbsp;");
			user.popup(definePopup + generalMenu + categoryMenu + scrollable + cardDisplay + divEnd);
			break;
		case 'card':
			let backButton = '<button name="send" value="/cardsearch ' + user.lastCardSearch + '" style="background-color:aliceblue;height:30px;width:35">&lt;&nbsp;Back</button><br /><br />';
			if (!parts[0] || !(toId(parts[0]) in cardData)) {
				return user.popup(definePopup + backButton + '<center><font color="red"><b>Invalid Card</b></font></center>');
			}

			// build the display screen for the card
			let card = cardData[toId(parts[0])];
			// the image
			let cardImage = '<img src="' + card.image + '" height=250>';
			// the name of the card
			let cardName = "<b>Name:</b> " + card.name + "<br />";
			// the id of the card
			let cardId = "<font color=\"gray\">(" + card.id + ")</font><br />";
			// rarity display
			let cardRarityPoints = '<b>Rarity: </b><font color="' + colors[toId(card.rarity)] + '">' + card.rarity + '</font> (' + card.points + ')<br />';
			// collections
			let collections = [];
			for (let u in card.collection) {
				for (let i in packs) {
					if (i === toId(card.collection[u])) collections.push(packs[i]);
				}
			}
			let cardCollection = '<b>Packs: </b>' + collections.join(", ") + "<br />";
			// get users that have the card
			let cardHolders = {};
			database.all("SELECT userid FROM cards WHERE id=$cardid", {$cardid: card.id}, function (err, rows) {
				if (err) return console.log("cardsearch: " + err);
				for (let u in rows) {
					if (!cardHolders[rows[u].userid]) cardHolders[rows[u].userid] = 0;
					cardHolders[rows[u].userid]++;
				}

				// show duplicates as (x#)
				cardHolders = Object.keys(cardHolders).sort().map(u => {
					return "&nbsp;- " + u + (cardHolders[u] > 1 ? " (x" + cardHolders[u] + ")" : "");
				});

				// build the display!
				cardDisplay = "<center><table><tr>" +
					"<td>" + cardImage + "</td>" + // Card on the left
					"<td>" + // details now
					cardName + cardId + cardRarityPoints + cardCollection +
					"<b>Users with this card:</b><br />" + // card holders
					"<div style=\"max-height: 130px; overflow-y: scroll\">" + // scrollable
					cardHolders.join("<br />") + "<br />" +
					"</td></tr></table></center>"; // close the table

				user.popup(definePopup + backButton + cardDisplay);
			});
			break;
		case 'error':
		default:
			user.popup(definePopup + generalMenu + '<br /><center><font color="red"><b>Invalid Command action for CardSearch</b></font></center>');
			break;
		}
	},

	trade: 'tradecard',
	tradecard: function (target, room, user) {
		if (!target) return this.errorReply("/tradecard [card ID], [user], [targetCard ID]");
		let parts = target.split(',');
		for (let u in parts) parts[u] = parts[u].trim();

		let forTrade = toId(parts[0]);
		let targetUser = parts[1];
		let targetCard = toId(parts[2]);

		if (!forTrade) return this.errorReply("Please specify the card you want to trade.");
		if (!targetUser) return this.errorReply("Please specify the user you would like to trade with.");
		if (!targetCard) return this.errorReply("Please specify the card you would like to receive from the trade.");
		if (!cardData[forTrade]) return this.errorReply("The card '" + forTrade + "' does not exist.");
		if (!cardData[targetCard]) return this.errorReply("The card '" + targetCard + "' does not exist.");
		let match;

		// check for user's card
		database.all("SELECT * FROM cards WHERE userid=$userid", {$userid: user.userid}, (err, rows) => {
			if (err) return console.log("tradecard 1: " + err);
			for (let u in rows) {
				if (rows[u].id === forTrade) {
					match = true;
					break;
				}
			}
			if (!match) return this.errorReply("You don't have that card!");

			database.all("SELECT * FROM cards WHERE userid=$userid", {$userid: toId(targetUser)}, (err, rows) => {
				if (err) return console.log("tradecard 2: " + err);
				match = false;
				for (let u in rows) {
					if (rows[u].id === targetCard) {
						match = true;
						break;
					}
				}
				if (!match) return this.errorReply(targetUser + " does not have that card!");

				database.run("INSERT INTO trades(id, fromUser, fromCard, toUser, toCard) VALUES ($id, $from, $fromCard, $to, $toCard)", {$id: uuid.v1(), $from: user.userid, $fromCard: forTrade, $to: toId(targetUser), $toCard: targetCard}, err => {
					if (err) return console.log("tradecard 3: " + err);
					this.sendReply("Your trade has been taken submitted.");
					if (Users(targetUser)) {
						Users(targetUser).send("|pm|~Card Shop [Do not Reply]|" + Users(targetUser).getIdentity() +
							"|/raw <div class=\"broadcast-green\">" + Wisp.nameColor(user.name, true) + " has initiated a trade with you." +
							"  Click <button name=\"send\" value=\"/trades last\">here</button> or use <b>/trades</b> to view your pending trade requests.</div>"
						);
					}
					user.send("|pm|~Card Shop [Do not Reply]|" + user.getIdentity() + "|/raw <div class=\"broadcast-green\">Your trade with " + Wisp.nameColor(targetUser, true) +
					" has been initiated.  Click <button name=\"send\" value=\"/trades last\">here</button> or use <b>/trades</b> to view your pending trade requests.</div>");
				});
			});
		});
	},

	trades: 'viewcardtrades',
	viewcardtrades: function (target, room, user) {
		// popup variables
		const popup = "|html|<center><b><font color=\"blue\">Trade Manager</font></b></center><br />";

		database.all("SELECT * FROM trades WHERE toUser=$userid OR fromUser=$userid", {$userid: user.userid}, (err, rows) => {
			if (err) return console.log("trades: " + err);
			if (!rows[0]) return user.popup(popup + "<center>You have no pending trades.</center>");

			if (target && toId(target) === "last") {
				target = rows.length - 1;
			} else {
				// when there is no target (initial use of command)
				if (!target) target = 0;
				target = parseInt(target);
				if (isNaN(target)) target = 0;
				if (target < 0) target = 0;
				if (target >= rows.length) target = rows.length - 1;
			}

			// show trade details
			let displayTrade = rows[target];
			const acceptReject = '<center>' + (displayTrade.fromUser === user.userid ? "" : '<button name="send" value="/tradeaction accept, ' + displayTrade.id + '" style=\"background-color:green;height:30px\"><b>Accept</b></button>') + // accept button
				'&nbsp;&nbsp;' + // spacing
				'<button name="send" value="/tradeaction ' + (displayTrade.fromUser === user.userid ? "cancel" : "reject") + ', ' + displayTrade.id + '" style=\"background-color:red;height:30px\"><b>' + (displayTrade.fromUser === user.userid ? "Cancel" : "Reject") + '</b></button></center>' + // reject button
				'<br /><br />'; // new line

			// build the user's card first
			let card = cardData[(displayTrade.fromUser === user.userid ? displayTrade.fromCard : displayTrade.toCard)];
			// the image
			let cardImage = '<img src="' + card.image + '" height=250>';
			// rarity display
			let cardRarityPoints = '(<font color="' + colors[toId(card.rarity)] + '">' + Tools.escapeHTML(card.rarity) + '</font> - ' + card.points + ')<br />';
			let userSideDisplay = '<center>' + user.userid + '<br />' + cardImage + "<br />" + cardRarityPoints + '</center>';

			// now build the target's side
			card = cardData[(displayTrade.fromUser !== user.userid ? displayTrade.fromCard : displayTrade.toCard)];
			// the image
			cardImage = '<img src="' + card.image + '" height=250>';
			// rarity display
			cardRarityPoints = '(<font color="' + colors[toId(card.rarity)] + '">' + Tools.escapeHTML(card.rarity) + '</font> - ' + card.points + ')<br />';
			let targetSideDisplay = "<center>" + (displayTrade.fromUser !== user.userid ? displayTrade.fromUser : displayTrade.toUser) + '<br />' + cardImage + "<br />" + cardRarityPoints + "</center>";

			// now build the entire popup
			let tradeScreen = popup + // base popup
				'<center><table><tr><td>' + // table element
				userSideDisplay +
				'</td><td>' + // next column
				targetSideDisplay +
				'</td></tr></table></center><br />' + // close table and add new line
				acceptReject;

			// build the navigation bar
			// build max and min
			let navigationButtons;
			if (rows.length === 1) {
				navigationButtons = '<center><button style="background-color:deepskyblue;height:30px;width:30px">1</button></center>';
			} else {
				// build min and mas
				let min = '<button style="background-color:lightblue;height:30px;width:30px" name="send" value="/viewcardtrades 0">1</button>&nbsp;&nbsp;&nbsp;';
				let max = '&nbsp;&nbsp;&nbsp;<button style="background-color:lightblue;height:30px;width:30px" name="send" value="/viewcardtrades last">' + (rows.length) + '</button>';
				// lazy replace for colour
				if (target === 0) min = min.replace("background-color:lightblue;height:30px", "background-color:deepskyblue;height:30px");
				if (target === rows.length - 1) max = max.replace("background-color:lightblue;height:30px", "background-color:deepskyblue;height:30px");

				let middle = "";
				// build range
				let range = rows.slice(1, rows.length - 1); // remove min and max and turn it into a array of numbers
				if (range.length !== 0) { // only build middle buttons is there is none
					if (range.length > 5) {
						// find the current one and get 2 above and below
						let displayRange = [target - 2, target - 1, target, target + 1, target + 2].filter(i => {
							return i > 0 && i <= range.length;
						});
						// build middle buttons
						middle = (displayRange[0] !== 1 ? "... " : "") + displayRange.map(n => {
							n = parseInt(n);
							let style = n === target ? "background-color:deepskyblue;height:30px;width:30px" : "background-color:aliceblue;height:30px;width:30px";
							return '<button style="' + style + '" name="send" value="/viewcardtrades ' + n + '">' + (n + 1) + '</button>';
						}).join("&nbsp;") + (displayRange[displayRange.length - 1] !== range.length ? " ..." : "");
					} else {
						// just map the range
						middle = range.map(n => {
							n = parseInt(n);
							let style = n === target ? "background-color:deepskyblue;height:30px;width:30px" : "background-color:aliceblue;height:30px;width:30px";
							return '<button style="' + style + '" name="send" value="/viewcardtrades ' + n + '">' + (n + 1) + '</button>';
						}).join("&nbsp;");
					}
				}
				// add the stuff to navigation buttons
				navigationButtons = "<center>" + min + middle + max + "</center>";
			}

			// add the navigation buttons to the popup
			user.lastTradeCommand = "/viewcardtrades " + target;
			tradeScreen += navigationButtons;
			user.popup(tradeScreen);
		});
	},

	tradeaction: function (target, room, user) {
		if (!target) return false; // due to the complexity of the command, this should only be used through the viewtrades screen
		let parts = target.split(",");
		for (let u in parts) parts[u] = parts[u].trim();
		let action = toId(parts[0]);
		const backButton = '<button name="send" value="' + (user.lastTradeCommand || '/viewcardtrades') + '" style="background-color:aliceblue;height:30px">< Back</button><br /><br />';
		const tradeError = "|html|" + backButton + '<center><font color="red"><b>ERROR: Invalid Trade / You cannot accept your own trade request!</b></font><center>';
		switch (action) {
		case 'confirmaccept':
		case 'accept':
			if (!parts[1]) return false;
			if (action === "accept") {
				// make the user confirm the decision
				// build a back button
				return user.popup("|html|" + backButton + // back button
				'<center><button name="send" value="/tradeaction confirmaccept, ' + parts[1] + '" style="background-color:red;height:65px;width:150px"><b>Confirm Trade</b></button></center>');
			}
			// finalize trade
			// get the trade
			database.all("SELECT * FROM trades WHERE id=$id", {$id: parts[1]}, (err, rows) => {
				if (err) return console.log("tradeaction 1: " + err);
				if (!rows[0]) return user.popup(tradeError);
				let trade = rows[0];

				// check if the trade involves the user
				if (trade.toUser !== user.userid) return user.popup(tradeError);
				database.all("SELECT * FROM cards WHERE userid=$userid AND id=$id", {$userid: user.userid, $id: trade.toCard}, (err, rows) => {
					if (err) return console.log("tradeaction 2: " + err);
					if (!rows[0]) return this.parse('/tradeaction forcecancel, ' + trade.id);
					database.all("SELECT * FROM cards WHERE userid=$userid AND id=$id", {$userid: trade.fromUser, $id: trade.fromCard}, (err, rows) => {
						if (err) return console.log("tradeaction 3: " + err);
						if (!rows[0]) return this.parse('/tradeaction forcecancel, ' + trade.id);

						addCard(trade.fromUser, trade.toCard, () => {
							takeCard(trade.toUser, trade.toCard, () => {
								addCard(trade.toUser, trade.fromCard, () => {
									takeCard(trade.fromUser, trade.fromCard, () => {
										database.run("DELETE FROM trades WHERE id=$id", {$id: trade.id}, err => {
											if (err) return console.log("tradeaction 4: " + err);
											if (Users(trade.toUser) && Users(trade.toUser).connected) {
												Users(trade.toUser).popup("|html|" + backButton + "<center>Your trade with " + Wisp.nameColor(trade.fromUser, true) + " has gone through." +
												"<br /><button name=\"send\" value=\"/cs card, " + trade.fromCard + "\">View Traded Card</button></center>"); // show card
											}
											if (Users(trade.fromUser) && Users(trade.fromUser).connected) {
												Users(trade.fromUser).popup("|html|<center>Your trade with " + Wisp.nameColor(trade.toUser, true) + " has gone through." +
												"<br /><button name=\"send\" value=\"/cs card, " + trade.toCard + "\">View Traded Card</button></center>");
											}
											logTrade(toId(trade.toUser) + " has traded a " + trade.toCard + " to " + toId(trade.fromUser) + " for a " + trade.fromCard);
										});
									});
								});
							});
						});
					});
				});
			});
			break;
		case 'forcecancel':
		case 'cancel':
		case 'reject':
			if (!parts[0]) return false;
			// check for trade
			database.all("SELECT * FROM trades WHERE id=$id", {$id: parts[1]}, (err, rows) => {
				if (err) return console.log("tradeaction 4: " + err);
				if (!rows[0]) return user.popup(tradeError);
				let trade = rows[0];
				// additional consts
				const popupText = {
					forcecancel: "The trade has automatically been cancelled as one of the participants does not have that card anymore.",
					cancel: "You have cancelled the trade",
				};

				// check if user is involved
				if (trade.fromUser === user.userid || trade.toUser === user.userid) {
					// check that the action is correct
					if (trade.fromUser === user.userid && action === "reject") action = "cancel";
					if (trade.toUser === user.userid && action !== "reject" && action !== "forcecancel") action = "reject";
				} else {
					return user.popup(tradeError);
				}

				// remove the trade
				database.run("DELETE FROM trades WHERE id=$id", {$id: parts[1]}, err => {
					if (err) return console.log("tradeaction 5: " + err);
					// letting the users involved know
					let targetUser;
					if (action === "reject") {
						targetUser = Users(trade.fromUser);
						if (targetUser) targetUser.popup("Your trade request with " + user.name + " was rejected");
						user.popup("|html|" + backButton + "You have rejected " + trade.fromUser + "'s trade request.");
					} else {
						user.popup("|html|" + backButton + popupText[action]);
					}
				});
			});
			break;
		}
	},

	confirmtransfercard: 'transfercard',
	transfercard: function (target, room, user, connection, cmd) {
		if (!target) return this.parse("/help transfercard");
		let parts = target.split(",");
		for (let u in parts) parts[u] = parts[u].trim();

		if (!parts[0]) return this.errorReply("Please specify a user to transfer a card to.");
		if (!parts[1]) return this.errorReply("Please specify a card to transfer.");

		// find targetUser and the card being transfered.
		let targetUser = parts[0];
		let card = toId(parts[1]);

		if (toId(targetUser).length > 19) return this.errorReply("Usernames may not be longer than 19 characters.");
		if (!cardData[card]) return this.errorReply("That card does not exist.");

		database.all("SELECT * FROM cards WHERE userid=$userid AND id=$card", {$userid: user.userid, $card: card}, (err, rows) => {
			if (err) return console.log("transfercard 1: " + err);
			if (!rows[0]) return this.sendReply("You don't have that card.");

			if (cmd === "transfercard") {
				return user.popup('|html|<center><button name="send" value="/confirmtransfercard ' + target + '" style="background-color:red;height:65px;width:150px"><b><font color="white" size=3>Confirm Transfer to ' + Wisp.nameColor(targetUser, true) + '</font></b></button>');
			}

			takeCard(user.userid, card, () => {
				addCard(toId(targetUser), card, () => {
					logTrade(user.userid + " transfered " + card + " to " + toId(targetUser) + ".");
					user.popup("You have sucessfully transfered " + card + " to " + targetUser + ".");
					if (Users(targetUser) && Users(targetUser).connected) Users(targetUser).popup("|modal|" + user.name + " has transferred the card " + card + " to you.");
				});
			});
		});
	},
	transfercardhelp: ["/transfercard [user], [card id] - Transfers a card to a user."],

	confirmtransferallcards: 'transferallcards',
	transferallcards: function (target, room, user, connection, cmd) {
		if (!target) return this.parse("/help transferallcards");
		if (toId(target) === user.userid) return this.errorReply("You cannot transfer cards to yourself.");
		let targetUser = target;
		if (toId(targetUser).length > 19) return this.errorReply("Usernames may not be longer than 19 characters.");

		database.all("SELECT * FROM cards WHERE userid=$userid", {$userid: user.userid}, (err, rows) => {
			if (err) return console.log("transferallcards 1: " + err);
			if (!rows[0]) return this.errorReply("You don't have any cards.");

			if (cmd === "transferallcards") {
				return user.popup('|html|<center><button name="send" value="/confirmtransferallcards ' + target + '" style="background-color:red;height:65px;width:150px"><b><font color="white" size=3>Confirm Transfer to ' + Wisp.nameColor(targetUser, true) + '</font></b></button>');
			}

			database.run("UPDATE cards SET userid=$targetUser WHERE userid=$userid", {$targetUser: toId(targetUser), $userid: user.userid}, err => {
				if (err) return console.log("tranferallcards 2: " + err);
				updatePoints(user.userid);
				updatePoints(targetUser);
				user.popup("You have transfered all of your cards to " + targetUser + ".");
				logTrade(user.userid + " transferred all of their cards to " + toId(targetUser));
			});
		});
	},
	transferallcardshelp: ["/transferallcards [user] - Transfers all of your cards to a user."],

	givecard: 'spawncard',
	spawncard: function (target, room, user, connection, cmd) {
		if (!this.can('psgoadmin')) return false;
		if (!target) return this.parse("/help givecard");
		let parts = target.split(',');
		for (let u in parts) parts[u] = parts[u].trim();

		if (!parts[1]) return this.parse("/help givecard");

		let targetUser = parts[0];
		let cardId = toId(parts[1]);
		if (toId(targetUser).length > 19) return this.errorReply("Usernames may not be longer than 19 characters.");
		if (!cardData[cardId]) return this.errorReply("The card '" + cardId + "' does not exist.");

		addCard(targetUser, cardId);
		this.sendReply("You've given the card " + cardData[cardId].name + " to " + targetUser + ".");
		logTrade(user.userid + " gave the card " + cardId + " to " + toId(targetUser));
	},
	givecardhelp: ["/givecard [user], [card id] - Gives a card to a user."],

	takecard: function (target, room, user, connection, cmd) {
		if (!this.can('psgoadmin')) return false;
		if (!target) return this.parse("/help takecard");
		let parts = target.split(',');
		for (let u in parts) parts[u] = parts[u].trim();

		if (!parts[1]) return this.parse("/help takecard");

		let targetUser = parts[0];
		let cardId = toId(parts[1]);

		if (toId(targetUser).length > 19) return this.errorReply("Usernames may not be longer than 19 characters.");
		if (!cardData[cardId]) return this.errorReply("The card '" + cardId + "' does not exist.");


		takeCard(targetUser, cardId, status => {
			if (!status) return this.sendReply("That user does not have that card.");
			this.sendReply("You have successfully taken " + cardData[cardId].name + " from " + targetUser + ".");
			logTrade(user.userid + " took the card " + cardId + " from " + toId(targetUser));
		});
	},
	takecardhelp: ["/takecard [user, [card id] - Takes a card from a user."],
};
