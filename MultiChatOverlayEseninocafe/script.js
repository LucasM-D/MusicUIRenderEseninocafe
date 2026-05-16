const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const sbServerAddress = urlParams.get("address") || "127.0.0.1";
const sbServerPort = urlParams.get("port") || "8080";

const BASE_WIDTH = 502;
const TARGET_WIDTH = 648; 
const scaleFactor = TARGET_WIDTH / BASE_WIDTH; 

document.body.style.width = `${BASE_WIDTH}px`;
document.body.style.height = `${100 / scaleFactor}vh`;
document.body.style.transform = `scale(${scaleFactor})`;
document.body.style.transformOrigin = "top left";

const showPlatform = GetBooleanParam("showPlatform", true);
const showAvatar = GetBooleanParam("showAvatar", true);
const showTimestamps = GetBooleanParam("showTimestamps", true);
const showBadges = GetBooleanParam("showBadges", true);
const showUsername = GetBooleanParam("showUsername", true);
const showMessage = GetBooleanParam("showMessage", true);

const font = urlParams.get("font") || "";
const background = urlParams.get("background") || "#ffffff";

const hideAfter = GetIntParam("hideAfter") || 0;
const excludeCommands = GetBooleanParam("excludeCommands", true);
const ignoreChatters = urlParams.get("ignoreChatters") || "";
const scrollDirection = GetIntParam("scrollDirection") || 1;
const imageEmbedPermissionLevel = GetIntParam("imageEmbedPermissionLevel") || 20;

const showTwitchMessages = GetBooleanParam("showTwitchMessages", true);
const showTwitchAnnouncements = GetBooleanParam("showTwitchAnnouncements", true);
const showTwitchSubs = GetBooleanParam("showTwitchSubs", true);
const showTwitchRaids = GetBooleanParam("showTwitchRaids", true);

const showYouTubeMessages = GetBooleanParam("showYouTubeMessages", true);
const showYouTubeSuperChats = GetBooleanParam("showYouTubeSuperChats", true);
const showYouTubeSuperStickers = GetBooleanParam("showYouTubeSuperStickers", true);
const showYouTubeMemberships = GetBooleanParam("showYouTubeMemberships", true);

const showStreamlabsDonations = GetBooleanParam("showStreamlabsDonations", true);
const showStreamElementsTips = GetBooleanParam("showStreamElementsTips", true);

if (font) document.body.style.fontFamily = font;
document.body.style.background = background;

const ignoreUserList = ignoreChatters.split(',').map(item => item.trim().toLowerCase());
const messageList = document.getElementById('messageList');

if (scrollDirection === 1) messageList.classList.add('normalScrollDirection');
else if (scrollDirection === 2) messageList.classList.add('reverseScrollDirection');

const client = new StreamerbotClient({
	host: sbServerAddress,
	port: sbServerPort,
	onConnect: () => SetConnectionStatus(true),
	onDisconnect: () => SetConnectionStatus(false),
});

client.on('Twitch.ChatMessage', (data) => TwitchChatMessage(data.data));
client.on('Twitch.ChatMessageDeleted', (data) => TwitchChatMessageDeleted(data.data));
client.on('Twitch.UserBanned', (data) => TwitchUserBanned(data.data));
client.on('Twitch.ChatCleared', (data) => TwitchChatCleared(data.data));
client.on('Twitch.Sub', (data) => TwitchSub(data.data));
client.on('Twitch.ReSub', (data) => TwitchResub(data.data));
client.on('Twitch.GiftSub', (data) => TwitchGiftSub(data.data));
client.on('Twitch.Raid', (data) => TwitchRaid(data.data));
client.on('Twitch.Announcement', (data) => TwitchAnnouncement(data.data));
client.on('Twitch.RewardRedemption', (data) => TwitchAutomaticRewardRedemption(data.data));

client.on('YouTube.Message', (data) => YouTubeMessage(data.data));
client.on('YouTube.SuperChat', (data) => YouTubeSuperChat(data.data));
client.on('YouTube.SuperSticker', (data) => YouTubeSuperSticker(data.data));
client.on('YouTube.NewSponsor', (data) => YouTubeNewSponsor(data.data));
client.on('YouTube.MembershipGift', (data) => YouTubeGiftMembershipReceived(data.data));

client.on('Streamlabs.Donation', (data) => StreamlabsDonation(data.data));
client.on('StreamElements.Tip', (data) => StreamElementsTip(data.data));

