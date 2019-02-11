const Discord = require('discord.js')
const client = new Discord.Client()
const { TOKEN, PREFIX, GOOGLE_API_KEY } = require('./config')
const ytdl = require('ytdl-core')
const YouTube = require('simple-youtube-api')

const youtube = new YouTube(GOOGLE_API_KEY)

const queue = new Map()

client.on('ready', function() {
    console.log('Connecté !')
    client.user.setActivity('de la musique !', { type : 'LISTENING' })
	client.user.setUsername('Bot-Music [FR]')
	//client.user.setGame('Locklear est', 'https://www.twitch.tv/locklear')
})

client.login(TOKEN)

client.on('message', message => {
	if(message.content === PREFIX + "help") {
		var embed = new Discord.RichEmbed()
			.setTitle('**Commande help**')
			.setColor('#ff0000')
			.addField(`${PREFIX}suppr`, '*Supprime 50 messages dans le salon où est utiliser la commande*')
			.addField(`${PREFIX}play`,'*Lance la musique*')
			.addField(`${PREFIX}stop`,'*Arrete la musique et déconnecte le bot du vocal*')
			.addField(`${PREFIX}volmume`,'*Choisis le volume du bot* (De base : 5)')
			.addField(`${PREFIX}skip`,'*Passe à la musique suivante*')
			.addField(`${PREFIX}np`,'*Sort le nom de la musique en cours de lecture*')
			.addField(`${PREFIX}queue`,'*Sort la playlist*')
			.addField(`${PREFIX}pause`,'*Fait pause a la lecture*')
			.addField(`${PREFIX}resume`,'*Relance la musique*')
			return message.channel.send(embed)
	}
})

client.on('message', message => {
    if (message.content === PREFIX + "suppr") {


      if (!message.channel.permissionsFor(message.author).hasPermission("MANAGE_MESSAGES")) {
        message.channel.sendMessage("Désoler mais vous n'avez pas la permissions d'utiliser cette commande \""+message.content+"\"");
        return;
      } else if (!message.channel.permissionsFor(client.user).hasPermission("MANAGE_MESSAGES")) {
        message.channel.sendMessage("Désoler mais vous n'avez pas la permissions d'utiliser cette commande \""+message.content+"\"");
        return;
      }
      if (message.channel.type == 'text') {
        message.channel.fetchMessages()
          .then(messages => {
			message.channel.bulkDelete(messages);
			message.channel.bulkDelete(messages.content);
            messagesDeleted = messages.array().length;
            message.channel.sendMessage("La suppression des messages a été un succès. Total des messages supprimés: "+messagesDeleted);
          })
          .catch(err => {
          })
      }
    }
})

