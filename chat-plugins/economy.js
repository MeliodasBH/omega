'use strict';

Wisp.database = new sqlite3.Database('config/users.db', function () {
	Wisp.database.run("CREATE TABLE if not exists users (userid TEXT, name TEXT, bucks INTEGER, lastSeen INTEGER, onlineTime INTEGER, credits INTEGER, title TEXT, notifystatus INTEGER, background TEXT, music TEXT)");
	Wisp.database.run("CREATE TABLE if not exists friends (id integer primary key, userid TEXT, friend TEXT)");
});

const fs = require('fs');
const moment = require('moment');
const geoip = require('geoip-ultralight');
const schedule = require('node-schedule');

const MAX_TICKETS = 5;

geoip.startWatchingDataUpdate();

let shopTitle = 'Wisp Shop';
let serverIp = '158.69.196.64';

let prices = {
	"ticket": 1,
	"symbol": 5,
	"fix": 10,
	"declare": 20,
	"poof": 25,
	"title": 30,
	"avatar": 35,
	"music": 35,
	"infobox": 40,
	"background": 40,
	"emote": 50,
	"roomshop": 55,
	"room": 75,
	"icon": 100,
	"color": 150,
	"pmbox": 500,
};

let lottery = [];

try {
	let data = fs.readFileSync('config/lottery.csv', 'utf8');
	if (data.length < 2) {
		lottery = [];
	} else {
		lottery = data.split(',');
	}
} catch (e) {}

let Economy = global.Economy = {
	readMoney: function (userid, callback) {
		if (!callback) return false;
		userid = toId(userid);
		Wisp.database.all("SELECT * FROM users WHERE userid=$userid", {$userid: userid}, function (err, rows) {
			if (err) return console.log("readMoney: " + err);
			callback(((rows[0] && rows[0].bucks) ? rows[0].bucks : 0));
		});
	},
	writeMoney: function (userid, amount, callback) {
		userid = toId(userid);
		Wisp.database.all("SELECT * FROM users WHERE userid=$userid", {$userid: userid}, function (err, rows) {
			if (err) return console.log("writeMoney 1: " + err);
			if (rows.length < 1) {
				Wisp.database.run("INSERT INTO users(userid, bucks) VALUES ($userid, $amount)", {$userid: userid, $amount: amount}, function (err) {
					if (err) return console.log("writeMoney 2: " + err);
					if (callback) return callback();
				});
			} else {
				amount += rows[0].bucks;
				Wisp.database.run("UPDATE users SET bucks=$amount WHERE userid=$userid", {$amount: amount, $userid: userid}, function (err) {
					if (err) return console.log("writeMoney 3: " + err);
					if (callback) return callback();
				});
			}
		});
	},
	writeMoneyArr: function (users, amount) {
		this.writeMoney(users[0], amount, () => {
			users.splice(0, 1);
			if (users.length > 0) this.writeMoneyArr(users, amount);
		});
	},
	logTransaction: function (message) {
		if (!message) return false;
		fs.appendFile('logs/transactions.log', '[' + new Date().toUTCString() + '] ' + message + '\n');
	},

	logDice: function (message) {
		if (!message) return false;
		fs.appendFile('logs/dice.log', '[' + new Date().toUTCString() + '] ' + message + '\n');
	},
};

function getProfileData(user, callback) {
	let userid = toId(user);
	let reply = {
		bucks: 0,
		regdate: "(Unregistered)",
		lastOnline: "Never",
		title: "",
		background: "",
		music: "",
	};
	Wisp.database.all("SELECT * FROM users WHERE userid=$userid;", {$userid: userid}, function (err, rows) {
		if (err) return console.log("getProfileData 1: " + err);
		Wisp.regdate(userid, function (date) {
			if (date) reply.regdate = moment(date).format("MMMM DD, YYYY");
			if (!rows[0]) return callback(reply);

			let userData = rows[0];
			if (userData.bucks) reply.bucks = userData.bucks;
			if (userData.lastSeen) reply.lastOnline = userData.lastSeen;
			if (userData.title) reply.title = userData.title;
			if (userData.background) reply.background = userData.background;
			if (userData.music) reply.music = userData.music;

			return callback(reply);
		});
	});
}

if (!Rooms.global.lotteryDraw) {
	Rooms.global.lotteryDraw = schedule.scheduleJob('0 18 * * 0,3', function () {
		if (lottery.length < 1) return;
		let winner = lottery[Math.floor(Math.random() * lottery.length)];
		let amount = (lottery.length * prices['ticket']) - Math.ceil((lottery.length * prices['ticket']) * 0.10);
		if (amount === 0) amount = 1;
		Economy.writeMoney(winner, amount, function () {
			Economy.logTransaction(winner + " has won " + amount + (amount === 1 ? " buck" : " bucks") + " from the lottery.");
			if (Users(winner) && Users(winner).connected) {
				Users(winner).send("|popup||modal|Congratulations, you have won " + amount + (amount === 1 ? " buck" : " bucks") + " from the lottery.");
			} else {
				if (!Wisp.tells[winner]) Wisp.tells[winner] = {};
				if (!Wisp.tells[winner]['server']) Wisp.tells[winner]['server'] = [];
				Wisp.tells[winner]['server'].push('<span style = "color:gray;"><i>(Sent by the Server on ' + moment().format("ddd, MMMM DD, YYYY HH:mmA ZZ") + ')</i></span><br />' +
				'Congratulations, you have won ' + amount + (amount === 1 ? ' buck' : ' bucks') + ' from the lottery.');
			}
			for (let u in Rooms.global.users) {
				if (!Users(u) || !Users(u).connected) continue;
				Users(u).send("|pm|~Lottery|~|/html Congratulations to " + Wisp.nameColor(winner, true) + " for winning todays lottery. They have won " + amount + " " + (amount === 1 ? "buck." : "bucks."));
			}
			lottery = [];
			fs.writeFileSync('config/lottery.csv', '');
		});
	});
}