function SetConnectionStatus(connected) {
	let statusContainer = document.getElementById("statusContainer");
	if (connected) {
		statusContainer.style.background = "#2FB774";
		statusContainer.innerText = "Connected!";
		statusContainer.style.opacity = 1;
		setTimeout(() => {
			statusContainer.style.transition = "all 2s ease";
			statusContainer.style.opacity = 0;
		}, 10);
	}
	else {
		statusContainer.style.background = "#D12025";
		statusContainer.innerText = "Connecting...";
		statusContainer.style.transition = "";
		statusContainer.style.opacity = 1;
	}
}

async function renderFeaturedMessage(data, headerText, platform) {
	const template = document.getElementById('featuredMessageTemplate');
	if (!template) return;
	const instance = template.content.cloneNode(true);

	instance.querySelector(".featured-header-text").innerText = headerText;
	instance.querySelector("#timestamp").innerText = GetCurrentTimeFormatted();

	const usernameSpan = instance.querySelector("#username");
	usernameSpan.innerText = data.user.name;
	usernameSpan.style.color = data.user.color || '#000000';
	
	const avatarUrl = await GetAvatar(data.user.name, data.user.profileImageUrl);
	instance.querySelector("#avatar").innerHTML = `<img src="${avatarUrl}" class="avatar">`;
	
	const platformIcon = platform === 'twitch' ? 'icons/platforms/twitch.png' : 'icons/platforms/youtube.png';
	instance.querySelector("#platform").innerHTML = `<img src="${platformIcon}">`;

	instance.querySelector(".featured-message-text").innerHTML = linkify(data.text || data.message || "");

	AddSubCardItem(instance, data.messageId || data.eventId, platform, data.user.id);
}

async function renderEventCard(data, type, platform) {
	const template = document.getElementById('subCardTemplate');
	const instance = template.content.cloneNode(true);

	const avatarDiv = instance.querySelector("#avatar");
	const platformDiv = instance.querySelector("#platform");
	const usernameDiv = instance.querySelector("#username");
	const timestampDiv = instance.querySelector("#timestamp");
	const descDiv = instance.querySelector(".sub-description");
	const iconImg = instance.querySelector(".sub-skull-icon");

	if (type === 'raid') {
		iconImg.src = 'icons/raid-bell.svg';
		iconImg.className = 'sub-raid-icon';
	} else if (type === 'donation' || type === 'superchat') {
		iconImg.src = 'icons/donation-paper-bag.svg';
		iconImg.className = 'sub-donation-icon';
	} else {
		iconImg.src = 'icons/sub-skull.svg';
		iconImg.className = 'sub-skull-icon';
	}

	if (showTimestamps) {
		timestampDiv.classList.add("timestamp");
		timestampDiv.innerText = GetCurrentTimeFormatted();
	}

	const isIndividualGift = (type === 'gift' && data.recipient);
	const senderName = data.isAnonymous ? 'Anonymous' : (data.user ? (data.user.name || data.user.displayName) : 'Unknown');
	const receiverName = isIndividualGift ? (data.recipient.name || data.recipient.displayName) : '';

	if (showUsername) {
		usernameDiv.textContent = senderName;
		usernameDiv.style.color = (platform === 'twitch') ? '#A644FF' : '#FF0000';
		if (senderName === 'Anonymous') usernameDiv.classList.add('is-anonymous');
	}

	if (showPlatform && !data.isAnonymous) {
		platformDiv.innerHTML = `<img src="icons/platforms/${platform}.png" class="platform"/>`;
	}

	if (showAvatar && !data.isAnonymous) {
		const avatarURL = await GetAvatar(senderName, data.user?.profileImageUrl);
		avatarDiv.innerHTML = `<img src="${avatarURL}" class="avatar">`;
	}
	
	if (isIndividualGift) {
		const receiverSpan = instance.querySelector("#gift-receiver");
		if (receiverSpan) {
			receiverSpan.style.display = 'flex';
			const recAvatarDiv = instance.querySelector("#receiver-avatar");
			if (showAvatar) {
				const recAvatarURL = await GetAvatar(receiverName, data.recipient?.profileImageUrl);
				recAvatarDiv.innerHTML = `<img src="${recAvatarURL}" class="avatar">`;
			}
			if (showPlatform) instance.querySelector("#receiver-platform").innerHTML = `<img src="icons/platforms/${platform}.png" class="platform"/>`;
			
			const recUsernameDiv = instance.querySelector("#receiver-username");
			recUsernameDiv.innerText = receiverName;
			recUsernameDiv.style.color = (platform === 'twitch') ? '#A644FF' : '#FF0000';
		}
	}

	let description = '';
	switch(type) {
		case 'sub':
			description = data.is_prime || data.isPrime ? `Used Their Prime Sub` : `Subscribed With Tier ${String(data.sub_tier || data.subTier || '1').charAt(0)}`;
			break;
		case 'resub':
			const months = data.cumulativeMonths || '14';
			description = data.isPrime ? `Used Their Prime Sub {calendar} ${months} Months` : `Resubscribed With Tier ${String(data.subTier || '1').charAt(0)} {calendar} ${months} Months`;
			break;
		case 'gift':
			description = platform === 'twitch' ? `Gifted a Tier ${String(data.subTier || '1').charAt(0)} Subscription` : `Gifted a Channel Membership`;
			break;
		case 'giftbomb':
			description = platform === 'twitch' ? `Gifted ${data.giftCount} Tier ${String(data.subTier || '1').charAt(0)} Subs to the Community` : `Gifted ${data.giftCount} Memberships to the Community`;
			break;
		case 'member':
			description = `Became a Channel Member!`;
			break;
		case 'raid':
			description = `Raiding with a Party of ${data.viewers} Homies`;
			break;
		case 'donation':
			description = `Donated ${data.formattedAmount}`;
			break;
		case 'superchat':
			description = `Donated ${data.amount} Through Super Chat`;
			break;
	}

	const calendarImg = `<img src="icons/calendar.svg" class="sub-calendar-icon">`;
	descDiv.innerHTML = description.replace('{calendar}', calendarImg);

	const commentWrapper = instance.querySelector(".sub-comment-wrapper");
	const message = data.text || data.message;
	if (message && message.trim().length > 0) {
		commentWrapper.style.display = "block";
		instance.querySelector(".sub-comment-text").innerText = message;
	}

	AddSubCardItem(instance, data.messageId || data.eventId, platform, data.user?.id);
}

