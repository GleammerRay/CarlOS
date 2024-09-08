import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'stats',
    description: 'Get user report summary',
    dm_permission: false,
    type: 1,
    options: [
      {
        name: 'user',
        dm_permission: false,
        description: 'Get user information',
        type: 1,
        default_member_permissions: '0',
        default_permission: false,
        options: [
          {
            name: 'user',
            description: 'Discord user',
            type: 6,
            required: true,
          },
        ],
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
    if (options.length < 1) return;
    const option0 = options[0];
    if (option0.name != 'user') return;
    const option0p0 = option0.options[0];
    const userId = option0p0.value;
    var user = User.fromDB(this.db, `guilds/${interaction.guild_id}/users.json`, userId);
    const guildMember = await this.rest.getGuildMember(interaction.guild_id, userId);
    if (guildMember.code == 10007) {
      if (user.alive) {
        user.alive = false;
        user.save();
      }
    } else {
      if (!user.alive) {
        user.alive = true;
        user.save();
      }
    }
    const reporterThreads = this.db.get(`guilds/${interaction.guild_id}/reporter_threads.json`, defaultThreads);
    const offenderThreads = this.db.get(`guilds/${interaction.guild_id}/offender_threads.json`, defaultThreads);
    const reporterThreadLink = reporterThreads.threads[userId];
    const offenderThreadLink = offenderThreads.threads[userId];
    return this.rest.createEphemeralInteractionResponse(interaction, { embeds: [ buildEmbed({ title: `User report summary.`, description: `${user.alive ? `Currently, <@${userId}> is a member of this server. :bust_in_silhouette:` : `Currently, <@${userId}> is not present in this server. :levitate:`}\n\n**:red_circle: Number of reports received against this user: ${user.reportsReceivedCount}**\n:mega: Number of reports sent against other members: ${user.reportsSentCount}\n:yellow_circle: Number of warnings received by this user: ${user.warningsReceivedCount}${user.warningsSentCount == 0 ? '' : `\n:crown: Number of warnings sent to other members: ${user.warningsSentCount}`}${ offenderThreadLink == reporterThreadLink ? '' : '\n'}${offenderThreadLink == null ? '' : `\n<#${offenderThreadLink}>`}${reporterThreadLink == null ? '' : `\n<#${reporterThreadLink}>`}` }) ], 'allowed_mentions': { 'parse': [] } });
  }

  async executeButton(interaction) {
    const customId = interaction.data.custom_id.split(' ');
    //
  }
}

export { commandSignatures, buttonSignatures, Command };