exports.commands = {
	lottery: function (target, room, user) {
		if (!this.runBroadcast()) return;
		if (lottery.length < 1) return this.sendReplyBox("No one has purchased any lottery tickets for this lottery.");
		let amount = (lottery.length * prices['ticket']) - Math.ceil((lottery.length * prices['ticket']) * 0.10);
		if (amount === 0) amount++;
		let tickets = lottery.length;
		this.sendReplyBox("The current lottery is worth " + amount + (amount === 1 ? " buck" : " bucks") + ".<br />" + tickets + (tickets === 1 ? " ticket" : " tickets") + " have been purchased for this lottery.");
	},

	moneylog: function (target, room, user) {
		//if (!this.can('bucks')) return false;
		if (!target) return this.sendReply("Usage: /moneylog [number] to view the last x lines OR /moneylog [text] to search for text.");
		let word = false;
		if (isNaN(Number(target))) word = true;
		let lines = fs.readFileSync('logs/transactions.log', 'utf8').split('\n').reverse();
		let output = '';
		let count = 0;
		let regex = new RegExp(target.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), "gi");

		if (word) {
			output += 'Displaying last 50 lines containing "' + target + '":\n';
			for (let line in lines) {
				if (count >= 50) break;
				if (!~lines[line].search(regex)) continue;
				output += lines[line] + '\n';
				count++;
			}
		} else {
			if (target > 100) target = 100;
			output = lines.slice(0, (lines.length > target ? target : lines.length));
			output.unshift("Displaying the last " + (lines.length > target ? target : lines.length) + " lines:");
			output = output.join('\n');
		}
		user.popup("|wide|" + output);
	},

	'!wallet': true,
	atm: 'wallet',
	wallet: function (target, room, user) {
		if (!target) target = user.name;
		if (!this.runBroadcast()) return;
		let userid = toId(target);
		if (userid.length < 1) return this.sendReply("/wallet - Please specify a user.");
		if (userid.length > 19) return this.sendReply("/wallet - [user] can't be longer than 19 characters.");

		Economy.readMoney(userid, money => {
			this.sendReplyBox(Wisp.nameColor(target, true) + " has " + money + ((money === 1) ? " buck." : " bucks."));
			if (this.broadcasting && room) room.update();
		});
	},

	gb: 'givebucks',
	givemoney:'givebucks',
	givebucks: function (target, room, user) {
		if (!this.can('bucks')) return false;
		if (!target) return this.sendReply("Usage: /givebucks [user], [amount]");
		let splitTarget = target.split(',');
		if (!splitTarget[2]) return this.sendReply("Usage: /givebucks [user], [amount], [reason]");
		for (let u in splitTarget) splitTarget[u] = splitTarget[u].trim();

		let targetUser = splitTarget[0];
		if (toId(targetUser).length < 1) return this.sendReply("/givebucks - [user] may not be blank.");
		if (toId(targetUser).length > 19) return this.sendReply("/givebucks - [user] can't be longer than 19 characters");

		let amount = Math.round(Number(splitTarget[1]));
		if (isNaN(amount)) return this.sendReply("/givebucks - [amount] must be a number.");
		if (amount > 1000) return this.sendReply("/givebucks - You can't give more than 1000 bucks at a time.");
		if (amount < 1) return this.sendReply("/givebucks - You can't give less than one buck.");

		let reason = splitTarget[2];
		if (reason.length > 100) return this.errorReply("Reason may not be longer than 100 characters.");
		if (toId(reason).length < 1) return this.errorReply("Please specify a reason to give bucks.");

		Economy.writeMoney(targetUser, amount, () => {
			Economy.readMoney(targetUser, newAmount => {
				if (Users(targetUser) && Users(targetUser).connected) {
					Users.get(targetUser).popup('|html|You have received ' + amount + ' ' + (amount === 1 ? 'buck' : 'bucks') +
					' from ' + Wisp.nameColor(user.userid, true) + '.');
				}
				this.sendReply(targetUser + " has received " + amount + ((amount === 1) ? " buck." : " bucks."));
				Economy.logTransaction(user.name + " has given " + amount + ((amount === 1) ? " buck " : " bucks ") + " to " + targetUser + ". (Reason: " + reason + ") They now have " + newAmount + (newAmount === 1 ? " buck." : " bucks."));
			});
		});
	},

	takemoney:'takebucks',
	takebucks: function (target, room, user) {
		if (!this.can('bucks')) return false;
		if (!target) return this.sendReply("Usage: /takebucks [user], [amount]");
		let splitTarget = target.split(',');
		if (!splitTarget[2]) return this.sendReply("Usage: /takebucks [user], [amount], [reason]");
		for (let u in splitTarget) splitTarget[u] = splitTarget[u].trim();

		let targetUser = splitTarget[0];
		if (toId(targetUser).length < 1) return this.sendReply("/takebucks - [user] may not be blank.");
		if (toId(targetUser).length > 19) return this.sendReply("/takebucks - [user] can't be longer than 19 characters");

		let amount = Math.round(Number(splitTarget[1]));
		if (isNaN(amount)) return this.sendReply("/takebucks - [amount] must be a number.");
		if (amount > 1000) return this.sendReply("/takebucks - You can't take more than 1000 bucks at a time.");
		if (amount < 1) return this.sendReply("/takebucks - You can't take less than one buck.");

		let reason = splitTarget[2];
		if (reason.length > 100) return this.errorReply("Reason may not be longer than 100 characters.");
		if (toId(reason).length < 1) return this.errorReply("Please specify a reason to remove bucks.");

		Economy.writeMoney(targetUser, -amount, () => {
			Economy.readMoney(targetUser, newAmount => {
				if (Users(targetUser) && Users(targetUser).connected) {
					Users.get(targetUser).popup('|html|' + Wisp.nameColor(user.userid, true) + ' has removed ' + amount + ' ' + (amount === 1 ? 'buck' : 'bucks') +
					' from you.<br />');
				}
				this.sendReply("You removed " + amount + ((amount === 1) ? " buck " : " bucks ") + " from " + Tools.escapeHTML(targetUser));
				Economy.logTransaction(user.name + " has taken " + amount + ((amount === 1) ? " buck " : " bucks ") + " from " + targetUser + ". (Reason: " + reason + ") They now have " + newAmount + (newAmount === 1 ? " buck." : " bucks."));
			});
		});
	},

	confirmtransferbucks: 'transferbucks',
	transferbucks: function (target, room, user, connection, cmd) {
		if (!target) return this.sendReply("Usage: /transferbucks [user], [amount]");
		let splitTarget = target.split(',');
		for (let u in splitTarget) splitTarget[u] = splitTarget[u].trim();
		if (!splitTarget[1]) return this.sendReply("Usage: /transferbucks [user], [amount]");

		let targetUser = (Users.getExact(splitTarget[0]) ? Users.getExact(splitTarget[0]).name : splitTarget[0]);
		if (toId(targetUser).length < 1) return this.sendReply("/transferbucks - [user] may not be blank.");
		if (toId(targetUser).length > 18) return this.sendReply("/transferbucks - [user] can't be longer than 18 characters.");

		let amount = Math.round(Number(splitTarget[1]));
		if (isNaN(amount)) return this.sendReply("/transferbucks - [amount] must be a number.");
		if (amount > 1000) return this.sendReply("/transferbucks - You can't transfer more than 1000 bucks at a time.");
		if (amount < 1) return this.sendReply("/transferbucks - You can't transfer less than one buck.");

		Economy.readMoney(user.userid, money => {
			if (money < amount) return this.sendReply("/transferbucks - You can't transfer more bucks than you have.");
			if (cmd !== 'confirmtransferbucks') {
				return this.popupReply('|html|<center>' +
					'<button class = "card-td button" name = "send" value = "/confirmtransferbucks ' + toId(targetUser) + ', ' + amount + '"' +
					'style = "outline: none; width: 200px; font-size: 11pt; padding: 10px; border-radius: 14px ; text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.4); box-shadow: 0px 0px 7px rgba(0, 0, 0, 0.4) inset; transition: all 0.2s;">' +
					'Confirm transfer to <br><b style = "color:' + Wisp.hashColor(targetUser) + '; text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8)">' + Tools.escapeHTML(targetUser) + '</b></button></center>'
				);
			}
			Economy.writeMoney(user.userid, -amount, () => {
				Economy.writeMoney(targetUser, amount, () => {
					Economy.readMoney(targetUser, firstAmount => {
						Economy.readMoney(user.userid, secondAmount => {
							this.popupReply("You sent " + amount + ((amount === 1) ? " buck " : " bucks ") + " to " + targetUser);
							Economy.logTransaction(
								user.name + " has transfered " + amount + ((amount === 1) ? " buck " : " bucks ") + " to " + targetUser + "\n" +
								user.name + " now has " + secondAmount + " " + (secondAmount === 1 ? "buck." : "bucks.") + " " +
								targetUser + " now has " + firstAmount + " " + (firstAmount === 1 ? "buck." : "bucks.")
							);
							if (Users.getExact(targetUser) && Users.getExact(targetUser).connected) {
								Users.getExact(targetUser).send('|popup||html|' + Wisp.nameColor(user.name, true) + " has sent you " + amount + ((amount === 1) ? " buck." : " bucks."));
							}
						});
					});
				});
			});
		});
	},

	buy: function (target, room, user) {
		if (!target) return this.sendReply("Usage: /buy [item]");
		let targetSplit = target.split(',');
		for (let u in targetSplit) targetSplit[u] = targetSplit[u].trim();
		let item = targetSplit[0];
		let itemid = toId(item);
		let matched = false;

		if (!prices[itemid]) return this.sendReply("/buy " + item + " - Item not found.");

		Economy.readMoney(user.userid, userMoney => {
			switch (itemid) {
			case 'symbol':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a custom symbol.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a custom symbol for " + prices[itemid] + " bucks. They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						user.canCustomSymbol = true;
						this.sendReplyBox("You have purchased a custom symbol. You may now use /customsymbol [symbol] to change your symbol.");
					});
				});
				matched = true;
				break;
			case 'avatar':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase an avatar.");
				if (!targetSplit[1]) return this.sendReply("Please specify the image you would like as your avatar with /buy avatar, image url.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased an avatar for " + prices[itemid] + " bucks. Image: " + targetSplit[1] + ". They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased an avatar.<center><img src=\"" + targetSplit[1] +
						"\" width=\"80\" height=\"80\"></center><br /><button name=\"send\" value=\"/customavatar set, " + user.userid + ", " + targetSplit[1] + "\">Click to add</button> | " +
						"<button name=\"send\" value=\"/customavatar delete, " + user.userid + "\">Click to remove</button>");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased an avatar.").update();
						this.sendReply("You have purchased an avatar. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'room':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a chat room.");
				if (!targetSplit[1]) return this.sendReply("Please specify a name for the chat room with /buy chatroom, name.");
				if (Rooms.rooms[toId(targetSplit[1])]) return this.sendReply("You can't purchase a room that already exists.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a chat room for " + prices[itemid] + " bucks.  They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a chat room. Name: " + Tools.escapeHTML(targetSplit[1]));
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a chat room named \"" + Tools.escapeHTML(targetSplit[1]) + "\".").update();
						this.sendReply("You've purchased a chat room. You will be notified when it has been created.");
					});
				});
				matched = true;
				break;
			case 'poof':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a poof.");
				if (!targetSplit[1]) return this.sendReply("Please specify the poof message you would like to buy with /buy poof, poof message.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a poof message for " + prices[itemid] + " bucks. They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a poof message. Message: " + Tools.escapeHTML(targetSplit[1]));
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a poof message. Message: " + Tools.escapeHTML(targetSplit[1])).update();
						this.sendReply("You've purchased a poof message. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'title':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a user title.");
				if (!targetSplit[1]) return this.sendReply("Please specify the title you would like with /buy title, [title], [optional colour].");
				let hex;
				if (targetSplit[2]) hex = targetSplit[2];
				if (targetSplit[1].length > 25) return this.sendReply("Titles may not be longer than 25 characters.");
				if (hex && hex.length > 7) return this.sendReply("Hex may not be longer than 7 characters.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a user title " + prices[itemid] + " bucks. Title: " + targetSplit[1] + (hex ? " Hex: " + hex : "") +
						". They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a title: <b><font color=\"" + (hex ? hex : "#b30000") + "\">" +
						Tools.escapeHTML(targetSplit[1]) + "</b></font><br />" +
						"<button name=\"send\" value=\"/title set, " + user.userid + ", " + targetSplit[1] + (hex ? ", " + hex : "") + "\">Click to add</button>");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a title: <b><font color=\"" + (hex ? hex : "#b30000") + "\">" +
						Tools.escapeHTML(targetSplit[1]) + "</b></font>").update();
						this.sendReply("You have purchased a title. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'infobox':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase an infobox.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased an infobox for " + prices[itemid] + " bucks. They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased an infobox.");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased an infobox.").update();
						this.sendReply("You have purchased an infobox. Please put everything you want on it in a pastebin including the command then send it to an Administrator, if you have any questions about what you can add pm an Admin.");
					});
				});
				matched = true;
				break;
			case 'declare':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a declare.");
				if (!targetSplit[1]) return this.sendReply("Please specify the declare you'd like with /buy declare, message.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a declare for " + prices[itemid] + " bucks. They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a declare. Message: " + Tools.escapeHTML(targetSplit[1]));
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a declare. Message: " + Tools.escapeHTML(targetSplit[1])).update();
						this.sendReply("You have purchased a declare. Please message an Administrator with the message you would like to declare.");
					});
				});
				matched = true;
				break;
			case 'fix':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a fix.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a fix for " + prices[itemid] + " bucks. They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a fix.");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a fix.").update();
						this.sendReply("You have purchased a fix. Please message an Administrator with what needs fixed.");
					});
				});
				matched = true;
				break;
			case 'roomshop':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a room shop.");
				if (!targetSplit[1]) return this.sendReply("Please specify the room you would like to buy a room shop for with /buy roomshop, room.");
				let targetRoom = Rooms(targetSplit[1]);
				if (!targetRoom) return this.sendReply("That room doesn't exist.");
				if (!targetRoom.chatRoomData) return this.sendReply("That room can't have a room shop.");
				if (!targetRoom.founder) return this.sendReply("Rooms require a room founder to have a shop.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a room shop for " + prices[itemid] + " bucks. Room: " + targetRoom.title + ". They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						matched = true;
						this.sendReply(targetRoom.title + " has received a shop. The room owners of that room should view /roomshop help to view the room shop commands.");
						targetRoom.add('|raw|<div class="broadcast-green"><b>' + Tools.escapeHTML(user.name) + ' has just purchased a room shop for this room.</b></div>');
						targetRoom.update();
						targetRoom.shop = {};
						targetRoom.shopList = [];
						targetRoom.chatRoomData.shop = targetRoom.shop;
						targetRoom.chatRoomData.shopList = targetRoom.shopList;
						Rooms.global.writeChatRoomData();
					});
				});
				matched = true;
				break;
			case 'emote':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase an emote.");
				if (!targetSplit[2]) return this.sendReply("Please specify the image you would like as your emote with /buy emote, name, image url.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased an emote for " + prices[itemid] + " bucks. Name: " + Tools.escapeHTML(targetSplit[1]) +
						" Image: " + targetSplit[2] + ". They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased an emote. Name: " + Tools.escapeHTML(targetSplit[1]) +
						"<img src=\"" + targetSplit[2] + "\" width=\"40\" height=\"40\">" +
						"<br /><button name=\"send\" value=\"/emote add, " + targetSplit[1] + ", " + targetSplit[2] + "\">Click to add</button>");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased an emote. Name: " + Tools.escapeHTML(targetSplit[1]) +
						" <img src=\"" + targetSplit[2] + "\" width=\"40\" height=\"40\">").update();
						this.sendReply("You have purchased an emote. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'background':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a profile background.");
				if (!targetSplit[1]) return this.sendReply("Please specify the image you would like with /buy background, [image]");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.userid + " has purchased a custom profile background for " + prices[itemid] + " bucks. Image: " + targetSplit[1]);
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a profile background: <a href=\"" + Tools.escapeHTML(targetSplit[1]) + "\">" + Tools.escapeHTML(targetSplit[1]) +
						"</a><br /><button name=\"send\" value=\"/background set " + user.userid + ", " + targetSplit[1] + "\">Click to add</button>");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a profile background: " + Tools.escapeHTML(targetSplit[1])).update();
						this.sendReply("You have purchased a profile background. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'music':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a profile background.");
				if (!targetSplit[1]) return this.sendReply("Please specify the song you would like with /buy music, [song link]");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.userid + " has purchased profile music for " + prices[itemid] + " bucks. Music URL: " + targetSplit[1]);
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased profile music: <a href=\"" + Tools.escapeHTML(targetSplit[1]) + "\">" + Tools.escapeHTML(targetSplit[1]) +
						"</a><br /><button name=\"send\" value=\"/music set " + user.userid + ", " + targetSplit[1] + "\">Click to add</button>");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased profile music: " + Tools.escapeHTML(targetSplit[1])).update();
						this.sendReply("You have purchased profile music. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'icon':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase an icon.");
				if (!targetSplit[1]) return this.sendReply("Please specify the image you would like as your icon with /buy icon, image url.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased an icon for " + prices[itemid] + " bucks. Image: " + targetSplit[1] + ". They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased an icon. <img src=\"" + targetSplit[1] + "\" width=\"32\" height=\"32\">").update();
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased an icon. <img src=\"" + targetSplit[1] + "\" width=\"32\" height=\"32\">" +
						"<br /><button name=\"send\" value=\"/icon set " + user.name + ", " + targetSplit[1] + "\">Click to add</button>");
						this.sendReply("You have purchased an icon. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'color':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a custom color.");
				if (!targetSplit[1]) return this.sendReply("|raw|Please specify the color you would like with /buy color, hexcode. (see: <a href=http://www.colorpicker.com/>http://www.colorpicker.com/</a>)");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a custom color for " + prices[itemid] + " bucks. Image: " + targetSplit[1] + ". They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a custom color. Color: <font color=\"" + targetSplit[1] +
						"\">" + Tools.escapeHTML(user.name) + "</font>" +
						"<br /><button name=\"send\" value=\"/customcolor set " + user.name + ", " + targetSplit[1] + "\">Click to add</button>");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a custom color. Color: <font color=\"" + targetSplit[1] +
						"\">" + Tools.escapeHTML(user.name) + "</font>").update();
						this.sendReply("You have purchased a custom color. It will be added shortly.");
					});
				});
				matched = true;
				break;
			case 'ticket':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a ticket.");
				let count = 0;
				for (let u in lottery) {
					if (lottery[u] === user.userid) count++;
				}
				if (count >= MAX_TICKETS) return this.sendReply("You can't buy more than " + MAX_TICKETS + " tickets per lottery draw.");
				matched = true;
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						count++;
						lottery.push(user.userid);
						fs.writeFileSync('config/lottery.csv', lottery.join(','));
						Economy.logTransaction(user.name + " has purchased a lottery ticket for " + prices[itemid] + " bucks. They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						this.sendReply("You have purchased a ticket for the next lottery draw. You now have " + count + (count === 1 ? " ticket." : " tickets."));
					});
				});
				break;
			case 'pmbox':
				if (userMoney < prices[itemid]) return this.sendReply("You need " + (prices[itemid] - userMoney) + " more bucks to purchase a custom PM box.");
				Economy.writeMoney(user.userid, prices[itemid] * -1, () => {
					Economy.readMoney(user.userid, amount => {
						Economy.logTransaction(user.name + " has purchased a custom PM box for " + prices[itemid] + " bucks. They now have " + amount + (amount === 1 ? " buck." : " bucks."));
						Wisp.messageSeniorStaff("/html " + Wisp.nameColor(user.name, true) + " has purchased a custom PM box. ");
						Rooms('upperstaff').add("|raw|" + Wisp.nameColor(user.name, true) + " has purchased a custom PM box. ").update();
						this.sendReply("You have purchased a custom pm box. Please PM any global &/~ with a pastebin of your submission.");
					});
				});
				matched = true;
			}

			if (matched) {
				return this.sendReply("You now have " + (userMoney - prices[itemid]) + " bucks left.");
			}
		});
	},

	shop: function (target, room, user) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox('<center><h4><b><u>' + shopTitle + '</u></b></h4><div style="max-height: 310px; overflow-y: scroll;"><table style="width: 100%; border-collapse: collapse;"><tr><th style="background: #2980B9; border: 1px solid #1d6391; border-bottom-width: 10px; color: #FFF; padding: 10px; font-size: 13pt;">Item</th><th style="background: #C0392B; border: 1px solid #a12f23; border-bottom-width: 10px; color: #FFF; padding: 10px; font-size: 13pt;">Description</th><th style="background: #F39C12; border: 1px solid #cd8109; border-bottom-width: 10px; color: #FFF; padding: 10px; font-size: 13pt;">Price</th></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy ticket">Ticket</button></td><td class="shop-td des">Buys a ticket for the lottery. Lottery is drawn every Sunday and Wednesday at 6PM EST.</td><td class="shop-td pri">' + prices['ticket'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy symbol">Custom Symbol</button></td><td class="shop-td des">Buys a custom symbol to go in front of your name. (Temporary until restart)</td><td class="shop-td pri">' + prices['symbol'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy fix">Fix</button></td><td class="shop-td des">Buys the ability to alter your current custom avatar or infobox (don\'t buy if you have neither)!</td><td class="shop-td pri">' + prices['fix'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy declare">Declare</button></td><td class="shop-td des">You get the ability to have a message declared in the lobby. This can be used for league advertisement (not server)</td><td class="shop-td pri">' + prices['declare'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy poof">Poof</button></td><td class="shop-td des">Buy a poof message to be added into the pool of possible poofs</td><td class="shop-td pri">' + prices['poof'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy title">Title</button></td><td class="shop-td des">Buys a user title that displays beside your name in /profile</td><td class="shop-td pri">' + prices['title'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy avatar">Avatar</button></td><td class="shop-td des">Buys a custom avatar to be applied to your name (You supply, must be .png or .gif format. Images larger than 80x80 may not show correctly.)</td><td class="shop-td pri">' + prices['avatar'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy music">Profile Music</button></td><td class="shop-td des">Buys custom music for your /profile</td><td class="shop-td pri">' + prices['music'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy infobox">Infobox</button></td><td class="shop-td des">Buys an infobox that will be viewable with a command such as /tailz.</td><td class="shop-td pri">' + prices['infobox'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy background">Background</button></td><td class="shop-td des">Buys a custom background for your /profile</td><td class="shop-td pri">' + prices['background'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy emote">Emote</button></td><td class="shop-td des">Buys an emoticon for you (and everyone else) to use in the chat.</td><td class="shop-td pri">' + prices['emote'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy roomshop">Room Shop</button></td><td class="shop-td des">Buys a fully customizable shop for your room. The bucks earned from purchases go to the room founder or room bank.</td><td class="shop-td pri">' + prices['roomshop'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy room">Room</button></td><td class="shop-td des">Buys a chatroom for you to own.</td><td class="shop-td pri">' + prices['room'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy icon">Icon</button></td><td class="shop-td des">Buys an icon that displays beside your name on the userlist. Size must be 32x32.</td><td class="shop-td pri">' + prices['icon'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy color">Color</button></td><td class="shop-td des">Buys a custom color change for your name. Changes the color of your name on the userlist and in the chat.</td><td class="shop-td pri">' + prices['color'] + '</td></tr>' +
			'<tr class="shop-tr"><td class="shop-td"><button name="send" value="/buy pmbox">PM Box</button></td><td class="shop-td des">Buys a custom PM-box for your username. Please fill out this form: http://pastebin.com/GUcm7XwX ; PM Tailz to see an example.</td><td class="shop-td pri">' + prices['pmbox'] + '</td></tr>' +
			'</table></div><br />To buy an item from the shop, use /buy [item].<br />All sales final, no refunds will be provided.</center>'
		);
	},

	roomshop: 'leagueshop',
	leagueshop: function (target, room, user) {
		if (!room.shop) return this.sendReply('/roomshop - This room does not have a shop, purchase one with /buy roomshop, ' + room.title);
		if (!room.founder) return this.sendReply('/roomshop - room shops require a room founder.');
		if (!room.shopList) room.shopList = [];
		if (!target) target = '';

		let cmdParts = target.split(' ');
		let cmd = cmdParts.shift().trim().toLowerCase();
		let params = cmdParts.join(' ').split(',').map(function (param) { return param.trim(); });
		let name, description, price, item;

		switch (cmd) {
		case 'list':
		case 'view':
		default:
			if (!this.runBroadcast()) return;
			if (room.shopList.length < 1) return this.sendReplyBox('<center><b><u>This shop has no items!</u></b></center>');
			let output = '<center><h4><b><u><font color="#24678d">' + Tools.escapeHTML(room.title) + '\'s Shop</font></u></b></h4><table border="1" cellspacing ="0" cellpadding="3"><tr><th>Item</th><th>Description</th><th>Price</th></tr>';
			for (let u in room.shopList) {
				if (!room.shop[room.shopList[u]] || !room.shop[room.shopList[u]].name || !room.shop[room.shopList[u]].description || !room.shop[room.shopList[u]].price) continue;
				output += '<tr><td><button name="send" value="/roomshop buy ' + Tools.escapeHTML(room.shopList[u]) + '" >' + Tools.escapeHTML(room.shop[room.shopList[u]].name) +
				'</button></td><td>' + Tools.escapeHTML(room.shop[room.shopList[u]].description.toString()) + '</td><td>' + room.shop[room.shopList[u]].price + '</td></tr>';
			}
			output += '</center><br />';
			this.sendReplyBox(output);
			break;
		case 'add':
			if (!user.can('roommod', null, room)) return this.sendReply('/roomshop - Access denied.');
			if (params.length < 3) return this.sendReply('Usage: /roomshop add [item name], [description], [price]');
			if (!room.shopList) room.shopList = [];
			name = params.shift();
			description = params.shift();
			price = Number(params.shift());
			if (isNaN(price)) return this.sendReply('Usage: /roomshop add [item name], [description], [price]');
			room.shop[toId(name)] = {};
			room.shop[toId(name)].name = name;
			room.shop[toId(name)].description = description;
			room.shop[toId(name)].price = price;
			room.shopList.push(toId(name));
			room.chatRoomData.shop = room.shop;
			room.chatRoomData.shopList = room.shopList;
			Rooms.global.writeChatRoomData();
			this.sendReply('Added "' + name + '" to the room shop for ' + price + ' ' + ((price === 1) ? " buck." : " bucks.") + '.');
			break;
		case 'remove':
		case 'rem':
		case 'del':
		case 'delete':
			if (!user.can('roommod', null, room)) return this.sendReply('/roomshop - Access denied.');
			if (params.length < 1) return this.sendReply('Usage: /roomshop delete [item name]');
			item = params.shift();
			if (!room.shop[toId(item)]) return this.sendReply('/roomshop - Item "' + item + '" not found.');
			delete room.shop[toId(item)];
			let index = room.shopList.indexOf(toId(item));
			if (index > -1) {
				room.shopList.splice(index, 1);
			}
			this.sendReply('Removed "' + item + '" from the room shop.');
			break;
		case 'buy':
			if (params.length < 1) return this.sendReply('Usage: /roomshop buy [item name]');
			item = params.shift();
			if (!room.shop[toId(item)]) return this.sendReply('/roomshop - Item "' + item + '" not found.');
			Economy.readMoney(user.userid, money => {
				if (money < room.shop[toId(item)].price) return this.sendReply('You don\'t have enough bucks to purchase a ' + item + '. You need ' + ((money - room.shop[toId(item)].price) * -1) + ' more bucks.');
				if (!room.shopBank) room.shopBank = room.founder;
				this.parse('/confirmtransferbucks ' + room.shopBank + ',' + room.shop[toId(item)].price);
				fs.appendFile('logs/roomshop_' + room.id + '.txt', '[' + new Date().toJSON() + '] ' + user.name + ' has purchased a ' +
					room.shop[toId(item)].price + ' for ' + room.shop[toId(item)].price + ' ' + ((price === 1) ? " buck." : " bucks.") + '.\n'
				);
				room.add(user.name + ' has purchased a ' + room.shop[toId(item)].name + ' for ' + room.shop[toId(item)].price + ' ' + ((price === 1) ? " buck." : " bucks.") + '.').update();
			});
			break;
		case 'help':
			if (!this.runBroadcast()) return;
			this.sendReplyBox('The following is a list of room shop commands: <br />' +
				'/roomshop view/list - Shows a complete list of shop items.`<br />' +
				'/roomshop add [item name], [description], [price] - Adds an item to the shop.<br />' +
				'/roomshop delete/remove [item name] - Removes an item from the shop.<br />' +
				'/roomshop buy [item name] - Purchases an item from the shop.<br />' +
				'/roomshop viewlog [number of lines OR word to search for] - Views the last 15 lines in the shop log.<br />' +
				'/roomshop bank [username] - Sets the room bank to [username]. The room bank receives all funds from purchases in the shop.'
			);
			break;
		case 'setbank':
		case 'bank':
			if (user.userid !== room.founder && !user.can('seniorstaff')) return this.sendReply('/roomshop - Access denied.');
			if (params.length < 1) return this.sendReply('Usage: /roomshop bank [username]');
			let bank = params.shift();
			room.shopBank = toId(bank);
			room.chatRoomData.shopBank = room.shopBank;
			Rooms.global.writeChatRoomData();
			this.sendReply('The room bank is now set to ' + room.shopBank);
			break;
		case 'log':
		case 'viewlog':
			if (!user.can('roommod', null, room)) return this.sendReply('/roomshop - Access denied.');
			target = params.shift();
			let lines = 0;
			if (!target.match('[^0-9]')) {
				lines = parseInt(target || 15);
				if (lines > 100) lines = 100;
			}
			let filename = 'logs/roomshop_' + room.id + '.txt';
			let command = 'tail -' + lines + ' ' + filename;
			let grepLimit = 100;
			if (!lines || lines < 0) { // searching for a word instead
				if (target.match(/^["'].+["']$/)) target = target.substring(1, target.length - 1);
				command = "awk '{print NR,$0}' " + filename + " | sort -nr | cut -d' ' -f2- | grep -m" + grepLimit +
					" -i '" + target.replace(/\\/g, '\\\\\\\\').replace(/["'`]/g, '\'\\$&\'').replace(/[\{\}\[\]\(\)\$\^\.\?\+\-\*]/g, '[$&]') + "'";
			}

			require('child_process').exec(command, function (error, stdout, stderr) {
				if (error && stderr) {
					user.popup('/roomshop viewlog erred - the shop log does not support Windows');
					console.log('/roomshop viewlog error: ' + error);
					return false;
				}
				if (lines) {
					if (!stdout) {
						user.popup('The log is empty.');
					} else {
						user.popup('Displaying the last ' + lines + ' lines of shop purchases:\n\n' + stdout);
					}
				} else {
					if (!stdout) {
						user.popup('No purchases containing "' + target + '" were found.');
					} else {
						user.popup('Displaying the last ' + grepLimit + ' logged purchases containing "' + target + '":\n\n' + stdout);
					}
				}
			});
			break;
		}
	},

	'!bucks': true,
	bucks: function (target, room, user) {
		if (!this.runBroadcast()) return;

		Wisp.database.all("SELECT SUM(bucks) FROM users;", (err, rows) => {
			if (err) return console.log("bucks1: " + err);
			let totalBucks = rows[0]['SUM(bucks)'];
			Wisp.database.all("SELECT bucks FROM users WHERE bucks > 0;", (err, rows) => {
				if (err) return console.log("bucks2: " + err);
				let userCount = rows.length;
				Wisp.database.all("SELECT * FROM users ORDER BY bucks DESC LIMIT 1;", (err, rows) => {
					if (err) return console.log("bucks3: " + err);
					let richestUser = rows[0].userid;
					let richestUserMoney = rows[0].bucks;
					if (Users.getExact(richestUser)) richestUser = Users.getExact(richestUser).name;
					Wisp.database.all("SELECT AVG(bucks) FROM users WHERE bucks > 0;", (err, rows) => {
						if (err) return console.log("bucks4: " + err);
						let averageBucks = rows[0]['AVG(bucks)'];

						this.sendReplyBox("The richest user is currently <b><font color=#24678d>" + Tools.escapeHTML(richestUser) + "</font></b> with <b><font color=#24678d>" +
							richestUserMoney + "</font></b> bucks.</font></b><br />There is a total of <b><font color=#24678d>" +
							userCount + "</font></b> users with at least one buck.<br /> The average user has " +
							"<b><font color=#24678d>" + Math.round(averageBucks) + "</font></b> bucks.<br /> There is a total of <b><font color=#24678d>" +
							totalBucks + "</font></b> bucks in the economy."
						);
						if (room) room.update();
					});
				});
			});
		});
	},

	'!richestuser': true,
	richestusers: 'richestuser',
	richestuser: function (target, room, user) {
		if (!target) target = 10;
		target = Number(target);
		if (isNaN(target)) target = 10;
		if (!this.runBroadcast()) return;
		if (this.broadcasting && target > 10) target = 10; // limit to 10 while broadcasting
		if (target > 500) target = 500;

		let self = this;

		function showResults(rows) {
			let output = '<table border="1" cellspacing ="0" cellpadding="3"><tr><th>Rank</th><th>Name</th><th>Bucks</th></tr>';
			let count = 1;
			for (let u in rows) {
				if (!rows[u].bucks || rows[u].bucks < 1) continue;
				let username;
				if (rows[u].name !== null) {
					username = rows[u].name;
				} else {
					username = rows[u].userid;
				}
				output += '<tr><td>' + count + '</td><td>' + Wisp.nameColor(username, true) + '</td><td>' + rows[u].bucks + '</td></tr>';
				count++;
			}
			self.sendReplyBox(output);
			if (room) room.update();
		}

		Wisp.database.all("SELECT userid, bucks, name FROM users ORDER BY bucks DESC LIMIT $target;", {$target: target}, function (err, rows) {
			if (err) return console.log("richestuser: " + err);
			showResults(rows);
		});
	},

	customsymbol: function (target, room, user) {
		let bannedSymbols = ['!', '|', '‽', '\u2030', '\u534D', '\u5350', '\u223C'];
		for (let u in Config.groups) if (Config.groups[u].symbol) bannedSymbols.push(Config.groups[u].symbol);
		if (!user.canCustomSymbol && !user.can('vip')) return this.sendReply('You need to buy this item from the shop to use.');
		if (!target || target.length > 1) return this.sendReply('/customsymbol [symbol] - changes your symbol (usergroup) to the specified symbol. The symbol can only be one character');
		if (target.match(/([a-zA-Z ^0-9])/g) || bannedSymbols.indexOf(target) >= 0) {
			return this.sendReply('This symbol is banned.');
		}
		user.customSymbol = target;
		user.updateIdentity();
		user.canCustomSymbol = false;
		this.sendReply('Your symbol is now ' + target + '. It will be saved until you log off for more than an hour, or the server restarts. You can remove it with /resetsymbol');
	},

	removesymbol: 'resetsymbol',
	resetsymbol: function (target, room, user) {
		if (!user.hasCustomSymbol) return this.sendReply("You don't have a custom symbol!");
		delete user.customSymbol;
		user.updateIdentity();
		this.sendReply('Your symbol has been removed.');
	},

	profile: function (target, room, user) {
		if (!target) target = user.name;
		if (toId(target).length > 19) return this.sendReply("Usernames may not be more than 19 characters long.");
		if (toId(target).length < 1 || toId(target) === 'constructor') return this.sendReply(target + " is not a valid username.");
		if (!this.runBroadcast()) return;

		let targetUser = Users.getExact(target);
		let username = (targetUser ? targetUser.name : target);
		let userid = toId(username);

		let customAvatarUrl = "http://" + serverIp + ":" + Config.port + "/avatars/";
		let avatar = (Config.customavatars[userid] ? customAvatarUrl + Config.customavatars[userid] : "http://play.pokemonshowdown.com/sprites/trainers/167.png");
		if (targetUser) {
			avatar = (isNaN(targetUser.avatar) && targetUser.avatar[0] !== '#' ? customAvatarUrl + targetUser.avatar : "http://play.pokemonshowdown.com/sprites/trainers/" + toId(targetUser.avatar) + ".png");
		}

		let badges = () => {
			let badges = Db('userBadges').get(userid);
			let css = 'border:none;background:none;padding:0;';
			if (typeof badges !== 'undefined' && badges !== null) {
				let output = ' <table style="' + css + '"> <tr>';
				for (let i = 0; i < badges.length; i++) {
					if (i !== 0 && i % 4 === 0) output += '</tr> <tr>';
					output += '<td><button style="' + css + '" name="send" value="/badges info, ' + badges[i] + '">' +
					'<img src="' + Db('badgeData').get(badges[i])[1] + '" height="16" width="16" alt="' + badges[i] + '" title="' + badges[i] + '" >' + '</button></td>';
				}
				output += '</tr> </table>';
				return output;
			}
			return '';
		};

		let userSymbol = (Users.usergroups[userid] ? Users.usergroups[userid].substr(0, 1) : "Regular User");
		let userGroup = (Config.groups[userSymbol] ? Config.groups[userSymbol].name : "Regular User");
		let flag = '';
		if (targetUser) {
			let country = geoip.lookupCountry(targetUser.latestIp);
			if (country) flag = ' <img title = "' + country + '" src = "http://' + serverIp + ':' + Config.port + '/flags/' + country.toLowerCase() + '.gif">';
		}


		let league = Wisp.getLeague(userid);
		let leagueRank = Wisp.getLeagueRank(userid);

		getProfileData(userid, userData => {
			let reply = '';
			reply += '|raw|<div class="infobox"' + (userData.background === '' ? '' : ' style="background: url(&quot;' + Tools.escapeHTML(userData.background) + '&quot;); background-size: contain;"') + '>';
			reply += '<table' + (userData.background === '' ? '' : '') + '><tr>';

			reply += '<td' + (userData.background === '' ? '' : ' style="background-color: rgba(255, 255, 255, 0.8); border-radius: 25px; padding: 10px;"') + '><img src="' + avatar + '" height="80" width="80"></td>';
			reply += '<td' + (userData.background === '' ? '' : ' style="background-color: rgba(255, 255, 255, 0.8); border-radius: 25px; padding: 10px;"') + '><font color="#B30000"><b>Name:</b></font> ' + Wisp.nameColor(userid, true) + (userData.title === "" ? '' : ' (' + userData.title + ')') + flag + '<br />';
			reply += '<font color="#B30000"><b>Registered:</b></font> ' + userData.regdate + '<br />';
			reply += '<font color="#B30000"><b>Rank:</b></font> ' + Tools.escapeHTML(userGroup) + '<br />';
			reply += '<font color="#B30000"><b>League:</b></font> ' + (league ? league + (leagueRank ? ' (' + leagueRank + ')' : '') : 'N/A') + '<br />';
			reply += '<font color="#B30000"><b>Bucks:</b></font> ' + userData.bucks + '<br />';
			reply += '<font color="#B30000"><b>Last Online:</b></font> ' + (targetUser && targetUser.connected ? '<font color="green">Currently Online</font> (Last Active: ' + moment(targetUser.lastActive).fromNow() + ')' : (userData.lastOnline === 'Never' ? userData.lastOnline : moment(userData.lastOnline).format("MMMM Do YYYY, h:mm:ss A") + ' EST. (' + moment(userData.lastOnline).fromNow() + ')')) + '<br />';

			reply += '</td><td><div class="card-button" style="background: rgba(255, 255, 255, 0.8); text-align: center; border-radius: 12px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2) inset; margin: 2px 2px 2px 0px">' + badges() + '</div></td>';
			reply += '</tr>';
			if (userData.music !== "") reply += '<tr><td colspan="2"><audio style="width: 100%;"src="' + Tools.escapeHTML(userData.music) + '" controls=""></audio></td></tr>';
			reply += '</table></div>';

			//reply += '<div style="position: relative; left: 50px; background: rgba(255, 255, 255, 0.8);float: left; text-align: center; border-radius: 12px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2) inset; margin: 2px 2px 2px 0px" class="card-button">' + badges() + '</div><br clear="all"/></div>';

			/*lastOnline = (lastOnline ? moment(lastOnline).format("MMMM Do YYYY, h:mm:ss A") + ' EST. (' + moment(lastOnline).fromNow() + ')' : "Never");
			if (targetUser && targetUser.connected && targetUser.lastActive) lastOnline = moment(targetUser.lastActive).fromNow();
			let profile = '|raw|';
			profile += '<div class="infobox"' + ((background && background !== '') ? ' style="background: url&quot;' + Tools.escapeHTML(background) + '&quot;); background-size: contain;">' : '>');
			profile += '<div style="float: left; width: 500px; background: rgba(255, 255, 255, 0.8); border-radius: 25px; padding: 10px;"> <img src="' + avatar + '" height=80 width=80 align=left>';
			profile += '&nbsp;<font color=#b30000><b>Name: </font>' + Wisp.nameColor(userid, true) + (title === "" ? "" : " (" + title + ")") + flag + '<br />';
			profile += '&nbsp;<font color=#b30000><b>Registered: </font></b>' + regdate + '<br />';
			profile += '&nbsp;<font color=#b30000><b>Rank: </font></b>' + userGroup + (Users.vips[userid] ? ' (<font color=#6390F0><b>VIP User</b></font>)' : '') + '<br />';
			if (league) profile += '&nbsp;<font color=#b30000><b>League: </font></b>' + league + (leagueRank ? ' (' + leagueRank + ')' : '') + '<br />';
			if (bucks) profile += '&nbsp;<font color=#b30000><b>Bucks: </font></b>' + bucks + '<br />';
			if (friendCode) profile += '&nbsp;<font color=#b30000><b>Friendcode: </font></b>' + friendCode + '<br />';
			profile += '&nbsp;<font color=#b30000><b>Last ' + (targetUser && targetUser.connected ? 'Active' : 'Online') + ': </font></b> ' + lastOnline;
			profile += '</div><div style="position: relative; left: 50px; background: rgba(255, 255, 255, 0.8);float: left; text-align: center; border-radius: 12px; box-shadow: 0px 0px 5px rgba(0, 0, 0, 0.2) inset; margin: 2px 2px 2px 0px" class="card-button">' + badges() + '</div>';
			profile += '<br clear="all">';
			profile += '</div>';*/
			this.sendReply(reply);
			room.update();
		});
	},

	economycode: function (target, room, user) {
		if (!this.runBroadcast()) return;
		this.sendReplyBox("Economy code by: <a href=\"https://gist.github.com/jd4564/d6e8f4140b7abc9295e1\">jd</a>");
	},
};