async function TwitchChatMessage(data) {
	if (data.isFirstMessage) return await renderFeaturedMessage(data, "FIRST TIME CHAT", 'twitch');
	if (!showTwitchMessages || (data.message.message.startsWith("!") && excludeCommands) || ignoreUserList.includes(data.message.username)) return;

	const template = document.getElementById('messageTemplate');
	const instance = template.content.cloneNode(true);

	const replyDiv = instance.querySelector("#reply");
	if (data.message.isReply && showMessage) {
		replyDiv.style.display = 'flex';
		const replyUserDiv = instance.querySelector("#replyUser");
		replyUserDiv.innerText = data.message.reply.userName;
		replyUserDiv.style.color = '#A644FF';
		instance.querySelector("#replyMsg").innerText = data.message.reply.msgBody;
	} else if (replyDiv) {
		replyDiv.remove();
	}

	if (showTimestamps) instance.querySelector("#timestamp").innerText = GetCurrentTimeFormatted();

	if (showUsername) {
		const usernameDiv = instance.querySelector("#username");
		usernameDiv.innerText = data.message.displayName;
		usernameDiv.style.color = data.message.color;
	}

	const messageDiv = instance.querySelector("#message");
	if (showMessage) messageDiv.innerText = data.message.message;
	if (data.message.isMe) messageDiv.style.color = data.message.color;

	if (showPlatform) instance.querySelector("#platform").innerHTML = `<img src="icons/platforms/twitch.png" class="platform"/>`;

	if (showBadges) {
		const badgeListDiv = instance.querySelector("#badgeList");
		badgeListDiv.innerHTML = "";
		data.message.badges.forEach(b => {
			const badge = new Image(); badge.src = b.imageUrl; badge.classList.add("badge");
			badgeListDiv.appendChild(badge);
		});
	}

	data.emotes.forEach(e => {
		messageDiv.innerHTML = messageDiv.innerHTML.replace(new RegExp(`\\b${e.name}\\b`), `<img src="${e.imageUrl}" class="emote"/>`);
	});

	if (data.cheerEmotes) {
		data.cheerEmotes.forEach(e => {
			const bitsElements = `<span class="bits">${e.bits}</span>`;
			messageDiv.innerHTML = messageDiv.innerHTML.replace(new RegExp(`\\b${e.name}${e.bits}\\b`, 'i'), `<img src="${e.imageUrl}" class="emote"/>` + bitsElements);
		});
	}

	if (showAvatar) {
		const avatarURL = await GetAvatar(data.message.username);
		instance.querySelector("#avatar").innerHTML = `<img src="${avatarURL}" class="avatar">`;
	}

	const messageList = document.getElementById("messageList");
	if (messageList.children.length > 0 && scrollDirection !== 2) {
		const lastPlatform = messageList.lastChild.dataset.platform;
		const lastUserId = messageList.lastChild.dataset.userId;
		if (lastPlatform === "twitch" && lastUserId === data.user.id) instance.querySelector("#userInfo").style.display = "none";
	}

	const messageText = data.message.message;
	if (IsThisUserAllowedToPostImagesOrNotReturnTrueIfTheyCanReturnFalseIfTheyCannot(imageEmbedPermissionLevel, data, 'twitch') && IsImageUrl(messageText)) {
		const image = new Image();
		image.onload = function () {
			image.style.padding = "10px 0px";
			image.style.width = "100%";
			image.style.display = "block";
			messageDiv.innerHTML = '';
			messageDiv.appendChild(image);
			AddMessageItem(instance, data.message.msgId, 'twitch', data.user.id);
		};
		try {
			const urlObj = new URL(messageText);
			urlObj.search = '';
			urlObj.hash = '';
			image.src = "https://external-content.duckduckgo.com/iu/?u=" + encodeURIComponent(urlObj.toString());
		} catch (e) {
			AddMessageItem(instance, data.message.msgId, 'twitch', data.user.id);
		}
	} else {
		AddMessageItem(instance, data.message.msgId, 'twitch', data.user.id);
	}
}

