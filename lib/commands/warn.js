import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'warn',
    description: 'Warn user',
    dm_permission: false,
    type: 1,
    options: [
      {
        name: 'user',
        description: 'Discord user',
        type: 6,
        required: true,
      },
      {
        name: 'reason',
        description: 'Warning reason and explanation',
        type: 3,
        required: true,
        max_length: 1000,
      },
    ],
  },
];

const buttonSignatures = [
/*
  {
    id: 'template',
  },
*/
];

class Command {
  rest;
  db;
  burstStackManager;

  constructor(options) {
    this.rest = options.rest;
    this.db = options.db;
    this.burstStackManager = options.burstStackManager;
  }

  async execute(interaction) {
    const settings = this.db.get(`guilds/${interaction.guild_id}/settings.json`, defaultSettings);
    if (!isAdmin(interaction.member) && interaction.member.roles.indexOf(settings.modRole) == -1) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: 'Permission denied. :lock:' } );
    }
    const options = interaction.data.options;
    if (options == null) return;
    if (options.length < 2) return;
    const option0 = options[0];
    const option1 = options[1];
    const user = option0.value;
    const reason = truncate(option1.value, 1000);
    if (settings.reportChannelId == null) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: `No channel set up for user reports. :levitate:` });
    }
    const offender = await this.rest.getUser(user);
    if (offender.id == null) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: `Failed to find <@${user}>. :levitate:` });
    }
    const guild = await this.rest.getGuild(interaction.guild_id);
    if (guild.name == null) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: `Failed to send warning to user. :no_bell:` });
    }
    var embed = buildEmbed({ title: `Official moderation warning received from ${guild.name}`, description: reason, thumbnail: { url: `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` } });
    embed.footer = undefined;
    const dmResponse = await this.rest.createDMMessage(user, { embeds: [ embed ] });
    if (dmResponse.id == null) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: `Failed to send warning to user. :no_bell:` });
    }
    const resultResponse = await this.rest.createEphemeralInteractionResponse(interaction, { content: `Warned user <@${user}>. :e_mail:` });
    const reportMessageData = { content: `**<@${interaction.member.user.id}> warned <@${user}>.**`, embeds: [ buildEmbed({ title: 'Warning sent', description: reason }) ], 'allowed_mentions': { 'parse': [] } };
    const reportMessage = await this.rest.createMessage(settings.reportChannelId, reportMessageData);
    const reporter = interaction.member.user;
    var reporterName = reporter.username;
    if (reporter.discriminator != '0') reporterName += `#${reporter.discriminator}`;
    var offenderName = offender.username;
    if (offender.discriminator != '0') offenderName += `#${offender.discriminator}`;
    const offenderData = User.fromDB(this.db, `guilds/${interaction.guild_id}/users.json`, offender.id);
    const reporterData = User.fromDB(this.db, `guilds/${interaction.guild_id}/users.json`, reporter.id);
    offenderData.warningsReceivedCount += 1;
    reporterData.warningsSentCount += 1;
    const guildMember = await this.rest.getGuild(interaction.guild_id, offender.id);
    if (guildMember.code == 10007) {
      offenderData.alive = false;
    } else {
      offenderData.alive = true;
    }
    offenderData.save();
    reporterData.save();
    var reporterThreads = this.db.get(`guilds/${interaction.guild_id}/reporter_threads.json`, defaultThreads);
    var offenderThreads = this.db.get(`guilds/${interaction.guild_id}/offender_threads.json`, defaultThreads);
    var reporterThreadId = reporterThreads.threads[reporter.id];
    var offenderThreadId = offenderThreads.threads[offender.id];
    if (reporterThreadId != null) {
      const channel = await this.rest.getChannel(reporterThreadId);
      if (channel.id == null) {
        delete reporterThreads.threads[reporter.id];
        this.db.set(`guilds/${interaction.guild_id}/reporter_threads.json`, reporterThreads);
        reporterThreadId = null;
      }
    }
    if (offenderThreadId != null) {
      const channel = await this.rest.getChannel(offenderThreadId);
      if (channel.id == null) {
        delete offenderThreads.threads[offender.id];
        this.db.set(`guilds/${interaction.guild_id}/offender_threads.json`, offenderThreads);
        offenderThreadId = null;
      }
    }
    if (reporterThreadId == null) {
      const reporterThread = await this.rest.startThread(settings.reportChannelId, `📣 Reporter - ${reporterName}`);
      if (reporterThread.id != null) {
        reporterThreadId = reporterThread.id;
        reporterThreads.threads[reporter.id] = reporterThreadId;
        this.db.set(`guilds/${interaction.guild_id}/reporter_threads.json`, reporterThreads);
      }
    }
    if (offenderThreadId == null) {
      const offenderThread = await this.rest.startThread(settings.reportChannelId, `🔴 Offender - ${offenderName}`);
      if (offenderThread.id != null) {
        offenderThreadId = offenderThread.id;
        offenderThreads.threads[offender.id] = offenderThreadId;
        this.db.set(`guilds/${interaction.guild_id}/offender_threads.json`, offenderThreads);
      }
    }
    if (reporterThreadId != null) {
      const message = await this.rest.createMessage(reporterThreadId, reportMessageData);
    }
    if (offenderThreadId != null) {
      const message = await this.rest.createMessage(offenderThreadId, reportMessageData);
    }
  }

  async executeButton(interaction) {
    const customId = interaction.data.custom_id.split(' ');
    //
  }
}

export { commandSignatures, buttonSignatures, Command };