client.on('message', async msg => { // eslint-disable-line
	if (msg.author.bot) return undefined;
	if (!msg.content.startsWith(PREFIX)) return undefined;

	const args = msg.content.split(' ');
	const searchString = args.slice(1).join(' ');
	const url = args[1] ? args[1].replace(/<(.+)>/g, '$1') : '';
	const serverQueue = queue.get(msg.guild.id);

	let command = msg.content.toLowerCase().split(' ')[0];
    command = command.slice(PREFIX.length)
    
    if(command === 'join') {
        const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('Je suis désoler mais vous devez être dans un salon vocal pour écouter la music !');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('Je ne peut pas rejoindre votre salon vocal, ai-je les droits pour le faire ?');
        }
        voiceChannel
           .join()
    }

	if (command === 'play') {
		const voiceChannel = msg.member.voiceChannel;
		if (!voiceChannel) return msg.channel.send('Je suis désoler mais vous devez être dans un salon vocal pour écouter la music !');
		const permissions = voiceChannel.permissionsFor(msg.client.user);
		if (!permissions.has('CONNECT')) {
			return msg.channel.send('Je ne peut pas rejoindre votre salon vocal, ai-je les droits pour le faire ?');
		}
		if (!permissions.has('SPEAK')) {
			return msg.channel.send('Je ne peut pas parler dans votre salon vocal, ai-je les droits pour le faire ?');
		}

		if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
			const playlist = await youtube.getPlaylist(url);
			const videos = await playlist.getVideos();
			for (const video of Object.values(videos)) {
				const video2 = await youtube.getVideoByID(video.id); // eslint-disable-line no-await-in-loop
				await handleVideo(video2, msg, voiceChannel, true); // eslint-disable-line no-await-in-loop
			}
			return msg.channel.send(`✅ Playlist: **${playlist.title}** a été ajouté à la file d'attente !`);
		} else {
			try {
				var video = await youtube.getVideo(url);
			} catch (error) {
				try {
					var videos = await youtube.searchVideos(searchString, 10);
					let index = 0;
					msg.channel.send(`
__**Séléctions de Musiques:**__
${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
Veuillez fournir une valeur pour sélectionner l'un des résultats de la recherche, allant de 1 à 10.
					`);
					// eslint-disable-next-line max-depth
					try {
						var response = await msg.channel.awaitMessages(msg2 => msg2.content > 0 && msg2.content < 11, {
							maxMatches: 1,
							time: 10000,
							errors: ['time']
						});
					} catch (err) {
						console.error(err);
						return msg.channel.send('Aucune valeur ou valeur invalide entrée, annulant la sélection de vidéo.');
					}
					const videoIndex = parseInt(response.first().content);
					var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
				} catch (err) {
					console.error(err);
					return msg.channel.send('🆘 Je n\'ai aucun résultat !');
				}
			}
			return handleVideo(video, msg, voiceChannel);
		}
	} else if (command === 'skip') {
		if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'êtes pas dans un salon vocal !');
		if (!serverQueue) return msg.channel.send('Il n\y a pas de musique donc je vais passer pour vous.');
		serverQueue.connection.dispatcher.end('Skip command has been used!');
		return undefined;
	} else if (command === 'stop') {
		if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'êtes pas dans un salon vocal !');
		if (!serverQueue) return msg.channel.send('Il n\y a pas de musique donc je vais passer pour vous.');
		serverQueue.songs = [];
		serverQueue.connection.dispatcher.end('Stop command has been used!');
		return undefined;
	} else if (command === 'volume') {
		if (!msg.member.voiceChannel) return msg.channel.send('Vous n\'êtes pas dans un salon vocal !');
		if (!serverQueue) return msg.channel.send('Il n\'y a aucun musique qui passe.');
		if (!args[1]) return msg.channel.send(`Le volume est à : **${serverQueue.volume}**`);
		serverQueue.volume = args[1];
		serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5);
		return msg.channel.send(`Je met le volume à : **${args[1]}**`);
	} else if (command === 'np') {
		if (!serverQueue) return msg.channel.send('Il n\'y a aucun musique qui passe.');
		return msg.channel.send(`🎶 Est entrain de passer : **${serverQueue.songs[0].title}**`);
	} else if (command === 'queue') {
		if (!serverQueue) return msg.channel.send('Il n\'y a aucun musique qui passe.');
		return msg.channel.send(`
__**Musique:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
**Est entrain de passer:** ${serverQueue.songs[0].title}
		`);
	} else if (command === 'pause') {
		if (serverQueue && serverQueue.playing) {
			serverQueue.playing = false;
			serverQueue.connection.dispatcher.pause();
			return msg.channel.send('⏸ Pause !');
		}
		return msg.channel.send('Il n\'y a aucun musique qui passe.');
	} else if (command === 'resume') {
		if (serverQueue && !serverQueue.playing) {
			serverQueue.playing = true;
			serverQueue.connection.dispatcher.resume();
			return msg.channel.send('▶ Resumed !');
		}
		return msg.channel.send('Il n\'y a aucun musique qui passe.');
	}

	return undefined;
});

async function handleVideo(video, msg, voiceChannel, playlist = false) {
	const serverQueue = queue.get(msg.guild.id);
	console.log(video);
	const song = {
		id: video.id,
		//title: Util.escapeMarkdown(video.title),
		url: `https://www.youtube.com/watch?v=${video.id}`
	};
	if (!serverQueue) {
		const queueConstruct = {
			textChannel: msg.channel,
			voiceChannel: voiceChannel,
			connection: null,
			songs: [],
			volume: 5,
			playing: true
		};
		queue.set(msg.guild.id, queueConstruct);

		queueConstruct.songs.push(song);

		try {
			var connection = await voiceChannel.join();
			queueConstruct.connection = connection;
			play(msg.guild, queueConstruct.songs[0]);
		} catch (error) {
			console.error(`Je ne peut pas rejoindre votre salon vocal : ${error}`);
			queue.delete(msg.guild.id);
			return msg.channel.send(`Je ne peut pas rejoindre votre salon vocal : ${error}`);
		}
	} else {
		serverQueue.songs.push(song);
		console.log(serverQueue.songs);
		if (playlist) return undefined;
		else return msg.channel.send(`✅ **${song.title}** a été ajouté dans la queue !`);
	}
	return undefined;
}

function play(guild, song) {
	const serverQueue = queue.get(guild.id);

	if (!song) {
		serverQueue.voiceChannel.leave();
		queue.delete(guild.id);
		return;
	}
	console.log(serverQueue.songs);

	const dispatcher = serverQueue.connection.playStream(ytdl(song.url))
		.on('end', reason => {
			if (reason === 'Stream is not generating quickly enough.') console.log('Song ended.');
			else console.log(reason);
			serverQueue.songs.shift();
			play(guild, serverQueue.songs[0]);
		})
		.on('error', error => console.error(error));
	dispatcher.setVolumeLogarithmic(serverQueue.volume / 5);

	serverQueue.textChannel.send(`🎶 Entrain de jouer : **${song.title}**`);
}