async function TwitchSub(data) { if (showTwitchSubs) await renderEventCard(data, 'sub', 'twitch'); }
async function TwitchResub(data) { if (showTwitchSubs) await renderEventCard(data, 'resub', 'twitch'); }
async function TwitchRaid(data) {
	if (!showTwitchRaids) return;
	if (!data.user) data.user = { id: data.from_broadcaster_user_id, name: data.from_broadcaster_user_name, login: data.from_broadcaster_user_login };
	await renderEventCard(data, 'raid', 'twitch');
}
async function TwitchAnnouncement(data) { if (showTwitchAnnouncements) await renderFeaturedMessage(data, "ANNOUNCEMENT", 'twitch'); }
async function TwitchAutomaticRewardRedemption(data) {
	if (data.reward_type !== 'gigantify_an_emote') return;

	const template = document.getElementById('messageTemplate');
	if (!template) return;
	
	const instance = template.content.cloneNode(true);
	const userInfoDiv = instance.querySelector("#userInfo");
	const messageDiv = instance.querySelector("#message");

	if (userInfoDiv) userInfoDiv.style.display = "none";

	const gigaEmote = data.gigantified_emote?.imageUrl || data.gigantified_emote?.url;
	if (!gigaEmote) return;

	const image = new Image();
	image.src = gigaEmote;
	image.style.padding = "10px 0px";
	image.style.width = "50%";
	image.style.display = "block";
	image.style.margin = "0 auto"; 

	image.onload = function () {
		messageDiv.innerHTML = '';
		messageDiv.appendChild(image);
		const userId = data.user_id || data.user?.id || 'reward_user';
		AddMessageItem(instance, data.id, 'twitch', userId);
	};
}

const GIFT_BOMB_WINDOW_MS = 800; 
const giftBombBuffer = new Map(); 

function accumulateGift(data, platform) {
	const senderId = data.isAnonymous ? '__anonymous__' : (data.user ? (data.user.id || data.user.login || data.user.name) : '__unknown__');
	const key = `${platform}:${senderId}`;

	if (giftBombBuffer.has(key)) {
		const entry = giftBombBuffer.get(key);
		entry.count++;
		clearTimeout(entry.timer);
		entry.timer = setTimeout(() => flushGiftBomb(key), GIFT_BOMB_WINDOW_MS);
	} else {
		giftBombBuffer.set(key, { data, platform, count: 1, timer: setTimeout(() => flushGiftBomb(key), GIFT_BOMB_WINDOW_MS) });
	}
}

function flushGiftBomb(key) {
	const entry = giftBombBuffer.get(key);
	if (!entry) return;
	giftBombBuffer.delete(key);
	const { data, platform, count } = entry;

	if (count === 1) renderEventCard(data, 'gift', platform);
	else renderEventCard({ ...data, giftCount: count, recipient: null, messageId: `giftbomb-${Date.now()}` }, 'giftbomb', platform);
}

async function TwitchGiftSub(data) { if (showTwitchSubs) accumulateGift(data, 'twitch'); }

