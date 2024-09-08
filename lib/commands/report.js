import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'report',
    description: 'Report user',
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
        name: 'message',
        description: 'Additional information',
        type: 3,
        required: true,
        max_length: 500,
      },
      {
        name: 'reason',
        description: 'Report reason',
        type: 3,
        required: true,
        autocomplete: true,
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
    const channelId = interaction.channel_id;
    const settings = this.db.get(`guilds/${interaction.guild_id}/settings.json`, defaultSettings);
    const topics = settings.topics;
    const options = interaction.data.options;
    if (options == null) return;
    if (options.length < 3) return;
    const option0 = options[0];
    const option1 = options[1];
    const option2 = options[2];
    const user = option0.value;
    const reason = option2.value;
    const reporterMessage = truncate(option1.value, 500);
    if (option2.focused == true) {
      return await this.rest.createCompletionInteractionResponse(interaction, reason, topics);
    }
    if (settings.reportChannelId == null) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: `No channel set up for user reports. :levitate:` });
    }
    if (topics.indexOf(reason) == -1) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: `Reason \`${reason}\` does not exist. :empty_nest:` });
    }
    var msgs = await this.rest.getChannelMessages(channelId);
    if (msgs.code != null) {
      return this.rest.createEphemeralInteractionResponse(interaction, { content: 'Failed to scan messages in this channel. :mag_right: :face_with_monocle:' });
    }
    var lastMessage = null;
    for (const msg of msgs) {
      if (msg.webhook_id != null) continue;
      if (msg.author == null) continue;
      if (msg.author.id != user) continue;
      lastMessage = msg;
      break;
    }
    if (lastMessage == null) {
      return this.rest.createEphemeralInteractionResponse(interaction, { content: `Failed to find recent messages from <@${user}> in this channel, **try right clicking their message and reporting through the \`Apps\` section**. :mag_right: :face_with_monocle:` });
    }
    const reportMessageData = { content: `**<@${interaction.member.user.id}> reported <@${user}> for ${reason}.**\nLink to their last message during report: https://discord.com/channels/${interaction.guild_id}/${channelId}/${lastMessage.id}\nReporter message:\n>>> ${reporterMessage}`, 'allowed_mentions': { 'parse': [] } };
    const reportMessage = await this.rest.createMessage(settings.reportChannelId, reportMessageData);
    if (reportMessage.id == null) {
      return this.rest.createEphemeralInteractionResponse(interaction, { content: 'Failed to send report message. :no_entry_sign:' });
    }
    const reporter = interaction.member.user;
    var reporterName = reporter.username;
    if (reporter.discriminator != '0') reporterName += `#${reporter.discriminator}`;
    const offender = lastMessage.author;
    var offenderName = offender.username;
    if (offender.discriminator != '0') offenderName += `#${offender.discriminator}`;
    const resultResponse = await this.rest.createEphemeralInteractionResponse(interaction, { content: `Reported user <@${user}>. :mega:` });
    const offenderData = User.fromDB(this.db, `guilds/${interaction.guild_id}/users.json`, offender.id);
    const reporterData = User.fromDB(this.db, `guilds/${interaction.guild_id}/users.json`, reporter.id);
    offenderData.reportsReceivedCount += 1;
    reporterData.reportsSentCount += 1;
    const guildMember = await this.rest.getGuildMember(interaction.guild_id, offender.id);
    if (guildMember.code == 10007) {
      offenderData.alive = false;
    } else {
      offenderData.alive = true;
    }
    offenderData.save();
    reporterData.save();
    var topicThreads = this.db.get(`guilds/${interaction.guild_id}/topic_threads.json`, defaultThreads);
    var reporterThreads = this.db.get(`guilds/${interaction.guild_id}/reporter_threads.json`, defaultThreads);
    var offenderThreads = this.db.get(`guilds/${interaction.guild_id}/offender_threads.json`, defaultThreads);
    var topicThreadId = topicThreads.threads[reason];
    var reporterThreadId = reporterThreads.threads[reporter.id];
    var offenderThreadId = offenderThreads.threads[offender.id];
    if (topicThreadId != null) {
      const channel = await this.rest.getChannel(topicThreadId);
      var archived = false;
      if (channel.thread_metadata != null) {
        archived = channel.thread_metadata.archived;
      }
      if (archived || channel.id == null) {
        delete topicThreads.threads[reason];
        this.db.set(`guilds/${interaction.guild_id}/topic_threads.json`, topicThreads);
        topicThreadId = null;
      }
    }
    if (reporterThreadId != null) {
      const channel = await this.rest.getChannel(reporterThreadId);
      var archived = false;
      if (channel.thread_metadata != null) {
        archived = channel.thread_metadata.archived;
      }
      if (archived || channel.id == null) {
        delete reporterThreads.threads[reporter.id];
        this.db.set(`guilds/${interaction.guild_id}/reporter_threads.json`, reporterThreads);
        reporterThreadId = null;
      }
    }
    if (offenderThreadId != null) {
      const channel = await this.rest.getChannel(offenderThreadId);
      var archived = false;
      if (channel.thread_metadata != null) {
        archived = channel.thread_metadata.archived;
      }
      if (archived || channel.id == null) {
        delete offenderThreads.threads[offender.id];
        this.db.set(`guilds/${interaction.guild_id}/offender_threads.json`, offenderThreads);
        offenderThreadId = null;
      }
    }
    if (topicThreadId == null) {
      const topicThread = await this.rest.startThread(settings.reportChannelId, `🚩 [${reason}]`);
      if (topicThread.id != null) {
        topicThreadId = topicThread.id;
        topicThreads.threads[reason] = topicThreadId;
        this.db.set(`guilds/${interaction.guild_id}/topic_threads.json`, topicThreads);
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
    if (topicThreadId != null) {
      const message = await this.rest.createMessage(topicThreadId, reportMessageData);
    }
    if (reporterThreadId != null) {
      const message = await this.rest.createMessage(reporterThreadId, reportMessageData);
    }
    if (offenderThreadId != null) {
      const message = await this.rest.createMessage(offenderThreadId, reportMessageData);
    }
    return resultResponse;
  }

  async executeButton(interaction) {
    const customId = interaction.data.custom_id.split(' ');
    //
  }
}

export { commandSignatures, buttonSignatures, Command };