function TwitchChatMessageDeleted(data) {
	document.querySelectorAll(`li[id="${data.messageId}"]`).forEach(item => {
		item.style.opacity = 0; 
		item.style.height = 0;
		item.style.paddingTop = 0;
		item.style.paddingBottom = 0;
		item.style.marginTop = 0;
		item.style.marginBottom = 0;
		setTimeout(() => item.remove(), 400);
	});
}
function TwitchUserBanned(data) {
	document.querySelectorAll(`li[data-user-id="${data.user_id}"]`).forEach(item => item.remove());
}
function TwitchChatCleared() {
	document.getElementById("messageList").innerHTML = '';
}

async function YouTubeMessage(data) {
	if (data.isFirstMessage) return await renderFeaturedMessage(data, "FIRST TIME CHAT", 'youtube');
	if (!showYouTubeMessages || (data.message.startsWith("!") && excludeCommands) || ignoreUserList.includes(data.user.name)) return;

	const template = document.getElementById('messageTemplate');
	const instance = template.content.cloneNode(true);

	const replyDiv = instance.querySelector("#reply");
	if (replyDiv) replyDiv.remove();

	if (showTimestamps) instance.querySelector("#timestamp").innerText = GetCurrentTimeFormatted();

	if (showUsername) {
		const usernameDiv = instance.querySelector("#username");
		usernameDiv.innerText = data.user.name;
		usernameDiv.style.color = "#f70000";	
	}

	const messageDiv = instance.querySelector("#message");
	if (showMessage) messageDiv.innerText = data.message;

	if (showPlatform) instance.querySelector("#platform").innerHTML = `<img src="icons/platforms/youtube.png" class="platform"/>`;

	if (showBadges) {
		const badgeListDiv = instance.querySelector("#badgeList");
		badgeListDiv.innerHTML = ""; 
		const addBadge = (icon) => { const b = new Image(); b.src = `icons/badges/${icon}`; b.style.filter = `invert(100%)`; b.style.opacity = 0.8; b.classList.add("badge"); badgeListDiv.appendChild(b); };
		if (data.user.isOwner) addBadge('youtube-broadcaster.svg');
		if (data.user.isModerator) addBadge('youtube-moderator.svg');
		if (data.user.isSponsor) addBadge('youtube-member.svg');
		if (data.user.isVerified) addBadge('youtube-verified.svg');
	}

	data.emotes.forEach(e => { messageDiv.innerHTML = messageDiv.innerHTML.replace(e.name, `<img src="${e.imageUrl}" class="emote"/>`); });

	if (showAvatar) instance.querySelector("#avatar").innerHTML = `<img src="${data.user.profileImageUrl || await GetAvatar(data.user.name)}" class="avatar">`;

	const messageList = document.getElementById("messageList");
	if (messageList.children.length > 0 && scrollDirection !== 2) {
		const lastPlatform = messageList.lastChild.dataset.platform;
		const lastUserId = messageList.lastChild.dataset.userId;
		if (lastPlatform === "youtube" && lastUserId === data.user.id) instance.querySelector("#userInfo").style.display = "none";
	}

	const messageText = data.message;
	if (IsThisUserAllowedToPostImagesOrNotReturnTrueIfTheyCanReturnFalseIfTheyCannot(imageEmbedPermissionLevel, data, 'youtube') && IsImageUrl(messageText)) {
		const image = new Image();
		image.onload = function () {
			image.style.padding = "10px 0px";
			image.style.width = "100%";
			image.style.display = "block";
			messageDiv.innerHTML = '';
			messageDiv.appendChild(image);
			AddMessageItem(instance, data.eventId, 'youtube', data.user.id);
		};
		try {
			const urlObj = new URL(messageText);
			urlObj.search = '';
			urlObj.hash = '';
			image.src = "https://external-content.duckduckgo.com/iu/?u=" + encodeURIComponent(urlObj.toString());
		} catch (e) {
			AddMessageItem(instance, data.eventId, 'youtube', data.user.id);
		}
	} else {
		AddMessageItem(instance, data.eventId, 'youtube', data.user.id);
	}
}

async function YouTubeSuperChat(data) {
	if (!showYouTubeSuperChats) return;
	if (!data.user) data.user = { id: data.eventId || 'yt-user', name: data.user ? data.user.name : 'YouTube Fan' };
	await renderEventCard(data, 'superchat', 'youtube');
}
function YouTubeSuperSticker(data) {
	if (!showYouTubeSuperStickers) return;
	const template = document.getElementById('cardTemplate').content.cloneNode(true);
	const cardDiv = template.querySelector("#card");
	cardDiv.classList.add('youtube');
	
	const stickerInstance = document.getElementById('stickerTemplate').content.cloneNode(true);
	stickerInstance.querySelector("#stickerImg").src = FindFirstImageUrl(data);
	stickerInstance.querySelector("#stickerLabel").innerText = `${data.user.name} sent a Super Sticker (${data.amount})`;
	template.querySelector("#content").appendChild(stickerInstance);
	AddMessageItem(template, data.eventId, 'youtube', data.user.id);
}
async function YouTubeNewSponsor(data) { if (showYouTubeMemberships) await renderEventCard(data, 'member', 'youtube'); }
async function YouTubeGiftMembershipReceived(data) {
	if (!showYouTubeMemberships) return;
	accumulateGift({ ...data, user: data.gifter || data.user, recipient: data.recipient || data.user, subTier: data.tier || '1' }, 'youtube');
}

async function StreamlabsDonation(data) {
	if (!showStreamlabsDonations) return;
	if (!data.user) data.user = { id: data.from, name: data.from };
	await renderEventCard(data, 'donation', 'twitch');
}
async function StreamElementsTip(data) {
	if (!showStreamElementsTips) return;
	if (!data.user) data.user = { id: data.username, name: data.username };
	if (!data.formattedAmount) data.formattedAmount = `$${data.amount}`;
	await renderEventCard(data, 'donation', 'twitch');
}

const Simplex3D = (function () {
	const F3 = 1.0 / 3.0, G3 = 1.0 / 6.0;
	const p = new Uint8Array([151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180]);
	const perm = new Uint8Array(512), permMod12 = new Uint8Array(512);
	for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = (perm[i] % 12); }
	function grad(hash, x, y, z) {
		const h = hash & 15; const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
		return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
	}
	return function (xin, yin, zin) {
		let n0, n1, n2, n3;
		const s = (xin + yin + zin) * F3; const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
		const t = (i + j + k) * G3; const X0 = i - t, Y0 = j - t, Z0 = k - t;
		const x0 = xin - X0, y0 = yin - Y0, z0 = zin - Z0;
		let i1, j1, k1, i2, j2, k2;
		if (x0 >= y0) {
			if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; } else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; } else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
		} else {
			if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; } else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; } else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
		}
		const x1=x0-i1+G3, y1=y0-j1+G3, z1=z0-k1+G3;
		const x2=x0-i2+2.0*G3, y2=y0-j2+2.0*G3, z2=z0-k2+2.0*G3;
		const x3=x0-1.0+3.0*G3, y3=y0-1.0+3.0*G3, z3=z0-1.0+3.0*G3;
		const ii=i&255, jj=j&255, kk=k&255;
		let t0=0.6-x0*x0-y0*y0-z0*z0; if(t0<0) n0=0.0; else { t0*=t0; n0=t0*t0*grad(permMod12[ii+perm[jj+perm[kk]]],x0,y0,z0); }
		let t1=0.6-x1*x1-y1*y1-z1*z1; if(t1<0) n1=0.0; else { t1*=t1; n1=t1*t1*grad(permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]],x1,y1,z1); }
		let t2=0.6-x2*x2-y2*y2-z2*z2; if(t2<0) n2=0.0; else { t2*=t2; n2=t2*t2*grad(permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]],x2,y2,z2); }
		let t3=0.6-x3*x3-y3*y3-z3*z3; if(t3<0) n3=0.0; else { t3*=t3; n3=t3*t3*grad(permMod12[ii+1+perm[jj+1+perm[kk+1]]],x3,y3,z3); }
		return 32.0*(n0+n1+n2+n3);
	};
})();

const BOIL_CFG = { cornerRadius: 20, strokeWidth: 7, noiseFreq: 4.2, noiseCoordScale: 0.006, noiseTimeScale: 1.0, noiseAmp: 1.5, divW: 200, divH: 60, divCorner: 10, padding: 10 };
function boilBuildBasePath(W, H, R) {
	const pts =[]; const { divW, divH, divCorner } = BOIL_CFG;
	for (let i=0; i<divW; i++) pts.push({ x: R+(W-2*R)*(i/divW), y: 0 });
	for (let i=0; i<divCorner; i++) pts.push({ x: W-R+R*Math.cos(-Math.PI/2+(Math.PI/2)*(i/divCorner)), y: R+R*Math.sin(-Math.PI/2+(Math.PI/2)*(i/divCorner)) });
	for (let i=0; i<divH; i++) pts.push({ x: W, y: R+(H-2*R)*(i/divH) });
	for (let i=0; i<divCorner; i++) pts.push({ x: W-R+R*Math.cos((Math.PI/2)*(i/divCorner)), y: H-R+R*Math.sin((Math.PI/2)*(i/divCorner)) });
	for (let i=0; i<divW; i++) pts.push({ x: W-R-(W-2*R)*(i/divW), y: H });
	for (let i=0; i<divCorner; i++) pts.push({ x: R+R*Math.cos(Math.PI/2+(Math.PI/2)*(i/divCorner)), y: H-R+R*Math.sin(Math.PI/2+(Math.PI/2)*(i/divCorner)) });
	for (let i=0; i<divH; i++) pts.push({ x: 0, y: H-R-(H-2*R)*(i/divH) });
	for (let i=0; i<divCorner; i++) pts.push({ x: R+R*Math.cos(Math.PI+(Math.PI/2)*(i/divCorner)), y: R+R*Math.sin(Math.PI+(Math.PI/2)*(i/divCorner)) });
	return pts;
}
function boilDeformPath(base, time, seed) {
	const freq = BOIL_CFG.noiseFreq * BOIL_CFG.noiseCoordScale, t = time * BOIL_CFG.noiseTimeScale;
	return base.map(p => ({ x: p.x + Simplex3D(p.x*freq+seed, p.y*freq+seed, t) * BOIL_CFG.noiseAmp, y: p.y + Simplex3D(p.x*freq+seed+99.9, p.y*freq+seed+99.9, t) * BOIL_CFG.noiseAmp }));
}
function boilTraceSmoothPath(c, pts) {
	if (pts.length < 3) return; c.beginPath(); let p1 = pts[0]; c.moveTo((pts[pts.length-1].x+p1.x)/2, (pts[pts.length-1].y+p1.y)/2);
	for (let i=0; i<pts.length; i++) { p1 = pts[i]; const p2 = pts[(i+1)%pts.length]; c.quadraticCurveTo(p1.x, p1.y, (p1.x+p2.x)/2, (p1.y+p2.y)/2); }
	c.closePath();
}
function initBoilingBorder(canvas, contentW, contentH, bottomExtension = 0) {
	const P = BOIL_CFG.padding, R = BOIL_CFG.cornerRadius, cw = contentW + P*2, ch = contentH + P*2 + bottomExtension;
	const dpr = (window.devicePixelRatio || 1) * scaleFactor;
	canvas.width = cw * dpr; canvas.height = ch * dpr;
	canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
	const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
	const basePath = boilBuildBasePath(contentW, contentH + bottomExtension, R), seed = Math.random() * 1000;
	function tick(ts) {
		ctx.clearRect(0, 0, cw, ch); ctx.save(); ctx.translate(P, P);
		const deformed = boilDeformPath(basePath, ts / 1000, seed);
		ctx.fillStyle = '#ffffff'; boilTraceSmoothPath(ctx, deformed); ctx.fill();
		ctx.strokeStyle = '#000000'; ctx.lineWidth = BOIL_CFG.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
		boilTraceSmoothPath(ctx, deformed); ctx.stroke();
		ctx.restore(); requestAnimationFrame(tick);
	}
	requestAnimationFrame(tick);
}

function AddMessageItem(element, elementID, platform, userId, customClasses = [], onAdded = null) {
	const tempContainer = document.createElement('div');
	tempContainer.style.cssText = 'position:absolute; visibility:hidden; width:502px; pointer-events:none;';
	
	const tempLi = document.createElement('li');
	tempLi.style.cssText = 'height:auto !important; transition:none !important; opacity:1 !important; display:block !important;';
	
	customClasses.forEach(cls => tempLi.classList.add(cls));
	
	tempLi.appendChild(element);
	tempContainer.appendChild(tempLi);
	
	const msgList = document.getElementById('messageList');
	msgList.appendChild(tempContainer);

	setTimeout(function () {
		const calculatedHeight = tempLi.offsetHeight + "px";
		
		const lineItem = document.createElement('li');
		lineItem.id = elementID;
		lineItem.dataset.platform = platform;
		lineItem.dataset.userId = userId;
		customClasses.forEach(cls => lineItem.classList.add(cls));
		
		if (scrollDirection === 2) lineItem.classList.add('reverseLineItemDirection');
		
		while (tempLi.firstChild) {
			lineItem.appendChild(tempLi.firstChild);
		}
		
		msgList.removeChild(tempContainer);
		msgList.appendChild(lineItem);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				lineItem.classList.add("show");
				lineItem.style.height = calculatedHeight;
				if (onAdded) onAdded(lineItem);
			});
		});

		while (msgList.clientHeight > 5 * window.innerHeight) {
			if (msgList.firstChild) msgList.removeChild(msgList.firstChild);
			else break;
		}

		if (hideAfter > 0) {
			setTimeout(() => {
				lineItem.style.opacity = 0;
				lineItem.style.height = 0;
				lineItem.style.paddingTop = 0;
				lineItem.style.paddingBottom = 0;
				lineItem.style.marginTop = 0;
				lineItem.style.marginBottom = 0;
				setTimeout(() => lineItem.remove(), 400); 
			}, hideAfter * 1000);
		}
	}, 50);
}

function AddSubCardItem(element, elementID, platform, userId) {
	AddMessageItem(element, elementID, platform, userId, ['sub-card-li'], (li) => {
		const tryInitBorder = (canvas, wrapper, extension, retries = 5) => {
			if (!canvas || !wrapper) return;
			const w = wrapper.offsetWidth, h = wrapper.offsetHeight;
			if (w > 0 && h > 0) initBoilingBorder(canvas, w, h, extension);
			else if (retries > 0) setTimeout(() => tryInitBorder(canvas, wrapper, extension, retries - 1), 50);
		};

		const mainCanvas = li.querySelector('.sub-border-canvas');
		const mainWrapper = li.querySelector('.sub-card-wrapper');
		const commentWrapperEl = li.querySelector('.sub-comment-wrapper');
		const extension = (commentWrapperEl && commentWrapperEl.style.display !== 'none') ? 26 : 0;
		tryInitBorder(mainCanvas, mainWrapper, extension);

		const commentCanvas = li.querySelector('.sub-comment-border-canvas');
		if (commentCanvas && commentWrapperEl && commentWrapperEl.style.display !== 'none') tryInitBorder(commentCanvas, commentWrapperEl, 0);
	}); 
}

function GetBooleanParam(paramName, defaultValue) {
	const val = new URLSearchParams(window.location.search).get(paramName);
	if (val === null) return defaultValue;
	return val.toLowerCase() === 'true';
}

function GetIntParam(paramName) {
	const val = parseInt(new URLSearchParams(window.location.search).get(paramName), 10);
	return isNaN(val) ? null : val;
}

function GetCurrentTimeFormatted() {
	const now = new Date();
	let hours = now.getHours();
	const minutes = String(now.getMinutes()).padStart(2, '0');
	const ampm = hours >= 12 ? 'PM' : 'AM';
	hours = hours % 12; hours = hours ? hours : 12;
	return `${hours}:${minutes} ${ampm}`;
}

async function GetAvatar(username, providedUrl) {
	if (providedUrl) return providedUrl;
	return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4,c0aede,d1d4f9`;
}

function linkify(text) {
	return text.replace(/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig, '<a href="$1" target="_blank">$1</a>');
}

function FindFirstImageUrl(jsonObject) {
	function iterate(obj) {
		if (Array.isArray(obj)) {
			for (const item of obj) { const res = iterate(item); if (res) return res; }
			return null;
		}
		for (const key in obj) {
			if (obj.hasOwnProperty(key)) {
				if (key === 'imageUrl') return obj[key];
				if (typeof obj[key] === 'object' && obj[key] !== null) {
					const res = iterate(obj[key]); if (res) return res;
				}
			}
		}
		return null;
	}
	return iterate(jsonObject);
}

function IsImageUrl(url) {
	try {
		const { pathname } = new URL(url);
		return /\.(png|jpe?g|webp|gif)$/i.test(pathname);
	} catch (error) {
		return false;
	}
}

function IsThisUserAllowedToPostImagesOrNotReturnTrueIfTheyCanReturnFalseIfTheyCannot(targetPermissions, data, platform) {
	return GetPermissionLevel(data, platform) >= targetPermissions;
}

function GetPermissionLevel(data, platform) {
	switch (platform) {
		case 'twitch':
			if (data.message.role >= 4) return 40;
			else if (data.message.role >= 3) return 30;
			else if (data.message.role >= 2) return 20;
			else if (data.message.role >= 2 || data.message.subscriber) return 15;
			else return 10;
		case 'youtube':
			if (data.user.isOwner) return 40;
			else if (data.user.isModerator) return 30;
			else if (data.user.isSponsor) return 15;
			else return 10;
	}
}